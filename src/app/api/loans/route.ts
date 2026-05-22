import { db } from '@/db'
import { financeLoans } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const loans = await db.select().from(financeLoans)
    .where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true)))
    .orderBy(asc(financeLoans.createdAt))
  return Response.json(loans)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as {
    name: string
    type?: string
    lender?: string
    originalAmount: number
    outstandingBalance: number
    interestRate?: number
    monthlyInstallment: number
    startDate?: string
    tenureMonths?: number
    billId?: string
    notes?: string
  }
  const [created] = await db.insert(financeLoans).values({
    userId,
    name: body.name,
    type: body.type ?? 'other',
    lender: body.lender ?? null,
    originalAmount: body.originalAmount,
    outstandingBalance: body.outstandingBalance,
    interestRate: body.interestRate ?? null,
    monthlyInstallment: body.monthlyInstallment,
    startDate: body.startDate ?? null,
    tenureMonths: body.tenureMonths ?? null,
    billId: body.billId ?? null,
    notes: body.notes ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
