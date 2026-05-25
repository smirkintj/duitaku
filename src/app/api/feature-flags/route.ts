import { db } from '@/db'
import { featureFlags } from '@/db/schema'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const rows = await db.select().from(featureFlags)
  const map: Record<string, boolean> = {}
  for (const row of rows) map[row.key] = row.enabled
  return Response.json(map)
}
