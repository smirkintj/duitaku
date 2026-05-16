import { db } from '@/db'
import { financeSavingsGoals } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as { name?: string; targetAmount?: number | null; currentAmount?: number; color?: string; notes?: string }
  const [updated] = await db.update(financeSavingsGoals).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.targetAmount !== undefined && { targetAmount: body.targetAmount }),
    ...(body.currentAmount !== undefined && { currentAmount: body.currentAmount }),
    ...(body.color !== undefined && { color: body.color }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }).where(eq(financeSavingsGoals.id, id)).returning()
  return Response.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(financeSavingsGoals).where(eq(financeSavingsGoals.id, id))
  return Response.json({ ok: true })
}
