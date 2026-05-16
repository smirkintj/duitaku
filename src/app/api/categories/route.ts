import { db } from '@/db'
import { financeCategories } from '@/db/schema'
import { asc } from 'drizzle-orm'

export async function GET() {
  const categories = await db
    .select()
    .from(financeCategories)
    .orderBy(asc(financeCategories.name))

  return Response.json(categories)
}

export async function POST(request: Request) {
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
      name: body.name,
      icon: body.icon ?? 'bag',
      color: body.color ?? '#a3e635',
      type: body.type ?? 'expense',
      monthlyLimit: body.monthlyLimit ?? null,
    })
    .returning()

  return Response.json(created, { status: 201 })
}
