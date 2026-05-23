import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createSession } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (!checkRateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
    return Response.json({ error: 'Too many registration attempts. Try again in 1 hour.' }, { status: 429 })
  }

  const { email, password, name } = await request.json() as { email: string; password: string; name?: string }

  if (!email || !password) {
    return Response.json({ error: 'Email and password required' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (existing.length > 0) {
    return Response.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    name: name?.trim() || null,
    passwordHash,
  }).returning()

  await createSession({ userId: user.id, email: user.email, name: user.name ?? undefined })
  return Response.json({ ok: true })
}
