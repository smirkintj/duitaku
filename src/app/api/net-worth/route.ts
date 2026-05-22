import { db } from '@/db'
import { financeAccounts, financeInvestments, financeSavingsGoals, financeLoans, financeBnpl } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { getUserIdFromRequest, unauthorized } from '@/lib/get-user-id'

export async function GET(request: Request) {
  const userId = await getUserIdFromRequest(request)
  if (!userId) return unauthorized()

  const [accounts, investments, savings, loans, bnplPlans] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
    db.select().from(financeInvestments).where(eq(financeInvestments.userId, userId)),
    db.select().from(financeSavingsGoals).where(eq(financeSavingsGoals.userId, userId)),
    db.select().from(financeLoans).where(and(eq(financeLoans.userId, userId), eq(financeLoans.isActive, true))),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
  ])

  // ASSETS
  // Bank/cash accounts: use initialBalance (no live transaction sum for now)
  const bankCashAccounts = accounts.filter(a => a.type === 'bank' || a.type === 'cash')
  const accountsTotal = bankCashAccounts.reduce((a, acc) => a + acc.initialBalance, 0)

  const investmentsTotal = investments.reduce((a, inv) => a + inv.currentValue, 0)
  const savingsTotal = savings.reduce((a, s) => a + s.currentAmount, 0)

  const assetsTotal = accountsTotal + investmentsTotal + savingsTotal

  // LIABILITIES
  // Credit card outstanding
  const ccAccounts = accounts.filter(a => a.type === 'credit')
  const ccTotal = ccAccounts.reduce((a, acc) => a + (acc.currentOutstanding ?? 0), 0)

  // Loans outstanding balance
  const loansTotal = loans.reduce((a, l) => a + l.outstandingBalance, 0)

  // BNPL: remaining installments × installmentAmount
  const bnplTotal = bnplPlans.reduce((a, p) => {
    const remaining = p.totalInstallments - p.paidInstallments
    return a + remaining * p.installmentAmount
  }, 0)

  const liabilitiesTotal = ccTotal + loansTotal + bnplTotal

  const netWorth = assetsTotal - liabilitiesTotal

  return Response.json({
    assets: {
      accounts: accountsTotal,
      investments: investmentsTotal,
      savings: savingsTotal,
      total: assetsTotal,
    },
    liabilities: {
      cc: ccTotal,
      loans: loansTotal,
      bnpl: bnplTotal,
      total: liabilitiesTotal,
    },
    netWorth,
  })
}
