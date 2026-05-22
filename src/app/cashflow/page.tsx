import React from 'react'
import { db } from '@/db'
import {
  financeBills,
  financeBillPayments,
  financeBnpl,
  financeAccounts,
  financeSalary,
} from '@/db/schema'
import { and, eq, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getUserId } from '@/lib/get-user-id'
import SidebarClient from '@/components/finance/SidebarClient'
import CashFlowCalendar, { type CashFlowEvent } from '@/components/finance/CashFlowCalendar'

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const DAYS = 30

async function getCashFlowEvents(userId: string, fromDate: Date, days: number): Promise<CashFlowEvent[]> {
  // Build date string list for the window
  const dateStrings: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(fromDate)
    d.setDate(d.getDate() + i)
    dateStrings.push(d.toISOString().slice(0, 10))
  }
  const monthsInWindow = new Set(dateStrings.map(d => d.slice(0, 7)))

  const [bills, bnplPlans, accounts] = await Promise.all([
    db.select().from(financeBills).where(and(eq(financeBills.userId, userId), eq(financeBills.isActive, true))),
    db.select().from(financeBnpl).where(and(eq(financeBnpl.userId, userId), eq(financeBnpl.isActive, true))),
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)),
  ])

  // Fetch bill payments for months in window
  const billIds = bills.map(b => b.id)
  const allPayments: { billId: string; month: string }[] = []
  for (const month of monthsInWindow) {
    if (billIds.length > 0) {
      const rows = await db
        .select()
        .from(financeBillPayments)
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
      const lastDay = new Date(y, m, 0).getDate()
      if (bill.dueDay > lastDay) continue
      const month = ds.slice(0, 7)
      const paid = paidMap.get(bill.id)?.has(month) ?? false
      events.push({ date: ds, type: 'bill', name: bill.name, amount: bill.amount, paid, icon: bill.icon })
    }
  }

  // --- BNPL (due on day 1 of each active month) ---
  for (const plan of bnplPlans) {
    const [sy, sm] = plan.startMonth.split('-').map(Number)
    const startIdx = sy * 12 + sm - 1
    const endIdx = startIdx + plan.totalInstallments - 1

    for (const ds of dateStrings) {
      const [y, m, d] = ds.split('-').map(Number)
      if (d !== 1) continue
      const monthIdx = y * 12 + m - 1
      if (monthIdx < startIdx || monthIdx > endIdx) continue
      const installmentNumber = monthIdx - startIdx
      const paid = installmentNumber < plan.paidInstallments
      events.push({ date: ds, type: 'bnpl', name: plan.merchant, amount: plan.installmentAmount, paid, icon: 'bnpl' })
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
        paid: false,
        icon: 'cc',
      })
    }
  }

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  return events
}

export default async function CashFlowPage() {
  const userId = await getUserId()
  if (!userId) redirect('/login')

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const fromDate = today.toISOString().slice(0, 10)

  const [events, salaryRows] = await Promise.all([
    getCashFlowEvents(userId, today, DAYS),
    db
      .select({ amount: financeSalary.amount })
      .from(financeSalary)
      .where(eq(financeSalary.userId, userId))
      .orderBy(desc(financeSalary.effectiveFrom))
      .limit(1),
  ])

  const salaryAmount = salaryRows[0]?.amount ?? 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          background: '#0d0d0d',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 72,
            background: '#0d0d0d',
            borderBottom: '1px solid #141414',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>CASH FLOW / NEXT {DAYS} DAYS</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>
              Cash Flow Calendar
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...S.label, fontSize: 9 }}>FROM {fromDate}</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 32px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CashFlowCalendar
            events={events}
            fromDate={fromDate}
            days={DAYS}
            salaryAmount={salaryAmount}
          />
        </div>
      </div>
    </div>
  )
}
