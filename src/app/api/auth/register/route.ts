import { db } from '@/db'
import { users, pendingRegistrations } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { Resend } from 'resend'

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function POST(request: Request) {
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
  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Clear any previous pending registration for this email
  await db.delete(pendingRegistrations).where(eq(pendingRegistrations.email, email.toLowerCase()))

  const [pending] = await db.insert(pendingRegistrations).values({
    email: email.toLowerCase(),
    name: name?.trim() || null,
    passwordHash,
    otp,
    expiresAt,
  }).returning()

  if (!process.env.RESEND_API_KEY) {
    // Dev fallback: log OTP to console
    console.log(`[DEV] OTP for ${email}: ${otp}`)
    return Response.json({ pendingId: pending.id, dev: true })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const fromAddress = process.env.RESEND_FROM ?? 'noreply@resend.dev'

  try {
    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: 'Your duitaku verification code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 32px 24px; background: #0d0d0d; color: #f5f5f4; border-radius: 12px;">
          <div style="font-size: 22px; font-weight: 800; color: #a3e635; margin-bottom: 8px;">duitaku</div>
          <p style="color: #a1a1a0; font-size: 14px; margin: 0 0 24px;">Your verification code</p>
          <div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #f5f5f4; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #5b5b59; font-size: 12px; margin: 0;">This code expires in 10 minutes. If you did not request this, you can safely ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('Resend error:', err)
    return Response.json({ error: 'Failed to send verification email' }, { status: 502 })
  }

  return Response.json({ pendingId: pending.id })
}
