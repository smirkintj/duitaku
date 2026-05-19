import { db } from '@/db'
import { financeBnpl, financeTransactions } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as {
    payInstallment?: boolean
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
    const [bnpl] = await db.select().from(financeBnpl).where(eq(financeBnpl.id, id))
    if (!bnpl) return Response.json({ error: 'Not found' }, { status: 404 })
    const newPaid = bnpl.paidInstallments + 1
    const isNowDone = newPaid >= bnpl.totalInstallments
    const today = new Date().toISOString().slice(0, 10)
    await db.insert(financeTransactions).values({
      amount: bnpl.installmentAmount,
      date: today,
      type: 'expense',
      merchant: `${bnpl.merchant} (BNPL ${newPaid}/${bnpl.totalInstallments})`,
      isRecurring: true,
    })
    const [updated] = await db.update(financeBnpl).set({ paidInstallments: newPaid, isActive: !isNowDone }).where(eq(financeBnpl.id, id)).returning()
    return Response.json(updated)
  }

  const updates: Record<string, unknown> = {}
  if (body.paidInstallments !== undefined) updates.paidInstallments = body.paidInstallments
  if (body.isActive !== undefined) updates.isActive = body.isActive
  if (body.merchant !== undefined) updates.merchant = body.merchant
  if (body.provider !== undefined) updates.provider = body.provider
  if (body.totalAmount !== undefined) updates.totalAmount = body.totalAmount
  if (body.installmentAmount !== undefined) updates.installmentAmount = body.installmentAmount
  if (body.totalInstallments !== undefined) updates.totalInstallments = body.totalInstallments
  if (body.startMonth !== undefined) updates.startMonth = body.startMonth
  if ('notes' in body) updates.notes = body.notes
  const [updated] = await db.update(financeBnpl).set(updates).where(eq(financeBnpl.id, id)).returning()
  return Response.json(updated)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(financeBnpl).where(eq(financeBnpl.id, id))
  return Response.json({ ok: true })
}
