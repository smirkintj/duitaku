import { db } from '@/db'
import { financeBillPayments, financeBills, financeTransactions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json() as { month: string; unpay?: boolean }

  if (body.unpay) {
    await db.delete(financeBillPayments).where(and(eq(financeBillPayments.billId, id), eq(financeBillPayments.month, body.month)))
    return Response.json({ ok: true, paid: false })
  }

  const [bill] = await db.select().from(financeBills).where(eq(financeBills.id, id))
  if (!bill) return Response.json({ error: 'Not found' }, { status: 404 })

  // Only create a cash transaction for direct debit bills.
  // CC bills are already captured in the CC outstanding balance — no double-counting.
  let transactionId: string | null = null
  if (bill.paymentMethod !== 'credit_card') {
    const today = new Date().toISOString().slice(0, 10)
    const [tx] = await db.insert(financeTransactions).values({
      amount: bill.amount,
      date: today,
      type: 'expense',
      merchant: bill.name,
      categoryId: bill.categoryId ?? null,
      accountId: bill.accountId ?? null,
      isRecurring: true,
    }).returning()
    transactionId = tx.id
  }

  await db.insert(financeBillPayments).values({ billId: id, month: body.month, paidAt: new Date() })

  return Response.json({ ok: true, paid: true, transactionId })
}
