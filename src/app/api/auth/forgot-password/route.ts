import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { email } = await request.json() as { email: string }

  if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email.toLowerCase().trim())).limit(1)

  // Always return the same response — don't reveal whether email exists
  if (!user) return Response.json({ ok: true })

  // Invalidate any existing unused tokens for this user
  await db.delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await db.insert(passwordResetTokens).values({ token, userId: user.id, expiresAt })

  return Response.json({ ok: true })
}
