// SQL migration required (run in Neon):
// CREATE TABLE telegram_connections (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, telegram_chat_id TEXT NOT NULL UNIQUE, linked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL);
// CREATE TABLE telegram_link_codes (code TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL);
// CREATE TABLE telegram_pending (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, intent TEXT NOT NULL, data TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);

import { db } from '@/db'
import {
  telegramConnections,
  telegramLinkCodes,
  telegramPending,
  financeBills,
  financeBillPayments,
  financeTransactions,
  financeLoans,
  financeInvestments,
  financeAccounts,
} from '@/db/schema'
import { and, eq, gte, lte, desc, sql, isNotNull } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { validateAmount } from '@/lib/validate'
import { checkRateLimit } from '@/lib/rate-limit'

function toTitleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w/g, c => c.toLowerCase())
}

function normalizeAccountName(s: string): string {
  return s.toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
import { fetchAssetInsight, investmentTypesToAssets, resolveAsset, signalEmoji } from '@/lib/market-data'

interface TelegramChat { id: number }
interface TelegramMessage { text?: string; chat?: TelegramChat }
interface TelegramUpdate { message?: TelegramMessage }

interface ParsedIntent {
  intent: 'mark_bill_paid' | 'add_expense' | 'add_income' | 'check_balance' |
          'check_loans' | 'check_investments' | 'check_net_worth' |
          'payment_history' | 'recent_transactions' | 'market_insights' | 'topup' |
          'pay_loan' | 'unknown'
  billId?: string
  billName?: string
  loanId?: string
  loanName?: string
  amount?: number
  merchant?: string
  note?: string | null
  query?: string  // for payment_history: what to look up
  account_name?: string  // for topup intent
  _?: string
}

async function sendMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

async function handleLink(chatId: string, code: string | undefined): Promise<void> {
  if (!code) {
    await sendMessage(chatId, "Please send a code like: /start 123456\n\nGenerate a code in duitaku → Settings → Connect Telegram.")
    return
  }

  if (!checkRateLimit(`tg-link:${chatId}`, 10, 15 * 60 * 1000)) {
    await sendMessage(chatId, "Too many attempts. Please wait 15 minutes or generate a new code in duitaku Settings.")
    return
  }

  const [linkCode] = await db.select().from(telegramLinkCodes)
    .where(eq(telegramLinkCodes.code, code)).limit(1)

  if (!linkCode || linkCode.expiresAt < new Date()) {
    await sendMessage(chatId, "Code invalid or expired. Generate a new one in duitaku Settings.")
    return
  }

  await db.insert(telegramConnections).values({
    userId: linkCode.userId,
    telegramChatId: chatId,
  }).onConflictDoUpdate({
    target: telegramConnections.userId,
    set: { telegramChatId: chatId, linkedAt: new Date() },
  })

  await db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.code, code))

  await sendMessage(chatId, `Your Telegram is now linked to duitaku!

Here's what I can do:

SPENDING
• "spent RM45 at lunch" — log an expense
• "received RM500" — log income
• "topup RM100 to TnG" — top up an account
• "paid celcomdigi" — mark a bill as paid
• "paid proton x50" — log a loan installment

BALANCE & OVERVIEW
• "how much left" — this month's budget
• "net worth" — assets vs liabilities
• "my investments" — portfolio summary
• "how much loan" — loan balances

HISTORY
• "last 5 transactions" — recent spending
• "when did i pay celcomdigi" — payment history

MARKET
• "gold" / "KLSE" / "BTC" — live price + signal

Send /help anytime to see this list again.`)
}

const HELP_TEXT = `What I can do:

SPENDING
• "spent RM45 at lunch" — log expense
• "received RM500 bonus" — log income
• "topup RM100 to TnG" — top up account
• "paid celcomdigi" — mark bill as paid
• "paid proton x50" — log loan installment

BALANCE
• "how much left" — monthly budget
• "net worth" — assets vs liabilities
• "my investments" — portfolio
• "how much loan" — loan balances

HISTORY
• "last 5 transactions" — recent spending
• "when did i pay unifi" — payment history

MARKET
• "gold" / "KLSE" / "BTC" — live price + signal

Just type naturally — I'll understand most phrasings.`

