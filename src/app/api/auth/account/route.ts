import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { deleteSession } from '@/lib/auth'

export async function DELETE(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { password: string }
  if (!body.password) {
    return Response.json({ error: 'Password is required to delete your account' }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) return Response.json({ error: 'Account not found' }, { status: 404 })

  const valid = await bcrypt.compare(body.password, user.passwordHash)
  if (!valid) {
    return Response.json({ error: 'Incorrect password' }, { status: 403 })
  }

  // Cascade deletes everything: transactions, accounts, categories, salary,
  // bills, BNPL, savings goals, investments, loans, AI insights, API keys, settings
  await db.delete(users).where(eq(users.id, userId))
  await deleteSession()

  return Response.json({ ok: true })
}
