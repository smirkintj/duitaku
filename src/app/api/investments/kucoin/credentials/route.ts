import { db } from '@/db'
import { financeApiKeys } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'
import { encrypt } from '@/lib/encrypt'

const KEYS = ['kucoin_api_key', 'kucoin_api_secret', 'kucoin_api_passphrase'] as const

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const rows = await db.select({ key: financeApiKeys.key })
    .from(financeApiKeys)
    .where(eq(financeApiKeys.userId, userId))

  const keySet = new Set(rows.map(r => r.key))
  const configured = KEYS.every(k => keySet.has(k))
  return Response.json({ configured })
}

export async function POST(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const body = await request.json() as { apiKey: string; apiSecret: string; apiPassphrase: string }

  const upsert = async (key: string, plaintext: string) => {
    const value = encrypt(plaintext)
    const existing = await db.select({ key: financeApiKeys.key })
      .from(financeApiKeys)
      .where(and(eq(financeApiKeys.userId, userId), eq(financeApiKeys.key, key)))
      .limit(1)
    if (existing.length > 0) {
      await db.update(financeApiKeys)
        .set({ value, updatedAt: new Date() })
        .where(and(eq(financeApiKeys.userId, userId), eq(financeApiKeys.key, key)))
    } else {
      await db.insert(financeApiKeys).values({ userId, key, value })
    }
  }

  await Promise.all([
    upsert('kucoin_api_key', body.apiKey),
    upsert('kucoin_api_secret', body.apiSecret),
    upsert('kucoin_api_passphrase', body.apiPassphrase),
  ])

  return Response.json({ ok: true })
}

export async function DELETE(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  await db.delete(financeApiKeys).where(eq(financeApiKeys.userId, userId))
  return Response.json({ ok: true })
}
