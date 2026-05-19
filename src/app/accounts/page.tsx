'use client'

import React, { useState, useEffect, useCallback } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Statement {
  id: string
  accountId: string
  month: string
  statementAmount: number
  minimumPayment: number
  paidAmount: number
  paidAt: string | null
  notes: string | null
}

interface Account {
  id: string
  name: string
  type: string
  currency: string
  initialBalance: number
  creditLimit: number | null
  currentOutstanding: number | null
  statementDueDay: number | null
  statementDay: number | null
  lastFour: string | null
  latestStatement: Statement | null
  statements: Statement[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
}

function fmt(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-MY', { month: 'short', year: 'numeric' })
}

function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function utilisationColor(pct: number) {
  if (pct >= 80) return '#ef4444'
  if (pct >= 50) return '#fbbf24'
  return '#a3e635'
}

// ─── CC Card ─────────────────────────────────────────────────────────────────

function CreditCardVisual({ account }: { account: Account }) {
  const outstanding = account.currentOutstanding ?? 0
  const limit = account.creditLimit ?? 0
  const utilisPct = limit > 0 ? Math.min(100, (outstanding / limit) * 100) : 0
  const color = utilisationColor(utilisPct)
  const stmt = account.latestStatement

  const unpaid = stmt ? stmt.statementAmount - stmt.paidAmount : 0
  const isOverdue = stmt && unpaid > 0 && account.statementDueDay
    ? new Date().getDate() > account.statementDueDay
    : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Card face */}
      <div
        style={{
          borderRadius: '16px 16px 0 0',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #111 60%, #161616 100%)',
          border: '1px solid #222',
          borderBottom: 'none',
          padding: '22px 24px 20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background pattern */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
          <svg width="100%" height="100%">
            <defs>
              <pattern id={`grid-${account.id}`} width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="16" cy="16" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#grid-${account.id})`} />
          </svg>
        </div>

        {/* Glow */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: color, opacity: 0.06, filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 11, ...S.mono, color: '#5b5b59', letterSpacing: '0.1em', marginBottom: 4 }}>CREDIT CARD</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{account.name}</div>
            </div>
            {/* Chip */}
            <div style={{ width: 32, height: 24, borderRadius: 5, background: 'linear-gradient(135deg, #b8922a, #f0c040, #b8922a)', opacity: 0.85 }} />
          </div>

          {/* Card number */}
          <div style={{ fontSize: 14, ...S.mono, color: '#5b5b59', letterSpacing: '0.25em', marginBottom: 18 }}>
            •••• •••• •••• {account.lastFour ?? '••••'}
          </div>

          {/* Outstanding vs limit */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 4 }}>OUTSTANDING</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.02em' }}>
                RM {fmt(outstanding)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 4 }}>LIMIT</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#7a7a78', ...S.sans }}>
                RM {fmt(limit)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Utilisation bar (flush between card face and info panel) */}
      <div style={{ height: 4, background: '#1a1a1a' }}>
        <div style={{ height: '100%', width: `${utilisPct}%`, background: color, transition: 'width 600ms ease' }} />
      </div>

      {/* Info panel */}
      <div
        style={{
          borderRadius: '0 0 14px 14px',
          border: '1px solid #1a1a1a',
          borderTop: 'none',
          background: '#0f0f0f',
          padding: '16px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Utilisation row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={S.label}>UTILISATION</span>
          <span style={{ fontSize: 13, fontWeight: 600, color, ...S.sans }}>{Math.round(utilisPct)}%</span>
        </div>

        {/* Statement info */}
        {stmt ? (
          <>
            <div style={{ height: 1, background: '#1a1a1a' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ ...S.label, marginBottom: 4 }}>{fmtMonth(stmt.month).toUpperCase()} STATEMENT</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f4', ...S.sans }}>
                  RM {fmt(stmt.statementAmount)}
                </div>
                {stmt.minimumPayment > 0 && (
                  <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 2 }}>
                    min. RM {fmt(stmt.minimumPayment)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                {account.statementDueDay && (
                  <div style={{ ...S.label, marginBottom: 4 }}>DUE</div>
                )}
                {account.statementDueDay && (
                  <div style={{ fontSize: 13, color: isOverdue ? '#ef4444' : '#d0d0cf', ...S.sans, fontWeight: 600 }}>
                    {ordinal(account.statementDueDay)} of month
                  </div>
                )}
                {unpaid > 0 ? (
                  <div style={{ fontSize: 11, color: isOverdue ? '#ef4444' : '#fbbf24', ...S.mono, marginTop: 2 }}>
                    RM {fmt(unpaid)} unpaid
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#a3e635', ...S.mono, marginTop: 2 }}>PAID ✓</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: '#3a3a3a', ...S.sans, textAlign: 'center' }}>No statement logged yet</div>
        )}
      </div>
    </div>
  )
}

// ─── Bank / Cash Card ────────────────────────────────────────────────────────

function BankCard({ account }: { account: Account }) {
  const typeLabel = account.type === 'cash' ? 'CASH' : 'BANK ACCOUNT'
  const typeColor = account.type === 'cash' ? '#fbbf24' : '#a3e635'

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid #1a1a1a',
        background: '#111',
        padding: '20px 22px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: 9, ...S.mono, color: typeColor, letterSpacing: '0.1em', marginBottom: 6, opacity: 0.7 }}>{typeLabel}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{account.name}</div>
        <div style={{ fontSize: 12, color: '#5b5b59', ...S.sans, marginTop: 2 }}>{account.currency}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ ...S.label, marginBottom: 4 }}>BALANCE</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.02em' }}>
          RM {fmt(account.initialBalance)}
        </div>
      </div>
    </div>
  )
}

