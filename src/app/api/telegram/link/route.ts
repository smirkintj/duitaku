import { randomInt } from 'crypto'
import { db } from '@/db'
import { telegramConnections, telegramLinkCodes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  // Delete old codes for this user
  await db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, userId))

  const code = String(randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await db.insert(telegramLinkCodes).values({ code, userId, expiresAt })

  return Response.json({ code })
}

export async function DELETE(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  await db.delete(telegramConnections).where(eq(telegramConnections.userId, userId))

  return Response.json({ ok: true })
}
