import { db } from '@/db'
import { financeSavingsGoals } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as { name?: string; targetAmount?: number | null; currentAmount?: number; color?: string; notes?: string }

  let targetAmount: number | null | undefined, currentAmount: number | undefined
  try {
    if (body.targetAmount != null) targetAmount = validateAmount(body.targetAmount, 'targetAmount')
    else if (body.targetAmount === null) targetAmount = null
    if (body.currentAmount !== undefined) currentAmount = validateAmount(body.currentAmount, 'currentAmount')
  } catch (e) { return validationError((e as Error).message) }

  const [updated] = await db.update(financeSavingsGoals).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(targetAmount !== undefined && { targetAmount }),
    ...(currentAmount !== undefined && { currentAmount }),
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
