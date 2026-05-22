import { db } from '@/db'
import { financeSavingsGoals } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as { name?: string; targetAmount?: number | null; currentAmount?: number; color?: string; notes?: string }
  const [updated] = await db.update(financeSavingsGoals).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.targetAmount !== undefined && { targetAmount: body.targetAmount }),
    ...(body.currentAmount !== undefined && { currentAmount: body.currentAmount }),
    ...(body.color !== undefined && { color: body.color }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }).where(and(eq(financeSavingsGoals.id, id), eq(financeSavingsGoals.userId, userId))).returning()
  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  await db.delete(financeSavingsGoals).where(and(eq(financeSavingsGoals.id, id), eq(financeSavingsGoals.userId, userId)))
  return Response.json({ ok: true })
}
