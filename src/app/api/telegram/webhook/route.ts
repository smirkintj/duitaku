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
} from '@/db/schema'
import { and, eq, gte, lte } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

interface TelegramChat {
  id: number
}

interface TelegramMessage {
  text?: string
  chat?: TelegramChat
}

interface TelegramUpdate {
  message?: TelegramMessage
}

interface ParsedIntent {
  intent: 'mark_bill_paid' | 'add_expense' | 'add_income' | 'check_balance' | 'unknown'
  billId?: string
  billName?: string
  amount?: number
  merchant?: string
  note?: string | null
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

  // Upsert the connection
  await db.insert(telegramConnections).values({
    userId: linkCode.userId,
    telegramChatId: chatId,
  }).onConflictDoUpdate({
    target: telegramConnections.userId,
    set: { telegramChatId: chatId, linkedAt: new Date() },
  })

  // Clean up the used code
  await db.delete(telegramLinkCodes).where(eq(telegramLinkCodes.code, code))

  await sendMessage(chatId, "✅ Your Telegram is now linked to duitaku!\n\nYou can now:\n• 'paid celcomdigi' — mark a bill as paid\n• 'spent RM45 lunch' — log an expense\n• 'received RM500' — log income\n• 'how much left' — check your balance")
}

async function handleMessage(userId: string, chatId: string, text: string): Promise<void> {
  // Fetch active bills for context
  const bills = await db.select().from(financeBills)
    .where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true)))

  // Fetch current month income/spent
  const now = new Date()
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${monthStr}-01`
  const monthEnd = `${monthStr}-31`

  const monthTransactions = await db.select().from(financeTransactions)
    .where(and(
      eq(financeTransactions.userId, userId),
      gte(financeTransactions.date, monthStart),
      lte(financeTransactions.date, monthEnd),
    ))

  const totalSpent = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const totalIncome = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  // Call Claude to parse intent
  let parsed: ParsedIntent = { intent: 'unknown' }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You are a parser for a personal finance app. Extract the intent from the user's message.
Return ONLY valid JSON, no other text.

Available bills: ${JSON.stringify(bills.map(b => ({ id: b.id, name: b.name, amount: b.amount })))}

Return one of these shapes:
{"intent":"mark_bill_paid","billId":"uuid","billName":"string"}
{"intent":"add_expense","amount":number,"merchant":"string","note":"string|null"}
{"intent":"add_income","amount":number,"note":"string"}
{"intent":"check_balance","_":""}
{"intent":"unknown","_":""}`,
      messages: [{ role: 'user', content: text }],
    })

    const content = response.content[0]
    if (content.type === 'text') {
      parsed = JSON.parse(content.text) as ParsedIntent
    }
  } catch {
    // Fall through to unknown intent
  }

  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  if (parsed.intent === 'mark_bill_paid') {
    // Find bill by ID, with fuzzy fallback
    let bill = bills.find(b => b.id === parsed.billId)
    if (!bill && parsed.billName) {
      const nameLower = parsed.billName.toLowerCase()
      bill = bills.find(b => b.name.toLowerCase().includes(nameLower) || nameLower.includes(b.name.toLowerCase()))
    }
    if (!bill) {
      // Last resort: fuzzy match against original text
      const textLower = text.toLowerCase()
      bill = bills.find(b => textLower.includes(b.name.toLowerCase()))
    }

    if (!bill) {
      const billList = bills.length > 0
        ? bills.map(b => `• ${b.name}`).join('\n')
        : '(no active bills)'
      await sendMessage(chatId, `Couldn't find that bill. Your active bills:\n${billList}`)
      return
    }

    // Check if already paid this month
    const [existing] = await db.select().from(financeBillPayments)
      .where(and(eq(financeBillPayments.billId, bill.id), eq(financeBillPayments.month, monthStr)))
      .limit(1)

    if (existing) {
      await sendMessage(chatId, `Already marked ${bill.name} as paid this month.`)
      return
    }

    // Insert payment record
    await db.insert(financeBillPayments).values({
      billId: bill.id,
      month: monthStr,
      paidAt: now,
    })

    // Insert transaction
    await db.insert(financeTransactions).values({
      userId,
      amount: bill.amount,
      currency: 'MYR',
      date: today,
      merchant: bill.name,
      type: 'expense',
    })

    await sendMessage(chatId, `✅ ${bill.name} marked paid — RM${bill.amount.toFixed(2)} logged as expense`)

  } else if (parsed.intent === 'add_expense') {
    const amount = parsed.amount ?? 0
    const merchant = parsed.merchant ?? 'Unknown'

    await db.insert(financeTransactions).values({
      userId,
      amount,
      currency: 'MYR',
      date: today,
      merchant,
      note: parsed.note ?? null,
      type: 'expense',
    })

    await sendMessage(chatId, `✅ Logged RM${amount.toFixed(2)} spent at ${merchant}`)

  } else if (parsed.intent === 'add_income') {
    const amount = parsed.amount ?? 0
    const note = parsed.note ?? null

    await db.insert(financeTransactions).values({
      userId,
      amount,
      currency: 'MYR',
      date: today,
      note,
      type: 'income',
    })

    await sendMessage(chatId, `✅ Logged RM${amount.toFixed(2)} income`)

  } else if (parsed.intent === 'check_balance') {
    const remaining = totalIncome - totalSpent
    await sendMessage(
      chatId,
      `💰 This month: Spent RM${totalSpent.toFixed(2)} | Remaining RM${remaining.toFixed(2)}`
    )

  } else {
    await sendMessage(chatId, "I didn't understand that. Try:\n• 'paid celcomdigi'\n• 'spent RM45 lunch'\n• 'how much left'")
  }
}

export async function POST(request: Request) {
  const body = await request.json() as TelegramUpdate
  const msg = body.message
  if (!msg?.text || !msg.chat?.id) return Response.json({ ok: true })

  const chatId = String(msg.chat.id)
  const text = msg.text.trim()

  // Handle /start CODE — link account
  if (text.startsWith('/start')) {
    const code = text.split(' ')[1]?.trim()
    await handleLink(chatId, code)
    return Response.json({ ok: true })
  }

  // Check if this chat is connected to a user
  const [conn] = await db.select().from(telegramConnections)
    .where(eq(telegramConnections.telegramChatId, chatId)).limit(1)

  if (!conn) {
    await sendMessage(chatId, "Your Telegram isn't linked to a duitaku account yet.\n\nGo to duitaku → Settings → Connect Telegram, then send me the 6-digit code with /start YOUR_CODE")
    return Response.json({ ok: true })
  }

  // Parse intent with Claude and execute
  await handleMessage(conn.userId, chatId, text)
  return Response.json({ ok: true })
}
