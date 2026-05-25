export interface AssetInsight {
  label: string          // display name e.g. "Gold", "Bitcoin", "KLCI"
  ticker: string         // Yahoo Finance ticker
  price: number          // current price in native currency
  currency: string       // USD, MYR, etc.
  priceMYR?: number      // converted to MYR if source is USD
  change30d: number      // % change over 30 days
  high30d: number
  low30d: number
  signal: 'buy' | 'sell' | 'hold' | 'neutral'
  signalReason: string
}

// Map investment type/name keywords → Yahoo Finance ticker + metadata
const ASSET_MAP: { keywords: string[]; ticker: string; label: string; currency: string; isMYR?: boolean }[] = [
  { keywords: ['gold', 'emas', 'public gold', 'maybank gold', 'pgold', 'xau'], ticker: 'GC=F',    label: 'Gold',         currency: 'USD' },
  { keywords: ['silver', 'perak', 'xag'],                                       ticker: 'SI=F',    label: 'Silver',       currency: 'USD' },
  { keywords: ['bitcoin', 'btc'],                                                ticker: 'BTC-USD', label: 'Bitcoin',      currency: 'USD' },
  { keywords: ['ethereum', 'eth'],                                               ticker: 'ETH-USD', label: 'Ethereum',     currency: 'USD' },
  { keywords: ['solana', 'sol'],                                                 ticker: 'SOL-USD', label: 'Solana',       currency: 'USD' },
  { keywords: ['crypto'],                                                        ticker: 'BTC-USD', label: 'Bitcoin',      currency: 'USD' },
  { keywords: ['oil', 'crude', 'petroleum'],                                     ticker: 'CL=F',    label: 'Crude Oil',    currency: 'USD' },
  { keywords: ['klci', 'klse', 'bursa', 'stock market', 'malaysia market'],     ticker: '^KLSE',   label: 'KLCI',         currency: 'MYR', isMYR: true },
  { keywords: ['s&p', 'sp500', 's&p500', 'us market'],                          ticker: '^GSPC',   label: 'S&P 500',      currency: 'USD' },
  { keywords: ['nasdaq'],                                                         ticker: '^IXIC',   label: 'Nasdaq',       currency: 'USD' },
  { keywords: ['ringgit', 'usdmyr', 'usd/myr', 'dollar'],                       ticker: 'USDMYR=X',label: 'USD/MYR',      currency: 'MYR', isMYR: true },
]

async function fetchUSDMYR(): Promise<number> {
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDMYR=X?interval=1d&range=5d', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) return 4.5
    const data = await res.json() as { chart: { result: Array<{ indicators: { quote: Array<{ close: (number | null)[] }> } }> } }
    const closes = data.chart.result[0].indicators.quote[0].close.filter((v): v is number => v != null)
    return closes[closes.length - 1] ?? 4.5
  } catch {
    return 4.5
  }
}