// ─── Add Account Modal ────────────────────────────────────────────────────────

function AddAccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'bank' | 'credit' | 'cash'>('credit')
  const [name, setName] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [creditLimit, setCreditLimit] = useState('')
  const [currentOutstanding, setCurrentOutstanding] = useState('')
  const [statementDueDay, setStatementDueDay] = useState('')
  const [statementDay, setStatementDay] = useState('')
  const [balance, setBalance] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        type,
        initialBalance: parseFloat(balance) || 0,
        creditLimit: type === 'credit' ? parseFloat(creditLimit) || null : null,
        currentOutstanding: type === 'credit' ? parseFloat(currentOutstanding) || 0 : null,
        statementDueDay: type === 'credit' ? parseInt(statementDueDay) || null : null,
        statementDay: type === 'credit' ? parseInt(statementDay) || null : null,
        lastFour: type === 'credit' ? lastFour.slice(-4) || null : null,
      }),
    })
    setSaving(false)
    onSaved()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#f5f5f4',
    ...S.sans,
    outline: 'none',
    boxSizing: 'border-box',
    colorScheme: 'dark',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 16, padding: '28px 32px', width: 440, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Add Account</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5b5b59', cursor: 'pointer', padding: 4 }}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Type selector */}
        <div style={{ display: 'flex', gap: 6, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 4 }}>
          {(['credit', 'bank', 'cash'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{ flex: 1, padding: '7px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, ...S.sans, background: type === t ? '#1f1f1f' : 'transparent', color: type === t ? '#f5f5f4' : '#5b5b59', transition: 'all 140ms' }}
            >
              {t === 'credit' ? 'Credit Card' : t === 'bank' ? 'Bank' : 'Cash'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 6 }}>ACCOUNT NAME</div>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'credit' ? 'e.g. Maybank CC, CIMB Platinum' : 'e.g. Maybank Savings'} style={inputStyle} />
          </div>

          {type === 'credit' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>CREDIT LIMIT (RM)</div>
                  <input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="10000" style={inputStyle} />
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>CURRENT OUTSTANDING (RM)</div>
                  <input type="number" value={currentOutstanding} onChange={(e) => setCurrentOutstanding(e.target.value)} placeholder="0" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>LAST 4 DIGITS</div>
                  <input value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(-4))} placeholder="1234" maxLength={4} style={inputStyle} />
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>STATEMENT DAY</div>
                  <input type="number" min={1} max={31} value={statementDay} onChange={(e) => setStatementDay(e.target.value)} placeholder="1" style={inputStyle} />
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 6 }}>DUE DAY</div>
                  <input type="number" min={1} max={31} value={statementDueDay} onChange={(e) => setStatementDueDay(e.target.value)} placeholder="25" style={inputStyle} />
                </div>
              </div>
            </>
          )}

          {type !== 'credit' && (
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>CURRENT BALANCE (RM)</div>
              <input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 600, ...S.sans, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', opacity: saving || !name.trim() ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Add Account'}
        </button>
      </div>
    </div>
  )
}

