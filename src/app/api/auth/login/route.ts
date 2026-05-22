import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createSession } from '@/lib/auth'

export async function POST(request: Request) {
  const { email, password } = await request.json() as { email: string; password: string }

  if (!email || !password) {
    return Response.json({ error: 'Email and password required' }, { status: 400 })
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (!user) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return Response.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  await createSession({ userId: user.id, email: user.email, name: user.name ?? undefined })
  return Response.json({ ok: true })
}
