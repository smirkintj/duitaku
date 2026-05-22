import React from 'react'
import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary, financeBills, financeBnpl, financeBillPayments, userSettings, financeAccounts, financeInvestments, financeLoans } from '@/db/schema'
import { and, gte, lte, desc, eq } from 'drizzle-orm'
import SidebarClient from '@/components/finance/SidebarClient'
import HeroRemaining from '@/components/finance/HeroRemaining'
import StatsColumn from '@/components/finance/StatsColumn'
import CategoriesBlock from '@/components/finance/CategoriesBlock'
import RecentTransactions from '@/components/finance/RecentTransactions'
import AICoachCard from '@/components/finance/AICoachCard'
import RedFlagClient from '@/components/finance/RedFlagClient'
import DashboardClient from '@/components/finance/DashboardClient'
import SalarySetupCard from '@/components/finance/SalarySetupCard'
import NetWorthWidget from '@/components/finance/NetWorthWidget'
import RecurringSuggestions from '@/components/finance/RecurringSuggestions'
import SetupNudge, { type NudgeItem } from '@/components/finance/SetupNudge'
import { computeRedFlags } from '@/lib/red-flags'
import { getPayCycle, getCurrentBaseMonth, getDayInCycle, prevCycleMonth } from '@/lib/pay-cycle'

interface PageProps {
  searchParams: Promise<{ m?: string }>
}

function DbSetupCard({ message }: { message: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d0d', fontFamily: '"Geist", -apple-system, sans-serif' }}>
      <div style={{ maxWidth: 440, background: '#111', border: '1px solid #222', borderRadius: 16, padding: '36px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', margin: '0 0 10px' }}>Database not configured</h1>
        <p style={{ fontSize: 14, color: '#7a7a78', margin: 0, lineHeight: 1.6 }}>{message}</p>
      </div>
    </div>
  )
}

