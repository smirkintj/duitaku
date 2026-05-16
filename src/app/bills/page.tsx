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
  paid?: boolean
}

interface BnplPlan {
  id: string
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
  const [loading, setLoading] = useState(true)
  const [bnplLoading, setBnplLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [payingBnpl, setPayingBnpl] = useState<string | null>(null)

  // Modal states
  const [showAddBill, setShowAddBill] = useState(false)
  const [showAddBnpl, setShowAddBnpl] = useState(false)

  // Add bill form
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [billDueDay, setBillDueDay] = useState('1')
  const [billIcon, setBillIcon] = useState<string>('bolt')
  const [billSaving, setBillSaving] = useState(false)

  // Add BNPL form
  const [bnplMerchant, setBnplMerchant] = useState('')
  const [bnplProvider, setBnplProvider] = useState('shopee')
  const [bnplTotal, setBnplTotal] = useState('')
  const [bnplInstallment, setBnplInstallment] = useState('')
  const [bnplCount, setBnplCount] = useState('')
  const [bnplStart, setBnplStart] = useState(defaultMonth)
  const [bnplNotes, setBnplNotes] = useState('')
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

  useEffect(() => { loadBills() }, [loadBills])
  useEffect(() => { loadBnpl() }, [loadBnpl])

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
      body: JSON.stringify({ name: billName.trim(), amount: parseFloat(billAmount), dueDay: parseInt(billDueDay), icon: billIcon }),
    })
    setBillName(''); setBillAmount(''); setBillDueDay('1'); setBillIcon('bolt')
    setShowAddBill(false)
    setBillSaving(false)
    await loadBills()
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
      }),
    })
    setBnplMerchant(''); setBnplProvider('shopee'); setBnplTotal(''); setBnplInstallment('')
    setBnplCount(''); setBnplStart(defaultMonth); setBnplNotes('')
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

        <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'TOTAL BILLS', value: `${bills.length}`, sub: null },
              { label: 'PAID', value: `${paid.length} / ${bills.length}`, sub: null },
              { label: 'REMAINING', value: `RM ${unpaidTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: null },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Bills list */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Monthly Bills</span>
              <span style={{ ...S.label }}>{paid.length} OF {bills.length} PAID</span>
            </div>

            {loading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', ...S.label }}>LOADING…</div>
            ) : bills.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ ...S.label, marginBottom: 8 }}>NO BILLS YET</div>
                <button onClick={() => setShowAddBill(true)} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '8px 16px', color: '#7a7a78', cursor: 'pointer', fontSize: 12, ...S.sans }}>
                  Add your first bill
                </button>
              </div>
            ) : (
              <>
                {unpaid.map((bill, i) => (
                  <BillRow
                    key={bill.id}
                    bill={bill}
                    onToggle={() => togglePaid(bill)}
                    onDelete={() => deleteBill(bill.id)}
                    toggling={toggling === bill.id}
                    isLast={i === unpaid.length - 1 && paid.length === 0}
                  />
                ))}
                {paid.length > 0 && (
                  <>
                    <div style={{ padding: '8px 20px', background: '#0d0d0d', borderTop: '1px solid #141414', borderBottom: '1px solid #141414' }}>
                      <span style={{ ...S.label }}>PAID</span>
                    </div>
                    {paid.map((bill, i) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        onToggle={() => togglePaid(bill)}
                        onDelete={() => deleteBill(bill.id)}
                        toggling={toggling === bill.id}
                        isLast={i === paid.length - 1}
                        faded
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* BNPL section */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={S.label}>BUY NOW PAY LATER</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>BNPL Plans</span>
              </div>
              <button onClick={() => setShowAddBnpl(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid #222', borderRadius: 9, padding: '0 14px', height: 34, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: '#a3e635', ...S.sans }}>
                + Add BNPL
              </button>
            </div>

            {bnplLoading ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', ...S.label }}>LOADING…</div>
            ) : bnpl.length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ ...S.label, marginBottom: 8 }}>NO BNPL PLANS</div>
                <button onClick={() => setShowAddBnpl(true)} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '8px 16px', color: '#7a7a78', cursor: 'pointer', fontSize: 12, ...S.sans }}>
                  Add a BNPL plan
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                {bnpl.map(plan => {
                  const remaining = (plan.totalInstallments - plan.paidInstallments) * plan.installmentAmount
                  const progress = plan.paidInstallments / plan.totalInstallments
                  return (
                    <div key={plan.id} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.08em', color: providerColor(plan.provider), border: `1px solid ${providerColor(plan.provider)}40`, borderRadius: 4, padding: '2px 6px' }}>
                              {providerLabel(plan.provider)}
                            </span>
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{plan.merchant}</div>
                          {plan.notes && <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 2 }}>{plan.notes}</div>}
                        </div>
                        <button
                          onClick={() => deleteBnpl(plan.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6, flexShrink: 0 }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                        >
                          <Icon name="close" width={14} height={14} />
                        </button>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ ...S.label }}>{plan.paidInstallments}/{plan.totalInstallments} INSTALLMENTS</span>
                          <span style={{ ...S.label }}>RM {remaining.toFixed(2)} LEFT</span>
                        </div>
                        <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(progress * 100, 100)}%`, background: '#a3e635', borderRadius: 2, transition: 'width 400ms ease' }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.02em' }}>
                            RM {plan.installmentAmount.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 10, color: '#5b5b59', ...S.mono, letterSpacing: '0.06em' }}>PER INSTALLMENT</div>
                        </div>
                        {plan.paidInstallments < plan.totalInstallments ? (
                          <button
                            onClick={() => payBnpl(plan.id)}
                            disabled={payingBnpl === plan.id}
                            style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: payingBnpl === plan.id ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, ...S.sans, opacity: payingBnpl === plan.id ? 0.6 : 1 }}
                          >
                            {payingBnpl === plan.id ? 'Paying…' : `Pay RM ${plan.installmentAmount.toFixed(2)}`}
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: '#a3e635', ...S.mono, letterSpacing: '0.06em' }}>COMPLETED</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

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

