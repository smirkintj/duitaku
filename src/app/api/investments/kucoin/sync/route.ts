import crypto from 'crypto'
import { db } from '@/db'
import { financeInvestments, financeApiKeys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

function kucoinSign(secret: string, timestamp: string, method: string, path: string, body = '') {
  const str = timestamp + method + path + body
  return crypto.createHmac('sha256', secret).update(str).digest('base64')
}

function kucoinPassphrase(secret: string, passphrase: string) {
  return crypto.createHmac('sha256', secret).update(passphrase).digest('base64')
}

async function kucoinFetch(apiKey: string, apiSecret: string, apiPassphrase: string, path: string) {
  const timestamp = Date.now().toString()
  const sig = kucoinSign(apiSecret, timestamp, 'GET', path)
  const passEncoded = kucoinPassphrase(apiSecret, apiPassphrase)

  const res = await fetch(`https://api.kucoin.com${path}`, {
    headers: {
      'KC-API-KEY': apiKey,
      'KC-API-SIGN': sig,
      'KC-API-TIMESTAMP': timestamp,
      'KC-API-PASSPHRASE': passEncoded,
      'KC-API-KEY-VERSION': '2',
      'Content-Type': 'application/json',
    },
  })

  const json = await res.json()
  if (json?.code && json.code !== '200000') {
    throw new Error(`KuCoin error ${json.code}: ${json.msg}`)
  }
  return json
}

export async function POST() {
  try {
    // Load credentials
    const allKeys = await db.select().from(financeApiKeys)
    const keyMap = Object.fromEntries(allKeys.map(r => [r.key, r.value]))

    const apiKey = keyMap['kucoin_api_key']
    const apiSecret = keyMap['kucoin_api_secret']
    const apiPassphrase = keyMap['kucoin_api_passphrase']

    if (!apiKey || !apiSecret || !apiPassphrase) {
      return Response.json({ error: 'KuCoin credentials not configured' }, { status: 400 })
    }

    // Fetch all account types in parallel (trade_hf = Trading Bot/DCA)
    const [tradeData, mainData, tradeHfData] = await Promise.all([
      kucoinFetch(apiKey, apiSecret, apiPassphrase, '/api/v1/accounts?type=trade'),
      kucoinFetch(apiKey, apiSecret, apiPassphrase, '/api/v1/accounts?type=main'),
      kucoinFetch(apiKey, apiSecret, apiPassphrase, '/api/v1/accounts?type=trade_hf').catch((e: Error) => ({ error: e.message })),
    ])

    const allAccounts: { currency: string; balance: string }[] = [
      ...(tradeData?.data ?? []),
      ...(mainData?.data ?? []),
      ...(tradeHfData?.data ?? []),
    ]

    // Debug: expose raw account data temporarily
    const _debug = { tradeData, mainData, tradeHfData }

    // Sum balances per currency
    const balanceMap: Record<string, number> = {}
    for (const acc of allAccounts) {
      const bal = parseFloat(acc.balance) || 0
      balanceMap[acc.currency] = (balanceMap[acc.currency] ?? 0) + bal
    }

    const STABLECOINS = new Set(['USDC', 'BUSD', 'TUSD', 'DAI'])
    const coins = Object.entries(balanceMap).filter(
      ([currency, balance]) => balance > 0.000001 && !STABLECOINS.has(currency)
    )

    // Get USD→MYR rate
    let usdMyrRate = 4.45
    try {
      const fxRes = await fetch('https://open.er-api.com/v6/latest/USD')
      const fxData = await fxRes.json()
      if (fxData?.rates?.MYR) usdMyrRate = fxData.rates.MYR
    } catch {
      // fallback to hardcoded rate
    }

    // Fetch prices concurrently
    const holdings: { ticker: string; units: number; priceUSDT: number; valueMYR: number }[] = []

    await Promise.all(coins.map(async ([currency, balance]) => {
      let priceUSDT = 1

      if (currency !== 'USDT') {
        try {
          const priceRes = await fetch(`https://api.kucoin.com/api/v1/market/stats?symbol=${currency}-USDT`)
          const priceData = await priceRes.json()
          const last = parseFloat(priceData?.data?.last ?? '0')
          if (last > 0) priceUSDT = last
          else return
        } catch {
          return
        }
      }

      holdings.push({ ticker: currency, units: balance, priceUSDT, valueMYR: balance * priceUSDT * usdMyrRate })
    }))

    // Upsert investments
    let synced = 0
    for (const h of holdings) {
      const existing = await db.select().from(financeInvestments)
        .where(and(eq(financeInvestments.ticker, h.ticker), eq(financeInvestments.provider, 'kucoin')))
        .limit(1)

      if (existing.length > 0) {
        await db.update(financeInvestments).set({
          currentValue: h.valueMYR,
          units: h.units,
          lastSyncedAt: new Date(),
        }).where(eq(financeInvestments.id, existing[0].id))
      } else {
        await db.insert(financeInvestments).values({
          name: `${h.ticker} (KuCoin)`,
          type: 'crypto',
          provider: 'kucoin',
          ticker: h.ticker,
          units: h.units,
          costBasis: 0,
          currentValue: h.valueMYR,
          currency: 'MYR',
          autoSync: true,
          lastSyncedAt: new Date(),
        })
      }
      synced++
    }

    return Response.json({ synced, holdings, _debug })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}
