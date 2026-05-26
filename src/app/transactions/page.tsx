'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SidebarClient from '@/components/finance/SidebarClient'
import AddTransactionModal from '@/components/finance/AddTransactionModal'
import EditTransactionModal from '@/components/finance/EditTransactionModal'
import { Icon } from '@/components/finance/icons'

interface Transaction {
  id: string
  amount: number
  date: string
  type: string
  merchant: string | null
  note: string | null
  categoryId: string | null
  isRecurring: boolean
}

interface Category {
  id: string
  name: string
  type: string
}

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
function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

function TransactionsContent() {
  const router = useRouter()
  const sp = useSearchParams()
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const month = sp.get('m') ?? defaultMonth

  const [txs, setTxs] = useState<Transaction[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'all' | 'expense' | 'income'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [txRes, catRes] = await Promise.all([
      fetch(`/api/transactions?m=${month}`),
      fetch('/api/categories'),
    ])
    setTxs(await txRes.json())
    setCats(await catRes.json())
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  const catMap = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats])

  const filtered = useMemo(() => txs.filter(tx => {
    if (tab !== 'all' && tx.type !== tab) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (tx.merchant ?? tx.note ?? '').toLowerCase()
      const cat = tx.categoryId ? (catMap.get(tx.categoryId)?.name ?? '').toLowerCase() : ''
      if (!name.includes(q) && !cat.includes(q)) return false
    }
    return true
  }), [txs, tab, search, catMap])

  const totalExpense = useMemo(() => txs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0), [txs])
  const totalIncome = useMemo(() => txs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0), [txs])

  async function deleteTx(id: string) {
    setDeleting(id)
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    setTxs(prev => prev.filter(t => t.id !== id))
    setDeleting(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={S.label}>TRANSACTIONS / {fmtMonth(month)}</span>
          <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>History</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #1f1f1f', borderRadius: 10, padding: '3px 4px' }}>
            <button onClick={() => router.push(`/transactions?m=${prevMonth(month)}`)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7a7a78', display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 7 }}>
              <Icon name="chevL" width={14} height={14} />
            </button>
            <span style={{ fontSize: 11, ...S.mono, color: '#d0d0cf', letterSpacing: '0.06em', padding: '0 4px' }}>{fmtMonth(month)}</span>
            <button onClick={() => router.push(`/transactions?m=${nextMonth(month)}`)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7a7a78', display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 7 }}>
              <Icon name="chevR" width={14} height={14} />
            </button>
          </div>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}>
            + Add
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'EXPENSES', value: totalExpense, color: '#f87171' },
            { label: 'INCOME', value: totalIncome, color: '#a3e635' },
            { label: 'NET', value: totalIncome - totalExpense, color: totalIncome - totalExpense >= 0 ? '#a3e635' : '#f87171' },
          ].map(s => (
            <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em' }}>
                RM {Math.abs(s.value).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          ))}
        </div>

        {/* Search + filter tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Icon name="search" width={14} height={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#5b5b59' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search merchant or category…"
              style={{ width: '100%', background: '#111', border: '1px solid #1f1f1f', borderRadius: 8, padding: '8px 12px 8px 34px', fontSize: 13, color: '#f5f5f4', ...S.sans, outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: 3 }}>
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, ...S.sans, background: tab === t ? '#1f1f1f' : 'transparent', color: tab === t ? '#f5f5f4' : '#5b5b59', transition: 'all 140ms' }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {!loading && txs.length === 0 ? (
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#181818', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#3a3a3a' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#d0d0cf', fontFamily: '"Geist", -apple-system, sans-serif', marginBottom: 8 }}>No transactions yet</div>
              <div style={{ fontSize: 13, color: '#5b5b59', fontFamily: '"Geist", -apple-system, sans-serif', lineHeight: 1.6, marginBottom: 24 }}>
                Start by importing a bank statement PDF or add transactions manually. Transactions power your spending trends, category budgets and AI insights.
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Link
                  href="/import"
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, fontFamily: '"Geist", -apple-system, sans-serif', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }}
                >
                  Import PDF
                </Link>
                <button
                  onClick={() => setShowModal(true)}
                  style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 600, fontFamily: '"Geist", -apple-system, sans-serif', color: '#7a7a78', cursor: 'pointer' }}
                >
                  + Add manually
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 120px 36px 36px', gap: 12, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                {['DATE', 'MERCHANT', 'CATEGORY', 'AMOUNT', '', ''].map((h, i) => (
                  <span key={i} style={S.label}>{h}</span>
                ))}
              </div>

              {loading ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', ...S.label }}>LOADING…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', ...S.label }}>NO TRANSACTIONS</div>
              ) : (
                filtered.map((tx, i) => {
                  const cat = tx.categoryId ? catMap.get(tx.categoryId) : undefined
                  const effectiveMerchant = tx.merchant && tx.merchant !== 'Unknown' ? tx.merchant : null
                  const label = effectiveMerchant ?? tx.note ?? '—'
                  return (
                    <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 140px 120px 36px 36px', gap: 12, padding: '13px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #141414' : 'none', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#7a7a78', ...S.mono }}>{fmtDate(tx.date)}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: '#f5f5f4', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                        {tx.isRecurring && <span style={{ fontSize: 9, color: '#a3e635', ...S.mono, letterSpacing: '0.06em' }}>RECURRING</span>}
                      </div>
                      <span style={{ fontSize: 12, color: '#5b5b59', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat?.name ?? '—'}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tx.type === 'income' ? '#a3e635' : '#f5f5f4', ...S.sans, textAlign: 'right' }}>
                        {tx.type === 'income' ? '+' : '−'} RM {tx.amount.toFixed(2)}
                      </span>
                      <button
                        onClick={() => setEditTx(tx)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 4, transition: 'color 140ms' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#a3e635' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                        title="Edit"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        onClick={() => deleteTx(tx.id)}
                        disabled={deleting === tx.id}
                        style={{ background: 'transparent', border: 'none', cursor: deleting === tx.id ? 'default' : 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 4, transition: 'color 140ms' }}
                        onMouseEnter={e => { if (deleting !== tx.id) e.currentTarget.style.color = '#ef4444' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                        title="Delete"
                      >
                        <Icon name="close" width={14} height={14} />
                      </button>
                    </div>
                  )
                })
              )}
            </div>
            {!loading && filtered.length > 0 && (
              <div style={{ ...S.label, textAlign: 'right' }}>{filtered.length} TRANSACTION{filtered.length !== 1 ? 'S' : ''}</div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load() }}
        />
      )}
      {editTx && (
        <EditTransactionModal
          tx={editTx}
          categories={cats}
          onClose={() => setEditTx(null)}
          onSaved={() => { setEditTx(null); load() }}
        />
      )}
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <Suspense fallback={<div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' }}>LOADING…</div>}>
        <TransactionsContent />
      </Suspense>
    </div>
  )
}