// ─── Log Statement Modal ──────────────────────────────────────────────────────

function LogStatementModal({ account, onClose, onSaved }: { account: Account; onClose: () => void; onSaved: () => void }) {
  const [month, setMonth] = useState(currentMonthStr())
  const [statementAmount, setStatementAmount] = useState('')
  const [minimumPayment, setMinimumPayment] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [outstanding, setOutstanding] = useState(String(account.currentOutstanding ?? ''))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!statementAmount) return
    setSaving(true)

    await Promise.all([
      fetch(`/api/accounts/${account.id}/statements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          statementAmount: parseFloat(statementAmount),
          minimumPayment: parseFloat(minimumPayment) || 0,
          paidAmount: parseFloat(paidAmount) || 0,
          notes: notes || null,
        }),
      }),
      // Update outstanding on the account
      fetch(`/api/accounts/${account.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentOutstanding: parseFloat(outstanding) || 0 }),
      }),
    ])

    setSaving(false)
    onSaved()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #222',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#f5f5f4',
    fontFamily: '"Geist", -apple-system, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    colorScheme: 'dark',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 16, padding: '28px 32px', width: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Log Statement</div>
            <div style={{ fontSize: 12, color: '#5b5b59', ...S.sans, marginTop: 2 }}>{account.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#5b5b59', cursor: 'pointer', padding: 4 }}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 6 }}>STATEMENT MONTH</div>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>STATEMENT AMOUNT (RM)</div>
              <input type="number" value={statementAmount} onChange={(e) => setStatementAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>MINIMUM PAYMENT (RM)</div>
              <input type="number" value={minimumPayment} onChange={(e) => setMinimumPayment(e.target.value)} placeholder="50.00" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>AMOUNT PAID (RM)</div>
              <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
            <div>
              <div style={{ ...S.label, marginBottom: 6 }}>TOTAL OUTSTANDING (RM)</div>
              <input type="number" value={outstanding} onChange={(e) => setOutstanding(e.target.value)} placeholder="0.00" style={inputStyle} />
            </div>
          </div>
          <div>
            <div style={{ ...S.label, marginBottom: 6 }}>NOTES</div>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" style={inputStyle} />
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving || !statementAmount}
          style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 600, ...S.sans, cursor: saving || !statementAmount ? 'not-allowed' : 'pointer', opacity: saving || !statementAmount ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : 'Save Statement'}
        </button>
      </div>
    </div>
  )
}

// ─── Statement History ────────────────────────────────────────────────────────

