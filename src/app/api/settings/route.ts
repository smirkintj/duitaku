import { db } from '@/db'
import { userSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

async function getOrCreateSettings(userId: string) {
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)
  if (rows[0]) return rows[0]
  const [row] = await db.insert(userSettings).values({ userId }).returning()
  return row
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const settings = await getOrCreateSettings(userId)
  return Response.json(settings)
}

export async function PATCH(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as Partial<{ celestial: boolean; sidebarExpanded: boolean; payDay: number }>
  const settings = await getOrCreateSettings(userId)

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.celestial !== undefined) updates.celestial = body.celestial
  if (body.sidebarExpanded !== undefined) updates.sidebarExpanded = body.sidebarExpanded
  if (body.payDay !== undefined) updates.payDay = Math.min(31, Math.max(1, Math.round(body.payDay)))

  const [updated] = await db.update(userSettings).set(updates).where(eq(userSettings.id, settings.id)).returning()
  return Response.json(updated)
}
