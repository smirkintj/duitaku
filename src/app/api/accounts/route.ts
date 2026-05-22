import { db } from '@/db'
import { financeAccounts, financeCcStatements } from '@/db/schema'
import { asc, eq, inArray } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

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

  const result = accounts.map((account) => {
    if (account.type !== 'credit') return { ...account, latestStatement: null, statements: [] }
    const acctStmts = statements
      .filter((s) => s.accountId === account.id)
      .sort((a, b) => b.month.localeCompare(a.month))
    return { ...account, latestStatement: acctStmts[0] ?? null, statements: acctStmts }
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

  const [created] = await db.insert(financeAccounts).values({
    userId,
    name: body.name,
    type: body.type ?? 'bank',
    currency: body.currency ?? 'MYR',
    initialBalance: body.initialBalance ?? 0,
    creditLimit: body.creditLimit ?? null,
    currentOutstanding: body.currentOutstanding ?? null,
    statementDueDay: body.statementDueDay ?? null,
    statementDay: body.statementDay ?? null,
    lastFour: body.lastFour ?? null,
  }).returning()

  return Response.json(created, { status: 201 })
}
