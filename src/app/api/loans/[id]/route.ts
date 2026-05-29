// SQL migration required (run in Neon):
// ALTER TABLE finance_loans ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;

import { db } from '@/db'
import { financeLoans, financeTransactions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as {
    payInstallment?: boolean
    date?: string          // client local YYYY-MM-DD
    name?: string
    lender?: string
    outstandingBalance?: number
    monthlyInstallment?: number
    interestRate?: number
    notes?: string
    isActive?: boolean
    billId?: string | null
  }

  // ── Pay one installment ────────────────────────────────────────────────
  if (body.payInstallment) {
    const [loan] = await db.select().from(financeLoans)
      .where(and(eq(financeLoans.id, id), eq(financeLoans.userId, userId)))
    if (!loan) return Response.json({ error: 'Not found' }, { status: 404 })

    const fallbackDate = new Date().toISOString().slice(0, 10)
    const txDate = (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) ? body.date : fallbackDate

    const newBalance = Math.max(0, loan.outstandingBalance - loan.monthlyInstallment)
    const isNowPaidOff = newBalance === 0

    await db.insert(financeTransactions).values({
      userId,
      accountId: null,
      amount: loan.monthlyInstallment,
      currency: 'MYR',
      date: txDate,
      type: 'expense',
      merchant: loan.name,
      note: `Loan installment — ${loan.lender ?? loan.type}`,
      isRecurring: true,
    })

    const [updated] = await db.update(financeLoans)
      .set({
        outstandingBalance: newBalance,
        lastPaidAt: new Date(),
        ...(isNowPaidOff && { isActive: false }),
      })
      .where(and(eq(financeLoans.id, id), eq(financeLoans.userId, userId)))
      .returning()

    return Response.json({ ...updated, paidOff: isNowPaidOff })
  }

  // ── Generic field update ───────────────────────────────────────────────
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
