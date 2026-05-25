import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return Response.json({ valid: false, error: 'Missing token' })

  const [row] = await db.select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), isNull(passwordResetTokens.usedAt)))
    .limit(1)

  if (!row) return Response.json({ valid: false, error: 'Invalid or already used token' })
  if (row.expiresAt < new Date()) return Response.json({ valid: false, error: 'Token has expired' })

  return Response.json({ valid: true })
}

export async function POST(request: Request) {
  const { token, password } = await request.json() as { token: string; password: string }

  if (!token || !password) return Response.json({ error: 'Token and password required' }, { status: 400 })
  if (password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const [row] = await db.select().from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.token, token), isNull(passwordResetTokens.usedAt)))
    .limit(1)

  if (!row) return Response.json({ error: 'Invalid or already used link' }, { status: 400 })
  if (row.expiresAt < new Date()) return Response.json({ error: 'This link has expired. Request a new one.' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 12)

  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId))
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.token, token))

  return Response.json({ ok: true })
}
