import { db } from '@/db'
import { financeBills, financeBillPayments, financeBnpl, financeAccounts, financeSalary, userSettings } from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export interface CashFlowEvent {
  date: string       // YYYY-MM-DD
  type: 'bill' | 'bnpl' | 'cc'
  name: string
  amount: number
  paid: boolean
  icon: string
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const { searchParams } = new URL(request.url)
  const fromParam = searchParams.get('from') // YYYY-MM-DD
  const daysParam = parseInt(searchParams.get('days') ?? '30')

  const fromDate = fromParam ? new Date(fromParam) : new Date()
  // Normalise to midnight
  fromDate.setHours(0, 0, 0, 0)
  const days = isNaN(daysParam) ? 30 : Math.min(Math.max(daysParam, 1), 90)

  // Build set of YYYY-MM-DD strings for the window
  const dateStrings: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    dateStrings.push(d.toISOString().slice(0, 10))
  }
  // The months that overlap with our window
  const monthsInWindow = new Set(dateStrings.map(d => d.slice(0, 7)))

  const [bills, bnplPlans, accounts, salaryRows, settings] = await Promise.all([
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
    db.select().from(financeSalary).where(eq(financeSalary.userId, userId)).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1),
  ])

  // Fetch bill payments for months in window
  const billIds = bills.map(b => b.id)
  const allPayments: { billId: string; month: string }[] = []
  for (const month of monthsInWindow) {
    if (billIds.length > 0) {
      const rows = await db.select().from(financeBillPayments)
        .where(eq(financeBillPayments.month, month))
        .then(r => r.filter(p => billIds.includes(p.billId)))
      allPayments.push(...rows)
    }
  }
  // paid lookup: billId -> Set<month>
  const paidMap = new Map<string, Set<string>>()
  for (const p of allPayments) {
    if (!paidMap.has(p.billId)) paidMap.set(p.billId, new Set())
    paidMap.get(p.billId)!.add(p.month)
  }

  const events: CashFlowEvent[] = []

  // --- Bills ---
  for (const bill of bills) {
    for (const ds of dateStrings) {
      const [y, m, d] = ds.split('-').map(Number)
      if (d !== bill.dueDay) continue
      // Clamp to actual last day of month
      const lastDay = new Date(y, m, 0).getDate()
      if (bill.dueDay > lastDay) {
        // If dueDay is e.g. 31 but month has 28 days, skip (already handled via dueDay !== d)
        continue
      }
      const month = ds.slice(0, 7)
      const paid = paidMap.get(bill.id)?.has(month) ?? false
      events.push({
        date: ds,
        type: 'bill',
        name: bill.name,
        amount: bill.amount,
        paid,
        icon: bill.icon,
      })
    }
  }

  // --- BNPL (due on day 1 of each active month) ---
  for (const plan of bnplPlans) {
    const [sy, sm] = plan.startMonth.split('-').map(Number)
    const startIdx = sy * 12 + sm - 1 // 0-based month index
    const endIdx = startIdx + plan.totalInstallments - 1

    for (const ds of dateStrings) {
      const [y, m, d] = ds.split('-').map(Number)
      if (d !== 1) continue
      const monthIdx = y * 12 + m - 1
      if (monthIdx < startIdx || monthIdx > endIdx) continue
      const installmentNumber = monthIdx - startIdx // 0-based
      const paid = installmentNumber < plan.paidInstallments
      events.push({
        date: ds,
        type: 'bnpl',
        name: plan.merchant,
        amount: plan.installmentAmount,
        paid,
        icon: 'bnpl',
      })
    }
  }

  // --- Credit card payment due dates ---
  const ccAccounts = accounts.filter(a => a.type === 'credit' && a.statementDueDay != null)
  for (const acc of ccAccounts) {
    const dueDay = acc.statementDueDay!
    for (const ds of dateStrings) {
      const [y, m, d] = ds.split('-').map(Number)
      if (d !== dueDay) continue
      const lastDay = new Date(y, m, 0).getDate()
      if (dueDay > lastDay) continue
      events.push({
        date: ds,
        type: 'cc',
        name: acc.name,
        amount: acc.currentOutstanding ?? 0,
        paid: false, // CC payments don't have a simple paid flag
        icon: 'cc',
      })
    }
  }

  // Sort by date then type
  events.sort((a, b) => {
    if (a.date < b.date) return -1
    if (a.date > b.date) return 1
    return 0
  })

  return Response.json(events)
}
