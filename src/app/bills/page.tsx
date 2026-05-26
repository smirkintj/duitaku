'use client'

import React, { useState, useEffect, useCallback } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon, CategoryIcon } from '@/components/finance/icons'

interface Bill {
  id: string
  name: string
  amount: number
  dueDay: number
  categoryId: string | null
  icon: string
  isActive: boolean
  paymentMethod: string
  accountId: string | null
  paid?: boolean
}

interface SnapshotData {
  salaryAmount: number
  directDebitTotal: number
  ccBillsTotal: number
  activeBnplTotal: number
  totalCcOutstanding: number
  directDebitBills: { id: string; name: string; amount: number }[]
  ccBills: { id: string; name: string; amount: number; accountId: string | null }[]
  bnplItems: { id: string; merchant: string; provider: string; installmentAmount: number; remainingInstallments: number; remainingTotal: number; activeThisMonth: boolean; clearMonth: string }[]
  ccAccounts: { id: string; name: string; lastFour: string | null; outstanding: number; creditLimit: number | null; utilisationPct: number | null }[]
}

interface BnplPlan {
  id: string
  accountId: string | null
  merchant: string
  provider: string
  totalAmount: number
  installmentAmount: number
  totalInstallments: number
  paidInstallments: number
  startMonth: string
  notes: string | null
  isActive: boolean
}

interface CcAccount {
  id: string
  name: string
  lastFour: string | null
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const CATEGORY_ICONS = ['bag', 'bowl', 'bolt', 'leaf', 'plane', 'car', 'play', 'pulse', 'film'] as const

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  let pm = mo - 1, py = y
  if (pm < 1) { pm = 12; py-- }
  return `${py}-${String(pm).padStart(2, '0')}`
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  let nm = mo + 1, ny = y
  if (nm > 12) { nm = 1; ny++ }
  return `${ny}-${String(nm).padStart(2, '0')}`
}
function fmtMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase()
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const PAYMENT_METHODS = [
  { v: 'direct_debit', label: 'Direct Debit',   badge: 'DD',     color: '#7a7a78' },
  { v: 'credit_card',  label: 'Credit Card',     badge: 'CC',     color: '#60a5fa' },
  { v: 'ewallet',      label: 'eWallet (TNG…)',  badge: 'TNG',    color: '#a78bfa' },
  { v: 'telco',        label: 'Telco Billing',   badge: 'TELCO',  color: '#34d399' },
] as const

type PaymentMethod = typeof PAYMENT_METHODS[number]['v']

function pmMeta(v: string) {
  return PAYMENT_METHODS.find(m => m.v === v) ?? PAYMENT_METHODS[0]
}

function providerLabel(p: string) {
  if (p === 'shopee') return 'SHOPEE PAY LATER'
  if (p === 'tiktok') return 'TIKTOK PAY LATER'
  return 'OTHER'
}

function providerColor(p: string) {
  if (p === 'shopee') return '#f97316'
  if (p === 'tiktok') return '#60a5fa'
  return '#a78bfa'
}

