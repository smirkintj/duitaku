import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { and, eq, isNotNull, desc, sql } from 'drizzle-orm'
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

  // Build merchant→categoryId map from user's history for auto-categorisation
  const merchantNames = [...new Set(
    transactions.filter(t => t.merchant && !t.categoryId).map(t => t.merchant.toLowerCase())
  )]
  const catMap = new Map<string, string>()
  if (merchantNames.length > 0) {
    const existing = await db.select({
      merchant: financeTransactions.merchant,
      categoryId: financeTransactions.categoryId,
    }).from(financeTransactions)
      .where(and(
        eq(financeTransactions.userId, userId),
        isNotNull(financeTransactions.categoryId),
        isNotNull(financeTransactions.merchant),
        sql`lower(${financeTransactions.merchant}) = ANY(${merchantNames})`,
      ))
      .groupBy(financeTransactions.merchant, financeTransactions.categoryId)
      .orderBy(desc(sql`count(*)`))
    for (const row of existing) {
      const key = (row.merchant ?? '').toLowerCase()
      if (!catMap.has(key) && row.categoryId) catMap.set(key, row.categoryId)
    }
  }

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

    const resolvedCategoryId = tx.categoryId ?? catMap.get(tx.merchant?.toLowerCase() ?? '') ?? null
    await db.insert(financeTransactions).values({
      userId,
      accountId: null,
      categoryId: resolvedCategoryId,
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
