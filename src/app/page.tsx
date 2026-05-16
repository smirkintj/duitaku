import React from 'react'
import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary } from '@/db/schema'
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
import { computeRedFlags } from '@/lib/red-flags'

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function padMonth(n: number) {
  return String(n).padStart(2, '0')
}

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
  let year = now.getFullYear()
  let month = now.getMonth() + 1

  if (mParam && /^\d{4}-\d{2}$/.test(mParam)) {
    const [y, m] = mParam.split('-').map(Number)
    year = y
    month = m
  }

  const monthStr = `${year}-${padMonth(month)}`
  const startDate = `${year}-${padMonth(month)}-01`
  const endDate = `${year}-${padMonth(month)}-31`
  const daysIn = getDaysInMonth(year, month)

  // Today's day of month (if current month, else last day)
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month
  const dayOfMonth = isCurrentMonth ? now.getDate() : daysIn

  // Fetch in parallel
  const [salaryRows, monthTxs, categories] = await Promise.all([
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
      })
      .from(financeTransactions)
      .where(
        and(
          gte(financeTransactions.date, startDate),
          lte(financeTransactions.date, endDate),
        ),
      ),
    db.select().from(financeCategories),
  ])

  const salary = salaryRows[0]?.amount ?? 0

  // If no salary, show setup screen
  if (!salaryRows[0]) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d0d0d' }}>
        <SalarySetupCard />
      </div>
    )
  }

  // Compute spent/remaining
  const expenseTxs = monthTxs.filter((t) => t.type === 'expense')
  const spent = expenseTxs.reduce((a, t) => a + t.amount, 0)
  const remaining = Math.max(0, salary - spent)

  // Daily spend array
  const dailySpend: number[] = Array(daysIn).fill(0)
  for (const tx of expenseTxs) {
    const day = parseInt(tx.date.split('-')[2], 10)
    if (day >= 1 && day <= daysIn) {
      dailySpend[day - 1] += tx.amount
    }
  }

  // Per-category stats — fetch prior 3 months
  const prior3Ranges = Array.from({ length: 3 }, (_, i) => {
    let m = month - (i + 1)
    let y = year
    while (m < 1) { m += 12; y-- }
    return {
      start: `${y}-${padMonth(m)}-01`,
      end: `${y}-${padMonth(m)}-31`,
    }
  })

  const prevMonthRange = prior3Ranges[0]

  const [prior3Txs, prevMonthTxs] = await Promise.all([
    db
      .select({
        amount: financeTransactions.amount,
        categoryId: financeTransactions.categoryId,
        type: financeTransactions.type,
        date: financeTransactions.date,
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

      // Spark: daily array
      const spark: number[] = Array(daysIn).fill(0)
      for (const tx of catExpenses) {
        const day = parseInt(tx.date.split('-')[2], 10)
        if (day >= 1 && day <= daysIn) {
          spark[day - 1] += tx.amount
        }
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

  // Red flags
  const flagInput = categoryStats.map((c) => ({
    name: c.name,
    spent: c.spent,
    prior3moAvg: c.prior3moAvg,
    monthlyLimit: c.budget,
    isSubscription: c.isSubscription,
    prevMonthTotal: c.prevMonthTotal,
  }))
  const flags = computeRedFlags(salary, remaining, flagInput, expenseTxs)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <DashboardClient
          remaining={remaining}
          salary={salary}
          month={monthStr}
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
          {flags.length > 0 && <RedFlagClient flags={flags} />}

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
              daysIn={daysIn}
              dayOfMonth={dayOfMonth}
              dailySpend={dailySpend}
              month={monthStr}
            />
            <StatsColumn
              income={salary}
              spent={spent}
              dayOfMonth={dayOfMonth}
              daysIn={daysIn}
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
