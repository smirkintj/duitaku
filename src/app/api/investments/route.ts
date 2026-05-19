import { db } from '@/db'
import { financeInvestments } from '@/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  const investments = await db.select().from(financeInvestments).orderBy(desc(financeInvestments.createdAt))
  return Response.json(investments)
}

export async function POST(request: Request) {
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
  const [created] = await db.insert(financeInvestments).values({
    name: body.name,
    type: body.type,
    provider: body.provider ?? null,
    costBasis: body.costBasis,
    currentValue: body.currentValue,
    currency: body.currency ?? 'MYR',
    units: body.units ?? null,
    ticker: body.ticker ?? null,
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
