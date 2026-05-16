import { db } from '@/db'
import { financeTransactions } from '@/db/schema'

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
