import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { randomBytes } from 'crypto'

// Admin-only endpoint: GET /api/admin/reset-link?email=x
// Requires: Authorization: Bearer ADMIN_SECRET
// Returns a password reset link you can send to a user via WhatsApp/Telegram.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization') ?? ''
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret || auth !== `Bearer ${adminSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  if (!email) return Response.json({ error: 'email param required' }, { status: 400 })

  const [user] = await db.select({ id: users.id, email: users.email, name: users.name })
    .from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1)

  if (!user) return Response.json({ error: 'No user with that email' }, { status: 404 })

  // Delete any existing unused tokens
  await db.delete(passwordResetTokens).where(
    and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt))
  )

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await db.insert(passwordResetTokens).values({ token, userId: user.id, expiresAt })

  const baseUrl = request.headers.get('host') ?? 'localhost:3000'
  const protocol = baseUrl.startsWith('localhost') ? 'http' : 'https'
  const resetLink = `${protocol}://${baseUrl}/reset-password?token=${token}`

  return Response.json({
    user: { email: user.email, name: user.name },
    resetLink,
    expiresAt: expiresAt.toISOString(),
    note: 'Send this link to the user. It expires in 24 hours and can only be used once.',
  })
}
