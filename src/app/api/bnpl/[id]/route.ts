import { db } from '@/db'
import { financeBnpl, financeTransactions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as {
    payInstallment?: boolean
    date?: string  // client local date YYYY-MM-DD to avoid UTC offset issues
    paidInstallments?: number
    isActive?: boolean
    merchant?: string
    provider?: string
    totalAmount?: number
    installmentAmount?: number
    totalInstallments?: number
    startMonth?: string
    notes?: string | null
  }

  if (body.payInstallment) {
    const [bnpl] = await db.select().from(financeBnpl).where(and(eq(financeBnpl.id, id), eq(financeBnpl.userId, userId)))
    if (!bnpl) return Response.json({ error: 'Not found' }, { status: 404 })
    const newPaid = bnpl.paidInstallments + 1
    const isNowDone = newPaid >= bnpl.totalInstallments
    // Prefer the client-supplied local date to avoid UTC offset mismatch
    const fallbackDate = new Date().toISOString().slice(0, 10)
    const txDate = (body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) ? body.date : fallbackDate
    const now = new Date()
    await db.insert(financeTransactions).values({
      userId,
      accountId: bnpl.accountId ?? null,
      amount: bnpl.installmentAmount,
      currency: 'MYR',
      date: txDate,
      type: 'expense',
      merchant: `${bnpl.merchant} (BNPL ${newPaid}/${bnpl.totalInstallments})`,
      isRecurring: true,
    })
    const [updated] = await db.update(financeBnpl)
      .set({ paidInstallments: newPaid, isActive: !isNowDone, lastPaidAt: now })
      .where(and(eq(financeBnpl.id, id), eq(financeBnpl.userId, userId)))
      .returning()
    return Response.json(updated)
  }

  const updates: Record<string, unknown> = {}
  try {
    if (body.totalAmount !== undefined) updates.totalAmount = validateAmount(body.totalAmount, 'totalAmount')
    if (body.installmentAmount !== undefined) updates.installmentAmount = validateAmount(body.installmentAmount, 'installmentAmount')
  } catch (e) { return validationError((e as Error).message) }
  if (body.paidInstallments !== undefined) updates.paidInstallments = body.paidInstallments
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.merchant !== undefined) updates.merchant = body.merchant
  if (body.provider !== undefined) updates.provider = body.provider
  if (body.totalInstallments !== undefined) {
    const n = Math.round(Number(body.totalInstallments))
    if (!Number.isInteger(n) || n < 1 || n > 1200) return validationError('totalInstallments must be a positive integer (max 1200)')
    updates.totalInstallments = n
  }
  if (body.startMonth !== undefined) updates.startMonth = body.startMonth
  if ('notes' in body) updates.notes = body.notes
  const [updated] = await db.update(financeBnpl).set(updates).where(and(eq(financeBnpl.id, id), eq(financeBnpl.userId, userId))).returning()
  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  await db.delete(financeBnpl).where(and(eq(financeBnpl.id, id), eq(financeBnpl.userId, userId)))
  return Response.json({ ok: true })
}
