// SQL migration required (run in Neon):
// CREATE TABLE telegram_connections (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, telegram_chat_id TEXT NOT NULL UNIQUE, linked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL);
// CREATE TABLE telegram_link_codes (code TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL);

import { db } from '@/db'
import {
  telegramConnections,
  telegramLinkCodes,
  financeBills,
  financeBillPayments,
  financeTransactions,
  financeLoans,
  financeInvestments,
  financeAccounts,
} from '@/db/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

interface TelegramChat { id: number }
interface TelegramMessage { text?: string; chat?: TelegramChat }
interface TelegramUpdate { message?: TelegramMessage }

interface ParsedIntent {
  intent: 'mark_bill_paid' | 'add_expense' | 'add_income' | 'check_balance' |
          'check_loans' | 'check_investments' | 'check_net_worth' |
          'payment_history' | 'recent_transactions' | 'unknown'
  billId?: string
  billName?: string
  amount?: number
  merchant?: string
  note?: string | null
  query?: string  // for payment_history: what to look up
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

  await sendMessage(chatId, `✅ Your Telegram is now linked to duitaku!

You can ask me:
• "paid celcomdigi" — mark a bill as paid
• "spent RM45 lunch" — log an expense
• "received RM500" — log income
• "how much left" — this month's balance
• "how much loan" — loan summary
• "my investments" — investment portfolio
• "net worth" — assets vs liabilities
• "when did i pay celcomdigi" — payment history
• "last 5 transactions" — recent spending`)
}

function fmt(n: number) { return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

async function handleMessage(userId: string, chatId: string, text: string): Promise<void> {
  const bills = await db.select().from(financeBills)
    .where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true)))

  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${monthStr}-01`
  const monthEnd = `${monthStr}-31`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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
    if (matchedBill) parsed = { intent: 'mark_bill_paid', billId: matchedBill.id, billName: matchedBill.name }
  } else if (['spent ', 'spend ', 'beli ', 'bought ', 'used rm', 'spend rm'].some(k => lower.includes(k))) {
    const amtMatch = text.match(/rm\s*(\d+(?:\.\d+)?)/i)
    if (amtMatch) {
      const merchant = text.replace(/rm\s*\d+(?:\.\d+)?/i, '').replace(/spent?|spend|beli|bought|used/i, '').trim() || 'Unknown'
      parsed = { intent: 'add_expense', amount: parseFloat(amtMatch[1]), merchant }
    }
  } else if (['received ', 'got paid', 'income ', 'masuk rm', 'dapat '].some(k => lower.includes(k))) {
    const amtMatch = text.match(/rm\s*(\d+(?:\.\d+)?)/i)
    if (amtMatch) parsed = { intent: 'add_income', amount: parseFloat(amtMatch[1]), note: text }
  }

  // Claude fallback for anything unresolved
  if (parsed.intent === 'unknown') {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: `You are a parser for a personal finance app. Extract intent from the user's message.
Return ONLY valid JSON.

Available bills: ${JSON.stringify(bills.map(b => ({ id: b.id, name: b.name, amount: b.amount })))}

Return one of:
{"intent":"mark_bill_paid","billId":"uuid","billName":"string"}
{"intent":"add_expense","amount":number,"merchant":"string","note":"string|null"}
{"intent":"add_income","amount":number,"note":"string"}
{"intent":"check_balance","_":""}
{"intent":"check_loans","_":""}
{"intent":"check_investments","_":""}
{"intent":"check_net_worth","_":""}
{"intent":"payment_history","query":"bill or merchant name to look up"}
{"intent":"recent_transactions","_":""}
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

  } else if (parsed.intent === 'check_investments') {
    const investments = await db.select().from(financeInvestments)
      .where(eq(financeInvestments.userId, userId))
    if (investments.length === 0) {
      await sendMessage(chatId, 'No investments recorded yet.')
      return
    }
    const totalValue = investments.reduce((s, i) => s + i.currentValue, 0)
    const totalCost = investments.reduce((s, i) => s + i.costBasis, 0)
    const gain = totalValue - totalCost
    const lines = investments.map(i => `• ${i.name} (${i.type}): RM${fmt(i.currentValue)}`).join('\n')
    await sendMessage(chatId, `📈 <b>Investments</b>\n${lines}\n\n<b>Total: RM${fmt(totalValue)}</b> (${gain >= 0 ? '+' : ''}RM${fmt(gain)} gain)`)

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

  } else if (parsed.intent === 'add_expense') {
    const amount = parsed.amount ?? 0
    const merchant = parsed.merchant ?? 'Unknown'
    await db.insert(financeTransactions).values({ userId, amount, currency: 'MYR', date: today, merchant, note: parsed.note ?? null, type: 'expense' })
    await sendMessage(chatId, `✅ Logged RM${fmt(amount)} spent at ${merchant}`)

  } else if (parsed.intent === 'add_income') {
    const amount = parsed.amount ?? 0
    await db.insert(financeTransactions).values({ userId, amount, currency: 'MYR', date: today, note: parsed.note ?? null, type: 'income' })
    await sendMessage(chatId, `✅ Logged RM${fmt(amount)} income`)

  } else {
    await sendMessage(chatId, `I didn't understand that. Try:
• "how much left" — balance
• "how much loan" — loan summary
• "my investments" — portfolio
• "net worth" — assets vs liabilities
• "when did i pay celcomdigi" — payment history
• "last 5 transactions" — recent spending
• "paid celcomdigi" — mark bill paid
• "spent RM45 lunch" — log expense`)
  }
}

export async function POST(request: Request) {
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

  const [conn] = await db.select().from(telegramConnections)
    .where(eq(telegramConnections.telegramChatId, chatId)).limit(1)

  if (!conn) {
    await sendMessage(chatId, "Your Telegram isn't linked to a duitaku account yet.\n\nGo to duitaku → Settings → Connect Telegram, then send me the 6-digit code with /start YOUR_CODE")
    return Response.json({ ok: true })
  }

  await handleMessage(conn.userId, chatId, text)
  return Response.json({ ok: true })
}
