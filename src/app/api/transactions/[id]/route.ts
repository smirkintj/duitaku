import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as {
    amount?: number
    date?: string
    type?: string
    merchant?: string
    note?: string
    categoryId?: string | null
    isRecurring?: boolean
  }

  const [updated] = await db
    .update(financeTransactions)
    .set({
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.merchant !== undefined && { merchant: body.merchant }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
    })
    .where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, userId)))
    .returning()

  return Response.json(updated)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params

  await db
    .delete(financeTransactions)
    .where(and(eq(financeTransactions.id, id), eq(financeTransactions.userId, userId)))

  return Response.json({ ok: true })
}
