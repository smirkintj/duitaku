import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary, financeBills, financeBillPayments, financeBnpl, financeSavingsGoals, financeAccounts, financeCcStatements, financeAiInsights, financeInvestments } from '@/db/schema'
import { and, gte, lte, desc, eq, inArray } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { fetchGoldInsight } from '@/lib/market-data'

interface CoachData {
  focus: { area: string; verdict: string; detail: string }
  summary: string
  bullets: { tone: string; text: string }[]
  plan: { step: number; title: string; amount: number; status: string; note: string }[]
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month')
  if (!month) return Response.json({ error: 'month required' }, { status: 400 })

  const rows = await db.select().from(financeAiInsights).where(and(eq(financeAiInsights.userId, userId), eq(financeAiInsights.month, month))).limit(1)
  if (rows.length === 0) return Response.json({ stored: null })

  return Response.json({
    stored: JSON.parse(rows[0].data) as CoachData,
    generatedAt: rows[0].generatedAt,
  })
}

function monthRange(month: string): { start: string; end: string } {
  const [year, mo] = month.split('-').map(Number)
  const start = `${year}-${String(mo).padStart(2, '0')}-01`
  const end = `${year}-${String(mo).padStart(2, '0')}-31`
  return { start, end }
}

function prevMonths(month: string, n: number): { start: string; end: string }[] {
  const [year, mo] = month.split('-').map(Number)
  const ranges = []
  for (let i = 1; i <= n; i++) {
    let m = mo - i
    let y = year
    while (m < 1) { m += 12; y-- }
    const start = `${y}-${String(m).padStart(2, '0')}-01`
    const end = `${y}-${String(m).padStart(2, '0')}-31`
    ranges.push({ start, end })
  }
  return ranges
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ noApiKey: true })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const body = await request.json() as { month: string }
  const { month } = body

  const { start, end } = monthRange(month)

  // Fetch all data in parallel (including live gold price for market context)
  const prior3 = prevMonths(month, 3)
  const [goldInsight, [salary, currentTxs, categories, bills, billPayments, bnplPlans, savingsGoals, accounts, investments]] = await Promise.all([
    fetchGoldInsight(),
    Promise.all([
    db.select().from(financeSalary).where(eq(financeSalary.userId, userId)).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(financeTransactions)
      .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, start), lte(financeTransactions.date, end))),
    db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeBillPayments).where(eq(financeBillPayments.month, month)),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
    db.select().from(financeSavingsGoals).where(eq(financeSavingsGoals.userId, userId)),
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
    db.select().from(financeInvestments).where(eq(financeInvestments.userId, userId)),
  ]),
  ])

  const priorTxsArr = await Promise.all(
    prior3.map(({ start: s, end: e }) =>
      db.select().from(financeTransactions)
        .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, s), lte(financeTransactions.date, e)))
    )
  )

  // CC statements for this month
  const ccAccounts = accounts.filter((a) => a.type === 'credit')
  const ccIds = ccAccounts.map((a) => a.id)
  const ccStatements = ccIds.length > 0
    ? await db.select().from(financeCcStatements).where(inArray(financeCcStatements.accountId, ccIds))
    : []

  const salaryAmount = salary[0]?.amount ?? 0

  // Transactions
  const spent = currentTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
  const income = currentTxs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)

  const catSummaries = categories.map((cat) => {
    const catSpent = currentTxs
      .filter((t) => t.categoryId === cat.id && t.type === 'expense')
      .reduce((a, t) => a + t.amount, 0)
    const priorSpent = priorTxsArr.map((txs) =>
      txs.filter((t) => t.categoryId === cat.id && t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    )
    const avg = priorSpent.reduce((a, b) => a + b, 0) / (priorSpent.length || 1)
    return { name: cat.name, spent: catSpent, prior3moAvg: avg, budget: cat.monthlyLimit }
  }).filter((c) => c.spent > 0)

  // Bills — financeBillPayments has no userId, derive security from billIds belonging to the user
  const userBillIds = new Set(bills.map((b) => b.id))
  const paidBillIds = new Set(billPayments.filter((p) => userBillIds.has(p.billId)).map((p) => p.billId))
  const billsSummary = bills.map((b) => ({
    name: b.name,
    amount: b.amount,
    paid: paidBillIds.has(b.id),
  }))
  const totalBillsCommitment = bills.reduce((a, b) => a + b.amount, 0)
  const totalBillsPaid = billsSummary.filter((b) => b.paid).reduce((a, b) => a + b.amount, 0)
  const totalBillsUnpaid = billsSummary.filter((b) => !b.paid).reduce((a, b) => a + b.amount, 0)

  // BNPL — only count plans whose installment window covers the current month
  function monthIndex(m: string) {
    const [y, mo] = m.split('-').map(Number)
    return y * 12 + mo
  }
  const currentIdx = monthIndex(month)

  const bnplSummary = bnplPlans.map((p) => {
    const startIdx = monthIndex(p.startMonth)
    const endIdx = startIdx + p.totalInstallments - 1
    const activeThisMonth = currentIdx >= startIdx && currentIdx <= endIdx
    const installmentNumber = activeThisMonth ? currentIdx - startIdx + 1 : null
    const remaining = p.totalInstallments - p.paidInstallments
    const monthsUntilStart = startIdx > currentIdx ? startIdx - currentIdx : 0
    return {
      merchant: p.merchant,
      provider: p.provider,
      installmentAmount: p.installmentAmount,
      totalInstallments: p.totalInstallments,
      remainingInstallments: remaining,
      remainingTotal: remaining * p.installmentAmount,
      startMonth: p.startMonth,
      activeThisMonth,
      installmentNumber,
      monthsUntilStart,
    }
  })
  const totalMonthlyBnpl = bnplSummary.filter(p => p.activeThisMonth).reduce((a, p) => a + p.installmentAmount, 0)

  // CC
  const ccSummary = ccAccounts.map((a) => {
    const latestStmt = ccStatements
      .filter((s) => s.accountId === a.id)
      .sort((x, y) => y.month.localeCompare(x.month))[0]
    const utilPct = a.creditLimit && a.currentOutstanding != null
      ? Math.round((a.currentOutstanding / a.creditLimit) * 100)
      : null
    return {
      name: a.name,
      creditLimit: a.creditLimit,
      outstanding: a.currentOutstanding,
      utilisationPct: utilPct,
      latestStatementAmount: latestStmt?.statementAmount ?? null,
      minimumPayment: latestStmt?.minimumPayment ?? null,
      unpaidAmount: latestStmt ? latestStmt.statementAmount - latestStmt.paidAmount : null,
    }
  })
  const totalCcOutstanding = ccAccounts.reduce((a, c) => a + (c.currentOutstanding ?? 0), 0)

  // Savings goals
  const savingsSummary = savingsGoals.map((g) => ({
    name: g.name,
    target: g.targetAmount,
    current: g.currentAmount,
    pct: g.targetAmount ? Math.round((g.currentAmount / g.targetAmount) * 100) : null,
  }))

  const totalInvestmentValue = investments.reduce((a, i) => a + i.currentValue, 0)
  const totalInvestmentCost = investments.reduce((a, i) => a + i.costBasis, 0)
  const investmentGainLoss = totalInvestmentValue - totalInvestmentCost
  const investmentGainPct = totalInvestmentCost > 0 ? ((investmentGainLoss / totalInvestmentCost) * 100).toFixed(1) : null
  const investmentSummary = investments.map((i) => {
    const gl = i.currentValue - i.costBasis
    const glPct = i.costBasis > 0 ? ((gl / i.costBasis) * 100).toFixed(1) : null
    return `- ${i.name} (${i.type}${i.provider ? ` / ${i.provider}` : ''}): RM ${i.currentValue.toFixed(2)} current value, cost RM ${i.costBasis.toFixed(2)}${glPct ? `, ${Number(glPct) >= 0 ? '+' : ''}${glPct}% return` : ''}`
  })

  const savingsRate = salaryAmount > 0 ? Math.round(((salaryAmount - spent - totalBillsCommitment - totalMonthlyBnpl) / salaryAmount) * 100) : 0
  const debtToIncome = salaryAmount > 0 ? Math.round(((totalBillsCommitment + totalMonthlyBnpl + totalCcOutstanding / 12) / salaryAmount) * 100) : 0

  const prompt = `You are an AI financial coach for a Malaysian. Analyze this personal finance data for ${month} and give focused, honest, actionable insights. Be direct — point out real issues or real wins, not generic advice.

INCOME & EXPENSES:
- Monthly salary: RM ${salaryAmount.toFixed(2)}
- Variable spending this month: RM ${spent.toFixed(2)} (${salaryAmount > 0 ? Math.round((spent / salaryAmount) * 100) : 0}% of salary)
- Fixed commitments (bills + BNPL): RM ${(totalBillsCommitment + totalMonthlyBnpl).toFixed(2)}
- Estimated savings rate: ${savingsRate}%
- Debt-to-income ratio (monthly): ${debtToIncome}%

SPENDING BY CATEGORY (vs 3-month average):
${catSummaries.map((c) => {
  const change = c.prior3moAvg > 0 ? Math.round(((c.spent - c.prior3moAvg) / c.prior3moAvg) * 100) : null
  const overBudget = c.budget && c.spent > c.budget ? ` — OVER BUDGET by RM ${(c.spent - c.budget).toFixed(2)}` : ''
  return `- ${c.name}: RM ${c.spent.toFixed(2)}${change !== null ? ` (${change > 0 ? '+' : ''}${change}% vs avg)` : ''}${overBudget}`
}).join('\n') || '- No spending data'}

BILLS & COMMITMENTS (RM ${totalBillsCommitment.toFixed(2)}/month):
${billsSummary.map((b) => `- ${b.name}: RM ${b.amount.toFixed(2)} — ${b.paid ? 'paid' : 'UNPAID'}`).join('\n') || '- None'}
Unpaid this month: RM ${totalBillsUnpaid.toFixed(2)}

BNPL (RM ${totalMonthlyBnpl.toFixed(2)} due this month):
${bnplSummary.filter(p => p.activeThisMonth).map((p) => `- ${p.merchant}: RM ${p.installmentAmount.toFixed(2)} (${p.installmentNumber}/${p.totalInstallments}, RM ${p.remainingTotal.toFixed(2)} left)`).join('\n') || '- None active'}

CREDIT CARDS (total outstanding: RM ${totalCcOutstanding.toFixed(2)}):
${ccSummary.map((c) => `- ${c.name}: RM ${(c.outstanding ?? 0).toFixed(2)} outstanding${c.utilisationPct !== null ? `, ${c.utilisationPct}% utilised` : ''}${c.unpaidAmount && c.unpaidAmount > 0 ? `, RM ${c.unpaidAmount.toFixed(2)} unpaid on last statement` : ''}`).join('\n') || '- No credit cards'}

INVESTMENTS (total: RM ${totalInvestmentValue.toFixed(2)}, ${investmentGainPct !== null ? `${Number(investmentGainPct) >= 0 ? '+' : ''}${investmentGainPct}% overall return` : 'no cost basis set'}):
${investmentSummary.join('\n') || '- No investments recorded'}
Investment-to-salary ratio: ${salaryAmount > 0 ? (totalInvestmentValue / salaryAmount).toFixed(1) : 'n/a'}x monthly salary
${goldInsight ? `
LIVE MARKET CONTEXT (gold spot price fetched now):
- Gold: RM ${goldInsight.priceMYR.toFixed(2)}/g (USD ${goldInsight.priceUSD.toFixed(0)}/oz), USD/MYR ${goldInsight.usdmyr.toFixed(4)}
- 30-day range: RM ${goldInsight.low30d.toFixed(2)} – RM ${goldInsight.high30d.toFixed(2)}
- 30-day change: ${goldInsight.change30d >= 0 ? '+' : ''}${goldInsight.change30d.toFixed(2)}%
- Signal: ${goldInsight.signal.toUpperCase()} — ${goldInsight.signalReason}
Use this to comment on gold investments if the user holds any, or suggest gold as an option if they have excess savings.` : ''}

SAVINGS GOALS:
${savingsSummary.map((g) => `- ${g.name}: RM ${g.current.toFixed(2)}${g.target ? ` / RM ${g.target.toFixed(2)} (${g.pct}%)` : ''}`).join('\n') || '- None set'}

Identify the single most important area needing attention or praise (e.g. "Overspending", "Savings Rate", "CC Debt", "Investment Growth", "Budget Discipline").

Return ONLY a JSON object, no other text, no emojis:
{
  "focus": {
    "area": "one short label, e.g. Savings Rate",
    "verdict": "one word: Critical | Warning | Good | Excellent",
    "detail": "one sentence explaining why this is the focus"
  },
  "summary": "2 sentences max. Lead with the most important number or finding.",
  "bullets": [
    { "tone": "warn|ok|tip", "text": "specific, number-backed insight" }
  ],
  "plan": [
    { "step": 1, "title": "action title", "amount": 0, "status": "Done|Recommended|Optional", "note": "brief note" }
  ]
}

Rules: 3-5 bullets, 3-4 plan steps. Every bullet must reference a specific RM amount or %. Investments must appear in at least one bullet or plan step. No generic advice like "track your spending".`

  let message
  try {
    message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg }, { status: 502 })
  }

  const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}'
  // Strip any emoji characters the model might still include
  const responseText = rawText.replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim()

  let data: CoachData
  try {
    data = JSON.parse(responseText)
  } catch {
    const match = responseText.match(/\{[\s\S]*\}/)
    if (!match) {
      return Response.json({ error: 'Failed to parse response' }, { status: 500 })
    }
    data = JSON.parse(match[0])
  }

  // Upsert: delete old row for this month/user then insert fresh
  await db.delete(financeAiInsights).where(and(eq(financeAiInsights.userId, userId), eq(financeAiInsights.month, month)))
  const [saved] = await db.insert(financeAiInsights).values({
    userId,
    month,
    data: JSON.stringify(data),
  }).returning()

  return Response.json({ ...data, generatedAt: saved.generatedAt })
}
