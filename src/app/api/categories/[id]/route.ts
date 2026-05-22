import { db } from '@/db'
import { financeCategories } from '@/db/schema'
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
    name?: string
    icon?: string
    color?: string
    type?: string
    monthlyLimit?: number | null
  }

  const [updated] = await db
    .update(financeCategories)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.icon !== undefined && { icon: body.icon }),
      ...(body.color !== undefined && { color: body.color }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.monthlyLimit !== undefined && { monthlyLimit: body.monthlyLimit }),
    })
    .where(and(eq(financeCategories.id, id), eq(financeCategories.userId, userId)))
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
  await db.delete(financeCategories).where(and(eq(financeCategories.id, id), eq(financeCategories.userId, userId)))
  return Response.json({ ok: true })
}
