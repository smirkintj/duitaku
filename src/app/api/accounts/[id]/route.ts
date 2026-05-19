import { db } from '@/db'
import { financeAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const [updated] = await db.update(financeAccounts)
    .set({
      ...(body.name !== undefined && { name: body.name }),
      ...(body.creditLimit !== undefined && { creditLimit: body.creditLimit }),
      ...(body.currentOutstanding !== undefined && { currentOutstanding: body.currentOutstanding }),
      ...(body.statementDueDay !== undefined && { statementDueDay: body.statementDueDay }),
      ...(body.statementDay !== undefined && { statementDay: body.statementDay }),
      ...(body.lastFour !== undefined && { lastFour: body.lastFour }),
      ...(body.initialBalance !== undefined && { initialBalance: body.initialBalance }),
    })
    .where(eq(financeAccounts.id, id))
    .returning()

  return Response.json(updated)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.delete(financeAccounts).where(eq(financeAccounts.id, id))
  return new Response(null, { status: 204 })
}
