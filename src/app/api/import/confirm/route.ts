import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { eq } from 'drizzle-orm'

interface ImportTx {
  date: string
  merchant: string
  amount: number
  type: string
  categoryId?: string
  importHash: string
}

export async function POST(request: Request) {
  const body = await request.json() as { transactions: ImportTx[] }
  const { transactions } = body

  let imported = 0
  let skipped = 0

  for (const tx of transactions) {
    // Check if importHash already exists
    const existing = await db
      .select({ id: financeTransactions.id })
      .from(financeTransactions)
      .where(eq(financeTransactions.importHash, tx.importHash))
      .limit(1)

    if (existing.length > 0) {
      skipped++
      continue
    }

    await db.insert(financeTransactions).values({
      accountId: null,
      categoryId: tx.categoryId ?? null,
      amount: tx.amount,
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
