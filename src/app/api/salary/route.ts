import { db } from '@/db'
import { financeSalary } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const [latest] = await db
    .select()
    .from(financeSalary)
    .orderBy(desc(financeSalary.effectiveFrom))
    .limit(1)

  return Response.json(latest ?? null)
}

export async function POST(request: Request) {
  const body = await request.json() as {
    amount: number
    currency?: string
    effectiveFrom: string
  }

  const [created] = await db
    .insert(financeSalary)
    .values({
      amount: body.amount,
      currency: body.currency ?? 'MYR',
      effectiveFrom: body.effectiveFrom,
    })
    .returning()

  return Response.json(created, { status: 201 })
}
