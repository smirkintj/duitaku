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
  financeSavingsGoals,
  financeBnpl,
  financeSalary,
  financeCategories,
  userSettings,
} from '@/db/schema'
import { and, eq, gte, lte, desc, sql, isNotNull } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { validateAmount } from '@/lib/validate'
import { checkRateLimit } from '@/lib/rate-limit'
import { computeRedFlags } from '@/lib/red-flags'

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

interface TelegramPhotoSize { file_id: string; width: number; height: number; file_size?: number }
interface TelegramChat { id: number }
interface TelegramMessage { text?: string; chat?: TelegramChat; photo?: TelegramPhotoSize[] }
interface TelegramUpdate { message?: TelegramMessage }

interface ParsedIntent {
  intent: 'mark_bill_paid' | 'add_expense' | 'add_income' | 'check_balance' |
          'check_loans' | 'check_investments' | 'check_net_worth' |
          'payment_history' | 'recent_transactions' | 'market_insights' | 'topup' |
          'pay_loan' | 'pay_bnpl' | 'check_accounts' | 'check_savings' | 'check_upcoming' |
          'check_bnpl' | 'check_salary' | 'check_category_budget' | 'check_red_flags' |
          'check_trends' | 'add_savings' | 'undo_last' | 'set_category_budget' | 'unknown'
  billId?: string
  billName?: string
  loanId?: string
  loanName?: string
  bnplId?: string
  bnplName?: string
  categoryName?: string
  goalName?: string
  savingsAmount?: number
  budgetAmount?: number
  amount?: number
  merchant?: string
  note?: string | null
  query?: string
  account_name?: string
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
• Send a receipt photo — auto-log via OCR

BILLS & LOANS
• "paid celcomdigi" — mark a bill as paid
• "paid proton x50" — log a loan installment
• "paid shopee bnpl" — pay a BNPL installment
• "upcoming bills" — next 30 days of payments

ACCOUNTS & SAVINGS
• "my accounts" — account balances
• "my savings" — savings goals progress
• "saved RM200 for car" — add to a goal
• "set food budget RM500" — set category limit

OVERVIEW
• "how much left" — this month's budget
• "my salary" — gross, net & deductions
• "spending trend" — compare to last month
• "net worth" — assets vs liabilities
• "red flags" — budget warnings

HISTORY & MARKET
• "last 5 transactions" — recent spending
• "undo" — delete the last transaction
• "gold" / "KLCI" / "BTC" — live market price

Send /help anytime to see the full command list.`)
}

const HELP_TEXT = `What I can do:

SPENDING
• "spent RM45 at lunch" — log expense
• "9.70 breakfast using RYT" — quick expense
• "received RM500 bonus" — log income
• "topup RM100 to TnG" — top up account
• Send a receipt photo — auto-log via OCR

BILLS & LOANS
• "paid celcomdigi" — mark bill as paid
• "paid proton x50" — log loan installment
• "paid shopee bnpl" — pay BNPL installment
• "upcoming bills" — next 30 days due

ACCOUNTS & SAVINGS
• "my accounts" — balances & CC utilisation
• "my savings" — goals progress
• "saved RM200 for emergency" — add to goal
• "set food budget RM500" — update category limit

OVERVIEW
• "how much left" — this month's budget
• "my salary" / "gaji" — gross, net & deductions
• "how much loan" / "hutang" — loan balances
• "my bnpl" — installment plans
• "net worth" — assets vs liabilities
• "my investments" — portfolio
• "spending trend" / "bulan lepas" — monthly comparison
• "food budget" — category budget check
• "red flags" / "masalah" — budget alerts

HISTORY
• "last 5 transactions" — recent spending
• "when did i pay unifi" — payment history
• "undo" / "silap" — delete last transaction

MARKET
• "gold" / "KLCI" / "BTC" — live price + signal

Just type naturally in English or Malay — I'll understand most phrasings.`

function fmt(n: number) { return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

function progBar(current: number, max: number, width = 10): string {
  if (max <= 0) return '░'.repeat(width)
  const filled = Math.min(width, Math.round((current / max) * width))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

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

  if (pending?.intent === 'ocr_confirm') {
    const lower2 = text.toLowerCase().trim()
    const pendingOcr = JSON.parse(pending.data) as { amount: number; merchant: string | null; date: string | null; note: string | null }
    if (['yes', 'ya', 'ok', 'yep', 'confirm', 'log it', 'log', 'yeah'].some(k => lower2 === k || lower2.startsWith(k))) {
      await db.delete(telegramPending).where(eq(telegramPending.userId, userId))
      const txDate = (pendingOcr.date && /^\d{4}-\d{2}-\d{2}$/.test(pendingOcr.date)) ? pendingOcr.date : today
      let categoryId: string | null = null
      if (pendingOcr.merchant) {
        const [catRow] = await db.select({ categoryId: financeTransactions.categoryId })
          .from(financeTransactions)
          .where(and(eq(financeTransactions.userId, userId), isNotNull(financeTransactions.categoryId), sql`lower(${financeTransactions.merchant}) = ${pendingOcr.merchant.toLowerCase()}`))
          .groupBy(financeTransactions.categoryId).orderBy(desc(sql`count(*)`)).limit(1)
        categoryId = catRow?.categoryId ?? null
      }
      await db.insert(financeTransactions).values({
        userId, amount: pendingOcr.amount, currency: 'MYR', date: txDate,
        merchant: pendingOcr.merchant, note: pendingOcr.note, type: 'expense', categoryId,
      })
      await sendMessage(chatId, `✅ Logged RM${fmt(pendingOcr.amount)} expense${pendingOcr.merchant ? ` at ${pendingOcr.merchant}` : ''}.`)
      return
    } else if (['no', 'nope', 'cancel', 'tak', 'tidak'].some(k => lower2 === k || lower2.startsWith(k))) {
      await db.delete(telegramPending).where(eq(telegramPending.userId, userId))
      await sendMessage(chatId, 'Cancelled.')
      return
    }
    // Any other reply: clear pending and process as normal message
    await db.delete(telegramPending).where(eq(telegramPending.userId, userId))
  }

  const [bills, activeLoans, activeBnpl] = await Promise.all([
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeLoans).where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true))),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
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

