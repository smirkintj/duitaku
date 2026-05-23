import { db } from '@/db'
import { financeAccounts } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount, validationError } from '@/lib/validate'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  const body = await request.json() as {
    name?: string
    creditLimit?: number
    currentOutstanding?: number
    statementDueDay?: number
    statementDay?: number
    lastFour?: string
    initialBalance?: number
  }

  let creditLimit: number | undefined, currentOutstanding: number | undefined, initialBalance: number | undefined
  try {
    if (body.creditLimit !== undefined) creditLimit = validateAmount(body.creditLimit, 'creditLimit')
    if (body.currentOutstanding !== undefined) currentOutstanding = validateAmount(body.currentOutstanding, 'currentOutstanding')
    if (body.initialBalance !== undefined) initialBalance = validateAmount(body.initialBalance, 'initialBalance')
  } catch (e) { return validationError((e as Error).message) }

  const [updated] = await db.update(financeAccounts)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(creditLimit !== undefined && { creditLimit }),
      ...(currentOutstanding !== undefined && { currentOutstanding }),
      ...(body.statementDueDay !== undefined && { statementDueDay: body.statementDueDay }),
      ...(body.statementDay !== undefined && { statementDay: body.statementDay }),
      ...(body.lastFour !== undefined && { lastFour: body.lastFour }),
      ...(initialBalance !== undefined && { initialBalance }),
    })
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)))
    .returning()

  return Response.json(updated)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params
  await db.delete(financeAccounts).where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)))
  return new Response(null, { status: 204 })
}
