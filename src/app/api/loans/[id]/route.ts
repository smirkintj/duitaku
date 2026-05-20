import { db } from '@/db'
import { financeLoans } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const [updated] = await db.update(financeLoans).set({
    ...(body.name !== undefined && { name: body.name }),
    ...(body.lender !== undefined && { lender: body.lender }),
    ...(body.outstandingBalance !== undefined && { outstandingBalance: body.outstandingBalance }),
    ...(body.monthlyInstallment !== undefined && { monthlyInstallment: body.monthlyInstallment }),
    ...(body.interestRate !== undefined && { interestRate: body.interestRate }),
    ...(body.notes !== undefined && { notes: body.notes }),
    ...(body.isActive !== undefined && { isActive: body.isActive }),
    ...(body.billId !== undefined && { billId: body.billId }),
  }).where(eq(financeLoans.id, id)).returning()
  return Response.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.update(financeLoans).set({ isActive: false }).where(eq(financeLoans.id, id))
  return Response.json({ ok: true })
}
