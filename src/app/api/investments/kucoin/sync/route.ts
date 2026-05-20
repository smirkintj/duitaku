import crypto from 'crypto'
import { db } from '@/db'
import { financeInvestments, financeApiKeys } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

function kucoinSign(secret: string, timestamp: string, method: string, path: string, body = '') {
  return crypto.createHmac('sha256', secret).update(timestamp + method + path + body).digest('base64')
}

function kucoinPassphrase(secret: string, passphrase: string) {
  return crypto.createHmac('sha256', secret).update(passphrase).digest('base64')
}

async function kucoinFetch(apiKey: string, apiSecret: string, apiPassphrase: string, path: string) {
  const timestamp = Date.now().toString()
  const res = await fetch(`https://api.kucoin.com${path}`, {
    headers: {
      'KC-API-KEY': apiKey,
      'KC-API-SIGN': kucoinSign(apiSecret, timestamp, 'GET', path),
      'KC-API-TIMESTAMP': timestamp,
      'KC-API-PASSPHRASE': kucoinPassphrase(apiSecret, apiPassphrase),
      'KC-API-KEY-VERSION': '2',
      'Content-Type': 'application/json',
    },
  })
  const json = await res.json()
  if (json?.code && json.code !== '200000') throw new Error(`KuCoin error ${json.code}: ${json.msg}`)
  return json
}

export async function POST() {
  try {
    const allKeys = await db.select().from(financeApiKeys)
    const keyMap = Object.fromEntries(allKeys.map(r => [r.key, r.value]))
    const apiKey = keyMap['kucoin_api_key']
    const apiSecret = keyMap['kucoin_api_secret']
    const apiPassphrase = keyMap['kucoin_api_passphrase']

    if (!apiKey || !apiSecret || !apiPassphrase) {
      return Response.json({ error: 'KuCoin credentials not configured' }, { status: 400 })
    }

    // Fetch all account types + KuCoin Earn positions in parallel
    const [accountsData, earnData, botData] = await Promise.all([
      kucoinFetch(apiKey, apiSecret, apiPassphrase, '/api/v1/accounts'),
      kucoinFetch(apiKey, apiSecret, apiPassphrase, '/api/v3/earn/saving/assets?status=ACTIVE&currentPage=1&pageSize=50').catch(() => null),
      kucoinFetch(apiKey, apiSecret, apiPassphrase, '/api/v2/strategy/spot/bots?status=active&page=1&pageSize=50').catch(() => null),
    ])

    const rawAccounts: { currency: string; balance: string; type?: string }[] = accountsData?.data ?? []
    const allAccounts: { currency: string; balance: string }[] = [...rawAccounts]

    // KuCoin Earn (flexible savings) — balance lives outside regular accounts
    if (earnData?.data?.items) {
      for (const item of earnData.data.items) {
        const currency = item.currency ?? item.asset
        const balance = item.holdBalance ?? item.totalAmount ?? item.balance ?? '0'
        if (currency && parseFloat(balance) > 0) {
          allAccounts.push({ currency, balance: String(balance) })
        }
      }
    }

    // Trading bot positions (requires Strategy API permission)
    if (botData?.data?.items) {
      for (const bot of botData.data.items) {
        const currency = bot.investCurrency ?? 'USDT'
        const invested = parseFloat(bot.totalInvestment ?? bot.investedAmount ?? '0')
        if (invested > 0) {
          allAccounts.push({ currency, balance: String(invested) })
        }
      }
    }

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
      const fxData = await fetch('https://open.er-api.com/v6/latest/USD').then(r => r.json())
      if (fxData?.rates?.MYR) usdMyrRate = fxData.rates.MYR
    } catch { /* fallback */ }

    // Fetch prices concurrently
    const holdings: { ticker: string; units: number; priceUSDT: number; valueMYR: number }[] = []
    await Promise.all(coins.map(async ([currency, balance]) => {
      let priceUSDT = 1
      if (currency !== 'USDT') {
        try {
          const priceData = await fetch(`https://api.kucoin.com/api/v1/market/stats?symbol=${currency}-USDT`).then(r => r.json())
          const last = parseFloat(priceData?.data?.last ?? '0')
          if (last > 0) priceUSDT = last
          else return
        } catch { return }
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
        await db.update(financeInvestments).set({ currentValue: h.valueMYR, units: h.units, lastSyncedAt: new Date() })
          .where(eq(financeInvestments.id, existing[0].id))
      } else {
        await db.insert(financeInvestments).values({
          name: `${h.ticker} (KuCoin)`, type: 'crypto', provider: 'kucoin',
          ticker: h.ticker, units: h.units, costBasis: 0, currentValue: h.valueMYR,
          currency: 'MYR', autoSync: true, lastSyncedAt: new Date(),
        })
      }
      synced++
    }

    return Response.json({
      synced,
      holdings,
      botApiAvailable: botData !== null,
      earnApiAvailable: earnData !== null,
      debug: {
        rawAccountCount: rawAccounts.length,
        rawAccountTypes: [...new Set(rawAccounts.map((a: { type?: string }) => a.type).filter(Boolean))],
        rawNonZero: rawAccounts.filter(a => parseFloat(a.balance) > 0.000001).map(a => ({ currency: a.currency, balance: a.balance, type: (a as { type?: string }).type })),
        earnItems: earnData?.data?.items?.length ?? 0,
      },
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
