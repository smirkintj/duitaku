import React from 'react'
import { db } from '@/db'
import { financeTransactions, financeCategories, financeSalary } from '@/db/schema'
import { and, gte, lte, desc } from 'drizzle-orm'
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

  const [salaryRows, monthTxs, categories, prevTxs, prior3Txs] = await Promise.all([
    db.select().from(financeSalary).orderBy(desc(financeSalary.effectiveFrom)).limit(1),
    db.select().from(financeTransactions)
      .where(and(gte(financeTransactions.date, startDate), lte(financeTransactions.date, endDate))),
    db.select().from(financeCategories),
    db.select().from(financeTransactions)
      .where(and(gte(financeTransactions.date, prevStart), lte(financeTransactions.date, prevEnd))),
    db.select({
      amount: financeTransactions.amount,
      categoryId: financeTransactions.categoryId,
      type: financeTransactions.type,
      date: financeTransactions.date,
    }).from(financeTransactions)
      .where(and(
        gte(financeTransactions.date, prior3Ranges[2].start),
        lte(financeTransactions.date, prior3Ranges[0].end),
      )),
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
      />
    </div>
  )
}