  if (['how much left', 'baki', 'check balance', 'how much do i have', 'remaining this month', 'berapa tinggal', 'berapa ada'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_balance' }
  } else if (['balance'].some(k => lower === k || lower.startsWith(k + ' '))) {
    parsed = { intent: 'check_balance' }
  } else if (['undo', 'delete last', 'silap', 'cancel that', 'wrong entry', 'padam last'].some(k => lower.includes(k))) {
    parsed = { intent: 'undo_last' }
  } else if (['how much loan', 'my loan', 'my debt', 'hutang', 'loan balance', 'berapa hutang', 'outstanding loan'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_loans' }
  } else if (['my account', 'akaun saya', 'account balance', 'bank balance', 'show account', 'all account', 'semua akaun'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_accounts' }
  } else if (['my saving', 'savings goal', 'simpanan', 'how much saved', 'berapa simpan'].some(k => lower.includes(k)) || (lower === 'tabung' || lower.startsWith('tabung ') && !lower.match(/rm\s*\d/i))) {
    parsed = { intent: 'check_savings' }
  } else if (['upcoming bill', "what's due", 'whats due', 'apa due', 'bills this week', 'due this month', 'next payment', 'next bill', 'apa bayaran'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_upcoming' }
  } else if (['my bnpl', ' bnpl', 'installment plan', 'atome', 'splitit', 'grab pay later', 'shopee pay later', 'fave pay'].some(k => lower.includes(k)) || lower === 'bnpl') {
    parsed = { intent: 'check_bnpl' }
  } else if (['my salary', 'gaji saya', 'berapa gaji', 'payslip', 'epf deduction', 'net salary', 'take home pay', 'pcb', 'potongan'].some(k => lower.includes(k)) || lower === 'gaji' || lower.startsWith('gaji ')) {
    parsed = { intent: 'check_salary' }
  } else if (['red flag', 'any issue', 'masalah', 'amaran', 'budget warning', 'over budget', 'any warning', 'habis budget'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_red_flags' }
  } else if (['spending trend', 'monthly trend', 'last month', 'bulan lepas', 'monthly summary', 'compare month', 'trend spending'].some(k => lower.includes(k))) {
    parsed = { intent: 'check_trends' }
  } else if (/\b(set|limit|cap|tetapkan)\b.+\bbudget\b/i.test(lower) || /\blimit\b.+\bto\b.+rm/i.test(lower)) {
    const amtMatch = text.match(/rm\s*(\d+(?:[.,]\d+)?)/i) ?? text.match(/\b(\d+(?:[.,]\d+)?)\b/)
    if (amtMatch) {
      const budgetAmount = parseFloat(amtMatch[1].replace(',', '.'))
      const catMatch = text.match(/set\s+(\w+)\s+budget/i) ?? text.match(/limit\s+(\w+)\s+to/i) ?? text.match(/cap\s+(\w+)\b/i)
      const categoryName = catMatch ? catMatch[1].trim() : undefined
      parsed = { intent: 'set_category_budget', categoryName, budgetAmount }
    }
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
  } else if (['saved rm', 'simpan rm', 'add to savings', 'tabung rm'].some(k => lower.includes(k)) || (/\bsaved\b.+\bfor\b/i.test(lower) && lower.includes('rm'))) {
    const amtMatch = text.match(/rm\s*(\d+(?:[.,]\d+)?)/i) ?? text.match(/\b(\d+(?:[.,]\d+)?)\b/)
    if (amtMatch) {
      const savingsAmount = parseFloat(amtMatch[1].replace(',', '.'))
      const forMatch = text.match(/\bfor\s+(.+)/i) ?? text.match(/\buntuk\s+(.+)/i)
      const goalName = forMatch ? forMatch[1].replace(/rm\s*\d+(?:[.,]\d+)?/i, '').replace(/\bbayar\b|\bsaved?\b/gi, '').trim() : undefined
      parsed = { intent: 'add_savings', savingsAmount, goalName }
    }
  } else if (['paid ', 'bayar ', 'dah bayar'].some(k => lower.startsWith(k) || lower.includes(k))) {
    const matchedBill = bills.find(b => lower.includes(b.name.toLowerCase()))
    if (matchedBill) {
      parsed = { intent: 'mark_bill_paid', billId: matchedBill.id, billName: matchedBill.name }
    } else {
      const matchedLoan = activeLoans.find(l =>
        lower.includes(l.name.toLowerCase()) ||
        l.name.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))
      )
      if (matchedLoan) {
        parsed = { intent: 'pay_loan', loanId: matchedLoan.id, loanName: matchedLoan.name }
      } else {
        const matchedBnpl = activeBnpl.find(b =>
          lower.includes(b.merchant.toLowerCase()) ||
          b.merchant.toLowerCase().split(' ').some(w => w.length > 3 && lower.includes(w))
        )
        if (matchedBnpl) parsed = { intent: 'pay_bnpl', bnplId: matchedBnpl.id, bnplName: matchedBnpl.merchant }
      }
    }
  } else if (lower.includes('budget') && !lower.includes('set ') && !lower.includes('limit ')) {
    const catMatch = text.match(/(\w+)\s+budget/i) ?? text.match(/budget\s+(?:for\s+)?(\w+)/i)
    const categoryName = catMatch ? catMatch[1].trim() : undefined
    const skipWords = new Set(['my', 'the', 'a', 'check', 'monthly', 'total', 'remaining', 'what', 'is', 'how', 'any', 'food', 'transport'])
    if (categoryName && !skipWords.has(categoryName.toLowerCase()) || categoryName) {
      parsed = { intent: 'check_category_budget', categoryName }
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
Available BNPL: ${JSON.stringify(activeBnpl.map(b => ({ id: b.id, merchant: b.merchant, provider: b.provider, installmentAmount: b.installmentAmount })))}

Examples:
- "spent 45 at mamak" → {"intent":"add_expense","amount":45,"merchant":"mamak","note":null}
- "9.70 breakfast using ryt" → {"intent":"add_expense","amount":9.70,"merchant":"ryt","note":"breakfast"}
- "beli kopi 4.50" → {"intent":"add_expense","amount":4.50,"merchant":null,"note":"kopi"}
- "received bonus 500" → {"intent":"add_income","amount":500,"note":"bonus"}
- "topup 60 touch n go" → {"intent":"topup","amount":60,"account_name":"touch n go"}
- "paid proton x50" → {"intent":"pay_loan","loanId":"uuid","loanName":"Proton X50"}
- "paid shopee bnpl" → {"intent":"pay_bnpl","bnplId":"uuid","bnplName":"Shopee"}
- "saved RM200 for emergency" → {"intent":"add_savings","savingsAmount":200,"goalName":"emergency"}
- "set food budget RM500" → {"intent":"set_category_budget","categoryName":"food","budgetAmount":500}
- "gaji saya" → {"intent":"check_salary","_":""}
- "bulan lepas" → {"intent":"check_trends","_":""}
- "red flags" → {"intent":"check_red_flags","_":""}
- "my accounts" → {"intent":"check_accounts","_":""}
- "my savings" → {"intent":"check_savings","_":""}
- "upcoming bills" → {"intent":"check_upcoming","_":""}
- "food budget" → {"intent":"check_category_budget","categoryName":"food"}
- "undo" → {"intent":"undo_last","_":""}

Return one of:
{"intent":"mark_bill_paid","billId":"uuid","billName":"string"}
{"intent":"pay_loan","loanId":"uuid","loanName":"string"}
{"intent":"pay_bnpl","bnplId":"uuid","bnplName":"string"}
{"intent":"add_expense","amount":number,"merchant":"string or null","note":"string or null"}
{"intent":"add_income","amount":number,"note":"string"}
{"intent":"add_savings","savingsAmount":number,"goalName":"string or null"}
{"intent":"check_balance","_":""}
{"intent":"check_loans","_":""}
{"intent":"check_accounts","_":""}
{"intent":"check_savings","_":""}
{"intent":"check_upcoming","_":""}
{"intent":"check_bnpl","_":""}
{"intent":"check_salary","_":""}
{"intent":"check_red_flags","_":""}
{"intent":"check_trends","_":""}
{"intent":"check_investments","_":""}
{"intent":"check_net_worth","_":""}
{"intent":"check_category_budget","categoryName":"string"}
{"intent":"payment_history","query":"bill or merchant name to look up"}
{"intent":"recent_transactions","_":""}
{"intent":"set_category_budget","categoryName":"string","budgetAmount":number}
{"intent":"topup","amount":number,"account_name":"account name to top up"}
{"intent":"undo_last","_":""}
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

  } else if (parsed.intent === 'pay_bnpl') {
    let bnpl = activeBnpl.find(b => b.id === parsed.bnplId)
    if (!bnpl && parsed.bnplName) {
      const nl = parsed.bnplName.toLowerCase()
      bnpl = activeBnpl.find(b => b.merchant.toLowerCase().includes(nl) || nl.includes(b.merchant.toLowerCase()))
    }
    if (!bnpl) bnpl = activeBnpl.find(b => lower.includes(b.merchant.toLowerCase()))

    if (!bnpl) {
      const list = activeBnpl.map(b => `• ${b.merchant} (${b.provider})`).join('\n')
      await sendMessage(chatId, `Couldn't find that BNPL plan. Active plans:\n${list || '(none)'}`)
      return
    }

    const newPaid = bnpl.paidInstallments + 1
    const isNowComplete = newPaid >= bnpl.totalInstallments

    await db.insert(financeTransactions).values({
      userId, accountId: bnpl.accountId, amount: bnpl.installmentAmount, currency: 'MYR', date: today,
      type: 'expense', merchant: bnpl.merchant, note: `BNPL installment — ${bnpl.provider}`, isRecurring: true,
    })
    await db.update(financeBnpl)
      .set({ paidInstallments: newPaid, lastPaidAt: now, ...(isNowComplete && { isActive: false }) })
      .where(eq(financeBnpl.id, bnpl.id))

    const bnplMsg = isNowComplete
      ? `BNPL fully paid off! ${bnpl.merchant} (${bnpl.provider}) complete. RM${fmt(bnpl.installmentAmount)} logged.`
      : `BNPL installment paid — RM${fmt(bnpl.installmentAmount)} for ${bnpl.merchant}. ${newPaid}/${bnpl.totalInstallments} done, ${bnpl.totalInstallments - newPaid} remaining.`
    await sendMessage(chatId, `✅ ${bnplMsg}`)

  } else if (parsed.intent === 'check_accounts') {
    const accounts = await db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId))
    if (accounts.length === 0) {
      await sendMessage(chatId, 'No accounts found. Add one in duitaku → Accounts.')
      return
    }
    const lines = accounts.map(a => {
      if (a.type === 'credit') {
        const outstanding = a.currentOutstanding ?? 0
        const limit = a.creditLimit ?? 0
        const pct = limit > 0 ? Math.round((outstanding / limit) * 100) : 0
        return `<b>${a.name}</b> (credit)\n  [${progBar(outstanding, limit)}] ${pct}% — RM${fmt(outstanding)} / RM${fmt(limit)}`
      }
      return `<b>${a.name}</b> (${a.type}): RM${fmt(a.initialBalance)}`
    }).join('\n\n')
    await sendMessage(chatId, `<b>Accounts</b>\n\n${lines}`)

  } else if (parsed.intent === 'check_savings') {
    const goals = await db.select().from(financeSavingsGoals).where(eq(financeSavingsGoals.userId, userId))
    if (goals.length === 0) {
      await sendMessage(chatId, 'No savings goals set. Create one in duitaku → Savings.')
      return
    }
    const lines = goals.map(g => {
      if (g.targetAmount && g.targetAmount > 0) {
        const pct = Math.round((g.currentAmount / g.targetAmount) * 100)
        const remaining = Math.max(0, g.targetAmount - g.currentAmount)
        return `<b>${g.name}</b>\n  [${progBar(g.currentAmount, g.targetAmount)}] ${pct}%\n  RM${fmt(g.currentAmount)} of RM${fmt(g.targetAmount)} — RM${fmt(remaining)} to go`
      }
      return `<b>${g.name}</b>: RM${fmt(g.currentAmount)} saved`
    }).join('\n\n')
    const total = goals.reduce((s, g) => s + g.currentAmount, 0)
    await sendMessage(chatId, `<b>Savings Goals</b>\n\n${lines}\n\n<b>Total saved: RM${fmt(total)}</b>`)

  } else if (parsed.intent === 'check_upcoming') {
    const todayDay = now.getDate()
    const items: { name: string; amount: number; dueDay: number; daysLeft: number; isPaid: boolean }[] = []

    const billPayments = await db.select().from(financeBillPayments)
      .where(and(
        sql`${financeBillPayments.billId} in (select id from finance_bills where user_id = ${userId} and is_active = true)`,
        eq(financeBillPayments.month, monthStr),
        isNotNull(financeBillPayments.paidAt),
      ))
    const paidBillIds = new Set(billPayments.map(p => p.billId))

    for (const bill of bills) {
      const daysLeft = bill.dueDay >= todayDay
        ? bill.dueDay - todayDay
        : bill.dueDay - todayDay + 30
      items.push({ name: bill.name, amount: bill.amount, dueDay: bill.dueDay, daysLeft, isPaid: paidBillIds.has(bill.id) })
    }
    for (const b of activeBnpl) {
      const remaining = b.totalInstallments - b.paidInstallments
      if (remaining > 0) {
        items.push({ name: `${b.merchant} BNPL`, amount: b.installmentAmount, dueDay: 1, daysLeft: todayDay <= 1 ? 0 : 30 - todayDay + 1, isPaid: false })
      }
    }

    items.sort((a, b) => a.daysLeft - b.daysLeft)

    const overdue = items.filter(i => !i.isPaid && i.daysLeft === 0)
    const soon = items.filter(i => !i.isPaid && i.daysLeft > 0 && i.daysLeft <= 7)
    const later = items.filter(i => !i.isPaid && i.daysLeft > 7)
    const paid = items.filter(i => i.isPaid)

    const fmtItem = (i: typeof items[0]) => `• ${i.name}: RM${fmt(i.amount)} (day ${i.dueDay}${i.daysLeft > 0 ? `, ${i.daysLeft}d left` : ' — TODAY'})`
    const parts: string[] = []
    if (overdue.length > 0) parts.push(`🔴 <b>Due today</b>\n${overdue.map(fmtItem).join('\n')}`)
    if (soon.length > 0) parts.push(`🟡 <b>Coming soon</b>\n${soon.map(fmtItem).join('\n')}`)
    if (later.length > 0) parts.push(`<b>Later this month</b>\n${later.map(fmtItem).join('\n')}`)
    if (paid.length > 0) parts.push(`✅ <b>Paid</b>\n${paid.map(i => `• ${i.name}: RM${fmt(i.amount)}`).join('\n')}`)
    if (parts.length === 0) {
      await sendMessage(chatId, 'No upcoming bills found.')
      return
    }
    await sendMessage(chatId, `<b>Upcoming Payments</b>\n\n${parts.join('\n\n')}`)

  } else if (parsed.intent === 'check_bnpl') {
    if (activeBnpl.length === 0) {
      await sendMessage(chatId, 'No active BNPL plans.')
      return
    }
    const lines = activeBnpl.map(b => {
      const remaining = b.totalInstallments - b.paidInstallments
      const lastPaid = b.lastPaidAt ? ` · last paid ${new Date(b.lastPaidAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}` : ''
      return `<b>${b.merchant}</b> (${b.provider})\n  RM${fmt(b.installmentAmount)}/mo · ${b.paidInstallments}/${b.totalInstallments} paid · ${remaining} months left${lastPaid}`
    }).join('\n\n')
    const totalMonthly = activeBnpl.reduce((s, b) => s + b.installmentAmount, 0)
    await sendMessage(chatId, `<b>BNPL Plans</b>\n\n${lines}\n\n<b>Total monthly: RM${fmt(totalMonthly)}</b>`)

  } else if (parsed.intent === 'check_salary') {
    const [salary] = await db.select().from(financeSalary)
      .where(eq(financeSalary.userId, userId))
      .orderBy(desc(financeSalary.effectiveFrom))
      .limit(1)
    if (!salary) {
      await sendMessage(chatId, 'No salary record found. Add it in duitaku → Settings → Salary.')
      return
    }
    const gross = salary.grossAmount ?? salary.amount
    const deductions = [
      salary.epfEmployee ? `  EPF (employee): RM${fmt(salary.epfEmployee)}` : null,
      salary.epfEmployer ? `  EPF (employer): RM${fmt(salary.epfEmployer)}` : null,
      salary.socso ? `  SOCSO: RM${fmt(salary.socso)}` : null,
      salary.eis ? `  EIS: RM${fmt(salary.eis)}` : null,
      salary.pcb ? `  PCB (tax): RM${fmt(salary.pcb)}` : null,
      salary.otherDeductions ? `  Other: RM${fmt(salary.otherDeductions)}` : null,
    ].filter(Boolean).join('\n')
    await sendMessage(chatId, `<b>Salary (from ${salary.effectiveFrom})</b>

Gross: RM${fmt(gross)}
${deductions ? deductions + '\n' : ''}
<b>Net take-home: RM${fmt(salary.amount)}</b>`)

  } else if (parsed.intent === 'check_red_flags') {
    const [allCats, thisMonthTxnsRf, salaryRecord] = await Promise.all([
      db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
      db.select().from(financeTransactions).where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, monthStart), lte(financeTransactions.date, monthEnd))),
      db.select().from(financeSalary).where(eq(financeSalary.userId, userId)).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    ])
    const salaryAmt = salaryRecord[0]?.amount ?? 0
    const catStats = allCats.map(cat => ({
      name: cat.name,
      spent: thisMonthTxnsRf.filter(t => t.categoryId === cat.id && t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      prior3moAvg: 0,
      monthlyLimit: cat.monthlyLimit ?? null,
    }))
    const rfIncome = thisMonthTxnsRf.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const rfSpent = thisMonthTxnsRf.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const flags = computeRedFlags(salaryAmt, rfIncome - rfSpent, catStats, thisMonthTxnsRf)
    if (flags.length === 0) {
      await sendMessage(chatId, '✅ No budget issues detected this month. You\'re on track!')
      return
    }
    const lines = flags.slice(0, 3).map(f => {
      const icon = f.tone === 'danger' ? '🔴' : '🟡'
      return `${icon} <b>${f.title}</b> (${f.metric})\n${f.detail}\nTip: ${f.tip}`
    }).join('\n\n')
    await sendMessage(chatId, `<b>Budget Check</b>\n\n${lines}`)

  } else if (parsed.intent === 'check_trends') {
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const [prevTxns, cats] = await Promise.all([
      db.select().from(financeTransactions).where(and(eq(financeTransactions.userId, userId), sql`${financeTransactions.date} like ${prevMonthStr + '-%'}`)),
      db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
    ])
    const thisIncome = monthTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const thisSpent = monthTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const prevIncome = prevTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const prevSpent = prevTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const spentΔ = thisSpent - prevSpent
    const catMap = new Map(cats.map(c => [c.id, c.name]))
    const catTotals = new Map<string, number>()
    for (const t of monthTxns.filter(t2 => t2.type === 'expense' && t2.categoryId)) {
      catTotals.set(t.categoryId!, (catTotals.get(t.categoryId!) ?? 0) + t.amount)
    }
    const top3 = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    const catLines = top3.map(([id, amt]) => `  • ${catMap.get(id) ?? 'Uncategorised'}: RM${fmt(amt)}`).join('\n')
    await sendMessage(chatId, `<b>Spending Trend</b>

<b>${prevMonthStr}</b>: Income RM${fmt(prevIncome)} · Spent RM${fmt(prevSpent)} · Net RM${fmt(prevIncome - prevSpent)}
<b>${monthStr} (so far)</b>: Income RM${fmt(thisIncome)} · Spent RM${fmt(thisSpent)} · Net RM${fmt(thisIncome - thisSpent)}

Spent ${spentΔ >= 0 ? '+' : ''}RM${fmt(spentΔ)} vs last month

<b>Top categories this month:</b>
${catLines || '  (no categorised transactions)'}`)

  } else if (parsed.intent === 'check_category_budget') {
    const allCats = await db.select().from(financeCategories).where(eq(financeCategories.userId, userId))
    const catQ = (parsed.categoryName ?? '').toLowerCase()
    const matched = catQ ? allCats.find(c => c.name.toLowerCase().includes(catQ) || catQ.includes(c.name.toLowerCase())) : null
    if (!matched) {
      const withBudget = allCats.filter(c => c.monthlyLimit).map(c => `• ${c.name}: RM${fmt(c.monthlyLimit!)} limit`).join('\n')
      await sendMessage(chatId, `Category not found. Categories with budgets:\n${withBudget || '(none set — add limits in duitaku → Categories)'}`)
      return
    }
    const [row] = await db.select({
      total: sql<number>`coalesce(sum(${financeTransactions.amount}), 0)`,
    }).from(financeTransactions).where(and(
      eq(financeTransactions.userId, userId),
      eq(financeTransactions.categoryId, matched.id),
      sql`${financeTransactions.date} like ${monthStr + '-%'}`,
      eq(financeTransactions.type, 'expense'),
    ))
    const spent = Number(row?.total ?? 0)
    const limit = matched.monthlyLimit ?? 0
    if (limit > 0) {
      const pct = Math.round((spent / limit) * 100)
      const remaining = Math.max(0, limit - spent)
      await sendMessage(chatId, `<b>${matched.name} Budget</b>\n\n[${progBar(spent, limit)}] ${pct}%\nSpent: RM${fmt(spent)} of RM${fmt(limit)}\nRemaining: RM${fmt(remaining)}`)
    } else {
      await sendMessage(chatId, `<b>${matched.name}</b>\nSpent this month: RM${fmt(spent)}\n(No budget limit set — add one in duitaku → Categories)`)
    }

  } else if (parsed.intent === 'add_savings') {
    const goals = await db.select().from(financeSavingsGoals).where(eq(financeSavingsGoals.userId, userId))
    if (goals.length === 0) {
      await sendMessage(chatId, 'No savings goals found. Create one in duitaku → Savings.')
      return
    }
    const goalQ = (parsed.goalName ?? '').toLowerCase()
    let goal = goalQ ? goals.find(g => g.name.toLowerCase().includes(goalQ) || goalQ.includes(g.name.toLowerCase())) : null
    if (!goal && goals.length === 1) goal = goals[0]
    if (!goal) {
      const list = goals.map(g => `• ${g.name}`).join('\n')
      await sendMessage(chatId, `Which savings goal?\n${list}`)
      return
    }
    let savingsAmt: number
    try { savingsAmt = validateAmount(parsed.savingsAmount) } catch {
      await sendMessage(chatId, 'Invalid amount. Try: "saved RM200 for emergency fund"')
      return
    }
    const newAmount = goal.currentAmount + savingsAmt
    await db.update(financeSavingsGoals).set({ currentAmount: newAmount }).where(eq(financeSavingsGoals.id, goal.id))
    const pct = goal.targetAmount && goal.targetAmount > 0 ? ` (${Math.round((newAmount / goal.targetAmount) * 100)}% of goal)` : ''
    await sendMessage(chatId, `✅ Added RM${fmt(savingsAmt)} to ${goal.name}. Total: RM${fmt(newAmount)}${pct}.`)

  } else if (parsed.intent === 'undo_last') {
    const [lastTx] = await db.select().from(financeTransactions)
      .where(eq(financeTransactions.userId, userId))
      .orderBy(desc(financeTransactions.createdAt))
      .limit(1)
    if (!lastTx) {
      await sendMessage(chatId, 'No transactions to undo.')
      return
    }
    await db.delete(financeTransactions).where(eq(financeTransactions.id, lastTx.id))
    const label = lastTx.merchant ?? lastTx.note ?? '?'
    await sendMessage(chatId, `Deleted: RM${fmt(lastTx.amount)} — ${label} on ${lastTx.date}.`)

  } else if (parsed.intent === 'set_category_budget') {
    const allCats = await db.select().from(financeCategories).where(eq(financeCategories.userId, userId))
    const catQ = (parsed.categoryName ?? '').toLowerCase()
    const matched = catQ ? allCats.find(c => c.name.toLowerCase().includes(catQ) || catQ.includes(c.name.toLowerCase())) : null
    if (!matched) {
      await sendMessage(chatId, `Category not found. Try: "set food budget RM500"\n\nYour categories:\n${allCats.map(c => `• ${c.name}`).join('\n') || '(none)'}`)
      return
    }
    let budgetAmt: number
    try { budgetAmt = validateAmount(parsed.budgetAmount) } catch {
      await sendMessage(chatId, 'Invalid amount. Try: "set food budget RM500"')
      return
    }
    await db.update(financeCategories).set({ monthlyLimit: budgetAmt }).where(and(eq(financeCategories.id, matched.id), eq(financeCategories.userId, userId)))
    await sendMessage(chatId, `✅ Budget for <b>${matched.name}</b> set to RM${fmt(budgetAmt)}/month.`)

  } else {
    await sendMessage(chatId, `I didn't understand that. Send /help to see everything I can do.\n\nQuick examples:\n• "spent RM45 lunch"\n• "topup RM100 to TnG"\n• "how much left"\n• "paid celcomdigi"\n• "red flags"`)
  }
}

