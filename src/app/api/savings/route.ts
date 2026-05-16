import { db } from '@/db'
import { financeSavingsGoals } from '@/db/schema'
import { asc } from 'drizzle-orm'

export async function GET() {
  const goals = await db.select().from(financeSavingsGoals).orderBy(asc(financeSavingsGoals.createdAt))
  return Response.json(goals)
}

export async function POST(request: Request) {
  const body = await request.json() as { name: string; targetAmount?: number; color?: string; notes?: string }
  const [created] = await db.insert(financeSavingsGoals).values({
    name: body.name,
    targetAmount: body.targetAmount ?? null,
    color: body.color ?? '#a3e635',
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
