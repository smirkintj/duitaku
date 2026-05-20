import { db } from '@/db'
import { financeAccounts, financeInvestments, financeSavingsGoals, financeLoans, financeBnpl } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const [accounts, investments, savings, loans, bnplPlans] = await Promise.all([
    db.select().from(financeAccounts),
    db.select().from(financeInvestments),
    db.select().from(financeSavingsGoals),
    db.select().from(financeLoans).where(eq(financeLoans.isActive, true)),
    db.select().from(financeBnpl).where(eq(financeBnpl.isActive, true)),
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
