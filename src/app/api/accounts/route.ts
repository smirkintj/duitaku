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
  // financeCcStatements doesn't have userId — derive security through accountId ownership
  const statements = ccIds.length > 0
    ? await db.select().from(financeCcStatements).where(inArray(financeCcStatements.accountId, ccIds))
    : []

  // Aggregate topup transactions for the current month
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM
  const topupRows = await db.select({
    accountId: financeTransactions.accountId,
    total: sql<number>`coalesce(sum(${financeTransactions.amount}), 0)`,
  }).from(financeTransactions)
    .where(and(
      eq(financeTransactions.userId, userId),
      eq(financeTransactions.type, 'topup'),
      sql`${financeTransactions.date} like ${month + '-%'}`,
    ))
    .groupBy(financeTransactions.accountId)

  const topupMap = new Map<string, number>()
  for (const row of topupRows) {
    if (row.accountId) topupMap.set(row.accountId, Number(row.total))
  }

  const result = accounts.map((account) => {
    const { userId: _, ...accountData } = account
    const monthlyTopup = topupMap.get(account.id) ?? 0
    if (account.type !== 'credit') return { ...accountData, latestStatement: null, statements: [], monthlyTopup, monthlyAllocation: account.monthlyAllocation ?? null }
    const acctStmts = statements
      .filter((s) => s.accountId === account.id)
      .sort((a, b) => b.month.localeCompare(a.month))
    return { ...accountData, latestStatement: acctStmts[0] ?? null, statements: acctStmts, monthlyTopup, monthlyAllocation: account.monthlyAllocation ?? null }
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
