import { db } from '@/db'
import { financeTransactions } from '@/db/schema'
import { isNotNull, sql } from 'drizzle-orm'

// Admin-only: POST /api/admin/normalize-merchants?secret=ADMIN_SECRET
// Normalizes existing transaction merchant names:
//   - Title-cases all non-null merchants
//   - Clears merchant='Unknown' (display falls back to note)
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || secret !== adminSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Clear 'Unknown' merchants so note is used as display label
  const clearedResult = await db.execute(
    sql`UPDATE finance_transactions SET merchant = NULL WHERE merchant = 'Unknown'`
  )

  // Title-case all remaining merchants
  const titleCaseResult = await db.execute(
    sql`UPDATE finance_transactions
        SET merchant = initcap(lower(merchant))
        WHERE merchant IS NOT NULL`
  )

  return Response.json({
    cleared_unknown: (clearedResult as { rowCount?: number }).rowCount ?? 0,
    title_cased: (titleCaseResult as { rowCount?: number }).rowCount ?? 0,
  })
}
