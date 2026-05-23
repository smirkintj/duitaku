import { db } from '@/db'
import { financeBills, financeBillPayments } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('m') // YYYY-MM

  const bills = await db.select().from(financeBills)
    .where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true)))
    .orderBy(asc(financeBills.dueDay))

  if (!month) return Response.json(bills)

  // financeBillPayments doesn't have userId — derive security from billId ownership
  const billIds = bills.map(b => b.id)
  const payments = billIds.length > 0
    ? await db.select().from(financeBillPayments).where(
        and(eq(financeBillPayments.month, month))
      ).then(rows => rows.filter(p => billIds.includes(p.billId)))
    : []
  const paidIds = new Set(payments.map(p => p.billId))

  return Response.json(bills.map(b => ({ ...b, paid: paidIds.has(b.id) })))
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { name: string; amount: number; dueDay?: number; categoryId?: string; icon?: string; paymentMethod?: string; accountId?: string }
  let amount: number
  try { amount = validateAmount(body.amount) } catch (e) { return validationError((e as Error).message) }

  const [created] = await db.insert(financeBills).values({
    userId,
    name: body.name,
    amount,
    dueDay: body.dueDay ?? 1,
    categoryId: body.categoryId ?? null,
    icon: body.icon ?? 'bolt',
    paymentMethod: body.paymentMethod ?? 'direct_debit',
    accountId: body.accountId ?? null,
  }).returning()
  return Response.json(created, { status: 201 })
}
