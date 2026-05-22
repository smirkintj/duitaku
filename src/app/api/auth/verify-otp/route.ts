import { db } from '@/db'
import { users, pendingRegistrations } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { createSession } from '@/lib/auth'

export async function POST(request: Request) {
  const { pendingId, otp } = await request.json() as { pendingId: string; otp: string }

  if (!pendingId || !otp) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  const [pending] = await db
    .select()
    .from(pendingRegistrations)
    .where(and(eq(pendingRegistrations.id, pendingId), gt(pendingRegistrations.expiresAt, new Date())))
    .limit(1)

  if (!pending) {
    return Response.json({ error: 'Code expired or invalid. Please register again.' }, { status: 400 })
  }

  if (pending.otp !== otp.trim()) {
    return Response.json({ error: 'Incorrect code. Please try again.' }, { status: 400 })
  }

  // Check email not taken (race condition guard)
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, pending.email)).limit(1)
  if (existing.length > 0) {
    await db.delete(pendingRegistrations).where(eq(pendingRegistrations.id, pendingId))
    return Response.json({ error: 'An account with this email already exists' }, { status: 409 })
  }

  const [user] = await db.insert(users).values({
    email: pending.email,
    name: pending.name,
    passwordHash: pending.passwordHash,
  }).returning()

  await db.delete(pendingRegistrations).where(eq(pendingRegistrations.id, pendingId))
  await createSession({ userId: user.id, email: user.email, name: user.name ?? undefined })

  return Response.json({ ok: true })
}
