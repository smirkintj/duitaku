import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, gte, lte, desc } from 'drizzle-orm'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const m = searchParams.get('m') // YYYY-MM

  let rows
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-')
    rows = await db
      .select()
      .from(financeTransactions)
      .where(and(gte(financeTransactions.date, `${y}-${mo}-01`), lte(financeTransactions.date, `${y}-${mo}-31`)))
      .orderBy(desc(financeTransactions.date))
  } else {
    rows = await db
      .select()
      .from(financeTransactions)
      .orderBy(desc(financeTransactions.date))
      .limit(200)
  }

  return Response.json(rows)
}

export async function POST(request: Request) {
  const body = await request.json() as {
    accountId?: string
    categoryId?: string
    amount: number
    currency?: string
    date: string
    note?: string
    merchant?: string
    type?: string
    isRecurring?: boolean
  }

  const [created] = await db
    .insert(financeTransactions)
    .values({
      accountId: body.accountId ?? null,
      categoryId: body.categoryId ?? null,
      amount: body.amount,
      currency: body.currency ?? 'MYR',
      date: body.date,
      note: body.note ?? null,
      merchant: body.merchant ?? null,
      type: body.type ?? 'expense',
      isRecurring: body.isRecurring ?? false,
    })
    .returning()

  return Response.json(created, { status: 201 })
}
