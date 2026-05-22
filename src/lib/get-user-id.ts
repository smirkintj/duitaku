import { getSession, getSessionFromRequest } from './auth'

/** For use in Server Components and Route Handlers that call cookies() */
export async function getUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.userId ?? null
}

/** For use in API Route Handlers — reads from the incoming Request */
export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const session = await getSessionFromRequest(request)
  return session?.userId ?? null
}

export function unauthorized() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}
