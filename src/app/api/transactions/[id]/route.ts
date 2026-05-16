import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    .where(eq(financeTransactions.id, id))
    .returning()

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  await db
    .delete(financeTransactions)
    .where(eq(financeTransactions.id, id))

  return Response.json({ ok: true })
}
