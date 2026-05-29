'use client'

import React, { useState, useEffect, useCallback } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'
import { formatRM } from '@/lib/finance-utils'

interface Loan {
  id: string
  name: string
  type: string
  lender: string | null
  originalAmount: number
  outstandingBalance: number
  interestRate: number | null
  monthlyInstallment: number
  startDate: string | null
  tenureMonths: number | null
  billId: string | null
  notes: string | null
  isActive: boolean
  lastPaidAt: string | null
  createdAt: string
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const LOAN_TYPES = [
  { v: 'car',      label: 'CAR',      color: '#f97316' },
  { v: 'student',  label: 'STUDENT',  color: '#60a5fa' },
  { v: 'personal', label: 'PERSONAL', color: '#a78bfa' },
  { v: 'mortgage', label: 'MORTGAGE', color: '#34d399' },
  { v: 'other',    label: 'OTHER',    color: '#7a7a78' },
]

function loanTypeMeta(v: string) {
  return LOAN_TYPES.find(t => t.v === v) ?? LOAN_TYPES[4]
}

function estimatedPayoffMonths(outstandingBalance: number, monthlyInstallment: number): number {
  if (monthlyInstallment <= 0) return 0
  return Math.ceil(outstandingBalance / monthlyInstallment)
}

function payoffDate(months: number): { label: string; date: Date } {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1)
  const label = d.toLocaleString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase()
  return { label, date: d }
}

function timelineColor(months: number): string {
  if (months <= 12) return '#4ade80'
  if (months <= 36) return '#fbbf24'
  return '#ef4444'
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid #222',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#f5f5f4',
  fontFamily: '"Geist", -apple-system, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#5b5b59',
  letterSpacing: '0.08em',
  marginBottom: 5,
  display: 'block',
}