function StatementHistory({ statements }: { statements: Statement[] }) {
  if (statements.length === 0) return null
  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 80px', gap: 12, padding: '10px 18px', borderBottom: '1px solid #1a1a1a' }}>
        {['MONTH', 'STATEMENT', 'PAID', 'MINIMUM', 'STATUS'].map((h) => (
          <span key={h} style={S.label}>{h}</span>
        ))}
      </div>
      {statements.map((s, i) => {
        const unpaid = s.statementAmount - s.paidAmount
        const paid = unpaid <= 0.01
        return (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 80px', gap: 12, padding: '11px 18px', borderBottom: i < statements.length - 1 ? '1px solid #141414' : 'none', alignItems: 'center' }}>
            <span style={{ fontSize: 11, ...S.mono, color: '#7a7a78' }}>{fmtMonth(s.month).toUpperCase()}</span>
            <span style={{ fontSize: 13, color: '#f5f5f4', ...S.sans }}>RM {fmt(s.statementAmount)}</span>
            <span style={{ fontSize: 13, color: s.paidAmount > 0 ? '#a3e635' : '#5b5b59', ...S.sans }}>
              {s.paidAmount > 0 ? `RM ${fmt(s.paidAmount)}` : '—'}
            </span>
            <span style={{ fontSize: 12, color: '#5b5b59', ...S.sans }}>
              {s.minimumPayment > 0 ? `RM ${fmt(s.minimumPayment)}` : '—'}
            </span>
            <span style={{ fontSize: 10, ...S.mono, color: paid ? '#a3e635' : '#fbbf24' }}>
              {paid ? 'PAID' : `RM ${fmt(unpaid)} left`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [logFor, setLogFor] = useState<Account | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/accounts')
    setAccounts(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const ccAccounts = accounts.filter((a) => a.type === 'credit')
  const bankCashAccounts = accounts.filter((a) => a.type !== 'credit')

  const totalOutstanding = ccAccounts.reduce((a, c) => a + (c.currentOutstanding ?? 0), 0)
  const totalLimit = ccAccounts.reduce((a, c) => a + (c.creditLimit ?? 0), 0)
  const totalBankBalance = bankCashAccounts.reduce((a, c) => a + c.initialBalance, 0)
  const overallUtilis = totalLimit > 0 ? Math.round((totalOutstanding / totalLimit) * 100) : 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>ACCOUNTS</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>My Accounts</span>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 16px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}
          >
            + Add Account
          </button>
        </div>

        <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', ...S.label }}>LOADING…</div>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, marginBottom: 16 }}>No accounts yet. Add your bank accounts and credit cards.</div>
              <button onClick={() => setShowAdd(true)} style={{ background: 'rgba(163,230,53,0.1)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 600, ...S.sans, cursor: 'pointer' }}>
                + Add First Account
              </button>
            </div>
          ) : (
            <>
              {/* Summary stats */}
              {(ccAccounts.length > 0 || bankCashAccounts.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: 'CC OUTSTANDING', value: `RM ${fmt(totalOutstanding)}`, color: totalOutstanding > 0 ? '#f87171' : '#f5f5f4' },
                    { label: 'TOTAL CC LIMIT', value: `RM ${fmt(totalLimit)}`, color: '#f5f5f4' },
                    { label: 'CC UTILISATION', value: `${overallUtilis}%`, color: utilisationColor(overallUtilis) },
                    { label: 'BANK / CASH', value: `RM ${fmt(totalBankBalance)}`, color: '#a3e635' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '16px 20px' }}>
                      <div style={{ ...S.label, marginBottom: 8 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em' }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Credit cards */}
              {ccAccounts.length > 0 && (
                <div>
                  <div style={{ ...S.label, marginBottom: 14 }}>CREDIT CARDS ({ccAccounts.length})</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                    {ccAccounts.map((account) => (
                      <div key={account.id}>
                        <CreditCardVisual account={account} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            onClick={() => setLogFor(account)}
                            style={{ flex: 1, background: 'rgba(163,230,53,0.08)', color: '#a3e635', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, ...S.sans, cursor: 'pointer' }}
                          >
                            Log Statement
                          </button>
                          <button
                            onClick={() => setExpanded(expanded === account.id ? null : account.id)}
                            style={{ background: 'transparent', color: '#5b5b59', border: '1px solid #1f1f1f', borderRadius: 8, padding: '8px 14px', fontSize: 12, ...S.sans, cursor: 'pointer' }}
                          >
                            {expanded === account.id ? 'Hide history' : 'History'}
                          </button>
                        </div>
                        {expanded === account.id && account.statements.length > 0 && (
                          <div style={{ marginTop: 10 }}>
                            <StatementHistory statements={account.statements} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank & cash */}
              {bankCashAccounts.length > 0 && (
                <div>
                  <div style={{ ...S.label, marginBottom: 14 }}>BANK & CASH ({bankCashAccounts.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {bankCashAccounts.map((account) => (
                      <BankCard key={account.id} account={account} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />}
      {logFor && <LogStatementModal account={logFor} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); load() }} />}
    </div>
  )
}