function BillRow({ bill, onToggle, onDelete, toggling, isLast, faded }: {
  bill: Bill
  onToggle: () => void
  onDelete: () => void
  toggling: boolean
  isLast: boolean
  faded?: boolean
}) {
  const S = {
    label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
    sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid #141414', opacity: faded ? 0.45 : 1 }}>
      {/* Checkbox */}
      <button
        onClick={onToggle}
        disabled={toggling}
        style={{
          width: 20, height: 20,
          borderRadius: 5,
          border: bill.paid ? '1.5px solid #a3e635' : '1.5px solid #333',
          background: bill.paid ? 'rgba(163,230,53,0.15)' : 'transparent',
          cursor: toggling ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 160ms',
        }}
      >
        {bill.paid && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#a3e635" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" />
          </svg>
        )}
      </button>

      {/* Icon */}
      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5b5b59', flexShrink: 0 }}>
        <CategoryIcon name={bill.icon as Parameters<typeof CategoryIcon>[0]['name']} width={16} height={16} />
      </div>

      {/* Name + due */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, color: bill.paid ? '#5b5b59' : '#f5f5f4', ...S.sans, textDecoration: bill.paid ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bill.name}
        </div>
        <div style={{ ...S.label, marginTop: 2 }}>DUE {ordinal(bill.dueDay)}</div>
      </div>

      {/* Amount */}
      <span style={{ fontSize: 14, fontWeight: 600, color: bill.paid ? '#5b5b59' : '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', letterSpacing: '-0.01em', flexShrink: 0 }}>
        RM {bill.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>

      {/* Delete */}
      <button
        onClick={onDelete}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2a2a2a', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, flexShrink: 0 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#2a2a2a' }}
      >
        <Icon name="close" width={14} height={14} />
      </button>
    </div>
  )
}
