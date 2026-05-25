import { db } from '@/db'
import {
  financeAccounts,
  financeTransactions,
  financeInvestments,
  financeSavingsGoals,
  financeLoans,
  financeBnpl,
} from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

function getMonthEnd(year: number, month: number): string {
  // month is 1-indexed
  const lastDay = new Date(year, month, 0).getDate() // day 0 of next month = last day of this month
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function getMonthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  // Fetch everything in parallel — transactions need a full fetch, rest are current state
  const [accounts, transactions, investments, savings, loans, bnplPlans] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
    db.select().from(financeTransactions).where(eq(financeTransactions.userId, userId)),
    db.select().from(financeInvestments).where(eq(financeInvestments.userId, userId)),
    db.select().from(financeSavingsGoals).where(eq(financeSavingsGoals.userId, userId)),
    db.select().from(financeLoans).where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true))),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
  ])

  // Current state values (same across all months — acknowledged limitation)
  const investmentsTotal = investments.reduce((a, inv) => a + inv.currentValue, 0)
  const savingsTotal = savings.reduce((a, s) => a + s.currentAmount, 0)

  const ccAccounts = accounts.filter(a => a.type === 'credit')
  const ccTotal = ccAccounts.reduce((a, acc) => a + (acc.currentOutstanding ?? 0), 0)
  const loansTotal = loans.reduce((a, l) => a + l.outstandingBalance, 0)
  const bnplTotal = bnplPlans.reduce((a, p) => {
    const remaining = p.totalInstallments - p.paidInstallments
    return a + remaining * p.installmentAmount
  }, 0)
  const liabilities = ccTotal + loansTotal + bnplTotal

  const bankCashAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash')
  const initialBalanceSum = bankCashAccounts.reduce((a, acc) => a + acc.initialBalance, 0)

  // Build 12 months (current month going back 11)
  const now = new Date()
  const months: Array<{ month: string; assets: number; liabilities: number; netWorth: number }> = []

  for (let i = 11; i >= 0; i--) {
    // Compute target year/month
    let year = now.getFullYear()
    let month = now.getMonth() + 1 - i // 1-indexed
    while (month <= 0) {
      month += 12
      year -= 1
    }
    while (month > 12) {
      month -= 12
      year += 1
    }

    const monthEnd = getMonthEnd(year, month)
    const label = getMonthLabel(year, month)

    // Filter transactions up to end of this month
    const incomeUpTo = transactions
      .filter(t => t.type === 'income' && t.date <= monthEnd)
      .reduce((a, t) => a + t.amount, 0)

    const expenseUpTo = transactions
      .filter(t => t.type === 'expense' && t.date <= monthEnd)
      .reduce((a, t) => a + t.amount, 0)

    const cashBalance = initialBalanceSum + incomeUpTo - expenseUpTo

    const assets = cashBalance + investmentsTotal + savingsTotal
    const netWorth = assets - liabilities

    months.push({ month: label, assets, liabilities, netWorth })
  }

  return Response.json({ months })
}