export default async function HomePage({ searchParams }: PageProps) {
  if (!process.env.DATABASE_URL) {
    return <DbSetupCard message="Set DATABASE_URL in your Vercel project environment variables, then redeploy." />
  }

  const sp = await searchParams
  const mParam = sp.m

  const now = new Date()

  // Load pay day setting (default 1 = calendar month)
  const settingsRows = await db.select({ payDay: userSettings.payDay }).from(userSettings).limit(1)
  const payDay = settingsRows[0]?.payDay ?? 1

  // Determine which cycle (base month) to view
  const baseMonth = (mParam && /^\d{4}-\d{2}$/.test(mParam))
    ? mParam
    : getCurrentBaseMonth(now, payDay)

  const cycle = getPayCycle(baseMonth, payDay)
  const { startDate, endDate, daysIn, label: cycleLabel } = cycle
  const monthStr = baseMonth

  const [cycleYear, cycleMonth] = baseMonth.split('-').map(Number)

  // Day of cycle (1-based, capped at daysIn for past cycles)
  const isCurrentCycle = baseMonth === getCurrentBaseMonth(now, payDay)
  const dayOfMonth = isCurrentCycle ? getDayInCycle(now, startDate, daysIn) : daysIn

  // Fetch in parallel
  const [salaryRows, monthTxs, categories, activeBills, activeBnpl, billPaymentsThisMonth, ccAccountRows, investmentRows, loanRows] = await Promise.all([
    db
      .select()
      .from(financeSalary)
      .where(lte(financeSalary.effectiveFrom, endDate))
      .orderBy(desc(financeSalary.effectiveFrom))
      .limit(1),
    db
      .select({
        id: financeTransactions.id,
        amount: financeTransactions.amount,
        date: financeTransactions.date,
        type: financeTransactions.type,
        merchant: financeTransactions.merchant,
        note: financeTransactions.note,
        categoryId: financeTransactions.categoryId,
        isRecurring: financeTransactions.isRecurring,
        accountId: financeTransactions.accountId,
      })
      .from(financeTransactions)
      .where(and(gte(financeTransactions.date, startDate), lte(financeTransactions.date, endDate))),
    db.select().from(financeCategories),
    db.select().from(financeBills).where(eq(financeBills.isActive, true)),
    db.select().from(financeBnpl).where(eq(financeBnpl.isActive, true)),
    db.select().from(financeBillPayments).where(eq(financeBillPayments.month, baseMonth)),
    db.select({ id: financeAccounts.id }).from(financeAccounts).where(eq(financeAccounts.type, 'credit')),
    db.select({ id: financeInvestments.id }).from(financeInvestments).limit(1),
    db.select({ id: financeLoans.id }).from(financeLoans).where(eq(financeLoans.isActive, true)).limit(1),
  ])

  const salaryDefault = salaryRows[0]?.amount ?? 0

  // If no salary ever set, show first-time setup
  if (!salaryRows[0]) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d0d' }}>
        <SalarySetupCard />
      </div>
    )
  }

  // Income = sum of income transactions this month (with salary as fallback)
  const incomeTxs = monthTxs.filter((t) => t.type === 'income')
  const totalIncome = incomeTxs.reduce((a, t) => a + t.amount, 0)
  const hasPaidThisMonth = totalIncome > 0
  const income = hasPaidThisMonth ? totalIncome : salaryDefault

  // Savings = expense txs in a "savings" category
  const savingsCatIds = new Set(
    categories.filter((c) => c.name.toLowerCase().includes('saving')).map((c) => c.id)
  )
  const expenseTxs = monthTxs.filter((t) => t.type === 'expense')
  const savingsTxs = expenseTxs.filter((t) => t.categoryId && savingsCatIds.has(t.categoryId))
  const spendTxs = expenseTxs.filter((t) => !(t.categoryId && savingsCatIds.has(t.categoryId)))
  const saved = savingsTxs.reduce((a, t) => a + t.amount, 0)
  const salary = income

  // Committed outflows: cash bills (non-CC) + active BNPL installments
  const paidBillIds = new Set(billPaymentsThisMonth.map(p => p.billId))
  // Include all bills (cash + CC statement payments) in committed
  const committedBills = activeBills.reduce((a, b) => a + b.amount, 0)
  const billsPaidCount = activeBills.filter(b => paidBillIds.has(b.id)).length
  const billsCashCount = activeBills.length
  const ccBillsCount = activeBills.filter(b => b.paymentMethod === 'credit_card').length

  const nowIdx = cycleYear * 12 + cycleMonth
  const activeBnplThisMonth = activeBnpl.filter(p => {
    const [sy, sm] = p.startMonth.split('-').map(Number)
    const si = sy * 12 + sm
    return nowIdx >= si && nowIdx <= si + p.totalInstallments - 1
  })
  const committedBnpl = activeBnplThisMonth.reduce((a, p) => a + p.installmentAmount, 0)
  const committedTotal = committedBills + committedBnpl

  // Split variable spending: CC charges are deferred (not cash outflow now)
  const ccAccountIds = new Set(ccAccountRows.map(a => a.id))
  const variableTxs = spendTxs.filter(t => !t.isRecurring)
  const cashVariableTxs = variableTxs.filter(t => !t.accountId || !ccAccountIds.has(t.accountId))
  const ccVariableTxs = variableTxs.filter(t => t.accountId && ccAccountIds.has(t.accountId))
  const variableSpent = cashVariableTxs.reduce((a, t) => a + t.amount, 0)
  const ccCharges = ccVariableTxs.reduce((a, t) => a + t.amount, 0)
  const spent = spendTxs.reduce((a, t) => a + t.amount, 0) // kept for backwards compat (daily chart)

  // Buffer = what's free after all commitments + variable spending
  const remaining = Math.max(0, income - committedTotal - variableSpent - saved)

  // End-of-cycle projection: extrapolate variable spend from daily average
  const avgDailyVar = dayOfMonth > 0 ? variableSpent / dayOfMonth : 0
  const projectedVarTotal = avgDailyVar * daysIn
  const projectedRemaining = Math.max(0, income - committedTotal - projectedVarTotal - saved)

  // Daily spend array (indexed by position in cycle, not calendar day)
  const dailySpend: number[] = Array(daysIn).fill(0)
  for (const tx of expenseTxs) {
    const idx = Math.floor(
      (new Date(tx.date + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000
    )
    if (idx >= 0 && idx < daysIn) {
      dailySpend[idx] += tx.amount
    }
  }

  // Per-category stats — fetch prior 3 cycles
  let bm = baseMonth
  const prior3Cycles = Array.from({ length: 3 }, () => {
    bm = prevCycleMonth(bm)
    return getPayCycle(bm, payDay)
  })
  const prior3Ranges = prior3Cycles.map(c => ({ start: c.startDate, end: c.endDate }))
  const prevMonthRange = prior3Ranges[0]

  const [prior3Txs, prevMonthTxs] = await Promise.all([
    db
      .select({
        amount: financeTransactions.amount,
        categoryId: financeTransactions.categoryId,
        type: financeTransactions.type,
        date: financeTransactions.date,
        merchant: financeTransactions.merchant,
      })
      .from(financeTransactions)
      .where(
        and(
          gte(financeTransactions.date, prior3Ranges[2].start),
          lte(financeTransactions.date, prior3Ranges[0].end),
        ),
      ),
    db
      .select({
        amount: financeTransactions.amount,
        categoryId: financeTransactions.categoryId,
        type: financeTransactions.type,
      })
      .from(financeTransactions)
      .where(
        and(
          gte(financeTransactions.date, prevMonthRange.start),
          lte(financeTransactions.date, prevMonthRange.end),
        ),
      ),
  ])

  // Build category stats
  const categoryStats = categories
    .filter((cat) => cat.type === 'expense')
    .map((cat) => {
      const catExpenses = expenseTxs.filter((t) => t.categoryId === cat.id)
      const catSpent = catExpenses.reduce((a, t) => a + t.amount, 0)

      // Spark: daily array indexed by cycle position
      const spark: number[] = Array(daysIn).fill(0)
      for (const tx of catExpenses) {
        const idx = Math.floor(
          (new Date(tx.date + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000
        )
        if (idx >= 0 && idx < daysIn) spark[idx] += tx.amount
      }

      // Prior 3mo average
      let prior3Total = 0
      for (const range of prior3Ranges) {
        const rangeTxs = prior3Txs.filter(
          (t) =>
            t.categoryId === cat.id &&
            t.type === 'expense' &&
            t.date >= range.start &&
            t.date <= range.end,
        )
        prior3Total += rangeTxs.reduce((a, t) => a + t.amount, 0)
      }
      const prior3moAvg = prior3Total / 3

      // Previous month total
      const prevMonthTotal = prevMonthTxs
        .filter((t) => t.categoryId === cat.id && t.type === 'expense')
        .reduce((a, t) => a + t.amount, 0)

      const isSpike = prior3moAvg > 0 && catSpent > prior3moAvg * 1.3

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon as Parameters<typeof import('@/components/finance/icons').CategoryIcon>[0]['name'],
        budget: cat.monthlyLimit ?? 0,
        spent: catSpent,
        prior3moAvg,
        prevMonthTotal,
        flag: isSpike,
        spark,
        isSubscription: cat.name.toLowerCase().includes('subscript'),
      }
    })
    .filter((c) => c.spent > 0 || c.budget > 0)

  // Last 8 transactions (derived from already-fetched monthTxs)
  const last8 = [...monthTxs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)

  // Build recent transactions with category info
  const catMap = new Map(categories.map((c) => [c.id, c]))
  const recentTxs = last8.map((tx) => {
    const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined
    return {
      id: tx.id,
      merchant: tx.merchant ?? tx.note ?? 'Unknown',
      cat: cat?.name ?? 'Uncategorized',
      icon: (cat?.icon ?? 'bag') as Parameters<typeof import('@/components/finance/icons').CategoryIcon>[0]['name'],
      amount: tx.type === 'income' ? tx.amount : -tx.amount,
      when: tx.date,
      recurring: tx.isRecurring,
      income: tx.type === 'income',
    }
  })

  // Merchant anomalies for red flags: group current cycle expenses by merchant
  const merchantSpend = new Map<string, number>()
  for (const tx of expenseTxs) {
    const key = (tx.merchant ?? 'Unknown').trim()
    merchantSpend.set(key, (merchantSpend.get(key) ?? 0) + tx.amount)
  }
  const merchantPrior = new Map<string, number>()
  for (const tx of prior3Txs.filter(t => t.type === 'expense')) {
    const key = (tx.merchant ?? 'Unknown').trim()
    merchantPrior.set(key, (merchantPrior.get(key) ?? 0) + tx.amount)
  }
  const merchantAnomalies = Array.from(merchantSpend.entries()).map(([merchant, currentTotal]) => ({
    merchant,
    currentTotal,
    prev3avg: merchantPrior.has(merchant) ? (merchantPrior.get(merchant)! / 3) : 0,
  }))

  // Red flags
  const flagInput = categoryStats.map((c) => ({
    name: c.name,
    spent: c.spent,
    prior3moAvg: c.prior3moAvg,
    monthlyLimit: c.budget,
    isSubscription: c.isSubscription,
    prevMonthTotal: c.prevMonthTotal,
  }))
  const flags = computeRedFlags(salary, remaining, flagInput, expenseTxs, merchantAnomalies, projectedRemaining, daysIn - dayOfMonth)

  // Setup nudges — ordered by priority, each with a step number for guidance
  const allNudges: NudgeItem[] = [
    {
      id: 'bills',
      step: 1,
      title: "Add your recurring commitments",
      body: "Log fixed monthly costs — rent, utilities, phone, subscriptions. This is what your buffer is calculated against.",
      href: '/bills',
      actionLabel: 'Add bills',
    },
    {
      id: 'transactions',
      step: 2,
      title: "Import your bank statement",
      body: "Upload your bank or CC PDF to see where your money actually went this month. The dashboard numbers update immediately.",
      href: '/import',
      actionLabel: 'Import statement',
    },
    {
      id: 'cc',
      step: 3,
      title: "Link a credit card account",
      body: "Adding a CC account separates deferred charges from cash spending, so your buffer reflects actual cash available.",
      href: '/accounts',
      actionLabel: 'Add card',
    },
    {
      id: 'investments',
      step: 4,
      title: "Track your investments",
      body: "Add EPF, ASB, unit trusts or crypto so net worth shows the full picture, not just your bank balance.",
      href: '/investments',
      actionLabel: 'Add investments',
    },
    {
      id: 'loans',
      step: 5,
      title: "Record any loans",
      body: "Add your car loan, mortgage or PTPTN so debt is included in net worth and you can see the payoff timeline.",
      href: '/loans',
      actionLabel: 'Add loan',
    },
  ]
  const activeNudges = allNudges.filter(n => {
    if (n.id === 'transactions') return monthTxs.filter(t => t.type === 'expense').length === 0
    if (n.id === 'bills') return activeBills.length === 0
    if (n.id === 'cc') return ccAccountRows.length === 0
    if (n.id === 'investments') return investmentRows.length === 0
    if (n.id === 'loans') return loanRows.length === 0
    return false
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <DashboardClient
          remaining={remaining}
          salary={salary}
          month={monthStr}
          cycleLabel={cycleLabel}
          hasPaidThisMonth={hasPaidThisMonth}
          salaryDefault={salaryDefault}
          projectedRemaining={projectedRemaining}
          daysLeft={daysIn - dayOfMonth}
        />
        <main
          style={{
            padding: '24px 32px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flex: 1,
          }}
        >
          <SetupNudge nudges={activeNudges} total={allNudges.length} />

          {flags.length > 0 && <RedFlagClient flags={flags} />}

          <RecurringSuggestions />

          <NetWorthWidget month={monthStr} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)',
              gap: 16,
            }}
          >
            <HeroRemaining
              remaining={remaining}
              salary={salary}
              spent={spent}
              committedTotal={committedTotal}
              variableSpent={variableSpent}
              daysIn={daysIn}
              dayOfMonth={dayOfMonth}
              dailySpend={dailySpend}
              month={monthStr}
            />
            <StatsColumn
              income={income}
              committedTotal={committedTotal}
              committedBills={committedBills}
              committedBnpl={committedBnpl}
              billsPaidCount={billsPaidCount}
              billsCashCount={billsCashCount}
              ccBillsCount={ccBillsCount}
              variableSpent={variableSpent}
              ccCharges={ccCharges}
              remaining={remaining}
              saved={saved}
              dayOfMonth={dayOfMonth}
              daysIn={daysIn}
              projectedRemaining={projectedRemaining}
              isCurrentCycle={isCurrentCycle}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)',
              gap: 16,
            }}
          >
            <CategoriesBlock categories={categoryStats} month={monthStr} />
            <RecentTransactions transactions={recentTxs} />
          </div>

          <AICoachCard month={monthStr} />
        </main>
      </div>
    </div>
  )
}
