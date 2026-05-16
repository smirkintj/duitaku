'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'

interface SavingsGoal {
  id: string
  name: string
  targetAmount: number | null
  currentAmount: number
  color: string | null
  notes: string | null
  createdAt: string
}

interface Transaction {
  id: string
  amount: number
  date: string
  type: string
  merchant: string | null
  note: string | null
  categoryId: string | null
}

interface Category {
  id: string
  name: string
  type: string
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const PRESET_COLORS = ['#a3e635', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa']

function fmtDate(d: string) {
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SavingsPage() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [allTxs, setAllTxs] = useState<Transaction[]>([])
  const [cats, setCats] = useState<Category[]>([])
  const [monthlyTxs, setMonthlyTxs] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Add goal modal
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const [goalColor, setGoalColor] = useState('#a3e635')
  const [goalNotes, setGoalNotes] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)

  // Add amount inline state
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [addAmount, setAddAmount] = useState('')
  const [addingLoading, setAddingLoading] = useState(false)

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [goalsRes, txRes, catRes, monthlyRes] = await Promise.all([
      fetch('/api/savings'),
      fetch('/api/transactions'),
      fetch('/api/categories'),
      fetch(`/api/transactions?m=${currentMonth}`),
    ])
    setGoals(await goalsRes.json())
    setAllTxs(await txRes.json())
    setCats(await catRes.json())
    setMonthlyTxs(await monthlyRes.json())
    setLoading(false)
  }, [currentMonth])

  useEffect(() => { load() }, [load])

  const savingCatIds = useMemo(() => {
    return new Set(cats.filter(c => c.name.toLowerCase().includes('saving')).map(c => c.id))
  }, [cats])

  const savingTxs = useMemo(() => {
    return allTxs.filter(tx => tx.categoryId && savingCatIds.has(tx.categoryId)).slice(0, 20)
  }, [allTxs, savingCatIds])

  const monthlySavings = useMemo(() => {
    return monthlyTxs
      .filter(tx => tx.type === 'expense' && tx.categoryId && savingCatIds.has(tx.categoryId))
      .reduce((a, t) => a + t.amount, 0)
  }, [monthlyTxs, savingCatIds])

  const totalCurrent = goals.reduce((a, g) => a + g.currentAmount, 0)
  const totalTarget = goals.reduce((a, g) => a + (g.targetAmount ?? 0), 0)

  async function addGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!goalName.trim()) return
    setGoalSaving(true)
    await fetch('/api/savings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: goalName.trim(),
        targetAmount: goalTarget ? parseFloat(goalTarget) : undefined,
        color: goalColor,
        notes: goalNotes.trim() || undefined,
      }),
    })
    setGoalName(''); setGoalTarget(''); setGoalColor('#a3e635'); setGoalNotes('')
    setShowAddGoal(false)
    setGoalSaving(false)
    await load()
  }

  async function addToGoal(goal: SavingsGoal) {
    const amt = parseFloat(addAmount)
    if (!amt || isNaN(amt) || amt <= 0) return
    setAddingLoading(true)
    await fetch(`/api/savings/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentAmount: goal.currentAmount + amt }),
    })
    setAddingTo(null)
    setAddAmount('')
    setAddingLoading(false)
    await load()
  }

  async function deleteGoal(id: string) {
    if (!confirm('Delete this savings goal?')) return
    setDeleting(id)
    await fetch(`/api/savings/${id}`, { method: 'DELETE' })
    setDeleting(null)
    await load()
  }

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
            <span style={S.label}>SAVINGS GOALS</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Savings</span>
          </div>
          <button
            onClick={() => setShowAddGoal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}
          >
            + New Goal
          </button>
        </div>

        <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              {
                label: 'TOTAL SAVED',
                value: `RM ${totalCurrent.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: '#a3e635',
              },
              {
                label: 'TOTAL TARGET',
                value: totalTarget > 0 ? `RM ${totalTarget.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
                color: '#f5f5f4',
              },
              {
                label: `SAVED THIS MONTH`,
                value: `RM ${monthlySavings.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                color: '#60a5fa',
              },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Goals grid */}
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', ...S.label }}>LOADING…</div>
          ) : goals.length === 0 ? (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ ...S.label, marginBottom: 10 }}>NO SAVINGS GOALS YET</div>
              <button onClick={() => setShowAddGoal(true)} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '8px 18px', color: '#7a7a78', cursor: 'pointer', fontSize: 12, ...S.sans }}>
                Create your first goal
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {goals.map(goal => {
                const progress = goal.targetAmount ? Math.min(goal.currentAmount / goal.targetAmount, 1) : null
                const color = goal.color ?? '#a3e635'
                const isAdding = addingTo === goal.id

                return (
                  <div key={goal.id} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f4', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {goal.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => { setAddingTo(isAdding ? null : goal.id); setAddAmount('') }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#a3e635' }}
                          onMouseLeave={e => { e.currentTarget.style.color = isAdding ? '#a3e635' : '#3a3a3a' }}
                          title="Add amount"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                        <button
                          onClick={() => deleteGoal(goal.id)}
                          disabled={deleting === goal.id}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                          title="Delete"
                        >
                          <Icon name="close" width={14} height={14} />
                        </button>
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.03em', lineHeight: 1 }}>
                        RM {goal.currentAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {goal.targetAmount ? (
                        <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 3 }}>
                          of RM {goal.targetAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} target
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#3a3a3a', ...S.mono, marginTop: 3, letterSpacing: '0.06em' }}>NO TARGET</div>
                      )}
                    </div>

                    {/* Progress bar */}
                    {progress !== null ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ ...S.label }}>{Math.round(progress * 100)}% REACHED</span>
                          {progress >= 1 && <span style={{ fontSize: 9, color: '#a3e635', ...S.mono, letterSpacing: '0.06em' }}>GOAL MET!</span>}
                        </div>
                        <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(progress * 100, 100)}%`, background: color, borderRadius: 2, transition: 'width 400ms ease' }} />
                        </div>
                      </div>
                    ) : null}

                    {goal.notes && (
                      <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, borderTop: '1px solid #1a1a1a', paddingTop: 10 }}>
                        {goal.notes}
                      </div>
                    )}

                    {/* Inline add amount */}
                    {isAdding && (
                      <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 12, display: 'flex', gap: 8 }}>
                        <input
                          type="number"
                          value={addAmount}
                          onChange={e => setAddAmount(e.target.value)}
                          placeholder="Amount (RM)"
                          min="0"
                          step="0.01"
                          autoFocus
                          style={{ flex: 1, background: '#0d0d0d', border: '1px solid #222', borderRadius: 7, padding: '8px 10px', fontSize: 13, color: '#f5f5f4', ...S.sans, outline: 'none', colorScheme: 'dark' }}
                          onKeyDown={e => { if (e.key === 'Enter') addToGoal(goal) }}
                        />
                        <button
                          onClick={() => addToGoal(goal)}
                          disabled={addingLoading || !addAmount}
                          style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 7, padding: '0 14px', cursor: addingLoading ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, ...S.sans, opacity: addingLoading ? 0.7 : 1 }}
                        >
                          {addingLoading ? '…' : 'Add'}
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setAddAmount('') }}
                          style={{ background: 'transparent', border: '1px solid #222', borderRadius: 7, padding: '0 10px', cursor: 'pointer', color: '#5b5b59', fontSize: 12, ...S.sans }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Savings history */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <span style={S.label}>SAVINGS HISTORY</span>
            </div>
            {savingTxs.length === 0 ? (
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '24px 20px', textAlign: 'center' }}>
                <span style={{ ...S.label }}>NO SAVINGS TRANSACTIONS FOUND</span>
                <div style={{ fontSize: 11, color: '#3a3a3a', ...S.sans, marginTop: 6 }}>
                  Transactions in categories with &quot;saving&quot; in the name will appear here
                </div>
              </div>
            ) : (
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 120px', gap: 12, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                  {['DATE', 'DESCRIPTION', 'AMOUNT'].map((h, i) => (
                    <span key={i} style={{ ...S.label, textAlign: i === 2 ? 'right' : 'left' }}>{h}</span>
                  ))}
                </div>
                {savingTxs.map((tx, i) => (
                  <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 120px', gap: 12, padding: '13px 20px', borderBottom: i < savingTxs.length - 1 ? '1px solid #141414' : 'none', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#7a7a78', fontFamily: '"JetBrains Mono", monospace' }}>{fmtDate(tx.date)}</span>
                    <span style={{ fontSize: 13, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tx.merchant ?? tx.note ?? '—'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#a3e635', fontFamily: '"Geist", -apple-system, sans-serif', textAlign: 'right' }}>
                      RM {tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Goal Modal */}
        {showAddGoal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 420, maxWidth: '90vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>New Savings Goal</span>
                <button onClick={() => setShowAddGoal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={addGoal} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>GOAL NAME</label>
                  <input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g. Emergency Fund" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>TARGET AMOUNT (RM) — OPTIONAL</label>
                  <input type="number" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="Leave blank for no target" min="0" step="0.01" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>COLOR</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setGoalColor(c)}
                        style={{
                          width: 30, height: 30,
                          borderRadius: '50%',
                          background: c,
                          border: goalColor === c ? '2px solid #fff' : '2px solid transparent',
                          cursor: 'pointer',
                          outline: goalColor === c ? `2px solid ${c}` : 'none',
                          outlineOffset: 2,
                          boxSizing: 'border-box',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>NOTES (OPTIONAL)</label>
                  <input value={goalNotes} onChange={e => setGoalNotes(e.target.value)} placeholder="Optional notes" style={inputStyle} />
                </div>
                <button
                  type="submit"
                  disabled={goalSaving}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: goalSaving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: goalSaving ? 0.7 : 1, marginTop: 4 }}
                >
                  {goalSaving ? 'Creating…' : 'Create Goal'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
