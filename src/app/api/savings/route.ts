import { db } from '@/db'
import { financeSavingsGoals } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const goals = await db.select().from(financeSavingsGoals)
    .where(eq(financeSavingsGoals.userId, userId))
    .orderBy(asc(financeSavingsGoals.createdAt))
  return Response.json(goals)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { name: string; targetAmount?: number; color?: string; notes?: string }
  const [created] = await db.insert(financeSavingsGoals).values({
    userId,
    name: body.name,
    targetAmount: body.targetAmount ?? null,
    color: body.color ?? '#a3e635',
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
