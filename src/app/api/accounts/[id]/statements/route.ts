import { db } from '@/db'
import { financeCcStatements, financeAccounts } from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

async function verifyAccountOwnership(accountId: string, userId: string): Promise<boolean> {
  const [account] = await db.select({ id: financeAccounts.id }).from(financeAccounts)
    .where(and(eq(financeAccounts.id, accountId), eq(financeAccounts.userId, userId)))
  return !!account
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  if (!(await verifyAccountOwnership(id, userId))) return Response.json({ error: 'Not found' }, { status: 404 })

  const statements = await db.select().from(financeCcStatements)
    .where(eq(financeCcStatements.accountId, id))
    .orderBy(desc(financeCcStatements.month))
  return Response.json(statements)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  if (!(await verifyAccountOwnership(id, userId))) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    month: string
    statementAmount: number
    minimumPayment?: number
    paidAmount?: number
    notes?: string
  }

  let statementAmount: number, minimumPayment: number, paidAmount: number
  try {
    statementAmount = validateAmount(body.statementAmount, 'statementAmount')
    minimumPayment = validateAmount(body.minimumPayment ?? 0, 'minimumPayment')
    paidAmount = validateAmount(body.paidAmount ?? 0, 'paidAmount')
  } catch (e) { return validationError((e as Error).message) }

  const [created] = await db.insert(financeCcStatements).values({
    accountId: id,
    month: body.month,
    statementAmount,
    minimumPayment,
    paidAmount,
    notes: body.notes ?? null,
  }).returning()

  return Response.json(created, { status: 201 })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  if (!(await verifyAccountOwnership(id, userId))) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as {
    statementId: string
    paidAmount?: number
    paidAt?: string | null
  }

  let paidAmount: number | undefined
  if (body.paidAmount !== undefined) {
    try { paidAmount = validateAmount(body.paidAmount, 'paidAmount') } catch (e) { return validationError((e as Error).message) }
  }

  const [updated] = await db.update(financeCcStatements)
    .set({
      ...(paidAmount !== undefined && { paidAmount }),
      ...(body.paidAt !== undefined && { paidAt: body.paidAt ? new Date(body.paidAt) : null }),
    })
    .where(and(eq(financeCcStatements.id, body.statementId), eq(financeCcStatements.accountId, id)))
    .returning()

  return Response.json(updated)
}
