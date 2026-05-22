import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) return Response.json(null, { status: 401 })
  return Response.json({ userId: session.userId, email: session.email, name: session.name })
}