async function handlePhoto(userId: string, chatId: string, photo: TelegramPhotoSize[]): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!token || !apiKey) {
    await sendMessage(chatId, 'Receipt scanning is not configured.')
    return
  }

  // Download the largest version of the photo
  const largest = photo.reduce((best, p) => p.width > best.width ? p : best, photo[0])
  try {
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${largest.file_id}`)
    const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } }
    if (!fileData.ok || !fileData.result) {
      await sendMessage(chatId, 'Could not download the photo. Try again.')
      return
    }
    const photoRes = await fetch(`https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`)
    const photoBuffer = await photoRes.arrayBuffer()
    const base64 = Buffer.from(photoBuffer).toString('base64')

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: 'Extract from this receipt: merchant name, total amount paid (number only, no currency symbol), date (YYYY-MM-DD or null if not visible), and a brief note. Return ONLY valid JSON with no explanation: {"merchant":"string or null","amount":number or null,"date":"YYYY-MM-DD or null","note":"string or null"}' },
        ],
      }],
    })
    const content = response.content[0]
    if (content.type !== 'text') throw new Error('no text')
    const parsed = JSON.parse(content.text) as { merchant: string | null; amount: number | null; date: string | null; note: string | null }

    if (!parsed.amount || parsed.amount <= 0) {
      await sendMessage(chatId, 'Could not read an amount from this receipt. Please log the expense manually.')
      return
    }

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000)
    await db.insert(telegramPending).values({
      userId, intent: 'ocr_confirm',
      data: JSON.stringify({ amount: parsed.amount, merchant: parsed.merchant, date: parsed.date, note: parsed.note }),
      expiresAt,
    }).onConflictDoUpdate({
      target: telegramPending.userId,
      set: { intent: 'ocr_confirm', data: JSON.stringify({ amount: parsed.amount, merchant: parsed.merchant, date: parsed.date, note: parsed.note }), expiresAt },
    })

    const merchantLine = parsed.merchant ? `Merchant: ${parsed.merchant}` : ''
    const dateLine = parsed.date ? `Date: ${parsed.date}` : ''
    const noteLine = parsed.note ? `Note: ${parsed.note}` : ''
    const details = [merchantLine, dateLine, noteLine].filter(Boolean).join('\n')
    await sendMessage(chatId, `Receipt scanned:\nAmount: RM${fmt(parsed.amount)}\n${details}\n\nReply <b>yes</b> to log this expense, or <b>no</b> to cancel.`)
  } catch {
    await sendMessage(chatId, 'Could not read this receipt. Try a clearer photo or log the expense manually.')
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
  if (!msg?.chat?.id) return Response.json({ ok: true })

  const chatId = String(msg.chat.id)

  // Photo message — OCR receipt scanning
  if (msg.photo && msg.photo.length > 0 && !msg.text) {
    const [conn] = await db.select().from(telegramConnections)
      .where(eq(telegramConnections.telegramChatId, chatId)).limit(1)
    if (!conn) {
      await sendMessage(chatId, "Your Telegram isn't linked yet. Use /start YOUR_CODE to link.")
      return Response.json({ ok: true })
    }
    await handlePhoto(conn.userId, chatId, msg.photo)
    return Response.json({ ok: true })
  }

  if (!msg.text) return Response.json({ ok: true })
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
