import { db } from '@/db'
import { financeInvestments } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

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
  let costBasis: number | undefined, currentValue: number | undefined
  try {
    if (body.costBasis !== undefined) costBasis = validateAmount(body.costBasis, 'costBasis')
    if (body.currentValue !== undefined) currentValue = validateAmount(body.currentValue, 'currentValue')
  } catch (e) { return validationError((e as Error).message) }

  const [updated] = await db.update(financeInvestments).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.type !== undefined && { type: body.type }),
    ...(body.provider !== undefined && { provider: body.provider }),
    ...(costBasis !== undefined && { costBasis }),
    ...(currentValue !== undefined && { currentValue }),
    ...(body.currency !== undefined && { currency: body.currency }),
    ...(body.units !== undefined && { units: body.units }),
    ...(body.ticker !== undefined && { ticker: body.ticker }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }).where(and(eq(financeInvestments.id, id), eq(financeInvestments.userId, userId))).returning()
  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  await db.delete(financeInvestments).where(and(eq(financeInvestments.id, id), eq(financeInvestments.userId, userId)))
  return Response.json({ ok: true })
}
