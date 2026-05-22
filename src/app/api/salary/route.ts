import { db } from '@/db'
import { financeSalary } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const [latest] = await db
    .select()
    .from(financeSalary)
    .where(eq(financeSalary.userId, userId))
    .orderBy(desc(financeSalary.effectiveFrom))
    .limit(1)

  return Response.json(latest ?? null)
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as {
    amount: number       // net take-home
    grossAmount?: number
    epfEmployee?: number
    epfEmployer?: number
    socso?: number
    eis?: number
    pcb?: number
    otherDeductions?: number
    currency?: string
    effectiveFrom: string
  }

  const [created] = await db
    .insert(financeSalary)
    .values({
      userId,
      amount: body.amount,
      grossAmount: body.grossAmount ?? null,
      epfEmployee: body.epfEmployee ?? 0,
      epfEmployer: body.epfEmployer ?? 0,
      socso: body.socso ?? 0,
      eis: body.eis ?? 0,
      pcb: body.pcb ?? 0,
      otherDeductions: body.otherDeductions ?? 0,
      currency: body.currency ?? 'MYR',
      effectiveFrom: body.effectiveFrom,
    })
    .returning()

  return Response.json(created, { status: 201 })
}
