import { db } from '@/db'
import { financeInvestments, investmentValueHistory } from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params

  // Verify ownership
  const [inv] = await db
    .select({ id: financeInvestments.id })
    .from(financeInvestments)
    .where(and(eq(financeInvestments.id, id), eq(financeInvestments.userId, userId)))
  if (!inv) return Response.json({ error: 'Not found' }, { status: 404 })

  const rows = await db
    .select({
      id: investmentValueHistory.id,
      investmentId: investmentValueHistory.investmentId,
      value: investmentValueHistory.value,
      month: investmentValueHistory.month,
      note: investmentValueHistory.note,
      loggedAt: investmentValueHistory.loggedAt,
    })
    .from(investmentValueHistory)
    .where(eq(investmentValueHistory.investmentId, id))
    .orderBy(desc(investmentValueHistory.month))

  return Response.json(rows)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { id } = await params

  // Verify ownership
  const [inv] = await db
    .select({ id: financeInvestments.id })
    .from(financeInvestments)
    .where(and(eq(financeInvestments.id, id), eq(financeInvestments.userId, userId)))
  if (!inv) return Response.json({ error: 'Not found' }, { status: 404 })

  const body = await request.json() as { value: number; month: string; note?: string }
  if (typeof body.value !== 'number' || !body.month) {
    return Response.json({ error: 'value and month are required' }, { status: 400 })
  }

  // Upsert: check if row exists for this (investmentId, month)
  const [existing] = await db
    .select({ id: investmentValueHistory.id })
    .from(investmentValueHistory)
    .where(
      and(
        eq(investmentValueHistory.investmentId, id),
        eq(investmentValueHistory.month, body.month)
      )
    )

  let row
  if (existing) {
    const [updated] = await db
      .update(investmentValueHistory)
      .set({ value: body.value, note: body.note ?? null, loggedAt: new Date() })
      .where(eq(investmentValueHistory.id, existing.id))
      .returning()
    row = updated
  } else {
    const [inserted] = await db
      .insert(investmentValueHistory)
      .values({ investmentId: id, value: body.value, month: body.month, note: body.note ?? null })
      .returning()
    row = inserted
  }

  // Update investment currentValue
  await db
    .update(financeInvestments)
    .set({ currentValue: body.value })
    .where(eq(financeInvestments.id, id))

  return Response.json(row)
}
