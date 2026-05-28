import { db } from '@/db'
import {
  telegramConnections,
  userSettings,
  financeTransactions,
  financeSalary,
  financeCategories,
} from '@/db/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'
import { getPayCycle, getCurrentBaseMonth, prevCycleMonth } from '@/lib/pay-cycle'

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const todayStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const today = new Date()

  // Fetch all Telegram-connected users
  const connections = await db.select().from(telegramConnections)
  let sent = 0

  for (const conn of connections) {
    const userId = conn.userId

    // Fetch user settings for payDay
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId))
    const payDay = settings?.payDay ?? 1

    // Compute current cycle
    const baseMonth = getCurrentBaseMonth(today, payDay)
    const cycle = getPayCycle(baseMonth, payDay)

    // Only send if today is the last day of the cycle
    if (cycle.endDate !== todayStr) continue

    // Fetch current cycle transactions
    const [curTxs, salary, cats] = await Promise.all([
      db.select().from(financeTransactions)
        .where(and(
          eq(financeTransactions.userId, userId),
          gte(financeTransactions.date, cycle.startDate),
          lte(financeTransactions.date, cycle.endDate),
        )),
      db.select().from(financeSalary)
        .where(eq(financeSalary.userId, userId))
        .orderBy(desc(financeSalary.createdAt))
        .limit(1),
      db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
    ])

    // Fetch previous cycle transactions
    const prevBase = prevCycleMonth(baseMonth)
    const prevCycle = getPayCycle(prevBase, payDay)
    const prevTxs = await db.select().from(financeTransactions)
      .where(and(
        eq(financeTransactions.userId, userId),
        gte(financeTransactions.date, prevCycle.startDate),
        lte(financeTransactions.date, prevCycle.endDate),
      ))

    const catMap = new Map(cats.map(c => [c.id, c.name]))
    const netSalary = salary[0]?.amount ?? 0

    // Current cycle totals
    const curExpenses = curTxs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
    const curIncome = curTxs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0)

    // Previous cycle totals
    const prevExpenses = prevTxs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)

    const savingsAmt = netSalary > 0 ? netSalary - curExpenses : curIncome - curExpenses
    const savingsRate = netSalary > 0 && netSalary > 0
      ? Math.round((savingsAmt / netSalary) * 100)
      : curIncome > 0 ? Math.round((savingsAmt / curIncome) * 100) : 0

    // Category breakdown for current cycle
    const catSpend: Record<string, number> = {}
    for (const tx of curTxs.filter(t => t.type === 'expense')) {
      const cat = tx.categoryId ? (catMap.get(tx.categoryId) ?? 'Uncategorised') : 'Uncategorised'
      catSpend[cat] = (catSpend[cat] ?? 0) + tx.amount
    }

    // Previous cycle category breakdown
    const prevCatSpend: Record<string, number> = {}
    for (const tx of prevTxs.filter(t => t.type === 'expense')) {
      const cat = tx.categoryId ? (catMap.get(tx.categoryId) ?? 'Uncategorised') : 'Uncategorised'
      prevCatSpend[cat] = (prevCatSpend[cat] ?? 0) + tx.amount
    }

    // Biggest mover (category with highest absolute change vs previous cycle)
    let biggestMover = ''
    let biggestDelta = 0
    for (const [cat, amount] of Object.entries(catSpend)) {
      const prev = prevCatSpend[cat] ?? 0
      const delta = Math.abs(amount - prev)
      if (delta > biggestDelta) {
        biggestDelta = delta
        biggestMover = cat
      }
    }

    const expenseDelta = prevExpenses > 0
      ? ((curExpenses - prevExpenses) / prevExpenses * 100).toFixed(1)
      : null

    const rm = (n: number) => `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

    let msg = `<b>Cycle summary — ${cycle.label}</b>\n\n`
    msg += `Total spent: <b>${rm(curExpenses)}</b>`
    if (expenseDelta !== null) {
      const sign = parseFloat(expenseDelta) > 0 ? '+' : ''
      msg += ` (${sign}${expenseDelta}% vs last cycle)`
    }
    msg += '\n'

    if (netSalary > 0) {
      msg += `Savings rate: <b>${savingsRate}%</b> (${rm(Math.abs(savingsAmt))} ${savingsAmt >= 0 ? 'saved' : 'over'})\n`
    }

    if (biggestMover && biggestDelta > 0) {
      const cur = catSpend[biggestMover] ?? 0
      const prev = prevCatSpend[biggestMover] ?? 0
      const up = cur > prev
      msg += `\nBiggest mover: <b>${biggestMover}</b> ${up ? '▲' : '▼'} ${rm(Math.abs(cur - prev))}\n`
      msg += `  ${rm(prev)} → ${rm(cur)}\n`
    }

    // Top 3 categories
    const topCats = Object.entries(catSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    if (topCats.length > 0) {
      msg += `\nTop categories:\n`
      for (const [cat, amt] of topCats) {
        msg += `  ${cat}: ${rm(amt)}\n`
      }
    }

    msg += `\nHave a great next cycle!`

    await sendTelegramMessage(conn.telegramChatId, msg)
    sent++
  }

  return Response.json({ sent, date: todayStr })
}
