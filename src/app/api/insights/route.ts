import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary } from '@/db/schema'
import { and, gte, lte, desc } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

// Simple in-memory cache keyed by month
const cache = new Map<string, { data: CoachData; ts: number }>()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour

interface CoachData {
  summary: string
  bullets: { tone: string; text: string }[]
  plan: { step: number; title: string; amount: number; status: string; note: string }[]
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ noApiKey: true })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const body = await request.json() as { month: string }
  const { month } = body

  // Check cache
  const cached = cache.get(month)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return Response.json(cached.data)
  }

  const { start, end } = monthRange(month)

  // Fetch data in parallel
  const [salary, currentTxs, categories] = await Promise.all([
    db.select().from(financeSalary).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(financeTransactions)
      .where(and(gte(financeTransactions.date, start), lte(financeTransactions.date, end))),
    db.select().from(financeCategories),
  ])

  // Fetch prior 3 months transactions
  const prior3 = prevMonths(month, 3)
  const priorTxsArr = await Promise.all(
    prior3.map(({ start: s, end: e }) =>
      db.select().from(financeTransactions)
        .where(and(gte(financeTransactions.date, s), lte(financeTransactions.date, e)))
    )
  )

  const salaryAmount = salary[0]?.amount ?? 0

  // Build context
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

  const prompt = `You are an AI financial coach. Analyze this personal finance data and provide actionable insights.

Month: ${month}
Monthly Salary: RM ${salaryAmount.toFixed(2)}
Total Spent: RM ${spent.toFixed(2)}
Total Income Received: RM ${income.toFixed(2)}
Remaining: RM ${Math.max(0, salaryAmount - spent).toFixed(2)}

Category Breakdown:
${catSummaries.map((c) => `- ${c.name}: RM ${c.spent.toFixed(2)} spent (budget: ${c.budget ? `RM ${c.budget}` : 'none'}, 3mo avg: RM ${c.prior3moAvg.toFixed(2)})`).join('\n')}

Return ONLY a JSON object with this structure, no other text:
{
  "summary": "2-3 sentence overview of the month",
  "bullets": [
    { "tone": "warn|ok|tip", "text": "bullet point" }
  ],
  "plan": [
    { "step": 1, "title": "action title", "amount": 0, "status": "Done|Recommended|Optional", "note": "brief note" }
  ]
}

Provide 3-4 bullets and 3-4 plan steps. Be specific with amounts and percentages.`

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

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}'

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

  cache.set(month, { data, ts: Date.now() })

  return Response.json(data)
}
