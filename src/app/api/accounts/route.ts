import { db } from '@/db'
import { financeAccounts } from '@/db/schema'
import { asc } from 'drizzle-orm'

export async function GET() {
  const accounts = await db
    .select()
    .from(financeAccounts)
    .orderBy(asc(financeAccounts.name))

  return Response.json(accounts)
}

export async function POST(request: Request) {
  const body = await request.json() as {
    name: string
    type?: string
    currency?: string
    initialBalance?: number
  }

  const [created] = await db
    .insert(financeAccounts)
    .values({
      name: body.name,
      type: body.type ?? 'bank',
      currency: body.currency ?? 'MYR',
      initialBalance: body.initialBalance ?? 0,
    })
    .returning()

  return Response.json(created, { status: 201 })
}
