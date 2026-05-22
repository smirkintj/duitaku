import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'duitaku-dev-secret-change-in-production'
)
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
    .sign(SECRET)

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
    const { payload } = await jwtVerify(token, SECRET)
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
    const { payload } = await jwtVerify(match[1], SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}
