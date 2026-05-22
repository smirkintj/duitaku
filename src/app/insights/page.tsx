import React from 'react'
import { db } from '@/db'
import {
  financeTransactions,
  financeCategories,
  financeSalary,
  financeAccounts,
  financeBills,
  financeBnpl,
  financeInvestments,
} from '@/db/schema'
import { and, gte, lte, desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getUserId } from '@/lib/get-user-id'
import SidebarClient from '@/components/finance/SidebarClient'
import InsightsClient from '@/components/finance/InsightsClient'
import { computeRedFlags } from '@/lib/red-flags'

interface PageProps {
  searchParams: Promise<{ m?: string }>
}

function padMonth(n: number) {
  return String(n).padStart(2, '0')
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const userId = await getUserId()
  if (!userId) redirect('/login')

  const sp = await searchParams
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (sp.m && /^\d{4}-\d{2}$/.test(sp.m)) {
    const [y, m] = sp.m.split('-').map(Number)
    year = y
    month = m
  }

  const monthStr = `${year}-${padMonth(month)}`
  const startDate = `${year}-${padMonth(month)}-01`
  const endDate = `${year}-${padMonth(month)}-31`

  const prevM = month - 1 < 1 ? 12 : month - 1
  const prevY = month - 1 < 1 ? year - 1 : year
  const prevStart = `${prevY}-${padMonth(prevM)}-01`
  const prevEnd = `${prevY}-${padMonth(prevM)}-31`

  const prior3Ranges = Array.from({ length: 3 }, (_, i) => {
    let m = month - (i + 1)
    let y = year
    while (m < 1) { m += 12; y-- }
    return { start: `${y}-${padMonth(m)}-01`, end: `${y}-${padMonth(m)}-31` }
  })

  const [salaryRows, monthTxs, categories, prevTxs, prior3Txs, ccAccounts, activeBills, activeBnpl, investments] = await Promise.all([
    db.select().from(financeSalary).where(eq(financeSalary.userId, userId)).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(financeTransactions)
      .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, startDate), lte(financeTransactions.date, endDate))),
    db.select().from(financeCategories).where(eq(financeCategories.userId, userId)),
    db.select().from(financeTransactions)
      .where(and(eq(financeTransactions.userId, userId), gte(financeTransactions.date, prevStart), lte(financeTransactions.date, prevEnd))),
    db.select({
      amount: financeTransactions.amount,
      categoryId: financeTransactions.categoryId,
      type: financeTransactions.type,
      date: financeTransactions.date,
    }).from(financeTransactions)
      .where(and(
        eq(financeTransactions.userId, userId),
        gte(financeTransactions.date, prior3Ranges[2].start),
        lte(financeTransactions.date, prior3Ranges[0].end),
      )),
    db.select().from(financeAccounts).where(and(eq(financeAccounts.userId, userId))),
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
    db.select().from(financeInvestments).where(eq(financeInvestments.userId, userId)),
  ])

  const salary = salaryRows[0]?.amount ?? 0
  const incomeTxs = monthTxs.filter((t) => t.type === 'income')
  const income = incomeTxs.reduce((a, t) => a + t.amount, 0) || salary
  const expenseTxs = monthTxs.filter((t) => t.type === 'expense')
  const spent = expenseTxs.reduce((a, t) => a + t.amount, 0)
  const remaining = Math.max(0, income - spent)
  const savingsRate = income > 0 ? Math.round(((income - spent) / income) * 100) : 0

  const categoryStats = categories
    .filter((cat) => cat.type === 'expense')
    .map((cat) => {
      const catTxs = expenseTxs.filter((t) => t.categoryId === cat.id)
      const catSpent = catTxs.reduce((a, t) => a + t.amount, 0)

      const prevCatSpent = prevTxs
        .filter((t) => t.categoryId === cat.id && t.type === 'expense')
        .reduce((a, t) => a + t.amount, 0)

      let prior3Total = 0
      for (const range of prior3Ranges) {
        const rangeTxs = prior3Txs.filter(
          (t) => t.categoryId === cat.id && t.type === 'expense' && t.date >= range.start && t.date <= range.end,
        )
        prior3Total += rangeTxs.reduce((a, t) => a + t.amount, 0)
      }
      const prior3moAvg = prior3Total / 3

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color ?? '#a3e635',
        budget: cat.monthlyLimit ?? 0,
        spent: catSpent,
        prevMonthSpent: prevCatSpent,
        prior3moAvg,
        isSubscription: cat.name.toLowerCase().includes('subscript'),
      }
    })
    .filter((c) => c.spent > 0 || c.budget > 0)
    .sort((a, b) => b.spent - a.spent)

  const merchantMap = new Map<string, number>()
  for (const tx of expenseTxs) {
    const key = tx.merchant ?? tx.note ?? 'Unknown'
    merchantMap.set(key, (merchantMap.get(key) ?? 0) + tx.amount)
  }
  const topMerchants = Array.from(merchantMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }))

  const flagInput = categoryStats.map((c) => ({
    name: c.name,
    spent: c.spent,
    prior3moAvg: c.prior3moAvg,
    monthlyLimit: c.budget,
    isSubscription: c.isSubscription,
    prevMonthTotal: c.prevMonthSpent,
  }))
  const flags = computeRedFlags(income, remaining, flagInput, expenseTxs)

  // --- Financial Health Score ---

  // 1. Savings rate component (max 30)
  const savingsScore = Math.min(30, savingsRate * 0.6)

  // 2. Budget adherence component (max 25)
  const catsWithBudget = categoryStats.filter((c) => c.budget > 0)
  let budgetScore: number
  if (catsWithBudget.length === 0) {
    budgetScore = 12 // neutral
  } else {
    const catsUnderBudget = catsWithBudget.filter((c) => c.spent <= c.budget).length
    budgetScore = 25 * (catsUnderBudget / catsWithBudget.length)
  }

  // 3. CC utilisation component (max 20)
  const creditCards = ccAccounts.filter((a) => a.type === 'credit' && a.creditLimit != null && (a.creditLimit ?? 0) > 0)
  let ccScore: number
  if (creditCards.length === 0) {
    ccScore = 10 // neutral
  } else {
    const utilisations = creditCards.map((cc) => {
      const outstanding = cc.currentOutstanding ?? 0
      const limit = cc.creditLimit ?? 1
      return outstanding / limit
    })
    const avgUtil = utilisations.reduce((a, b) => a + b, 0) / utilisations.length
    if (avgUtil < 0.3) ccScore = 20
    else if (avgUtil < 0.5) ccScore = 12
    else if (avgUtil < 0.8) ccScore = 6
    else ccScore = 0
  }

  // 4. Debt-to-income component (max 15)
  const totalBillsMonthly = activeBills.reduce((a, b) => a + b.amount, 0)
  const totalBnplMonthly = activeBnpl.reduce((a, b) => a + b.installmentAmount, 0)
  const fixedCommitments = totalBillsMonthly + totalBnplMonthly
  let debtScore: number
  if (salary <= 0) {
    debtScore = 7 // neutral
  } else {
    const dti = fixedCommitments / salary
    if (dti < 0.2) debtScore = 15
    else if (dti < 0.35) debtScore = 10
    else if (dti < 0.5) debtScore = 5
    else debtScore = 0
  }

  // 5. Investment habit component (max 10)
  const totalInvestmentValue = investments.reduce((a, inv) => a + inv.currentValue, 0)
  const investScore = totalInvestmentValue > 0 ? Math.min(10, investments.length * 2) : 0

  const healthTotal = Math.round(savingsScore + budgetScore + ccScore + debtScore + investScore)
  const healthGrade = healthTotal >= 80 ? 'A' : healthTotal >= 65 ? 'B' : healthTotal >= 50 ? 'C' : healthTotal >= 35 ? 'D' : 'F'

  const healthScore = {
    total: healthTotal,
    grade: healthGrade,
    components: [
      {
        label: 'Savings Rate',
        score: Math.round(savingsScore),
        max: 30,
        note: `${savingsRate}% savings rate`,
      },
      {
        label: 'Budget',
        score: Math.round(budgetScore),
        max: 25,
        note: catsWithBudget.length === 0
          ? 'No budgets set'
          : `${catsWithBudget.filter((c) => c.spent <= c.budget).length}/${catsWithBudget.length} under budget`,
      },
      {
        label: 'CC Utilisation',
        score: Math.round(ccScore),
        max: 20,
        note: creditCards.length === 0
          ? 'No credit cards'
          : `Avg ${Math.round((creditCards.reduce((a, cc) => a + (cc.currentOutstanding ?? 0) / (cc.creditLimit ?? 1), 0) / creditCards.length) * 100)}% used`,
      },
      {
        label: 'Debt-to-Income',
        score: Math.round(debtScore),
        max: 15,
        note: salary > 0 ? `${Math.round((fixedCommitments / salary) * 100)}% of salary` : 'No salary set',
      },
      {
        label: 'Investments',
        score: Math.round(investScore),
        max: 10,
        note: investments.length === 0 ? 'No investments' : `${investments.length} position${investments.length > 1 ? 's' : ''}`,
      },
    ],
  }

  // --- Spending Pace Prediction ---
  const daysInMonth = new Date(year, month, 0).getDate()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
  const todayDate = now.getDate()
  const daysPassed = isPastMonth ? daysInMonth : Math.min(todayDate, daysInMonth)
  const dailyRate = daysPassed > 0 ? spent / daysPassed : 0
  const projectedTotal = dailyRate * daysInMonth
  const daysRemaining = daysInMonth - daysPassed

  const pacePrediction = {
    daysInMonth,
    daysPassed,
    daysRemaining,
    spent,
    dailyRate,
    projectedTotal,
    salary,
    isPastMonth,
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <InsightsClient
        month={monthStr}
        salary={salary}
        income={income}
        spent={spent}
        remaining={remaining}
        savingsRate={savingsRate}
        categories={categoryStats}
        topMerchants={topMerchants}
        flags={flags}
        healthScore={healthScore}
        pacePrediction={pacePrediction}
      />
    </div>
  )
}