export async function fetchAssetInsight(ticker: string, label: string, currency: string, isMYR = false): Promise<AssetInsight | null> {
  try {
    const [res, usdmyr] = await Promise.all([
      fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=35d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }),
      isMYR || currency === 'MYR' ? Promise.resolve(1) : fetchUSDMYR(),
    ])
    if (!res.ok) return null

    const data = await res.json() as { chart: { result: Array<{ indicators: { quote: Array<{ close: (number | null)[] }> } }> } }
    const closes = data.chart.result[0].indicators.quote[0].close.filter((v): v is number => v != null)
    if (closes.length < 2) return null

    const current = closes[closes.length - 1]
    const change30d = ((current - closes[0]) / closes[0]) * 100
    const high30d = Math.max(...closes)
    const low30d = Math.min(...closes)
    const pctFromHigh = ((current - high30d) / high30d) * 100
    const pctFromLow = ((current - low30d) / low30d) * 100

    // For USD-priced assets, also compute MYR equivalent
    // Gold: price is per troy oz → convert to per gram for MYR display
    let priceMYR: number | undefined
    if (currency === 'USD' && !isMYR) {
      const divisor = ticker === 'GC=F' || ticker === 'SI=F' ? 31.1035 : 1  // metals → per gram
      priceMYR = (current / (ticker === 'GC=F' || ticker === 'SI=F' ? divisor : 1)) * usdmyr
    }

    let signal: AssetInsight['signal'] = 'neutral'
    let signalReason = ''

    if (pctFromHigh <= -10) {
      signal = 'buy'
      signalReason = `Down ${Math.abs(pctFromHigh).toFixed(1)}% from 30-day high — potential dip opportunity`
    } else if (pctFromHigh <= -5) {
      signal = 'buy'
      signalReason = `Down ${Math.abs(pctFromHigh).toFixed(1)}% from 30-day high — pulling back from recent peak`
    } else if (pctFromLow >= 15 && change30d > 10) {
      signal = 'sell'
      signalReason = `Up ${change30d.toFixed(1)}% over 30 days — consider taking partial profit`
    } else if (change30d > 5) {
      signal = 'hold'
      signalReason = `Up ${change30d.toFixed(1)}% over 30 days — positive momentum, hold position`
    } else if (change30d < -7) {
      signal = 'hold'
      signalReason = `Down ${Math.abs(change30d).toFixed(1)}% over 30 days — wait for stabilisation`
    } else {
      signal = 'neutral'
      signalReason = `Stable (${change30d >= 0 ? '+' : ''}${change30d.toFixed(2)}% over 30 days)`
    }

    return { label, ticker, price: current, currency, priceMYR, change30d, high30d, low30d, signal, signalReason }
  } catch {
    return null
  }
}

/** Resolve a freeform query like "bitcoin", "KLCI", "oil" to a ticker */
export function resolveAsset(query: string): { ticker: string; label: string; currency: string; isMYR: boolean } | null {
  const lower = query.toLowerCase().trim()

  // Direct ticker lookup (e.g. user typed "AAPL", "1155.KL")
  if (/^[A-Z0-9^.=\-]+$/.test(query.toUpperCase()) && query.length <= 10) {
    // Bursa Malaysia stocks end in .KL
    const ticker = /^\d{4}$/.test(query) ? `${query}.KL` : query.toUpperCase()
    return { ticker, label: query.toUpperCase(), currency: ticker.endsWith('.KL') ? 'MYR' : 'USD', isMYR: ticker.endsWith('.KL') }
  }

  for (const asset of ASSET_MAP) {
    if (asset.keywords.some(k => lower.includes(k))) {
      return { ticker: asset.ticker, label: asset.label, currency: asset.currency, isMYR: asset.isMYR ?? false }
    }
  }
  return null
}

/** Given a list of investment names+types, return unique asset insights to fetch */
export function investmentTypesToAssets(investments: { name: string; type: string; ticker?: string | null }[]): { ticker: string; label: string; currency: string; isMYR: boolean }[] {
  const seen = new Set<string>()
  const result: { ticker: string; label: string; currency: string; isMYR: boolean }[] = []

  for (const inv of investments) {
    // Use explicit ticker field first
    if (inv.ticker) {
      const t = inv.ticker.toUpperCase()
      if (!seen.has(t)) {
        seen.add(t)
        result.push({ ticker: t, label: inv.name, currency: t.endsWith('.KL') ? 'MYR' : 'USD', isMYR: t.endsWith('.KL') })
      }
      continue
    }
    // Match by name/type keywords
    const query = `${inv.name} ${inv.type}`.toLowerCase()
    for (const asset of ASSET_MAP) {
      if (asset.keywords.some(k => query.includes(k))) {
        if (!seen.has(asset.ticker)) {
          seen.add(asset.ticker)
          result.push({ ticker: asset.ticker, label: asset.label, currency: asset.currency, isMYR: asset.isMYR ?? false })
        }
        break
      }
    }
  }
  return result
}

export function signalEmoji(signal: AssetInsight['signal']): string {
  return { buy: '🟢', sell: '🔴', hold: '🟡', neutral: '⚪' }[signal]
}

// Keep backward compat
export async function fetchGoldInsight() {
  return fetchAssetInsight('GC=F', 'Gold', 'USD')
}
export function goldSignalEmoji(signal: AssetInsight['signal']) { return signalEmoji(signal) }
