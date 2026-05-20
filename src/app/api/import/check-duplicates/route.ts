import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, gte, lte, eq } from 'drizzle-orm'

interface IncomingTx {
  _id: number
  date: string
  merchant: string
  amount: number
  importHash: string
}

// Returns a set of _id values that appear to already be recorded.
// Two checks:
//   1. Exact importHash match (same date+merchant+amount)
//   2. Fuzzy: same amount + date within 7 days + any existing transaction
//      (catches bill-paid transactions whose date slightly differs from the PDF)
export async function POST(request: Request) {
  const { transactions } = await request.json() as { transactions: IncomingTx[] }
  if (!transactions.length) return Response.json({ duplicateIds: [] })

  // Date range covering all incoming transactions ±7 days
  const dates = transactions.map(t => t.date).sort()
  const rangeStart = shiftDate(dates[0], -7)
  const rangeEnd = shiftDate(dates[dates.length - 1], 7)

  const existing = await db
    .select({
      amount: financeTransactions.amount,
      date: financeTransactions.date,
      importHash: financeTransactions.importHash,
    })
    .from(financeTransactions)
    .where(and(
      gte(financeTransactions.date, rangeStart),
      lte(financeTransactions.date, rangeEnd),
      eq(financeTransactions.type, 'expense'),
    ))

  const existingHashes = new Set(existing.map(e => e.importHash).filter(Boolean))

  const duplicateIds: number[] = []

  for (const tx of transactions) {
    // Check 1: exact hash match
    if (existingHashes.has(tx.importHash)) {
      duplicateIds.push(tx._id)
      continue
    }

    // Check 2: same amount, date within 7 days
    const txTime = new Date(tx.date).getTime()
    const fuzzy = existing.find(e => {
      if (Math.abs(e.amount - tx.amount) > 0.01) return false
      const diff = Math.abs(new Date(e.date).getTime() - txTime)
      return diff <= 7 * 24 * 60 * 60 * 1000
    })
    if (fuzzy) duplicateIds.push(tx._id)
  }

  return Response.json({ duplicateIds })
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
