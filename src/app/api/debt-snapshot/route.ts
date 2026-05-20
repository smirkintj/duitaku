import { db } from '@/db'
import { financeBills, financeBnpl, financeAccounts, financeSalary } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET() {
  const [salary, bills, bnplPlans, accounts] = await Promise.all([
    db.select().from(financeSalary).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(financeBills).where(eq(financeBills.isActive, true)),
    db.select().from(financeBnpl).where(eq(financeBnpl.isActive, true)),
    db.select().from(financeAccounts),
  ])

  const salaryAmount = salary[0]?.amount ?? 0

  // credit_card bills are already on the CC balance; everything else is a direct cash outflow
  const cashBills = bills.filter(b => b.paymentMethod !== 'credit_card')
  const ccBills = bills.filter(b => b.paymentMethod === 'credit_card')
  const directDebitBills = cashBills // alias used in response
  const directDebitTotal = cashBills.reduce((a, b) => a + b.amount, 0)
  const ccBillsTotal = ccBills.reduce((a, b) => a + b.amount, 0)

  const bnplItems = bnplPlans.map(p => {
    const remaining = p.totalInstallments - p.paidInstallments
    const [sy, sm] = p.startMonth.split('-').map(Number)
    const now = new Date()
    const curIdx = now.getFullYear() * 12 + (now.getMonth() + 1)
    const startIdx = sy * 12 + sm
    const endIdx = startIdx + p.totalInstallments - 1
    const activeThisMonth = curIdx >= startIdx && curIdx <= endIdx
    // Clear month = start month + totalInstallments - 1
    const clearIdx = endIdx
    const clearYear = Math.floor((clearIdx - 1) / 12)
    const clearMonth = ((clearIdx - 1) % 12) + 1
    const clearMonthStr = `${clearYear}-${String(clearMonth).padStart(2, '0')}`
    return {
      id: p.id,
      merchant: p.merchant,
      provider: p.provider,
      installmentAmount: p.installmentAmount,
      remainingInstallments: remaining,
      remainingTotal: remaining * p.installmentAmount,
      activeThisMonth,
      clearMonth: clearMonthStr,
      accountId: p.accountId,
    }
  })
  const activeBnplTotal = bnplItems.filter(p => p.activeThisMonth).reduce((a, p) => a + p.installmentAmount, 0)

  const ccAccounts = accounts.filter(a => a.type === 'credit').map(a => ({
    id: a.id,
    name: a.name,
    lastFour: a.lastFour,
    creditLimit: a.creditLimit,
    outstanding: a.currentOutstanding ?? 0,
    utilisationPct: a.creditLimit && a.currentOutstanding != null
      ? Math.round((a.currentOutstanding / a.creditLimit) * 100) : null,
  }))
  const totalCcOutstanding = ccAccounts.reduce((a, c) => a + c.outstanding, 0)

  return Response.json({
    salaryAmount,
    directDebitBills: directDebitBills.map(b => ({ id: b.id, name: b.name, amount: b.amount, dueDay: b.dueDay })),
    directDebitTotal,
    ccBills: ccBills.map(b => ({ id: b.id, name: b.name, amount: b.amount, accountId: b.accountId })),
    ccBillsTotal,
    bnplItems,
    activeBnplTotal,
    ccAccounts,
    totalCcOutstanding,
  })
}
