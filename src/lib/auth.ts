import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function getSecret(): Uint8Array {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET environment variable is not set. Generate one with: openssl rand -base64 32')
  return new TextEncoder().encode(s)
}

const COOKIE = 'duitaku_session'

export interface SessionPayload {
  userId: string
  email: string
  name?: string
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(COOKIE)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE)
}

/** Read session from a Request object (for API routes) */
export async function getSessionFromRequest(request: Request): Promise<SessionPayload | null> {
  try {
    const cookie = request.headers.get('cookie') ?? ''
    const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`))
    if (!match) return null
    const { payload } = await jwtVerify(match[1], getSecret())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
