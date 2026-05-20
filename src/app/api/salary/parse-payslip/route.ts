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

export interface ParsedPayslip {
  grossAmount: number
  epfEmployee: number
  epfEmployer: number
  socso: number
  eis: number
  pcb: number
  otherDeductions: number
  netAmount: number
  effectiveFrom: string   // YYYY-MM-DD (first of the pay period month)
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
      content: `You are extracting salary data from a Malaysian payslip.
Return ONLY a JSON object with these fields (all amounts in MYR as numbers, 2 decimal places):

{
  "grossAmount": number,         // total gross earnings before any deductions
  "epfEmployee": number,         // EPF / KWSP employee contribution
  "epfEmployer": number,         // EPF / KWSP employer contribution (0 if not shown)
  "socso": number,               // SOCSO / PERKESO employee contribution
  "eis": number,                 // EIS / SIP employee contribution
  "pcb": number,                 // PCB / monthly tax deduction (Potongan Cukai Berjadual)
  "otherDeductions": number,     // sum of any other deductions not listed above (0 if none)
  "netAmount": number,           // net pay / take-home amount
  "effectiveFrom": "YYYY-MM-DD"  // first day of the pay period month (e.g. "2024-11-01")
}

Rules:
- If a field is not found, use 0 (or today's first of month for effectiveFrom).
- Do NOT include explanations, markdown, or any text outside the JSON object.

Payslip text:
${text}`,
    }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  try {
    const obj = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```\s*$/, ''))
    return Response.json(obj as ParsedPayslip)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return Response.json({ error: 'Could not parse AI response' }, { status: 500 })
    return Response.json(JSON.parse(match[0]) as ParsedPayslip)
  }
}
