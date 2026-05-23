import { db } from '@/db'
import { financeLoans } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as {
    name?: string
    lender?: string
    outstandingBalance?: number
    monthlyInstallment?: number
    interestRate?: number
    notes?: string
    isActive?: boolean
    billId?: string | null
  }
  let outstandingBalance: number | undefined, monthlyInstallment: number | undefined
  try {
    if (body.outstandingBalance !== undefined) outstandingBalance = validateAmount(body.outstandingBalance, 'outstandingBalance')
    if (body.monthlyInstallment !== undefined) monthlyInstallment = validateAmount(body.monthlyInstallment, 'monthlyInstallment')
  } catch (e) { return validationError((e as Error).message) }

  const [updated] = await db.update(financeLoans).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.lender !== undefined && { lender: body.lender }),
    ...(outstandingBalance !== undefined && { outstandingBalance }),
    ...(monthlyInstallment !== undefined && { monthlyInstallment }),
    ...(body.interestRate !== undefined && { interestRate: body.interestRate }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    ...(body.billId !== undefined && { billId: body.billId }),
  }).where(and(eq(financeLoans.id, id), eq(financeLoans.userId, userId))).returning()
  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  await db.update(financeLoans).set({ isActive: false }).where(and(eq(financeLoans.id, id), eq(financeLoans.userId, userId)))
  return Response.json({ ok: true })
}
