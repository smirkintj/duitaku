import { db } from '@/db'
import { sql } from 'drizzle-orm'
import { getUserIdFromRequest } from '@/lib/get-user-id'

// POST /api/admin/normalize-merchants
// Normalizes the calling user's transaction merchant names:
//   - Clears merchant='Unknown' (display falls back to note)
//   - Title-cases all remaining merchant names
export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const clearedResult = await db.execute(
    sql`UPDATE finance_transactions SET merchant = NULL WHERE user_id = ${userId} AND merchant = 'Unknown'`
  )

  const titleCaseResult = await db.execute(
    sql`UPDATE finance_transactions
        SET merchant = initcap(lower(merchant))
        WHERE user_id = ${userId} AND merchant IS NOT NULL`
  )

  return Response.json({
    cleared_unknown: (clearedResult as { rowCount?: number }).rowCount ?? 0,
    title_cased: (titleCaseResult as { rowCount?: number }).rowCount ?? 0,
  })
}
