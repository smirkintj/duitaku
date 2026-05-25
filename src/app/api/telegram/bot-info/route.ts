import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

let cached: { username: string; firstName: string } | null = null

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  if (cached) return Response.json(cached)

  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return Response.json({ username: null, firstName: null })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
    const data = await res.json() as { ok: boolean; result?: { username?: string; first_name?: string } }
    if (data.ok && data.result) {
      cached = { username: data.result.username ?? '', firstName: data.result.first_name ?? 'duitaku' }
      return Response.json(cached)
    }
  } catch {}

  return Response.json({ username: null, firstName: null })
}
