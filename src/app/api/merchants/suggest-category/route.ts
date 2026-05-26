import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, eq, isNotNull, desc, sql } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

// GET /api/merchants/suggest-category?q=<merchant>
// Returns the most frequently used categoryId for the given merchant name.
export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.toLowerCase().trim()
  if (!q) return Response.json({ categoryId: null })

  const rows = await db.select({
    categoryId: financeTransactions.categoryId,
    count: sql<number>`count(*)::int`,
  }).from(financeTransactions)
    .where(and(
      eq(financeTransactions.userId, userId),
      isNotNull(financeTransactions.categoryId),
      sql`lower(${financeTransactions.merchant}) = ${q}`,
    ))
    .groupBy(financeTransactions.categoryId)
    .orderBy(desc(sql`count(*)`))
    .limit(1)

  return Response.json({ categoryId: rows[0]?.categoryId ?? null })
}
