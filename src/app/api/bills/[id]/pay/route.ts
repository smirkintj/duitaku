import { db } from '@/db'
import { financeBillPayments, financeBills, financeTransactions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as { month: string; unpay?: boolean }

  // Verify the bill belongs to the user
  const [bill] = await db.select().from(financeBills).where(and(eq(financeBills.id, id), eq(financeBills.userId, userId)))
  if (!bill) return Response.json({ error: 'Not found' }, { status: 404 })

  if (body.unpay) {
    await db.delete(financeBillPayments).where(and(eq(financeBillPayments.billId, id), eq(financeBillPayments.month, body.month)))
    return Response.json({ ok: true, paid: false })
  }

  // Only create a cash transaction for direct debit bills.
  // CC bills are already captured in the CC outstanding balance — no double-counting.
  let transactionId: string | null = null
  if (bill.paymentMethod !== 'credit_card') {
    const today = new Date().toISOString().slice(0, 10)
    // Store importHash using the same formula as PDF import so the same
    // transaction arriving via PDF statement is caught as a duplicate.
    const importHash = createHash('sha256')
      .update(`${today}${bill.name}${bill.amount}`)
      .digest('hex')
    const [tx] = await db.insert(financeTransactions).values({
      userId,
      amount: bill.amount,
      date: today,
      type: 'expense',
      merchant: bill.name,
      categoryId: bill.categoryId ?? null,
      accountId: bill.accountId ?? null,
      isRecurring: true,
      importHash,
    }).returning()
    transactionId = tx.id
  }

  await db.insert(financeBillPayments).values({ billId: id, month: body.month, paidAt: new Date() })

  return Response.json({ ok: true, paid: true, transactionId })
}
