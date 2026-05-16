import { db } from '@/db'
import { financeCategories } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
    .where(eq(financeCategories.id, id))
    .returning()

  return Response.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await db.delete(financeCategories).where(eq(financeCategories.id, id))
  return Response.json({ ok: true })
}
