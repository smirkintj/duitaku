import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, gte, lte, desc, eq, SQL } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { searchParams } = new URL(request.url)
  const m = searchParams.get('m') // YYYY-MM
  const accountId = searchParams.get('accountId')
  const type = searchParams.get('type')

  const conditions: SQL[] = [eq(financeTransactions.userId, userId)]
  if (accountId) conditions.push(eq(financeTransactions.accountId, accountId))
  if (type) conditions.push(eq(financeTransactions.type, type))

  let rows
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-')
    conditions.push(gte(financeTransactions.date, `${y}-${mo}-01`))
    conditions.push(lte(financeTransactions.date, `${y}-${mo}-31`))
    rows = await db
      .select()
      .from(financeTransactions)
      .where(and(...conditions))
      .orderBy(desc(financeTransactions.date))
  } else {
    rows = await db
      .select()
      .from(financeTransactions)
      .where(and(...conditions))
      .orderBy(desc(financeTransactions.date))
      .limit(200)
  }

  return Response.json(rows)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

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

  let amount: number
  try { amount = validateAmount(body.amount) } catch (e) { return validationError((e as Error).message) }

  const [created] = await db
    .insert(financeTransactions)
    .values({
      userId,
      accountId: body.accountId ?? null,
      categoryId: body.categoryId ?? null,
      amount,
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
