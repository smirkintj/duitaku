import { db } from '@/db'
import { financeApiKeys } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const allKeys = await db.select().from(financeApiKeys)
  const keySet = new Set(allKeys.map(r => r.key))
  const configured =
    keySet.has('kucoin_api_key') &&
    keySet.has('kucoin_api_secret') &&
    keySet.has('kucoin_api_passphrase')
  return Response.json({ configured })
}

export async function POST(request: Request) {
  const body = await request.json() as { apiKey: string; apiSecret: string; apiPassphrase: string }

  const upsert = async (key: string, value: string) => {
    const existing = await db.select().from(financeApiKeys).where(eq(financeApiKeys.key, key)).limit(1)
    if (existing.length > 0) {
      await db.update(financeApiKeys).set({ value, updatedAt: new Date() }).where(eq(financeApiKeys.key, key))
    } else {
      await db.insert(financeApiKeys).values({ key, value })
    }
  }

  await Promise.all([
    upsert('kucoin_api_key', body.apiKey),
    upsert('kucoin_api_secret', body.apiSecret),
    upsert('kucoin_api_passphrase', body.apiPassphrase),
  ])

  return Response.json({ ok: true })
}
