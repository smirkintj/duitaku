import { db } from '@/db'
import { financeInvestments } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const investments = await db.select().from(financeInvestments)
    .where(eq(financeInvestments.userId, userId))
    .orderBy(desc(financeInvestments.createdAt))
  return Response.json(investments.map(({ userId: _, ...r }) => r))
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as {
    name: string
    type: string
    provider?: string
    costBasis: number
    currentValue: number
    currency?: string
    units?: number
    ticker?: string
    notes?: string
  }
  let costBasis: number, currentValue: number
  try {
    costBasis = validateAmount(body.costBasis, 'costBasis')
    currentValue = validateAmount(body.currentValue, 'currentValue')
  } catch (e) { return validationError((e as Error).message) }

  const [created] = await db.insert(financeInvestments).values({
    userId,
    name: body.name,
    type: body.type,
    provider: body.provider ?? null,
    costBasis,
    currentValue,
    currency: body.currency ?? 'MYR',
    units: body.units ?? null,
    ticker: body.ticker ?? null,
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
