import { db } from '@/db'
import { financeAccounts, financeCcStatements, financeTransactions } from '@/db/schema'
import { asc, eq, inArray, and, sql } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const accounts = await db.select().from(financeAccounts)
    .where(eq(financeAccounts.userId, userId))
    .orderBy(asc(financeAccounts.name))

  const ccIds = accounts.filter((a) => a.type === 'credit').map((a) => a.id)
  const allIds = accounts.map((a) => a.id)

  const [statements, txAgg] = await Promise.all([
    ccIds.length > 0
      ? db.select().from(financeCcStatements).where(inArray(financeCcStatements.accountId, ccIds))
      : Promise.resolve([]),
    allIds.length > 0
      ? db.select({
          accountId: financeTransactions.accountId,
          type: financeTransactions.type,
          total: sql<number>`coalesce(sum(${financeTransactions.amount}), 0)`,
        }).from(financeTransactions)
          .where(and(
            eq(financeTransactions.userId, userId),
            inArray(financeTransactions.accountId, allIds),
          ))
          .groupBy(financeTransactions.accountId, financeTransactions.type)
      : Promise.resolve([]),
  ])

  // Build per-account transaction totals
  const txMap = new Map<string, { income: number; expense: number; topup: number }>()
  for (const row of txAgg) {
    if (!row.accountId) continue
    const entry = txMap.get(row.accountId) ?? { income: 0, expense: 0, topup: 0 }
    if (row.type === 'income') entry.income = Number(row.total)
    else if (row.type === 'expense') entry.expense = Number(row.total)
    else if (row.type === 'topup') entry.topup = Number(row.total)
    txMap.set(row.accountId, entry)
  }

  // Monthly topup for allocation bar (current month only)
  const month = new Date().toISOString().slice(0, 7)
  const monthlyTopupMap = new Map<string, number>()
  for (const row of txAgg.filter(r => true)) { /* already aggregated all-time; recompute monthly below */ }
  const monthlyTopupRows = allIds.length > 0
    ? await db.select({
        accountId: financeTransactions.accountId,
        total: sql<number>`coalesce(sum(${financeTransactions.amount}), 0)`,
      }).from(financeTransactions)
        .where(and(
          eq(financeTransactions.userId, userId),
          eq(financeTransactions.type, 'topup'),
          inArray(financeTransactions.accountId, allIds),
          sql`${financeTransactions.date} like ${month + '-%'}`,
        ))
        .groupBy(financeTransactions.accountId)
    : []
  for (const row of monthlyTopupRows) {
    if (row.accountId) monthlyTopupMap.set(row.accountId, Number(row.total))
  }

  const result = accounts.map((account) => {
    const { userId: _, ...accountData } = account
    const monthlyTopup = monthlyTopupMap.get(account.id) ?? 0
    const activity = txMap.get(account.id) ?? { income: 0, expense: 0, topup: 0 }
    // currentBalance = opening + all linked income/topups − all linked expenses
    const currentBalance = account.type !== 'credit'
      ? account.initialBalance + activity.income + activity.topup - activity.expense
      : null

    if (account.type !== 'credit') return { ...accountData, currentBalance, latestStatement: null, statements: [], monthlyTopup, monthlyAllocation: account.monthlyAllocation ?? null }
    const acctStmts = statements
      .filter((s) => s.accountId === account.id)
      .sort((a, b) => b.month.localeCompare(a.month))
    return { ...accountData, currentBalance, latestStatement: acctStmts[0] ?? null, statements: acctStmts, monthlyTopup, monthlyAllocation: account.monthlyAllocation ?? null }
  })

  return Response.json(result)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as {
    name: string
    type?: string
    currency?: string
    initialBalance?: number
    creditLimit?: number
    currentOutstanding?: number
    statementDueDay?: number
    statementDay?: number
    lastFour?: string
  }

  let initialBalance: number, creditLimit: number | null = null, currentOutstanding: number | null = null
  try {
    initialBalance = validateAmount(body.initialBalance ?? 0, 'initialBalance')
    if (body.creditLimit != null) creditLimit = validateAmount(body.creditLimit, 'creditLimit')
    if (body.currentOutstanding != null) currentOutstanding = validateAmount(body.currentOutstanding, 'currentOutstanding')
  } catch (e) { return validationError((e as Error).message) }

  const [created] = await db.insert(financeAccounts).values({
    userId,
    name: body.name,
    type: body.type ?? 'bank',
    currency: body.currency ?? 'MYR',
    initialBalance,
    creditLimit,
    currentOutstanding,
    statementDueDay: body.statementDueDay ?? null,
    statementDay: body.statementDay ?? null,
    lastFour: body.lastFour ?? null,
  }).returning()

  return Response.json(created, { status: 201 })
}
