import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'crypto'

async function extractPdfText(buffer: Buffer, password?: string): Promise<string> {
  // pdfjs-dist is in serverExternalPackages so it runs as a real Node module, not bundled.
  // Using dynamic import (ESM) to get the actual module exports.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Point workerSrc to the worker file so pdfjs can use a worker_thread in Node.
  // Using a file:// URL ensures Node resolves it correctly outside of webpack bundling.
  const { createRequire } = await import('module')
  const require = createRequire(import.meta.url)
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${workerPath}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadingTask = (pdfjs as any).getDocument({
    data: new Uint8Array(buffer),
    ...(password ? { password } : {}),
  })

  const pdf = await loadingTask.promise

  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    text += content.items.map((item: any) => ('str' in item ? item.str : '')).join(' ') + '\n'
  }
  return text
}

function parseTransactionsFromText(
  text: string,
): { date: string; merchant: string; amount: number; type: 'expense' | 'income' }[] {
  const results: { date: string; merchant: string; amount: number; type: 'expense' | 'income' }[] = []

  const lineRe =
    /(\d{1,2}[\/\- ]\w{2,3}[\/\- ]\d{2,4}|\d{4}-\d{2}-\d{2})\s{2,}(.+?)\s{2,}(CR\s*)?([\d,]+\.\d{2})(\s*CR)?/gi

  let match: RegExpExecArray | null
  while ((match = lineRe.exec(text)) !== null) {
    const rawDate = match[1].trim()
    const merchant = match[2].trim()
    const isCredit = !!(match[3] || match[5])
    const amount = parseFloat(match[4].replace(/,/g, ''))

    let date = rawDate
    const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!isoMatch) {
      const parts = rawDate.split(/[\/\- ]/)
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      }
      if (parts.length >= 3) {
        const d = parts[0].padStart(2, '0')
        const m = months[parts[1].toLowerCase().slice(0, 3)] ?? parts[1].padStart(2, '0')
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
        date = `${y}-${m}-${d}`
      }
    }

    if (!isNaN(amount) && merchant.length > 1) {
      results.push({ date, merchant, amount, type: isCredit ? 'income' : 'expense' })
    }
  }

  return results
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const password = (formData.get('password') as string) || undefined

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let fullText: string
    try {
      fullText = await extractPdfText(buffer, password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      // Surface password errors clearly so the frontend can prompt the user
      if (msg.includes('No password') || msg.includes('NEED_PASSWORD')) {
        return Response.json({ error: 'This PDF is password-protected. Enter the password and try again.', needsPassword: true }, { status: 422 })
      }
      if (msg.includes('Incorrect password') || msg.includes('INCORRECT_PASSWORD')) {
        return Response.json({ error: 'Incorrect PDF password.', needsPassword: true }, { status: 422 })
      }
      return Response.json({ error: `Failed to read PDF: ${msg}` }, { status: 422 })
    }

    if (!fullText.trim()) {
      return Response.json({ error: 'PDF has no selectable text. Try a different file.' }, { status: 422 })
    }

    let parsed: { date: string; merchant: string; amount: number; type: string }[]

    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are a financial data extractor. Extract all transactions from this credit card statement text.
Return ONLY a JSON array, no other text. Each item: { date: "YYYY-MM-DD", merchant: string, amount: number (positive), type: "expense" | "income" }.
Treat payments/credits as income, all purchases as expense.
Ignore summary rows, balance rows, interest charges labels (keep the amounts).

Statement text:
${fullText}`,
          },
        ],
      })

      const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

      try {
        parsed = JSON.parse(responseText)
      } catch {
        const match = responseText.match(/\[[\s\S]*\]/)
        if (!match) {
          return Response.json({ error: 'Failed to parse AI response' }, { status: 500 })
        }
        parsed = JSON.parse(match[0])
      }
    } else {
      parsed = parseTransactionsFromText(fullText)
      if (parsed.length === 0) {
        return Response.json(
          { error: 'Could not extract transactions. Add an ANTHROPIC_API_KEY for AI-powered extraction, or check that your PDF contains selectable text.' },
          { status: 422 },
        )
      }
    }

    const transactions = parsed.map((tx) => ({
      ...tx,
      importHash: createHash('sha256')
        .update(`${tx.date}${tx.merchant}${tx.amount}`)
        .digest('hex'),
    }))

    return Response.json({ transactions, aiPowered: !!process.env.ANTHROPIC_API_KEY })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500 })
  }
}
