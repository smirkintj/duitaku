import { db } from '@/db'
import { financeBills } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as { name?: string; amount?: number; dueDay?: number; icon?: string; isActive?: boolean; paymentMethod?: string; accountId?: string | null }
  let amount: number | undefined
  if (body.amount !== undefined) {
    try { amount = validateAmount(body.amount) } catch (e) { return validationError((e as Error).message) }
  }
  const [updated] = await db.update(financeBills).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(amount !== undefined && { amount }),
    ...(body.dueDay !== undefined && { dueDay: body.dueDay }),
    ...(body.icon !== undefined && { icon: body.icon }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    ...(body.paymentMethod !== undefined && { paymentMethod: body.paymentMethod }),
    ...(body.accountId !== undefined && { accountId: body.accountId }),
  }).where(and(eq(financeBills.id, id), eq(financeBills.userId, userId))).returning()
  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  await db.delete(financeBills).where(and(eq(financeBills.id, id), eq(financeBills.userId, userId)))
  return Response.json({ ok: true })
}
