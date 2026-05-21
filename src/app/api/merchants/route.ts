import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, gte, lte, eq } from 'drizzle-orm'
import { getPayCycle, prevCycleMonth } from '@/lib/pay-cycle'

function shiftDate(d: string, days: number): string {
  const dt = new Date(d); dt.setDate(dt.getDate() + days); return dt.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const baseMonth = searchParams.get('m') ?? ''
  const payDay = parseInt(searchParams.get('payDay') ?? '1', 10)

  if (!baseMonth) return Response.json({ error: 'm required' }, { status: 400 })

  const current = getPayCycle(baseMonth, payDay)
  const prev1 = getPayCycle(prevCycleMonth(baseMonth), payDay)
  const prev2 = getPayCycle(prevCycleMonth(prevCycleMonth(baseMonth)), payDay)
  const prev3 = getPayCycle(prevCycleMonth(prevCycleMonth(prevCycleMonth(baseMonth))), payDay)

  // Fetch last 4 cycles of expense transactions
  const rangeStart = shiftDate(prev3.startDate, -1)
  const rangeEnd = shiftDate(current.endDate, 1)

  const rows = await db
    .select({ amount: financeTransactions.amount, date: financeTransactions.date, merchant: financeTransactions.merchant })
    .from(financeTransactions)
    .where(and(
      gte(financeTransactions.date, rangeStart),
      lte(financeTransactions.date, rangeEnd),
      eq(financeTransactions.type, 'expense'),
    ))

  function sumInCycle(cycle: { startDate: string; endDate: string }) {
    return rows.filter(r => r.date >= cycle.startDate && r.date <= cycle.endDate)
  }

  // Group by normalised merchant name
  const merchantMap = new Map<string, { total: number; count: number; prev1: number; prev3avg: number }>()

  const currentRows = sumInCycle(current)
  const prev1Rows = sumInCycle(prev1)
  const prev2Rows = sumInCycle(prev2)
  const prev3Rows = sumInCycle(prev3)

  function aggregate(txs: typeof rows) {
    const m = new Map<string, number>()
    for (const r of txs) {
      const key = (r.merchant ?? 'Unknown').trim()
      m.set(key, (m.get(key) ?? 0) + r.amount)
    }
    return m
  }

  const curMap = aggregate(currentRows)
  const p1Map = aggregate(prev1Rows)
  const p2Map = aggregate(prev2Rows)
  const p3Map = aggregate(prev3Rows)

  // Count cycles per merchant (for active-months average)
  for (const [name, total] of curMap.entries()) {
    const p1 = p1Map.get(name) ?? 0
    const p2 = p2Map.get(name) ?? 0
    const p3 = p3Map.get(name) ?? 0
    const activeCycles = [p1, p2, p3].filter(v => v > 0).length
    const prev3avg = activeCycles > 0 ? (p1 + p2 + p3) / activeCycles : 0
    merchantMap.set(name, { total, count: currentRows.filter(r => (r.merchant ?? 'Unknown').trim() === name).length, prev1: p1, prev3avg })
  }

  const results = Array.from(merchantMap.entries())
    .map(([name, d]) => ({
      merchant: name,
      total: d.total,
      count: d.count,
      prev1: d.prev1,
      prev3avg: d.prev3avg,
      trend: d.prev3avg > 0 ? (d.total - d.prev3avg) / d.prev3avg : null,
    }))
    .sort((a, b) => b.total - a.total)

  return Response.json({ merchants: results, cycle: current })
}
