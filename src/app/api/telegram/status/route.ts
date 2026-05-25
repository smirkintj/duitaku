import { db } from '@/db'
import { telegramConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const [conn] = await db.select().from(telegramConnections)
    .where(eq(telegramConnections.userId, userId)).limit(1)

  if (!conn) {
    return Response.json({ connected: false })
  }

  return Response.json({ connected: true, chatId: conn.telegramChatId })
}
