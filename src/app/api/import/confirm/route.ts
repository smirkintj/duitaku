import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { validateAmount } from '@/lib/validate'

interface ImportTx {
  date: string
  merchant: string
  amount: number
  type: string
  categoryId?: string
  importHash: string
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { transactions: ImportTx[] }
  const { transactions } = body

  let imported = 0
  let skipped = 0

  for (const tx of transactions) {
    let amount: number
    try { amount = validateAmount(tx.amount) } catch { skipped++; continue }

    // Check if importHash already exists for this user
    const existing = await db
      .select({ id: financeTransactions.id })
      .from(financeTransactions)
      .where(and(eq(financeTransactions.userId, userId), eq(financeTransactions.importHash, tx.importHash)))
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    await db.insert(financeTransactions).values({
      userId,
      accountId: null,
      categoryId: tx.categoryId ?? null,
      amount,
      currency: 'MYR',
      date: tx.date,
      merchant: tx.merchant,
      type: tx.type,
      isRecurring: false,
      importHash: tx.importHash,
    })

    imported++
  }

  return Response.json({ imported, skipped })
}
