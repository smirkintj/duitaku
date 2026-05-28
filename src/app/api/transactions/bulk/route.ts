import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function PATCH(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { ids: string[]; categoryId: string | null }
  const { ids, categoryId } = body

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'ids must be a non-empty array' }, { status: 400 })
  }
  if (ids.length > 500) {
    return Response.json({ error: 'Too many ids (max 500)' }, { status: 400 })
  }

  await db
    .update(financeTransactions)
    .set({ categoryId: categoryId ?? null })
    .where(and(
      eq(financeTransactions.userId, userId),
      inArray(financeTransactions.id, ids),
    ))

  return Response.json({ updated: ids.length })
}
