import { db } from '@/db'
import { financeBills, financeBillPayments } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('m') // YYYY-MM

  const bills = await db.select().from(financeBills).where(eq(financeBills.isActive, true)).orderBy(asc(financeBills.dueDay))

  if (!month) return Response.json(bills)

  const payments = await db.select().from(financeBillPayments).where(eq(financeBillPayments.month, month))
  const paidIds = new Set(payments.map(p => p.billId))

  return Response.json(bills.map(b => ({ ...b, paid: paidIds.has(b.id) })))
}

export async function POST(request: Request) {
  const body = await request.json() as { name: string; amount: number; dueDay?: number; categoryId?: string; icon?: string }
  const [created] = await db.insert(financeBills).values({
    name: body.name,
    amount: body.amount,
    dueDay: body.dueDay ?? 1,
    categoryId: body.categoryId ?? null,
    icon: body.icon ?? 'bolt',
  }).returning()
  return Response.json(created, { status: 201 })
}
