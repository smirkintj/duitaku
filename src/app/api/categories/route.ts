import { db } from '@/db'
import { financeCategories } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const categories = await db
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.userId, userId))
    .orderBy(asc(financeCategories.name))

  return Response.json(categories)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as {
    name: string
    icon?: string
    color?: string
    type?: string
    monthlyLimit?: number
  }

  const [created] = await db
    .insert(financeCategories)
    .values({
      userId,
      name: body.name,
      icon: body.icon ?? 'bag',
      color: body.color ?? '#a3e635',
      type: body.type ?? 'expense',
      monthlyLimit: body.monthlyLimit ?? null,
    })
    .returning()

  return Response.json(created, { status: 201 })
}