export default function BillsPage() {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)

  const [bills, setBills] = useState<Bill[]>([])
  const [bnpl, setBnpl] = useState<BnplPlan[]>([])
  const [accounts, setAccounts] = useState<CcAccount[]>([])
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null)
  const [targetCcPayment, setTargetCcPayment] = useState('')
  const [loading, setLoading] = useState(true)
  const [bnplLoading, setBnplLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [payingBnpl, setPayingBnpl] = useState<string | null>(null)

  // Modal states
  const [showAddBill, setShowAddBill] = useState(false)
  const [showAddBnpl, setShowAddBnpl] = useState(false)
  const [editingBnpl, setEditingBnpl] = useState<BnplPlan | null>(null)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)

  // Add bill form
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [billDueDay, setBillDueDay] = useState('1')
  const [billIcon, setBillIcon] = useState<string>('bolt')
  const [billPaymentMethod, setBillPaymentMethod] = useState('direct_debit')
  const [billAccountId, setBillAccountId] = useState('')
  const [billSaving, setBillSaving] = useState(false)

  // Add BNPL form
  const [bnplMerchant, setBnplMerchant] = useState('')
  const [bnplProvider, setBnplProvider] = useState('shopee')
  const [bnplTotal, setBnplTotal] = useState('')
  const [bnplInstallment, setBnplInstallment] = useState('')
  const [bnplCount, setBnplCount] = useState('')
  const [bnplStart, setBnplStart] = useState(defaultMonth)
  const [bnplNotes, setBnplNotes] = useState('')
  const [bnplAccountId, setBnplAccountId] = useState('')
  const [bnplSaving, setBnplSaving] = useState(false)

  const loadBills = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/bills?m=${month}`)
    setBills(await res.json())
    setLoading(false)
  }, [month])

  const loadBnpl = useCallback(async () => {
    setBnplLoading(true)
    const res = await fetch('/api/bnpl')
    setBnpl(await res.json())
    setBnplLoading(false)
  }, [])

  const loadAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts')
    const data = await res.json()
    setAccounts((data as { type: string; id: string; name: string; lastFour: string | null }[]).filter(a => a.type === 'credit'))
  }, [])

  const loadSnapshot = useCallback(async () => {
    const res = await fetch('/api/debt-snapshot')
    setSnapshot(await res.json())
  }, [])

  useEffect(() => { loadBills() }, [loadBills])
  useEffect(() => { loadBnpl() }, [loadBnpl])
  useEffect(() => { loadAccounts() }, [loadAccounts])
  useEffect(() => { loadSnapshot() }, [loadSnapshot])

  async function togglePaid(bill: Bill) {
    setToggling(bill.id)
    await fetch(`/api/bills/${bill.id}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bill.paid ? { month, unpay: true } : { month }),
    })
    await loadBills()
    setToggling(null)
  }

  async function deleteBill(id: string) {
    if (!confirm('Delete this bill?')) return
    await fetch(`/api/bills/${id}`, { method: 'DELETE' })
    await loadBills()
  }

  async function addBill(e: React.FormEvent) {
    e.preventDefault()
    if (!billName.trim() || !billAmount) return
    setBillSaving(true)
    await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: billName.trim(), amount: parseFloat(billAmount), dueDay: parseInt(billDueDay), icon: billIcon, paymentMethod: billPaymentMethod, accountId: billAccountId || undefined }),
    })
    setBillName(''); setBillAmount(''); setBillDueDay('1'); setBillIcon('bolt'); setBillPaymentMethod('direct_debit'); setBillAccountId('')
    setShowAddBill(false)
    setBillSaving(false)
    await Promise.all([loadBills(), loadSnapshot()])
  }

  async function saveBillEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBill) return
    await fetch(`/api/bills/${editingBill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingBill.name,
        amount: editingBill.amount,
        dueDay: editingBill.dueDay,
        icon: editingBill.icon,
        paymentMethod: editingBill.paymentMethod,
        accountId: editingBill.accountId,
      }),
    })
    setEditingBill(null)
    await Promise.all([loadBills(), loadSnapshot()])
  }

  async function saveBnplEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBnpl) return
    await fetch(`/api/bnpl/${editingBnpl.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: editingBnpl.merchant,
        provider: editingBnpl.provider,
        totalAmount: editingBnpl.totalAmount,
        installmentAmount: editingBnpl.installmentAmount,
        totalInstallments: editingBnpl.totalInstallments,
        startMonth: editingBnpl.startMonth,
        notes: editingBnpl.notes ?? null,
      }),
    })
    setEditingBnpl(null)
    await loadBnpl()
  }

  async function payBnpl(id: string) {
    setPayingBnpl(id)
    await fetch(`/api/bnpl/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payInstallment: true }),
    })
    await loadBnpl()
    setPayingBnpl(null)
  }

  async function deleteBnpl(id: string) {
    if (!confirm('Delete this BNPL plan?')) return
    await fetch(`/api/bnpl/${id}`, { method: 'DELETE' })
    await loadBnpl()
  }

  async function addBnpl(e: React.FormEvent) {
    e.preventDefault()
    if (!bnplMerchant.trim() || !bnplTotal || !bnplInstallment || !bnplCount) return
    setBnplSaving(true)
    await fetch('/api/bnpl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: bnplMerchant.trim(),
        provider: bnplProvider,
        totalAmount: parseFloat(bnplTotal),
        installmentAmount: parseFloat(bnplInstallment),
        totalInstallments: parseInt(bnplCount),
        startMonth: bnplStart,
        notes: bnplNotes.trim() || undefined,
        accountId: bnplAccountId || undefined,
      }),
    })
    setBnplMerchant(''); setBnplProvider('shopee'); setBnplTotal(''); setBnplInstallment('')
    setBnplCount(''); setBnplStart(defaultMonth); setBnplNotes(''); setBnplAccountId('')
    setShowAddBnpl(false)
    setBnplSaving(false)
    await loadBnpl()
  }

  const unpaid = bills.filter(b => !b.paid)
  const paid = bills.filter(b => b.paid)
  const unpaidTotal = unpaid.reduce((a, b) => a + b.amount, 0)

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: '#f5f5f4',
    ...S.sans,
    outline: 'none',
    boxSizing: 'border-box',
    colorScheme: 'dark',
  }

  const labelStyle: React.CSSProperties = {
    ...S.label,
    marginBottom: 5,
    display: 'block',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#0d0d0d' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>BILLS / {fmtMonth(month)}</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Bills & BNPL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #1f1f1f', borderRadius: 10, padding: '3px 4px' }}>
              <button onClick={() => setMonth(prevMonth(month))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7a7a78', display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 7 }}>
                <Icon name="chevL" width={14} height={14} />
              </button>
              <span style={{ fontSize: 11, ...S.mono, color: '#d0d0cf', letterSpacing: '0.06em', padding: '0 4px' }}>{fmtMonth(month)}</span>
              <button onClick={() => setMonth(nextMonth(month))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7a7a78', display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 7 }}>
                <Icon name="chevR" width={14} height={14} />
              </button>
            </div>
            <button onClick={() => setShowAddBill(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}>
              + Bill
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 32px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'TOTAL BILLS', value: `${bills.length}` },
              { label: 'PAID', value: `${paid.length} / ${bills.length}` },
              { label: 'REMAINING', value: `RM ${unpaidTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '12px 18px' }}>
                <div style={{ ...S.label, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Debt Snapshot */}
          {snapshot && <DebtSnapshot snapshot={snapshot} targetCcPayment={targetCcPayment} setTargetCcPayment={setTargetCcPayment} />}

          {/* Bills list */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Monthly Bills</span>
              <span style={{ ...S.label }}>{paid.length} OF {bills.length} PAID</span>
            </div>

            {loading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', ...S.label }}>LOADING…</div>
            ) : bills.length === 0 ? (
              <div style={{ padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#181818', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#3a3a3a' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="18" height="14" rx="2"/>
                      <path d="M3 10h18"/>
                      <path d="M8 15h.01M12 15h4"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#d0d0cf', ...S.sans, marginBottom: 8 }}>No bills set up yet</div>
                  <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, lineHeight: 1.6, marginBottom: 24 }}>
                    Bills tracks your fixed monthly payments — rent, subscriptions, utilities. Once added, they appear on your Cash Flow calendar and the AI Coach factors them into your budget.
                  </div>
                  <button
                    onClick={() => setShowAddBill(true)}
                    style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, ...S.sans, cursor: 'pointer' }}
                  >
                    + Add your first bill
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                  {unpaid.map((bill, i) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      onToggle={() => togglePaid(bill)}
                      onEdit={() => setEditingBill({ ...bill })}
                      onDelete={() => deleteBill(bill.id)}
                      toggling={toggling === bill.id}
                      col={i % 2 === 0 ? 'left' : 'right'}
                    />
                  ))}
                </div>
                {paid.length > 0 && (
                  <>
                    <div style={{ padding: '6px 16px', background: '#0d0d0d', borderTop: '1px solid #141414', borderBottom: '1px solid #141414', gridColumn: '1/-1' }}>
                      <span style={{ ...S.label }}>PAID</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      {paid.map((bill, i) => (
                        <BillRow
                          key={bill.id}
                          bill={bill}
                          onToggle={() => togglePaid(bill)}
                          onEdit={() => setEditingBill({ ...bill })}
                          onDelete={() => deleteBill(bill.id)}
                          toggling={toggling === bill.id}
                          col={i % 2 === 0 ? 'left' : 'right'}
                          faded
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* BNPL section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <span style={{ ...S.label, display: 'block', marginBottom: 2 }}>BUY NOW PAY LATER</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>BNPL Plans</span>
              </div>
              <button onClick={() => setShowAddBnpl(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #222', borderRadius: 9, padding: '0 14px', height: 34, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: '#a3e635', ...S.sans }}>
                + Add BNPL
              </button>
            </div>

            {bnplLoading ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', ...S.label }}>LOADING…</div>
            ) : bnpl.length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: '#181818', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#3a3a3a' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#d0d0cf', ...S.sans, marginBottom: 8 }}>No BNPL plans</div>
                  <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, lineHeight: 1.6, marginBottom: 24 }}>
                    Track buy-now-pay-later installments from Shopee, Grab, or any provider. We&apos;ll show you the total monthly commitment and flag when plans overlap.
                  </div>
                  <button
                    onClick={() => setShowAddBnpl(true)}
                    style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, ...S.sans, cursor: 'pointer' }}
                  >
                    + Add BNPL plan
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {bnpl.map(plan => {
                  const isCompleted = plan.paidInstallments >= plan.totalInstallments
                  const remaining = (plan.totalInstallments - plan.paidInstallments) * plan.installmentAmount
                  const progress = plan.paidInstallments / plan.totalInstallments
                  const now = new Date()
                  const curIdx = now.getFullYear() * 12 + (now.getMonth() + 1)
                  const [sy, sm] = plan.startMonth.split('-').map(Number)
                  const startIdx = sy * 12 + sm
                  const endIdx = startIdx + plan.totalInstallments - 1
                  const activeThisMonth = !isCompleted && curIdx >= startIdx && curIdx <= endIdx
                  const notStartedYet = !isCompleted && curIdx < startIdx
                  // Has the current month's installment already been logged?
                  const installmentsDueNow = Math.max(0, Math.min(curIdx - startIdx + 1, plan.totalInstallments))
                  const thisMonthPaid = activeThisMonth && plan.paidInstallments >= installmentsDueNow
                  const linkedAccount = plan.accountId ? accounts.find(a => a.id === plan.accountId) : null

                  const cardBorder = isCompleted ? '#1a2a1a' : notStartedYet ? '#1f2a1a' : '#1a1a1a'

                  return (
                    <div key={plan.id} style={{ background: '#111', border: `1px solid ${cardBorder}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, opacity: isCompleted ? 0.72 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: providerColor(plan.provider), border: `1px solid ${providerColor(plan.provider)}40`, borderRadius: 4, padding: '2px 6px' }}>
                              {providerLabel(plan.provider)}
                            </span>
                            {isCompleted && (
                              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)', borderRadius: 4, padding: '2px 6px' }}>
                                FULLY PAID
                              </span>
                            )}
                            {thisMonthPaid && (
                              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)', borderRadius: 4, padding: '2px 6px' }}>
                                PAID THIS MONTH
                              </span>
                            )}
                            {notStartedYet && (
                              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)', borderRadius: 4, padding: '2px 6px' }}>
                                STARTS {fmtMonth(plan.startMonth)}
                              </span>
                            )}
                            {!isCompleted && !notStartedYet && (
                              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
                                FROM {fmtMonth(plan.startMonth)}
                              </span>
                            )}
                            {linkedAccount && (
                              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: '#94a3b8', border: '1px solid #94a3b840', borderRadius: 4, padding: '2px 6px' }}>
                                {linkedAccount.name}{linkedAccount.lastFour ? ` ••${linkedAccount.lastFour}` : ''}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: isCompleted ? '#7a7a78' : '#f5f5f4', ...S.sans }}>{plan.merchant}</div>
                          {plan.notes && <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 2 }}>{plan.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => setEditingBnpl({ ...plan })}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#a3e635' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                          >
                            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteBnpl(plan.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6 }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                          >
                            <Icon name="close" width={14} height={14} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ ...S.label }}>{plan.paidInstallments}/{plan.totalInstallments} INSTALLMENTS</span>
                          <span style={{ ...S.label }}>{isCompleted ? 'DONE' : `RM ${remaining.toFixed(2)} LEFT`}</span>
                        </div>
                        <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(progress * 100, 100)}%`, background: isCompleted ? '#4a7a20' : '#a3e635', borderRadius: 2, transition: 'width 400ms ease' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: isCompleted ? '#3a3a3a' : notStartedYet ? '#5b5b59' : '#f5f5f4', ...S.sans, letterSpacing: '-0.02em' }}>
                            RM {plan.installmentAmount.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 10, color: '#5b5b59', ...S.mono, letterSpacing: '0.06em' }}>
                            {isCompleted ? 'ALL INSTALLMENTS PAID' : notStartedYet ? `STARTS IN ${startIdx - curIdx} MONTH${startIdx - curIdx > 1 ? 'S' : ''}` : activeThisMonth ? `INSTALLMENT ${curIdx - startIdx + 1}/${plan.totalInstallments}` : 'PER INSTALLMENT'}
                          </div>
                        </div>
                        {isCompleted ? (
                          <button disabled style={{ background: 'transparent', color: '#a3e635', border: '1px solid rgba(163,230,53,0.25)', borderRadius: 8, padding: '8px 16px', cursor: 'default', fontSize: 12, fontWeight: 600, ...S.sans }}>
                            Fully Paid
                          </button>
                        ) : thisMonthPaid ? (
                          <button disabled style={{ background: 'rgba(163,230,53,0.08)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.25)', borderRadius: 8, padding: '8px 16px', cursor: 'default', fontSize: 12, fontWeight: 600, ...S.sans }}>
                            Paid this month
                          </button>
                        ) : (
                          <button
                            onClick={() => payBnpl(plan.id)}
                            disabled={payingBnpl === plan.id}
                            style={{ background: activeThisMonth ? '#a3e635' : '#1a1a1a', color: activeThisMonth ? '#0d0d0d' : '#5b5b59', border: activeThisMonth ? 'none' : '1px solid #222', borderRadius: 8, padding: '8px 16px', cursor: payingBnpl === plan.id ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, ...S.sans, opacity: payingBnpl === plan.id ? 0.6 : 1 }}
                          >
                            {payingBnpl === plan.id ? 'Paying…' : `Pay RM ${plan.installmentAmount.toFixed(2)}`}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Edit Bill Modal */}
        {editingBill && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 440, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Edit Bill</span>
                <button onClick={() => setEditingBill(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={saveBillEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>BILL NAME</label>
                  <input value={editingBill.name} onChange={e => setEditingBill(b => b && ({ ...b, name: e.target.value }))} style={inputStyle} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>AMOUNT (RM)</label>
                    <input type="number" value={editingBill.amount} onChange={e => setEditingBill(b => b && ({ ...b, amount: parseFloat(e.target.value) }))} min="0" step="0.01" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>DUE DAY</label>
                    <input type="number" value={editingBill.dueDay} onChange={e => setEditingBill(b => b && ({ ...b, dueDay: parseInt(e.target.value) }))} min="1" max="31" style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>PAYMENT METHOD</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {PAYMENT_METHODS.map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setEditingBill(b => b && ({ ...b, paymentMethod: opt.v, accountId: opt.v !== 'credit_card' ? null : b.accountId }))}
                        style={{
                          padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, ...S.sans,
                          background: editingBill.paymentMethod === opt.v ? `${opt.color}18` : '#0d0d0d',
                          border: editingBill.paymentMethod === opt.v ? `1px solid ${opt.color}60` : '1px solid #222',
                          color: editingBill.paymentMethod === opt.v ? opt.color : '#7a7a78',
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
                {editingBill.paymentMethod === 'credit_card' && accounts.length > 0 && (
                  <div>
                    <label style={labelStyle}>CHARGED TO</label>
                    <select
                      value={editingBill.accountId ?? ''}
                      onChange={e => setEditingBill(b => b && ({ ...b, accountId: e.target.value || null }))}
                      style={inputStyle}
                    >
                      <option value="">— Select card —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}{a.lastFour ? ` (••${a.lastFour})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={labelStyle}>ICON</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CATEGORY_ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setEditingBill(b => b && ({ ...b, icon }))}
                        style={{
                          width: 36, height: 36,
                          background: editingBill.icon === icon ? 'rgba(163,230,53,0.12)' : '#0d0d0d',
                          border: editingBill.icon === icon ? '1px solid rgba(163,230,53,0.4)' : '1px solid #222',
                          borderRadius: 8, cursor: 'pointer',
                          color: editingBill.icon === icon ? '#a3e635' : '#5b5b59',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <CategoryIcon name={icon as Parameters<typeof CategoryIcon>[0]['name']} width={16} height={16} />
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, marginTop: 4 }}>
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add Bill Modal */}
        {showAddBill && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Add Bill</span>
                <button onClick={() => setShowAddBill(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={addBill} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>BILL NAME</label>
                  <input value={billName} onChange={e => setBillName(e.target.value)} placeholder="e.g. Netflix" style={inputStyle} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>AMOUNT (RM)</label>
                    <input type="number" value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>DUE DAY</label>
                    <input type="number" value={billDueDay} onChange={e => setBillDueDay(e.target.value)} min="1" max="31" style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>PAYMENT METHOD</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {PAYMENT_METHODS.map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => { setBillPaymentMethod(opt.v); if (opt.v !== 'credit_card') setBillAccountId('') }}
                        style={{
                          padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, ...S.sans,
                          background: billPaymentMethod === opt.v ? `${opt.color}18` : '#0d0d0d',
                          border: billPaymentMethod === opt.v ? `1px solid ${opt.color}60` : '1px solid #222',
                          color: billPaymentMethod === opt.v ? opt.color : '#7a7a78',
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
                {billPaymentMethod === 'credit_card' && accounts.length > 0 && (
                  <div>
                    <label style={labelStyle}>CHARGED TO</label>
                    <select value={billAccountId} onChange={e => setBillAccountId(e.target.value)} style={inputStyle}>
                      <option value="">— Select card —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}{a.lastFour ? ` (••${a.lastFour})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={labelStyle}>ICON</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CATEGORY_ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setBillIcon(icon)}
                        style={{
                          width: 36, height: 36,
                          background: billIcon === icon ? 'rgba(163,230,53,0.12)' : '#0d0d0d',
                          border: billIcon === icon ? '1px solid rgba(163,230,53,0.4)' : '1px solid #222',
                          borderRadius: 8,
                          cursor: 'pointer',
                          color: billIcon === icon ? '#a3e635' : '#5b5b59',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <CategoryIcon name={icon as Parameters<typeof CategoryIcon>[0]['name']} width={16} height={16} />
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={billSaving}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: billSaving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: billSaving ? 0.7 : 1, marginTop: 4 }}
                >
                  {billSaving ? 'Adding…' : 'Add Bill'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit BNPL Modal */}
        {editingBnpl && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 460, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Edit BNPL Plan</span>
                <button onClick={() => setEditingBnpl(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={saveBnplEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>MERCHANT</label>
                  <input value={editingBnpl.merchant} onChange={e => setEditingBnpl(p => p && ({ ...p, merchant: e.target.value }))} style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>PROVIDER</label>
                  <select value={editingBnpl.provider} onChange={e => setEditingBnpl(p => p && ({ ...p, provider: e.target.value }))} style={{ ...inputStyle }}>
                    <option value="shopee">Shopee Pay Later</option>
                    <option value="tiktok">TikTok Pay Later</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>TOTAL AMOUNT (RM)</label>
                    <input type="number" value={editingBnpl.totalAmount} onChange={e => setEditingBnpl(p => p && ({ ...p, totalAmount: parseFloat(e.target.value) }))} min="0" step="0.01" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>INSTALLMENT (RM)</label>
                    <input type="number" value={editingBnpl.installmentAmount} onChange={e => setEditingBnpl(p => p && ({ ...p, installmentAmount: parseFloat(e.target.value) }))} min="0" step="0.01" style={inputStyle} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>NO. OF INSTALLMENTS</label>
                    <input type="number" value={editingBnpl.totalInstallments} onChange={e => setEditingBnpl(p => p && ({ ...p, totalInstallments: parseInt(e.target.value) }))} min="1" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>START MONTH</label>
                    <input type="month" value={editingBnpl.startMonth} onChange={e => setEditingBnpl(p => p && ({ ...p, startMonth: e.target.value }))} style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>NOTES (OPTIONAL)</label>
                  <input value={editingBnpl.notes ?? ''} onChange={e => setEditingBnpl(p => p && ({ ...p, notes: e.target.value || null }))} placeholder="Optional notes" style={inputStyle} />
                </div>
                <button type="submit" style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, marginTop: 4 }}>
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add BNPL Modal */}
        {showAddBnpl && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 460, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Add BNPL Plan</span>
                <button onClick={() => setShowAddBnpl(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={addBnpl} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>MERCHANT</label>
                  <input value={bnplMerchant} onChange={e => setBnplMerchant(e.target.value)} placeholder="e.g. Shopee Electronics" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>PROVIDER</label>
                  <select value={bnplProvider} onChange={e => setBnplProvider(e.target.value)} style={{ ...inputStyle }}>
                    <option value="shopee">Shopee Pay Later</option>
                    <option value="tiktok">TikTok Pay Later</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {accounts.length > 0 && (
                  <div>
                    <label style={labelStyle}>CHARGED TO CC (OPTIONAL)</label>
                    <select value={bnplAccountId} onChange={e => setBnplAccountId(e.target.value)} style={{ ...inputStyle }}>
                      <option value="">— No linked card —</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name}{a.lastFour ? ` (••${a.lastFour})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>TOTAL AMOUNT (RM)</label>
                    <input type="number" value={bnplTotal} onChange={e => setBnplTotal(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>INSTALLMENT (RM)</label>
                    <input type="number" value={bnplInstallment} onChange={e => setBnplInstallment(e.target.value)} placeholder="0.00" min="0" step="0.01" style={inputStyle} required />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>NO. OF INSTALLMENTS</label>
                    <input type="number" value={bnplCount} onChange={e => setBnplCount(e.target.value)} placeholder="e.g. 3" min="1" style={inputStyle} required />
                  </div>
                  <div>
                    <label style={labelStyle}>START MONTH</label>
                    <input type="month" value={bnplStart} onChange={e => setBnplStart(e.target.value)} style={inputStyle} required />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>NOTES (OPTIONAL)</label>
                  <input value={bnplNotes} onChange={e => setBnplNotes(e.target.value)} placeholder="Optional notes" style={inputStyle} />
                </div>
                <button
                  type="submit"
                  disabled={bnplSaving}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: bnplSaving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: bnplSaving ? 0.7 : 1, marginTop: 4 }}
                >
                  {bnplSaving ? 'Adding…' : 'Add BNPL Plan'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DebtSnapshot({ snapshot, targetCcPayment, setTargetCcPayment }: {
  snapshot: SnapshotData
  targetCcPayment: string
  setTargetCcPayment: (v: string) => void
}) {
  const S = {
    label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
    mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
    sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  }

  const ccPayment = parseFloat(targetCcPayment) || 0
  const remaining = snapshot.salaryAmount - snapshot.directDebitTotal - snapshot.activeBnplTotal - ccPayment
  const remainingColor = remaining < 0 ? '#ef4444' : remaining < snapshot.salaryAmount * 0.1 ? '#f97316' : '#a3e635'

  const rm = (n: number) => `RM ${Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  function fmtMonth(m: string) {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo - 1, 1).toLocaleString('en-MY', { month: 'short', year: 'numeric' })
  }

  const rows: { label: string; amount: number; sub?: string; color?: string; indent?: boolean }[] = [
    { label: 'Monthly Salary', amount: snapshot.salaryAmount, color: '#a3e635' },
    { label: 'Direct Debit Bills', amount: -snapshot.directDebitTotal, sub: `${snapshot.directDebitBills.length} bills`, indent: true },
    { label: 'Active BNPL Installments', amount: -snapshot.activeBnplTotal, sub: `${snapshot.bnplItems.filter(p => p.activeThisMonth).length} plans`, indent: true },
    { label: 'Target CC Payment', amount: -ccPayment, sub: 'you decide', indent: true },
  ]

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Monthly Allocation</span>
        <span style={{ ...S.label }}>DEBT SNAPSHOT</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
        {/* Left: allocation breakdown */}
        <div style={{ padding: '16px 18px', borderRight: '1px solid #141414', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {rows.map((row, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid #141414' : 'none' }}>
              <span style={{ fontSize: 12, color: row.indent ? '#9a9a98' : '#f5f5f4', ...S.sans, paddingLeft: row.indent ? 10 : 0 }}>
                {row.label}
                {row.sub && <span style={{ ...S.label, marginLeft: 6 }}>{row.sub}</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: row.color ?? (row.amount < 0 ? '#f5f5f4' : '#a3e635'), fontFamily: '"Geist", sans-serif', letterSpacing: '-0.01em' }}>
                {row.amount < 0 ? `− ${rm(-row.amount)}` : rm(row.amount)}
              </span>
            </div>
          ))}

          {/* Target CC payment input */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...S.label, flexShrink: 0 }}>CC PAYMENT TARGET</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#5b5b59', ...S.mono }}>RM</span>
              <input
                type="number"
                value={targetCcPayment}
                onChange={e => setTargetCcPayment(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 6, padding: '5px 8px 5px 28px', fontSize: 12, color: '#f5f5f4', fontFamily: '"JetBrains Mono", monospace', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Result */}
          <div style={{ marginTop: 12, padding: '10px 12px', background: remaining < 0 ? 'rgba(239,68,68,0.08)' : 'rgba(163,230,53,0.06)', border: `1px solid ${remaining < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(163,230,53,0.15)'}`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#9a9a98', ...S.sans }}>Cash remaining</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: remainingColor, fontFamily: '"Geist", sans-serif', letterSpacing: '-0.02em' }}>
              {remaining < 0 ? `− ${rm(remaining)}` : rm(remaining)}
            </span>
          </div>

          {snapshot.ccBillsTotal > 0 && (
            <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 8 }}>
              <span style={{ fontSize: 11, color: '#60a5fa', ...S.sans }}>
                + {rm(snapshot.ccBillsTotal)} in CC bills are already on your card balance
              </span>
            </div>
          )}
        </div>

        {/* Right: BNPL payoff + CC debt */}
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* BNPL payoff timeline */}
          {snapshot.bnplItems.length > 0 && (
            <div>
              <div style={{ ...S.label, marginBottom: 10 }}>BNPL PAYOFF TIMELINE</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {snapshot.bnplItems.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: p.activeThisMonth ? '#f5f5f4' : '#5b5b59', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.merchant}</div>
                      <div style={{ ...S.label, marginTop: 1 }}>{p.remainingInstallments} left · clears {fmtMonth(p.clearMonth)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: p.activeThisMonth ? '#f97316' : '#5b5b59', ...S.mono }}>{rm(p.remainingTotal)}</div>
                      <div style={{ ...S.label }}>total left</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CC debt */}
          {snapshot.ccAccounts.length > 0 && (
            <div>
              <div style={{ ...S.label, marginBottom: 10 }}>CC OUTSTANDING</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {snapshot.ccAccounts.map(cc => {
                  const monthsToClear = ccPayment > 0 ? Math.ceil(cc.outstanding / ccPayment) : null
                  return (
                    <div key={cc.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: '#f5f5f4', ...S.sans }}>{cc.name}{cc.lastFour ? ` ••${cc.lastFour}` : ''}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', ...S.mono }}>{rm(cc.outstanding)}</span>
                      </div>
                      {cc.creditLimit && (
                        <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                          <div style={{ height: '100%', width: `${Math.min((cc.outstanding / cc.creditLimit) * 100, 100)}%`, background: (cc.utilisationPct ?? 0) > 80 ? '#ef4444' : (cc.utilisationPct ?? 0) > 50 ? '#f97316' : '#a3e635', borderRadius: 2 }} />
                        </div>
                      )}
                      {monthsToClear !== null && (
                        <div style={{ ...S.label }}>≈ {monthsToClear} month{monthsToClear !== 1 ? 's' : ''} to clear at {rm(ccPayment)}/mo</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {snapshot.ccAccounts.length === 0 && snapshot.bnplItems.length === 0 && (
            <div style={{ color: '#3a3a3a', fontSize: 12, ...S.sans, textAlign: 'center', paddingTop: 20 }}>No debt data yet</div>
          )}
        </div>
      </div>
    </div>
  )
}

function BillRow({ bill, onToggle, onEdit, onDelete, toggling, col, faded }: {
  bill: Bill
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  toggling: boolean
  col: 'left' | 'right'
  faded?: boolean
}) {
  const S = {
    label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
    sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid #141414', borderRight: col === 'left' ? '1px solid #141414' : 'none', opacity: faded ? 0.4 : 1 }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={toggling}
        style={{
          width: 17, height: 17, borderRadius: 4,
          border: bill.paid ? '1.5px solid #a3e635' : '1.5px solid #333',
          background: bill.paid ? 'rgba(163,230,53,0.15)' : 'transparent',
          cursor: toggling ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 160ms',
        }}
      >
        {bill.paid && (
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#a3e635" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" />
          </svg>
        )}
      </button>

      {/* Icon */}
      <div style={{ width: 26, height: 26, borderRadius: 6, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5b5b59', flexShrink: 0 }}>
        <CategoryIcon name={bill.icon as Parameters<typeof CategoryIcon>[0]['name']} width={13} height={13} />
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: bill.paid ? '#5b5b59' : '#f5f5f4', ...S.sans, textDecoration: bill.paid ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bill.name}
          </span>
          {bill.paymentMethod !== 'direct_debit' && (() => {
            const pm = pmMeta(bill.paymentMethod)
            return <span style={{ fontSize: 8, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em', color: pm.color, border: `1px solid ${pm.color}30`, borderRadius: 3, padding: '1px 4px', flexShrink: 0 }}>{pm.badge}</span>
          })()}
        </div>
        <span style={{ ...S.label }}>{ordinal(bill.dueDay)}</span>
      </div>

      {/* Amount */}
      <span style={{ fontSize: 13, fontWeight: 600, color: bill.paid ? '#5b5b59' : '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', flexShrink: 0 }}>
        RM {bill.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>

      {/* Edit */}
      <button
        onClick={onEdit}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 4, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#a3e635' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#333' }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>
      {/* Delete */}
      <button
        onClick={onDelete}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#222', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 4, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#222' }}
      >
        <Icon name="close" width={12} height={12} />
      </button>
    </div>
  )
}
