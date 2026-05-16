import { db } from '@/db'
import { financeBnpl } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET() {
  const rows = await db.select().from(financeBnpl).where(eq(financeBnpl.isActive, true)).orderBy(asc(financeBnpl.createdAt))
  return Response.json(rows)
}

export async function POST(request: Request) {
  const body = await request.json() as { merchant: string; provider?: string; totalAmount: number; installmentAmount: number; totalInstallments: number; startMonth: string; notes?: string }
  const [created] = await db.insert(financeBnpl).values({
    merchant: body.merchant,
    provider: body.provider ?? 'shopee',
    totalAmount: body.totalAmount,
    installmentAmount: body.installmentAmount,
    totalInstallments: body.totalInstallments,
    paidInstallments: 0,
    startMonth: body.startMonth,
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
