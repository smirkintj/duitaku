import { db } from '@/db'
import { financeSavingsGoals } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const goals = await db.select().from(financeSavingsGoals)
    .where(eq(financeSavingsGoals.userId, userId))
    .orderBy(asc(financeSavingsGoals.createdAt))
  return Response.json(goals.map(({ userId: _, ...r }) => r))
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { name: string; targetAmount?: number; color?: string; notes?: string }
  let targetAmount: number | null = null
  if (body.targetAmount != null) {
    try { targetAmount = validateAmount(body.targetAmount, 'targetAmount') } catch (e) { return validationError((e as Error).message) }
  }
  const [created] = await db.insert(financeSavingsGoals).values({
    userId,
    name: body.name,
    targetAmount,
    color: body.color ?? '#a3e635',
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
