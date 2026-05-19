import { db } from '@/db'
import { financeAccounts, financeCcStatements } from '@/db/schema'
import { asc, inArray } from 'drizzle-orm'

export async function GET() {
  const accounts = await db.select().from(financeAccounts).orderBy(asc(financeAccounts.name))

  const ccIds = accounts.filter((a) => a.type === 'credit').map((a) => a.id)
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
