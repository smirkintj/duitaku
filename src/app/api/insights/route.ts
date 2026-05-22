import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary, financeBills, financeBillPayments, financeBnpl, financeSavingsGoals, financeAccounts, financeCcStatements, financeAiInsights } from '@/db/schema'
import { and, gte, lte, desc, eq, inArray } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

interface CoachData {
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

  // Fetch all data in parallel
  const prior3 = prevMonths(month, 3)
  const [salary, currentTxs, categories, bills, billPayments, bnplPlans, savingsGoals, accounts] = await Promise.all([
    db.select().from(financeSalary).where(eq(financeSalary.userId, userId)).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(financeTransactions)
      .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, start), lte(financeTransactions.date, end))),
    db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeBillPayments).where(eq(financeBillPayments.month, month)),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
    db.select().from(financeSavingsGoals).where(eq(financeSavingsGoals.userId, userId)),
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
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

  const prompt = `You are an AI financial coach for a Malaysian. Analyze this comprehensive personal finance data and provide actionable insights.

Month: ${month}
Monthly Salary: RM ${salaryAmount.toFixed(2)}
Total Expenses Recorded: RM ${spent.toFixed(2)}
Total Income Received: RM ${income.toFixed(2)}
Remaining (after expenses): RM ${Math.max(0, salaryAmount - spent).toFixed(2)}

SPENDING BY CATEGORY:
${catSummaries.map((c) => `- ${c.name}: RM ${c.spent.toFixed(2)} spent (budget: ${c.budget ? `RM ${c.budget}` : 'none'}, 3mo avg: RM ${c.prior3moAvg.toFixed(2)})`).join('\n') || '- No category data'}

MONTHLY BILLS & COMMITMENTS (total commitment: RM ${totalBillsCommitment.toFixed(2)}):
${billsSummary.length > 0 ? billsSummary.map((b) => `- ${b.name}: RM ${b.amount.toFixed(2)} — ${b.paid ? 'PAID' : 'UNPAID'}`).join('\n') : '- No bills configured'}
Paid: RM ${totalBillsPaid.toFixed(2)} | Still unpaid this month: RM ${totalBillsUnpaid.toFixed(2)}

BNPL / INSTALLMENTS (this month's commitment: RM ${totalMonthlyBnpl.toFixed(2)}):
${bnplSummary.length > 0 ? bnplSummary.map((p) => {
  if (!p.activeThisMonth && p.monthsUntilStart > 0) {
    return `- ${p.merchant} (${p.provider}): starts in ${p.monthsUntilStart} month(s) — RM ${p.installmentAmount.toFixed(2)}/month for ${p.totalInstallments} installments (NOT due this month)`
  }
  return `- ${p.merchant} (${p.provider}): installment ${p.installmentNumber}/${p.totalInstallments} due this month — RM ${p.installmentAmount.toFixed(2)}, ${p.remainingInstallments} installments left (RM ${p.remainingTotal.toFixed(2)} total remaining)`
}).join('\n') : '- No BNPL plans'}

CREDIT CARDS:
${ccSummary.length > 0 ? ccSummary.map((c) => `- ${c.name}: outstanding RM ${(c.outstanding ?? 0).toFixed(2)}${c.creditLimit ? ` / RM ${c.creditLimit.toFixed(2)} limit (${c.utilisationPct}% utilised)` : ''}${c.latestStatementAmount ? `, latest statement RM ${c.latestStatementAmount.toFixed(2)}` : ''}${c.unpaidAmount && c.unpaidAmount > 0 ? `, RM ${c.unpaidAmount.toFixed(2)} unpaid` : ''}`).join('\n') : '- No credit cards configured'}
Total CC outstanding: RM ${totalCcOutstanding.toFixed(2)}

SAVINGS GOALS:
${savingsSummary.length > 0 ? savingsSummary.map((g) => `- ${g.name}: RM ${g.current.toFixed(2)}${g.target ? ` / RM ${g.target.toFixed(2)} (${g.pct}%)` : ' (no target set)'}`).join('\n') : '- No savings goals configured'}

TOTAL FIXED MONTHLY OUTFLOWS: RM ${(totalBillsCommitment + totalMonthlyBnpl).toFixed(2)} (bills + BNPL installments)

Return ONLY a JSON object with this structure, no other text. Do not use any emojis anywhere in the response:
{
  "summary": "2-3 sentence overview of the month",
  "bullets": [
    { "tone": "warn|ok|tip", "text": "bullet point" }
  ],
  "plan": [
    { "step": 1, "title": "action title", "amount": 0, "status": "Done|Recommended|Optional", "note": "brief note" }
  ]
}

Provide 3-4 bullets and 3-4 plan steps. Be specific with amounts and percentages. No emojis.`

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
