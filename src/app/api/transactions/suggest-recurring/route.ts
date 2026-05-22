import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, eq, gte } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

interface Suggestion {
  merchant: string
  amount: number
  occurrences: number
  lastDate: string
  transactionIds: string[]
}

// Look back 90 days and find merchants that appear 2+ times with same amount.
// Only surfaces expenses not already marked recurring.
export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const since = cutoff.toISOString().slice(0, 10)

  const rows = await db
    .select({
      id: financeTransactions.id,
      merchant: financeTransactions.merchant,
      amount: financeTransactions.amount,
      date: financeTransactions.date,
      isRecurring: financeTransactions.isRecurring,
    })
    .from(financeTransactions)
    .where(and(
      eq(financeTransactions.userId, userId),
      gte(financeTransactions.date, since),
      eq(financeTransactions.type, 'expense'),
      eq(financeTransactions.isRecurring, false),
    ))

  // Group by merchant+amount (round to 2dp to handle float noise)
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    if (!r.merchant) continue
    const key = `${r.merchant.trim().toLowerCase()}::${r.amount.toFixed(2)}`
    const g = groups.get(key) ?? []
    g.push(r)
    groups.set(key, g)
  }

  const suggestions: Suggestion[] = []
  for (const [, txs] of groups) {
    if (txs.length < 2) continue
    // Check that occurrences span at least 20 days (rules out same-day duplicates)
    const dates = txs.map(t => t.date).sort()
    const spanDays = Math.round(
      (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000
    )
    if (spanDays < 20) continue

    const rep = txs[0]
    suggestions.push({
      merchant: rep.merchant!.trim(),
      amount: rep.amount,
      occurrences: txs.length,
      lastDate: dates[dates.length - 1],
      transactionIds: txs.map(t => t.id),
    })
  }

  suggestions.sort((a, b) => b.occurrences - a.occurrences || b.amount - a.amount)

  return Response.json({ suggestions })
}

// PATCH: mark all transactions in a group as recurring
export async function PATCH(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { transactionIds, isRecurring } = await request.json() as { transactionIds: string[]; isRecurring: boolean }
  const { inArray } = await import('drizzle-orm')
  await db.update(financeTransactions).set({ isRecurring }).where(
    and(inArray(financeTransactions.id, transactionIds), eq(financeTransactions.userId, userId))
  )
  return Response.json({ ok: true })
}
