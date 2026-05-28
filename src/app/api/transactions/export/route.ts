import { db } from '@/db'
import { financeTransactions, financeCategories, userSettings } from '@/db/schema'
import { and, eq, gte, lte } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { getPayCycle } from '@/lib/pay-cycle'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const url = new URL(request.url)
  const m = url.searchParams.get('m') ?? new Date().toISOString().slice(0, 7)

  const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId))
  const payDay = settings?.payDay ?? 1
  const cycle = getPayCycle(m, payDay)

  const [txs, cats] = await Promise.all([
    db.select().from(financeTransactions)
      .where(and(
        eq(financeTransactions.userId, userId),
        gte(financeTransactions.date, cycle.startDate),
        lte(financeTransactions.date, cycle.endDate),
      ))
      .orderBy(financeTransactions.date),
    db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
  ])

  const catMap = new Map(cats.map(c => [c.id, c.name]))

  const rows: string[][] = [
    ['Date', 'Merchant', 'Note', 'Category', 'Type', 'Amount (MYR)'],
    ...txs.map(tx => [
      tx.date,
      tx.merchant ?? '',
      tx.note ?? '',
      tx.categoryId ? (catMap.get(tx.categoryId) ?? '') : '',
      tx.type,
      tx.type === 'expense' ? `-${tx.amount.toFixed(2)}` : tx.amount.toFixed(2),
    ]),
  ]

  const csv = rows
    .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="duitaku-transactions-${m}.csv"`,
    },
  })
}
