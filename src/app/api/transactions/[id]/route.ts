import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { eq } from 'drizzle-orm'

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
