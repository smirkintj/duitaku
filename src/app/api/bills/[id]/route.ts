import { db } from '@/db'
import { financeBills } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as { name?: string; amount?: number; dueDay?: number; icon?: string; isActive?: boolean }
  const [updated] = await db.update(financeBills).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.amount !== undefined && { amount: body.amount }),
    ...(body.dueDay !== undefined && { dueDay: body.dueDay }),
    ...(body.icon !== undefined && { icon: body.icon }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
  }).where(eq(financeBills.id, id)).returning()
  return Response.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(financeBills).where(eq(financeBills.id, id))
  return Response.json({ ok: true })
}
