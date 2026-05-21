import Anthropic from '@anthropic-ai/sdk'

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFJS = require('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
  PDFJS.disableWorker = true
  const doc = await PDFJS.getDocument({ data: new Uint8Array(buffer) })
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of content.items as any[]) text += (item.str ?? '') + ' '
    text += '\n'
  }
  doc.destroy()
  return text
}

export interface EpfStatement {
  account1Balance: number      // Akaun 1 — retirement (70%)
  account2Balance: number      // Akaun 2 — flexible withdrawals (30%)
  account3Balance: number      // Akaun 3 (Fleksibel) — if applicable, else 0
  totalBalance: number
  asOf: string                 // YYYY-MM-DD (statement date)
  memberName: string | null
  memberNo: string | null
  annualDividendRate: number | null  // % e.g. 5.35
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  let text: string
  try {
    text = await extractPdfText(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Could not read PDF: ${msg}` }, { status: 422 })
  }

  if (!text.trim()) {
    return Response.json({ error: 'PDF has no selectable text.' }, { status: 422 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract EPF (KWSP) account balances from this Malaysian EPF statement.
Return ONLY a JSON object, no other text:

{
  "account1Balance": number,      // Akaun 1 balance (pengeluaran persaraan / retirement)
  "account2Balance": number,      // Akaun 2 balance (pengeluaran fleksibel / pre-retirement)
  "account3Balance": number,      // Akaun 3 balance (Akaun Fleksibel, new 2024 account; 0 if not present)
  "totalBalance": number,         // total EPF savings
  "asOf": "YYYY-MM-DD",          // statement date or last update date
  "memberName": string | null,    // member full name if shown
  "memberNo": string | null,      // EPF member number / IC number
  "annualDividendRate": number | null  // latest declared dividend rate % (e.g. 5.35)
}

If a value is not found use 0 for numbers, null for strings/rate.
Do NOT output anything except the JSON object.

EPF statement text:
${text}`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  try {
    const obj = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''))
    return Response.json(obj as EpfStatement)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return Response.json({ error: 'Could not parse AI response' }, { status: 500 })
    return Response.json(JSON.parse(match[0]) as EpfStatement)
  }
}
