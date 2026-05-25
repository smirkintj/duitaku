export interface GoldInsight {
  priceMYR: number       // per gram
  priceUSD: number       // per troy oz
  change30d: number      // % change over 30 days
  high30d: number        // 30-day high MYR/g
  low30d: number         // 30-day low MYR/g
  usdmyr: number         // exchange rate used
  signal: 'buy' | 'sell' | 'hold' | 'neutral'
  signalReason: string
}

export async function fetchGoldInsight(): Promise<GoldInsight | null> {
  try {
    const headers = { 'User-Agent': 'Mozilla/5.0' }
    const [goldRes, fxRes] = await Promise.all([
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=35d', { headers }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/USDMYR=X?interval=1d&range=5d', { headers }),
    ])
    if (!goldRes.ok || !fxRes.ok) return null

    const goldData = await goldRes.json() as { chart: { result: Array<{ indicators: { quote: Array<{ close: (number | null)[] }> } }> } }
    const fxData = await fxRes.json() as { chart: { result: Array<{ indicators: { quote: Array<{ close: (number | null)[] }> } }> } }

    const goldCloses = goldData.chart.result[0].indicators.quote[0].close.filter((v): v is number => v != null)
    const fxCloses = fxData.chart.result[0].indicators.quote[0].close.filter((v): v is number => v != null)

    if (goldCloses.length < 2 || fxCloses.length === 0) return null

    const currentUSD = goldCloses[goldCloses.length - 1]
    const usdmyr = fxCloses[fxCloses.length - 1]
    const TROY_OZ_TO_GRAM = 31.1035

    const myrPerGram = goldCloses.map(c => (c / TROY_OZ_TO_GRAM) * usdmyr)
    const currentMYR = myrPerGram[myrPerGram.length - 1]
    const high30d = Math.max(...myrPerGram)
    const low30d = Math.min(...myrPerGram)
    const change30d = ((goldCloses[goldCloses.length - 1] - goldCloses[0]) / goldCloses[0]) * 100
    const pctFromHigh = ((currentMYR - high30d) / high30d) * 100
    const pctFromLow = ((currentMYR - low30d) / low30d) * 100

    let signal: GoldInsight['signal'] = 'neutral'
    let signalReason = ''

    if (pctFromHigh <= -8) {
      signal = 'buy'
      signalReason = `Down ${Math.abs(pctFromHigh).toFixed(1)}% from 30-day high — historically a dip-buying window`
    } else if (pctFromLow >= 10 && change30d > 8) {
      signal = 'sell'
      signalReason = `Up ${pctFromLow.toFixed(1)}% from 30-day low and ${change30d.toFixed(1)}% over 30 days — consider taking partial profit`
    } else if (change30d > 4) {
      signal = 'hold'
      signalReason = `Up ${change30d.toFixed(1)}% over 30 days — momentum is bullish, hold or trail stop-loss`
    } else if (change30d < -4) {
      signal = 'hold'
      signalReason = `Down ${Math.abs(change30d).toFixed(1)}% over 30 days — wait for price to stabilise before adding`
    } else {
      signal = 'neutral'
      signalReason = `Price is stable (${change30d >= 0 ? '+' : ''}${change30d.toFixed(1)}% over 30 days)`
    }

    return { priceMYR: currentMYR, priceUSD: currentUSD, change30d, high30d, low30d, usdmyr, signal, signalReason }
  } catch {
    return null
  }
}

export function goldSignalEmoji(signal: GoldInsight['signal']): string {
  return { buy: '🟢', sell: '🔴', hold: '🟡', neutral: '⚪' }[signal]
}
