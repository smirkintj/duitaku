import { db } from '@/db'
import { financeTransactions, financeCategories } from '@/db/schema'
import { and, gte, lte, or, ilike, eq, desc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const type = searchParams.get('type') ?? ''

  const filters: ReturnType<typeof eq>[] = [eq(financeTransactions.userId, userId)]

  if (q) {
    filters.push(or(
      ilike(financeTransactions.merchant, `%${q}%`),
      ilike(financeTransactions.note, `%${q}%`),
    ) as ReturnType<typeof eq>)
  }
  if (from) filters.push(gte(financeTransactions.date, from) as ReturnType<typeof eq>)
  if (to) filters.push(lte(financeTransactions.date, to) as ReturnType<typeof eq>)
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
    .where(and(...filters))
    .orderBy(desc(financeTransactions.date))
    .limit(100)

  const categories = await db.select({ id: financeCategories.id, name: financeCategories.name, icon: financeCategories.icon }).from(financeCategories).where(eq(financeCategories.userId, userId))
  const catMap = new Map(categories.map(c => [c.id, c]))

  const results = rows.map(r => ({
    ...r,
    categoryName: r.categoryId ? (catMap.get(r.categoryId)?.name ?? null) : null,
    categoryIcon: r.categoryId ? (catMap.get(r.categoryId)?.icon ?? null) : null,
  }))

  return Response.json(results)
}