function fmt(n: number) { return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function handleMessage(userId: string, chatId: string, text: string): Promise<void> {
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${monthStr}-01`
  const monthEnd = `${monthStr}-31`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Check for pending multi-turn state (e.g. awaiting account name for topup)
  const [pending] = await db.select().from(telegramPending)
    .where(and(eq(telegramPending.userId, userId), gte(telegramPending.expiresAt, now)))
    .limit(1)

  if (pending?.intent === 'topup') {
    const pendingData = JSON.parse(pending.data) as { amount: number }
    const accountQuery = normalizeAccountName(text)
    const userAccounts = await db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId))
    const matched = userAccounts.find(a => {
      const norm = normalizeAccountName(a.name)
      return norm.includes(accountQuery) || accountQuery.includes(norm)
    })

    if (matched) {
      await db.delete(telegramPending).where(eq(telegramPending.userId, userId))
      let amount: number
      try { amount = validateAmount(pendingData.amount) } catch {
        await sendMessage(chatId, 'Invalid amount stored in pending topup. Please try again.')
        return
      }
      await db.insert(financeTransactions).values({
        userId, accountId: matched.id, amount, currency: 'MYR', date: today,
        note: 'Top-up via Telegram', type: 'topup',
      })
      const [topupRow] = await db.select({
        total: sql<number>`coalesce(sum(${financeTransactions.amount}), 0)`,
      }).from(financeTransactions).where(and(
        eq(financeTransactions.userId, userId),
        eq(financeTransactions.accountId, matched.id),
        eq(financeTransactions.type, 'topup'),
        sql`${financeTransactions.date} like ${monthStr + '-%'}`,
      ))
      const toppedUpTotal = Number(topupRow?.total ?? 0)
      if (matched.monthlyAllocation) {
        const remaining = matched.monthlyAllocation - toppedUpTotal
        await sendMessage(chatId, `Added RM${fmt(amount)} to ${matched.name}.\n\nMonthly budget: RM${fmt(matched.monthlyAllocation)}\nTopped up: RM${fmt(toppedUpTotal)} this month\nRemaining: RM${fmt(remaining)}`)
      } else {
        await sendMessage(chatId, `Added RM${fmt(amount)} to ${matched.name}.`)
      }
      return
    } else {
      const names = userAccounts.map(a => `• ${a.name}`).join('\n')
      await sendMessage(chatId, `Couldn't find that account. Which account?\n${names || '(no accounts found)'}`)
      return
    }
  }

  const [bills, activeLoans] = await Promise.all([
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeLoans).where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true))),
  ])

  const monthTxns = await db.select().from(financeTransactions)
    .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, monthStart), lte(financeTransactions.date, monthEnd)))

  const totalSpent = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const totalIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)

  // Keyword pre-matching (fast path)
  let parsed: ParsedIntent = { intent: 'unknown' }
  const lower = text.toLowerCase()

  if (lower === 'how much' || lower === 'berapa' || lower === 'baki') {
    await sendMessage(chatId, `How much what?\n• "how much left" — this month's balance\n• "how much loan" — loan summary\n• "my investments" — portfolio\n• "net worth" — total assets vs liabilities`)
    return
  }

  if (['how much left', 'baki', 'check balance', 'how much do i have', 'remaining this month'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_balance' }
  } else if (['balance'].some(k => lower === k || lower.startsWith(k + ' '))) {
    parsed = { intent: 'check_balance' }
  } else if (['how much loan', 'my loan', 'my debt', 'hutang', 'loan balance', 'berapa hutang', 'outstanding loan'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_loans' }
  } else if (['price', 'signal', 'market', 'pasaran', 'harga'].some(k => lower.includes(k)) || resolveAsset(lower) !== null) {
    parsed = { intent: 'market_insights', query: lower }
  } else if (['my investment', 'investment', 'portfolio', 'epf', 'amanah saham', 'asb', 'unit trust', 'berapa invest'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_investments' }
  } else if (['net worth', 'total assets', 'kekayaan', 'berapa kaya'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_net_worth' }
  } else if (['when did i pay', 'last paid', 'last payment', 'bila bayar', 'have i paid'].some(k => lower.includes(k))) {
    const query = lower.replace(/when did i pay|last paid|last payment|bila bayar|have i paid/g, '').trim()
    parsed = { intent: 'payment_history', query }
  } else if (['last transactions', 'recent transactions', 'last spending', 'what did i spend', 'recent expenses', 'tunjuk transaction'].some(k => lower.includes(k))) {
    parsed = { intent: 'recent_transactions' }
  } else if (['paid ', 'bayar ', 'dah bayar'].some(k => lower.startsWith(k) || lower.includes(k))) {
    const matchedBill = bills.find(b => lower.includes(b.name.toLowerCase()))
    if (matchedBill) {
      parsed = { intent: 'mark_bill_paid', billId: matchedBill.id, billName: matchedBill.name }
    } else {
      const matchedLoan = activeLoans.find(l =>
        lower.includes(l.name.toLowerCase()) ||
        l.name.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))
      )
      if (matchedLoan) parsed = { intent: 'pay_loan', loanId: matchedLoan.id, loanName: matchedLoan.name }
    }
  } else if (['spent ', 'spend ', 'beli ', 'bought '].some(k => lower.includes(k))) {
    // Match "RM12.30" or bare "12.30"
    const amtMatch = text.match(/rm\s*(\d+(?:\.\d+)?)/i) ?? text.match(/\b(\d+(?:[.,]\d+)?)\b/)
    if (amtMatch) {
      const amount = parseFloat(amtMatch[1].replace(',', '.'))
      // "using Ryt" or "at Ryt" → merchant
      const usingMatch = text.match(/\b(?:using|at|via|through)\s+([^\s]+(?:\s+[^\s]+)?)/i)
      const merchant = usingMatch ? toTitleCase(usingMatch[1].trim()) : null
      // Everything left after removing verb, amount, merchant clause = note
      const note = text
        .replace(/rm\s*\d+(?:[.,]\d+)?/i, '')
        .replace(/\b\d+(?:[.,]\d+)?\b/, '')
        .replace(/\b(?:using|at|via|through)\s+\S+(?:\s+\S+)?/i, '')
        .replace(/\bspent?\b|\bspend\b|\bbeli\b|\bbought\b/i, '')
        .replace(/\s+/g, ' ').trim() || null
      parsed = { intent: 'add_expense', amount, merchant: merchant ?? undefined, note }
    }
  } else if (['received ', 'got paid', 'income ', 'masuk rm', 'dapat '].some(k => lower.includes(k))) {
    const amtMatch = text.match(/rm\s*(\d+(?:\.\d+)?)/i) ?? text.match(/\b(\d+(?:[.,]\d+)?)\b/)
    if (amtMatch) parsed = { intent: 'add_income', amount: parseFloat(amtMatch[1].replace(',', '.')), note: text }
  } else if (/\b(top.?up|topup|reload|tambah)\b/i.test(lower)) {
    const amtMatch = text.match(/rm\s*(\d+(?:[.,]\d+)?)/i) ?? text.match(/(\d+(?:[.,]\d+)?)/)
    // Match "to X", "at X", "ke X", "untuk X" as the destination account
    const accountMatch = text.match(/\b(?:to|at|ke|untuk)\s+(.+)/i)
    if (amtMatch) {
      const amount = parseFloat(amtMatch[1].replace(',', '.'))
      const account_name = accountMatch ? accountMatch[1].trim() : undefined
      parsed = { intent: 'topup', amount, account_name }
    }
  } else if (/^\d+(?:[.,]\d+)?\s+\S/.test(lower)) {
    // Number-first expense: "9.70 for breakfast using ryt", "45.1 lunch using ryt"
    const amtMatch = text.match(/^(\d+(?:[.,]\d+)?)/)
    if (amtMatch) {
      const amount = parseFloat(amtMatch[1].replace(',', '.'))
      const usingMatch = text.match(/\b(?:using|via|through)\s+(\S+(?:\s+\S+)?)/i)
      const atMatch = text.match(/\bat\s+(\S+(?:\s+\S+)?)/i)
      const merchantRaw = (usingMatch ?? atMatch)?.[1]
      const merchant = merchantRaw ? toTitleCase(merchantRaw.trim()) : null
      const note = text
        .replace(/^\d+(?:[.,]\d+)?/, '')
        .replace(/\b(?:using|at|via|through)\s+\S+(?:\s+\S+)?/i, '')
        .replace(/^\s*for\s+/i, '')
        .replace(/\s+/g, ' ').trim() || null
      parsed = { intent: 'add_expense', amount, merchant: merchant ?? undefined, note }
    }
  }

  // Claude fallback for anything unresolved
  if (parsed.intent === 'unknown') {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: `You are a parser for a personal finance app. Extract intent from the user's message.
Return ONLY valid JSON with no explanation.

Available bills: ${JSON.stringify(bills.map(b => ({ id: b.id, name: b.name, amount: b.amount })))}
Available loans: ${JSON.stringify(activeLoans.map(l => ({ id: l.id, name: l.name, monthlyInstallment: l.monthlyInstallment })))}

Examples of natural phrasings and their outputs:
- "spent 45 at mamak" → {"intent":"add_expense","amount":45,"merchant":"mamak","note":null}
- "9.70 for breakfast using ryt" → {"intent":"add_expense","amount":9.70,"merchant":"ryt","note":"breakfast"}
- "45.1 lunch using ryt" → {"intent":"add_expense","amount":45.1,"merchant":"ryt","note":"lunch"}
- "beli kopi 4.50" → {"intent":"add_expense","amount":4.50,"merchant":null,"note":"kopi"}
- "received bonus 500" → {"intent":"add_income","amount":500,"note":"bonus"}
- "topup 60 touch n go" → {"intent":"topup","amount":60,"account_name":"touch n go"}
- "paid my proton x50" → {"intent":"pay_loan","loanId":"uuid","loanName":"Proton X50"}
- "bayar loan kereta" → {"intent":"pay_loan","loanId":"uuid","loanName":"loan name"}

Return one of:
{"intent":"mark_bill_paid","billId":"uuid","billName":"string"}
{"intent":"pay_loan","loanId":"uuid","loanName":"string"}
{"intent":"add_expense","amount":number,"merchant":"string or null","note":"string or null"}
{"intent":"add_income","amount":number,"note":"string"}
{"intent":"check_balance","_":""}
{"intent":"check_loans","_":""}
{"intent":"check_investments","_":""}
{"intent":"check_net_worth","_":""}
{"intent":"payment_history","query":"bill or merchant name to look up"}
{"intent":"recent_transactions","_":""}
{"intent":"topup","amount":number,"account_name":"account name to top up"}
{"intent":"unknown","_":""}`,
        messages: [{ role: 'user', content: text }],
      })
      const content = response.content[0]
      if (content.type === 'text') parsed = JSON.parse(content.text) as ParsedIntent
    } catch { /* fall through */ }
  }

  // --- Execute intents ---

  if (parsed.intent === 'check_balance') {
    const remaining = totalIncome - totalSpent
    await sendMessage(chatId, `💰 <b>${monthStr}</b>\nSpent: RM${fmt(totalSpent)}\nIncome: RM${fmt(totalIncome)}\nRemaining: RM${fmt(remaining)}`)

  } else if (parsed.intent === 'check_loans') {
    const loans = await db.select().from(financeLoans)
      .where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true)))
    if (loans.length === 0) {
      await sendMessage(chatId, '✅ No active loans recorded.')
      return
    }
    const total = loans.reduce((s, l) => s + l.outstandingBalance, 0)
    const lines = loans.map(l => `• ${l.name}: RM${fmt(l.outstandingBalance)} (RM${fmt(l.monthlyInstallment)}/mo)`).join('\n')
    await sendMessage(chatId, `🏦 <b>Loans</b>\n${lines}\n\n<b>Total outstanding: RM${fmt(total)}</b>`)

  } else if (parsed.intent === 'market_insights') {
    const query = (parsed.query ?? '').replace(/price|signal|harga|pasaran/gi, '').trim()
    const resolved = resolveAsset(query)
    if (!resolved) {
      await sendMessage(chatId, 'What asset? Try: "bitcoin price", "KLCI", "gold", "oil", "USD/MYR", or a Bursa stock code like "1155" (Maybank).')
      return
    }
    await sendMessage(chatId, `⏳ Fetching ${resolved.label}...`)
    const insight = await fetchAssetInsight(resolved.ticker, resolved.label, resolved.currency, resolved.isMYR)
    if (!insight) {
      await sendMessage(chatId, `⚠️ Couldn't fetch data for ${resolved.label}. Try again in a moment.`)
      return
    }
    const e = signalEmoji(insight.signal)
    const priceStr = insight.priceMYR != null
      ? `RM${fmt(insight.priceMYR)}${insight.ticker === 'GC=F' || insight.ticker === 'SI=F' ? '/g' : ''}  ·  ${insight.currency} ${insight.price.toLocaleString('en', { maximumFractionDigits: 2 })}`
      : `${insight.currency} ${insight.price.toLocaleString('en', { maximumFractionDigits: 2 })}`
    await sendMessage(chatId, `<b>${insight.label} — Live</b>

<b>${priceStr}</b>

30-day range: ${insight.currency} ${insight.low30d.toLocaleString('en', { maximumFractionDigits: 2 })} – ${insight.high30d.toLocaleString('en', { maximumFractionDigits: 2 })}
30-day change: ${insight.change30d >= 0 ? '+' : ''}${insight.change30d.toFixed(2)}%

${e} <b>${insight.signal.toUpperCase()}</b>
${insight.signalReason}

<i>Not financial advice. Do your own research.</i>`)

  } else if (parsed.intent === 'check_investments') {
    const investments = await db.select().from(financeInvestments).where(eq(financeInvestments.userId, userId))
    if (investments.length === 0) {
      await sendMessage(chatId, 'No investments recorded yet.')
      return
    }
    const totalValue = investments.reduce((s, i) => s + i.currentValue, 0)
    const totalCost = investments.reduce((s, i) => s + i.costBasis, 0)
    const gain = totalValue - totalCost
    const lines = investments.map(i => `• ${i.name} (${i.type}): RM${fmt(i.currentValue)}`).join('\n')

    // Fetch live prices for assets the user actually holds
    const assetsToFetch = investmentTypesToAssets(investments.map(i => ({ name: i.name, type: i.type, ticker: i.ticker })))
    const marketLines: string[] = []
    if (assetsToFetch.length > 0) {
      const insights = await Promise.all(assetsToFetch.slice(0, 4).map(a => fetchAssetInsight(a.ticker, a.label, a.currency, a.isMYR)))
      for (const ins of insights) {
        if (!ins) continue
        const e = signalEmoji(ins.signal)
        const p = ins.priceMYR != null ? `RM${fmt(ins.priceMYR)}${ins.ticker === 'GC=F' || ins.ticker === 'SI=F' ? '/g' : ''}` : `${ins.currency} ${ins.price.toLocaleString('en', { maximumFractionDigits: 2 })}`
        marketLines.push(`${e} ${ins.label}: ${p} (${ins.change30d >= 0 ? '+' : ''}${ins.change30d.toFixed(1)}% 30d) — ${ins.signal.toUpperCase()}`)
      }
    }
    const marketNote = marketLines.length > 0 ? `\n\n📡 <b>Live market</b>\n${marketLines.join('\n')}` : ''
    await sendMessage(chatId, `📈 <b>Investments</b>\n${lines}\n\n<b>Total: RM${fmt(totalValue)}</b> (${gain >= 0 ? '+' : ''}RM${fmt(gain)} gain)${marketNote}`)

  } else if (parsed.intent === 'check_net_worth') {
    const [accounts, investments, loans] = await Promise.all([
      db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
      db.select().from(financeInvestments).where(eq(financeInvestments.userId, userId)),
      db.select().from(financeLoans).where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true))),
    ])
    const cashAssets = accounts.filter(a => a.type !== 'credit').reduce((s, a) => s + a.initialBalance, 0)
    const investTotal = investments.reduce((s, i) => s + i.currentValue, 0)
    const ccLiab = accounts.filter(a => a.type === 'credit').reduce((s, a) => s + (a.currentOutstanding ?? 0), 0)
    const loanLiab = loans.reduce((s, l) => s + l.outstandingBalance, 0)
    const assets = cashAssets + investTotal
    const liab = ccLiab + loanLiab
    const netWorth = assets - liab
    await sendMessage(chatId, `💎 <b>Net Worth</b>\nAssets: RM${fmt(assets)} (cash + investments)\nLiabilities: RM${fmt(liab)} (CC + loans)\n\n<b>Net Worth: ${netWorth >= 0 ? '' : '-'}RM${fmt(Math.abs(netWorth))}</b>`)

  } else if (parsed.intent === 'payment_history') {
    const query = (parsed.query ?? '').toLowerCase().trim()
    // Check bills first
    const bill = bills.find(b => b.name.toLowerCase().includes(query) || query.includes(b.name.toLowerCase()))
    if (bill) {
      const payments = await db.select().from(financeBillPayments)
        .where(eq(financeBillPayments.billId, bill.id))
        .orderBy(desc(financeBillPayments.month))
        .limit(6)
      if (payments.length === 0) {
        await sendMessage(chatId, `No payment history for ${bill.name}.`)
        return
      }
      const lines = payments.map(p => `• ${p.month}${p.paidAt ? ' — ' + new Date(p.paidAt).toLocaleDateString('en-MY') : ''}`).join('\n')
      await sendMessage(chatId, `📋 <b>${bill.name} payment history</b>\n${lines}`)
      return
    }
    // Fallback: search transactions by merchant
    const allTxns = await db.select().from(financeTransactions)
      .where(eq(financeTransactions.userId, userId))
      .orderBy(desc(financeTransactions.date))
      .limit(200)
    const matched = allTxns.filter(t =>
      (t.merchant ?? '').toLowerCase().includes(query) ||
      (t.note ?? '').toLowerCase().includes(query)
    ).slice(0, 5)
    if (matched.length === 0) {
      await sendMessage(chatId, `No transactions found matching "${parsed.query}".`)
      return
    }
    const lines = matched.map(t => `• ${t.date} — RM${fmt(t.amount)} at ${t.merchant ?? t.note ?? '?'}`).join('\n')
    await sendMessage(chatId, `📋 <b>Recent: "${parsed.query}"</b>\n${lines}`)

  } else if (parsed.intent === 'recent_transactions') {
    const recent = await db.select().from(financeTransactions)
      .where(eq(financeTransactions.userId, userId))
      .orderBy(desc(financeTransactions.date))
      .limit(5)
    if (recent.length === 0) {
      await sendMessage(chatId, 'No transactions recorded yet.')
      return
    }
    const lines = recent.map(t => {
      const sign = t.type === 'income' ? '+' : '-'
      const label = t.merchant ?? t.note ?? '?'
      return `• ${t.date} ${sign}RM${fmt(t.amount)} ${label}`
    }).join('\n')
    await sendMessage(chatId, `🧾 <b>Last 5 transactions</b>\n${lines}`)

  } else if (parsed.intent === 'mark_bill_paid') {
    let bill = bills.find(b => b.id === parsed.billId)
    if (!bill && parsed.billName) {
      const nl = parsed.billName.toLowerCase()
      bill = bills.find(b => b.name.toLowerCase().includes(nl) || nl.includes(b.name.toLowerCase()))
    }
    if (!bill) bill = bills.find(b => lower.includes(b.name.toLowerCase()))

    if (!bill) {
      const billList = bills.length > 0 ? bills.map(b => `• ${b.name}`).join('\n') : '(no active bills)'
      await sendMessage(chatId, `Couldn't find that bill. Your active bills:\n${billList}`)
      return
    }

    const [existing] = await db.select().from(financeBillPayments)
      .where(and(eq(financeBillPayments.billId, bill.id), eq(financeBillPayments.month, monthStr))).limit(1)
    if (existing) {
      await sendMessage(chatId, `Already marked ${bill.name} as paid this month.`)
      return
    }

    await db.insert(financeBillPayments).values({ billId: bill.id, month: monthStr, paidAt: now })
    await db.insert(financeTransactions).values({ userId, amount: bill.amount, currency: 'MYR', date: today, merchant: bill.name, type: 'expense' })
    await sendMessage(chatId, `✅ ${bill.name} marked paid — RM${fmt(bill.amount)} logged as expense`)

  } else if (parsed.intent === 'pay_loan') {
    let loan = activeLoans.find(l => l.id === parsed.loanId)
    if (!loan && parsed.loanName) {
      const nl = parsed.loanName.toLowerCase()
      loan = activeLoans.find(l => l.name.toLowerCase().includes(nl) || nl.includes(l.name.toLowerCase()))
    }
    if (!loan) loan = activeLoans.find(l => lower.includes(l.name.toLowerCase()))

    if (!loan) {
      const loanList = activeLoans.length > 0 ? activeLoans.map(l => `• ${l.name}`).join('\n') : '(no active loans)'
      await sendMessage(chatId, `Couldn't find that loan. Your active loans:\n${loanList}`)
      return
    }

    const newBalance = Math.max(0, loan.outstandingBalance - loan.monthlyInstallment)
    const isNowPaidOff = newBalance === 0

    await db.insert(financeTransactions).values({
      userId, accountId: null, amount: loan.monthlyInstallment, currency: 'MYR', date: today,
      type: 'expense', merchant: loan.name,
      note: `Loan installment — ${loan.lender ?? loan.type}`, isRecurring: true,
    })
    await db.update(financeLoans).set({
      outstandingBalance: newBalance,
      lastPaidAt: now,
      ...(isNowPaidOff && { isActive: false }),
    }).where(and(eq(financeLoans.id, loan.id), eq(financeLoans.userId, userId)))

    const msg = isNowPaidOff
      ? `Loan fully paid off! ${loan.name} marked complete. RM${fmt(loan.monthlyInstallment)} logged.`
      : `Loan installment paid — RM${fmt(loan.monthlyInstallment)} logged for ${loan.name}. RM${fmt(newBalance)} remaining.`
    await sendMessage(chatId, `✅ ${msg}`)

  } else if (parsed.intent === 'add_expense') {
    let amount: number
    try { amount = validateAmount(parsed.amount) } catch {
      await sendMessage(chatId, 'Invalid amount — please use a positive number, e.g. "spent RM12.50 at mamak".')
      return
    }
    const merchant = parsed.merchant ? toTitleCase(parsed.merchant) : null
    let categoryId: string | null = null
    if (merchant) {
      const [catRow] = await db.select({ categoryId: financeTransactions.categoryId })
        .from(financeTransactions)
        .where(and(
          eq(financeTransactions.userId, userId),
          isNotNull(financeTransactions.categoryId),
          sql`lower(${financeTransactions.merchant}) = ${merchant.toLowerCase()}`,
        ))
        .groupBy(financeTransactions.categoryId)
        .orderBy(desc(sql`count(*)`))
        .limit(1)
      categoryId = catRow?.categoryId ?? null
    }
    await db.insert(financeTransactions).values({ userId, amount, currency: 'MYR', date: today, merchant: merchant ?? null, note: parsed.note ?? null, type: 'expense', categoryId })
    const label = merchant ? `at ${merchant}` : parsed.note ? `— ${parsed.note}` : ''
    await sendMessage(chatId, `✅ Logged RM${fmt(amount)} expense${label ? ' ' + label : ''}`)

  } else if (parsed.intent === 'add_income') {
    let amount: number
    try { amount = validateAmount(parsed.amount) } catch {
      await sendMessage(chatId, 'Invalid amount — please use a positive number, e.g. "received RM500".')
      return
    }
    await db.insert(financeTransactions).values({ userId, amount, currency: 'MYR', date: today, note: parsed.note ?? null, type: 'income' })
    await sendMessage(chatId, `✅ Logged RM${fmt(amount)} income`)

  } else if (parsed.intent === 'topup') {
    let amount: number
    try { amount = validateAmount(parsed.amount) } catch {
      await sendMessage(chatId, 'Invalid amount — please use a positive number, e.g. "topup RM50 to TnG".')
      return
    }
    const accountNameQuery = parsed.account_name ? normalizeAccountName(parsed.account_name) : ''

    const userAccounts = await db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId))

    // Fuzzy match by normalized name (strips apostrophes and special chars)
    const matched = accountNameQuery
      ? userAccounts.find(a => {
          const norm = normalizeAccountName(a.name)
          return norm.includes(accountNameQuery) || accountNameQuery.includes(norm)
        })
      : null

    if (!matched) {
      // Save pending state so next reply can resolve the account
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
      await db.insert(telegramPending).values({
        userId, intent: 'topup', data: JSON.stringify({ amount }), expiresAt,
      }).onConflictDoUpdate({
        target: telegramPending.userId,
        set: { intent: 'topup', data: JSON.stringify({ amount }), expiresAt },
      })
      const names = userAccounts.map(a => `• ${a.name}`).join('\n')
      await sendMessage(chatId, `Which account?\n${names || '(no accounts found)'}`)
      return
    }

    await db.insert(financeTransactions).values({
      userId, accountId: matched.id, amount, currency: 'MYR', date: today,
      note: 'Top-up via Telegram', type: 'topup',
    })

    const [topupRow] = await db.select({
      total: sql<number>`coalesce(sum(${financeTransactions.amount}), 0)`,
    }).from(financeTransactions).where(and(
      eq(financeTransactions.userId, userId),
      eq(financeTransactions.accountId, matched.id),
      eq(financeTransactions.type, 'topup'),
      sql`${financeTransactions.date} like ${monthStr + '-%'}`,
    ))

    const toppedUpTotal = Number(topupRow?.total ?? 0)

    if (matched.monthlyAllocation) {
      const remaining = matched.monthlyAllocation - toppedUpTotal
      await sendMessage(chatId, `Added RM${fmt(amount)} to ${matched.name}.\n\nMonthly budget: RM${fmt(matched.monthlyAllocation)}\nTopped up: RM${fmt(toppedUpTotal)} this month\nRemaining: RM${fmt(remaining)}`)
    } else {
      await sendMessage(chatId, `Added RM${fmt(amount)} to ${matched.name}.`)
    }

  } else {
    await sendMessage(chatId, `I didn't understand that. Send /help to see everything I can do.\n\nQuick examples:\n• "spent RM45 lunch"\n• "topup RM100 to TnG"\n• "how much left"\n• "paid celcomdigi"\n• "net worth"`)
  }
}

export async function POST(request: Request) {
  const secretToken = request.headers.get('x-telegram-bot-api-secret-token')
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret || secretToken !== webhookSecret) {
    return new Response(null, { status: 401 })
  }

  const body = await request.json() as TelegramUpdate
  const msg = body.message
  if (!msg?.text || !msg.chat?.id) return Response.json({ ok: true })

  const chatId = String(msg.chat.id)
  const text = msg.text.trim()

  if (text.startsWith('/start')) {
    const code = text.split(' ')[1]?.trim()
    await handleLink(chatId, code)
    return Response.json({ ok: true })
  }

  if (text === '/help' || text.toLowerCase() === 'help') {
    await sendMessage(chatId, HELP_TEXT)
    return Response.json({ ok: true })
  }

  const [conn] = await db.select().from(telegramConnections)
    .where(eq(telegramConnections.telegramChatId, chatId)).limit(1)

  if (!conn) {
    await sendMessage(chatId, "Your Telegram isn't linked to a duitaku account yet.\n\nGo to duitaku → Settings → Connect Telegram, then send me the 6-digit code with /start YOUR_CODE")
    return Response.json({ ok: true })
  }

  await handleMessage(conn.userId, chatId, text)
  return Response.json({ ok: true })
}
