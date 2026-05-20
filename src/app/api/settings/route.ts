import { db } from '@/db'
import { userSettings } from '@/db/schema'

async function getOrCreateSettings() {
  const rows = await db.select().from(userSettings).limit(1)
  if (rows[0]) return rows[0]
  const [row] = await db.insert(userSettings).values({}).returning()
  return row
}

export async function GET() {
  const settings = await getOrCreateSettings()
  return Response.json(settings)
}

export async function PATCH(request: Request) {
  const body = await request.json() as Partial<{ celestial: boolean; sidebarExpanded: boolean; payDay: number }>
  const settings = await getOrCreateSettings()

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (body.celestial !== undefined) updates.celestial = body.celestial
  if (body.sidebarExpanded !== undefined) updates.sidebarExpanded = body.sidebarExpanded
  if (body.payDay !== undefined) updates.payDay = Math.min(31, Math.max(1, Math.round(body.payDay)))

  const { eq } = await import('drizzle-orm')
  const [updated] = await db.update(userSettings).set(updates).where(eq(userSettings.id, settings.id)).returning()
  return Response.json(updated)
}
