import { db } from '@/db'
import { financeTransactions, financeCategories } from '@/db/schema'
import { and, gte, lte, or, ilike, eq, desc } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const type = searchParams.get('type') ?? ''

  const filters = []

  if (q) {
    filters.push(or(
      ilike(financeTransactions.merchant, `%${q}%`),
      ilike(financeTransactions.note, `%${q}%`),
    ))
  }
  if (from) filters.push(gte(financeTransactions.date, from))
  if (to) filters.push(lte(financeTransactions.date, to))
  if (type === 'expense' || type === 'income') filters.push(eq(financeTransactions.type, type))

  const rows = await db
    .select({
      id: financeTransactions.id,
      amount: financeTransactions.amount,
      date: financeTransactions.date,
      type: financeTransactions.type,
      merchant: financeTransactions.merchant,
      note: financeTransactions.note,
      categoryId: financeTransactions.categoryId,
      isRecurring: financeTransactions.isRecurring,
    })
    .from(financeTransactions)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(financeTransactions.date))
    .limit(100)

  const categories = await db.select({ id: financeCategories.id, name: financeCategories.name, icon: financeCategories.icon }).from(financeCategories)
  const catMap = new Map(categories.map(c => [c.id, c]))

  const results = rows.map(r => ({
    ...r,
    categoryName: r.categoryId ? (catMap.get(r.categoryId)?.name ?? null) : null,
    categoryIcon: r.categoryId ? (catMap.get(r.categoryId)?.icon ?? null) : null,
  }))

  return Response.json(results)
}