// Amortization: compute payoff months and total interest saved with extra payment
function whatIfCalc(outstanding: number, monthly: number, rate: number, extra: number) {
  if (monthly <= 0) return null
  const monthlyRate = rate / 100 / 12

  function monthsToPayoff(extraMonthly: number): { months: number; totalInterest: number } {
    if (monthlyRate <= 0) {
      const months = Math.ceil(outstanding / (monthly + extraMonthly))
      return { months, totalInterest: 0 }
    }
    let balance = outstanding
    let months = 0
    let totalInterest = 0
    while (balance > 0.01 && months < 600) {
      const interest = balance * monthlyRate
      totalInterest += interest
      const payment = Math.min(monthly + extraMonthly, balance + interest)
      balance = balance + interest - payment
      months++
    }
    return { months, totalInterest }
  }

  const base = monthsToPayoff(0)
  const with_ = monthsToPayoff(extra)
  return {
    baseMonths: base.months,
    withMonths: with_.months,
    savedMonths: base.months - with_.months,
    savedInterest: Math.max(0, base.totalInterest - with_.totalInterest),
  }
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)

  // What-if state
  const [whatIfLoan, setWhatIfLoan] = useState<Loan | null>(null)
  const [extraPayment, setExtraPayment] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)

  // Form state
  const [fName, setFName] = useState('')
  const [fType, setFType] = useState('other')
  const [fLender, setFLender] = useState('')
  const [fOriginalAmount, setFOriginalAmount] = useState('')
  const [fOutstanding, setFOutstanding] = useState('')
  const [fMonthly, setFMonthly] = useState('')
  const [fInterestRate, setFInterestRate] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [payingLoan, setPayingLoan] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/loans')
    setLoans(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditingLoan(null)
    setFName(''); setFType('other'); setFLender(''); setFOriginalAmount(''); setFOutstanding(''); setFMonthly(''); setFInterestRate(''); setFNotes('')
    setShowModal(true)
  }

  function openEdit(loan: Loan) {
    setEditingLoan(loan)
    setFName(loan.name)
    setFType(loan.type)
    setFLender(loan.lender ?? '')
    setFOriginalAmount(String(loan.originalAmount))
    setFOutstanding(String(loan.outstandingBalance))
    setFMonthly(String(loan.monthlyInstallment))
    setFInterestRate(loan.interestRate != null ? String(loan.interestRate) : '')
    setFNotes(loan.notes ?? '')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fName.trim() || !fOriginalAmount || !fOutstanding || !fMonthly) return
    setSaving(true)

    const body = {
      name: fName.trim(),
      type: fType,
      lender: fLender.trim() || undefined,
      originalAmount: parseFloat(fOriginalAmount),
      outstandingBalance: parseFloat(fOutstanding),
      monthlyInstallment: parseFloat(fMonthly),
      interestRate: fInterestRate ? parseFloat(fInterestRate) : undefined,
      notes: fNotes.trim() || undefined,
    }

    if (editingLoan) {
      await fetch(`/api/loans/${editingLoan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    setSaving(false)
    setShowModal(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Archive this loan?')) return
    await fetch(`/api/loans/${id}`, { method: 'DELETE' })
    await load()
  }

  async function handlePayLoan(loan: Loan) {
    setPayingLoan(loan.id)
    const d = new Date()
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await fetch(`/api/loans/${loan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payInstallment: true, date: localDate }),
    })
    await load()
    setPayingLoan(null)
  }

  // Summary calculations
  const totalOutstanding = loans.reduce((a, l) => a + l.outstandingBalance, 0)
  const monthlyBurden = loans.reduce((a, l) => a + l.monthlyInstallment, 0)

  let latestPayoffMonths = 0
  for (const l of loans) {
    const months = estimatedPayoffMonths(l.outstandingBalance, l.monthlyInstallment)
    if (months > latestPayoffMonths) latestPayoffMonths = months
  }
  const debtFreeLabel = loans.length > 0 ? payoffDate(latestPayoffMonths).label : '—'

  // Timeline: sorted by payoff months (soonest first)
  const timelineLoans = [...loans].sort((a, b) => {
    const ma = estimatedPayoffMonths(a.outstandingBalance, a.monthlyInstallment)
    const mb = estimatedPayoffMonths(b.outstandingBalance, b.monthlyInstallment)
    return ma - mb
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#0d0d0d' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>FINANCE</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Loans</span>
          </div>
          <button
            onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}
          >
            + Add Loan
          </button>
        </div>

        <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'TOTAL OUTSTANDING', value: `RM ${formatRM(totalOutstanding)}`, color: '#ef4444' },
              { label: 'MONTHLY BURDEN', value: `RM ${formatRM(monthlyBurden)}`, color: '#f97316' },
              { label: 'EST. DEBT-FREE', value: debtFreeLabel, color: '#a3e635' },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Loan list */}
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', ...S.label }}>LOADING…</div>
          ) : loans.length === 0 ? (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#181818', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#3a3a3a' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2"/>
                    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                    <line x1="12" y1="12" x2="12" y2="16"/>
                    <line x1="10" y1="14" x2="14" y2="14"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#d0d0cf', ...S.sans, marginBottom: 8 }}>No loans recorded</div>
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, lineHeight: 1.6, marginBottom: 24 }}>
                  Track your car loan, mortgage, personal financing or PTPTN. We&apos;ll calculate your payoff timeline and show debt as part of your net worth.
                </div>
                <button
                  onClick={openAdd}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, ...S.sans, cursor: 'pointer' }}
                >
                  + Add loan
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {loans.map(loan => {
                const meta = loanTypeMeta(loan.type)
                const paidPct = loan.originalAmount > 0
                  ? Math.min((loan.originalAmount - loan.outstandingBalance) / loan.originalAmount, 1)
                  : 0
                const payoffMonths = estimatedPayoffMonths(loan.outstandingBalance, loan.monthlyInstallment)
                const payoffInfo = payoffDate(payoffMonths)

                return (
                  <div key={loan.id} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* Type badge */}
                          <span style={{
                            fontSize: 9,
                            fontFamily: '"JetBrains Mono", monospace',
                            letterSpacing: '0.08em',
                            color: meta.color,
                            background: `${meta.color}18`,
                            border: `1px solid ${meta.color}40`,
                            borderRadius: 4,
                            padding: '2px 6px',
                          }}>
                            {meta.label}
                          </span>
                          {loan.interestRate != null && (
                            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
                              {loan.interestRate}% p.a.
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f4', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {loan.name}
                        </span>
                        {loan.lender && (
                          <span style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>
                            {loan.lender}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => openEdit(loan)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#a3e635' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#3a3a3a' }}
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(loan.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#3a3a3a' }}
                          title="Archive"
                        >
                          <Icon name="close" width={14} height={14} />
                        </button>
                      </div>
                    </div>

                    {/* Outstanding balance */}
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.03em', lineHeight: 1 }}>
                        RM {formatRM(loan.outstandingBalance)}
                      </div>
                      <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 3 }}>
                        of RM {formatRM(loan.originalAmount)} original
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={S.label}>{Math.round(paidPct * 100)}% PAID OFF</span>
                        <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
                          RM {formatRM(loan.originalAmount - loan.outstandingBalance)} PAID
                        </span>
                      </div>
                      <div style={{ height: 5, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(paidPct * 100, 100)}%`,
                          background: meta.color,
                          borderRadius: 3,
                          transition: 'width 400ms ease',
                        }} />
                      </div>
                    </div>

                    {/* Footer row */}
                    {(() => {
                      const now = new Date()
                      const paidThisMonth = loan.lastPaidAt
                        ? (() => {
                            const p = new Date(loan.lastPaidAt)
                            return p.getFullYear() === now.getFullYear() && p.getMonth() === now.getMonth()
                          })()
                        : false
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #1a1a1a', paddingTop: 12 }}>
                            <div>
                              <div style={{ ...S.label, marginBottom: 3 }}>MONTHLY</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>
                                RM {formatRM(loan.monthlyInstallment)}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ ...S.label, marginBottom: 3 }}>EST. PAYOFF</div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: timelineColor(payoffMonths), ...S.sans }}>
                                {payoffInfo.label}
                              </div>
                              <div style={{ fontSize: 10, color: '#5b5b59', ...S.mono, marginTop: 1 }}>
                                {payoffMonths} mo left
                              </div>
                            </div>
                          </div>

                          {/* Pay installment row */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <div>
                              {loan.lastPaidAt && (
                                <div style={{ fontSize: 10, color: '#5b5b59', ...S.mono, letterSpacing: '0.04em' }}>
                                  LAST PAID {new Date(loan.lastPaidAt).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {paidThisMonth ? (
                              <button disabled style={{ background: 'rgba(163,230,53,0.08)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.25)', borderRadius: 8, padding: '7px 14px', cursor: 'default', fontSize: 12, fontWeight: 600, ...S.sans }}>
                                Paid this month
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePayLoan(loan)}
                                disabled={payingLoan === loan.id}
                                style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: payingLoan === loan.id ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, ...S.sans, opacity: payingLoan === loan.id ? 0.6 : 1 }}
                              >
                                {payingLoan === loan.id ? 'Paying…' : `Pay RM ${formatRM(loan.monthlyInstallment)}`}
                              </button>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}

          {/* Payoff Timeline */}
          {loans.length > 0 && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <span style={S.label}>DEBT PAYOFF TIMELINE</span>
              </div>
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
                {timelineLoans.map((loan, i) => {
                  const payoffMonths = estimatedPayoffMonths(loan.outstandingBalance, loan.monthlyInstallment)
                  const payoffInfo = payoffDate(payoffMonths)
                  const paidPct = loan.originalAmount > 0
                    ? Math.min((loan.originalAmount - loan.outstandingBalance) / loan.originalAmount, 1)
                    : 0
                  const color = timelineColor(payoffMonths)
                  const meta = loanTypeMeta(loan.type)

                  return (
                    <div
                      key={loan.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '180px 1fr 110px',
                        gap: 16,
                        padding: '14px 20px',
                        borderBottom: i < timelineLoans.length - 1 ? '1px solid #141414' : 'none',
                        alignItems: 'center',
                      }}
                    >
                      {/* Loan name */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#f5f5f4', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {loan.name}
                          </span>
                        </div>
                        {loan.lender && (
                          <span style={{ fontSize: 10, color: '#5b5b59', ...S.sans, paddingLeft: 14 }}>{loan.lender}</span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div>
                        <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(paidPct * 100, 100)}%`,
                            background: color,
                            borderRadius: 3,
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59' }}>
                            {Math.round(paidPct * 100)}%
                          </span>
                          <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59' }}>
                            RM {formatRM(loan.outstandingBalance)} left
                          </span>
                        </div>
                      </div>

                      {/* Payoff month */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color, ...S.sans }}>{payoffInfo.label}</div>
                        <div style={{ fontSize: 9, color: '#5b5b59', ...S.mono, marginTop: 1 }}>{payoffMonths} MO</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* What-If Calculator */}
          {loans.length > 0 && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ ...S.label, marginBottom: 14 }}>LOAN WHAT-IF CALCULATOR</div>
              <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, margin: '0 0 16px', lineHeight: 1.5 }}>
                See how an extra monthly payment shortens your loan and reduces interest paid.
              </p>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <label style={labelStyle}>LOAN</label>
                  <select
                    value={whatIfLoan?.id ?? ''}
                    onChange={e => setWhatIfLoan(loans.find(l => l.id === e.target.value) ?? null)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Select a loan…</option>
                    {loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div style={{ width: 160 }}>
                  <label style={labelStyle}>EXTRA MONTHLY (RM)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={extraPayment}
                    onChange={e => setExtraPayment(e.target.value)}
                    placeholder="e.g. 200"
                    style={inputStyle}
                  />
                </div>
              </div>
              {(() => {
                if (!whatIfLoan) return null
                const extra = parseFloat(extraPayment) || 0
                const rate = whatIfLoan.interestRate ?? 0
                const result = whatIfCalc(whatIfLoan.outstandingBalance, whatIfLoan.monthlyInstallment, rate, extra)
                if (!result) return null
                const basePay = payoffDate(result.baseMonths)
                const withPay = payoffDate(result.withMonths)
                const color = result.savedMonths > 0 ? '#a3e635' : '#7a7a78'
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {[
                      { label: 'CURRENT PAYOFF', value: `${basePay.label}`, sub: `${result.baseMonths} months` },
                      { label: extra > 0 ? `WITH +RM ${formatRM(extra, 0)}/MO` : 'PAYOFF WITH EXTRA', value: extra > 0 ? withPay.label : '—', sub: extra > 0 ? `${result.withMonths} months` : 'Enter an amount above', color: extra > 0 ? color : undefined },
                      { label: 'MONTHS SAVED', value: extra > 0 ? String(result.savedMonths) : '—', sub: extra > 0 && result.savedMonths > 0 ? `${Math.floor(result.savedMonths / 12)}y ${result.savedMonths % 12}m earlier` : '', color: extra > 0 ? color : undefined },
                      { label: 'INTEREST SAVED', value: extra > 0 && rate > 0 ? `RM ${formatRM(result.savedInterest)}` : '—', sub: rate > 0 ? '' : 'add interest rate to loan', color: extra > 0 && rate > 0 ? color : undefined },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color ?? '#f5f5f4', ...S.sans }}>{s.value}</div>
                        {s.sub && <div style={{ fontSize: 11, color: '#5b5b59', ...S.mono, marginTop: 3 }}>{s.sub}</div>}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* Add / Edit Modal */}
        {showModal && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
          >
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 480, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>
                  {editingLoan ? 'Edit Loan' : 'Add Loan'}
                </span>
                <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Name */}
                <div>
                  <label style={labelStyle}>LOAN NAME</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} placeholder="e.g. My Car Loan" style={inputStyle} required />
                </div>

                {/* Type selector */}
                <div>
                  <label style={labelStyle}>TYPE</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {LOAN_TYPES.map(t => (
                      <button
                        key={t.v}
                        type="button"
                        onClick={() => setFType(t.v)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 20,
                          border: `1px solid ${fType === t.v ? t.color : '#222'}`,
                          background: fType === t.v ? `${t.color}18` : 'transparent',
                          color: fType === t.v ? t.color : '#5b5b59',
                          fontSize: 11,
                          fontFamily: '"JetBrains Mono", monospace',
                          letterSpacing: '0.06em',
                          cursor: 'pointer',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lender */}
                <div>
                  <label style={labelStyle}>LENDER (OPTIONAL)</label>
                  <input value={fLender} onChange={e => setFLender(e.target.value)} placeholder="e.g. Maybank, CIMB" style={inputStyle} />
                </div>

                {/* Amounts row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>ORIGINAL AMOUNT (RM)</label>
                    <input type="number" value={fOriginalAmount} onChange={e => setFOriginalAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, color: editingLoan ? '#a3e635' : '#5b5b59' }}>
                      {editingLoan ? 'OUTSTANDING BALANCE (RM) ★' : 'OUTSTANDING BALANCE (RM)'}
                    </label>
                    <input
                      type="number"
                      value={fOutstanding}
                      onChange={e => setFOutstanding(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      style={{ ...inputStyle, ...(editingLoan ? { border: '1px solid rgba(163,230,53,0.4)' } : {}) }}
                      required
                    />
                  </div>
                </div>

                {/* Monthly + interest */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>MONTHLY INSTALLMENT (RM)</label>
                    <input type="number" value={fMonthly} onChange={e => setFMonthly(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>INTEREST RATE % (OPTIONAL)</label>
                    <input type="number" value={fInterestRate} onChange={e => setFInterestRate(e.target.value)} placeholder="e.g. 3.5" min="0" step="0.01" style={inputStyle} />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={labelStyle}>NOTES (OPTIONAL)</label>
                  <input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Any additional notes" style={inputStyle} />
                </div>

                {/* Submit */}
                {editingLoan ? (
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      type="submit"
                      disabled={saving}
                      style={{ flex: 1, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 700, ...S.sans, opacity: saving ? 0.7 : 1 }}
                    >
                      {saving ? 'Saving…' : 'Update Balance'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      style={{ background: 'transparent', border: '1px solid #222', borderRadius: 9, padding: '12px 20px', cursor: 'pointer', color: '#7a7a78', fontSize: 13, ...S.sans }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: saving ? 0.7 : 1, marginTop: 4 }}
                  >
                    {saving ? 'Adding…' : 'Add Loan'}
                  </button>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
