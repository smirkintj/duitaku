import { db } from '@/db'
import { financeBnpl } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const rows = await db.select().from(financeBnpl)
    .where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true)))
    .orderBy(asc(financeBnpl.createdAt))
  return Response.json(rows)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { merchant: string; provider?: string; totalAmount: number; installmentAmount: number; totalInstallments: number; startMonth: string; notes?: string; accountId?: string }
  const [created] = await db.insert(financeBnpl).values({
    userId,
    accountId: body.accountId ?? null,
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
