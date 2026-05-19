import { db } from '@/db'
import { financeInvestments } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as {
    name?: string
    type?: string
    provider?: string
    costBasis?: number
    currentValue?: number
    currency?: string
    units?: number
    ticker?: string
    notes?: string
  }
  const [updated] = await db.update(financeInvestments).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.type !== undefined && { type: body.type }),
    ...(body.provider !== undefined && { provider: body.provider }),
    ...(body.costBasis !== undefined && { costBasis: body.costBasis }),
    ...(body.currentValue !== undefined && { currentValue: body.currentValue }),
    ...(body.currency !== undefined && { currency: body.currency }),
    ...(body.units !== undefined && { units: body.units }),
    ...(body.ticker !== undefined && { ticker: body.ticker }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }).where(eq(financeInvestments.id, id)).returning()
  return Response.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(financeInvestments).where(eq(financeInvestments.id, id))
  return Response.json({ ok: true })
}
