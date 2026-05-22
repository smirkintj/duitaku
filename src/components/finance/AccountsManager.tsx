'use client'

import React, { useState, useEffect } from 'react'

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
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  input: {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    color: '#f5f5f4',
    fontSize: 13,
    padding: '8px 12px',
    fontFamily: '"Geist", -apple-system, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    colorScheme: 'dark',
  } as React.CSSProperties,
}

const TYPE_COLORS: Record<string, string> = {
  bank: '#60a5fa',
  cash: '#a3e635',
  credit: '#f97316',
}

const TYPE_LABELS: Record<string, string> = {
  bank: 'BANK',
  cash: 'CASH',
  credit: 'CREDIT CARD',
}

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? '#5b5b59'
  return (
    <span style={{
      fontSize: 9,
      fontFamily: '"JetBrains Mono", monospace',
      color,
      border: `1px solid ${color}33`,
      borderRadius: 4,
      padding: '2px 6px',
      letterSpacing: '0.06em',
    }}>
      {TYPE_LABELS[type] ?? type.toUpperCase()}
    </span>
  )
}

function AccountRow({
  account,
  onSave,
  onDelete,
}: {
  account: Account
  onSave: (id: string, patch: Partial<Account>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({
    name: account.name,
    type: account.type,
    initialBalance: String(account.initialBalance ?? 0),
    creditLimit: String(account.creditLimit ?? ''),
    currentOutstanding: String(account.currentOutstanding ?? ''),
    lastFour: account.lastFour ?? '',
    statementDay: String(account.statementDay ?? ''),
    statementDueDay: String(account.statementDueDay ?? ''),
  })

  function field(key: keyof typeof form, label: string, type = 'text', placeholder = '') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={S.label}>{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          style={S.input}
        />
      </div>
    )
  }

  async function handleSave() {
    setSaving(true)
    const patch: Partial<Account> = {
      name: form.name,
      type: form.type,
      initialBalance: parseFloat(form.initialBalance) || 0,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null,
      currentOutstanding: form.currentOutstanding ? parseFloat(form.currentOutstanding) : null,
      lastFour: form.lastFour || null,
      statementDay: form.statementDay ? parseInt(form.statementDay) : null,
      statementDueDay: form.statementDueDay ? parseInt(form.statementDueDay) : null,
    }
    await onSave(account.id, patch)
    setSaving(false)
    setOpen(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    await onDelete(account.id)
    setDeleting(false)
  }

  const isCredit = form.type === 'credit'

  return (
    <div style={{ borderBottom: '1px solid #141414' }}>
      {/* Row summary */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...S.sans, fontSize: 14, fontWeight: 600, color: '#f5f5f4', marginBottom: 3 }}>{account.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TypeBadge type={account.type} />
            {account.type === 'credit' && account.lastFour && (
              <span style={{ ...S.mono, fontSize: 11, color: '#5b5b59' }}>••{account.lastFour}</span>
            )}
            {account.type === 'credit' && account.creditLimit && (
              <span style={{ ...S.mono, fontSize: 11, color: '#5b5b59' }}>
                limit RM {account.creditLimit.toLocaleString()}
              </span>
            )}
            {account.type !== 'credit' && (
              <span style={{ ...S.mono, fontSize: 11, color: '#5b5b59' }}>
                RM {account.initialBalance?.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <span style={{ color: '#3a3a3a', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Edit form */}
      {open && (
        <div style={{ padding: '0 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid #111' }}>
          <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('name', 'ACCOUNT NAME')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={S.label}>TYPE</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                style={{ ...S.input }}
              >
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="credit">Credit Card</option>
              </select>
            </div>
          </div>

          {isCredit ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {field('creditLimit', 'CREDIT LIMIT (RM)', 'number', '0')}
                {field('currentOutstanding', 'CURRENT OUTSTANDING (RM)', 'number', '0')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {field('lastFour', 'LAST 4 DIGITS', 'text', '1234')}
                {field('statementDay', 'STATEMENT DATE', 'number', '1')}
                {field('statementDueDay', 'PAYMENT DUE DAY', 'number', '15')}
              </div>
            </>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {field('initialBalance', 'CURRENT BALANCE (RM)', 'number', '0')}
              <div />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, paddingTop: 2 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? '#1a1a1a' : '#a3e635',
                color: saving ? '#3a3a3a' : '#0d0d0d',
                border: 'none',
                borderRadius: 8,
                padding: '9px 20px',
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                ...S.sans,
              }}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmDelete(false) }}
              style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 16px', fontSize: 13, color: '#5b5b59', cursor: 'pointer', ...S.sans }}
            >
              Cancel
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: confirmDelete ? '#ef4444' : 'transparent',
                border: `1px solid ${confirmDelete ? '#ef4444' : '#3a3a3a'}`,
                borderRadius: 8,
                padding: '9px 16px',
                fontSize: 13,
                color: confirmDelete ? '#fff' : '#ef4444',
                cursor: deleting ? 'not-allowed' : 'pointer',
                ...S.sans,
                transition: 'all 150ms',
              }}
            >
              {deleting ? 'Deleting…' : confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewAccountForm({ onCreated }: { onCreated: (a: Account) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'bank',
    initialBalance: '',
    creditLimit: '',
    currentOutstanding: '',
    lastFour: '',
    statementDay: '',
    statementDueDay: '',
  })

  function field(key: keyof typeof form, label: string, type = 'text', placeholder = '') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <label style={S.label}>{label}</label>
        <input
          type={type}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          style={S.input}
        />
      </div>
    )
  }

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    const body = {
      name: form.name.trim(),
      type: form.type,
      initialBalance: parseFloat(form.initialBalance) || 0,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : null,
      currentOutstanding: form.currentOutstanding ? parseFloat(form.currentOutstanding) : null,
      lastFour: form.lastFour || null,
      statementDay: form.statementDay ? parseInt(form.statementDay) : null,
      statementDueDay: form.statementDueDay ? parseInt(form.statementDueDay) : null,
    }
    const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const created = await res.json() as Account
    onCreated(created)
    setSaving(false)
    setOpen(false)
    setForm({ name: '', type: 'bank', initialBalance: '', creditLimit: '', currentOutstanding: '', lastFour: '', statementDay: '', statementDueDay: '' })
  }

  const isCredit = form.type === 'credit'

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'transparent',
          border: '1px dashed #2a2a2a',
          borderRadius: 10,
          padding: '12px 16px',
          width: '100%',
          color: '#5b5b59',
          fontSize: 13,
          cursor: 'pointer',
          ...S.sans,
          marginTop: 4,
          transition: 'border-color 150ms',
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, color: '#3a3a3a' }}>+</span>
        Add account
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid #2a2a2a', borderRadius: 10, padding: '16px', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...S.label, marginBottom: 0 }}>NEW ACCOUNT</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {field('name', 'ACCOUNT NAME', 'text', 'e.g. Maybank Current')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={S.label}>TYPE</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={S.input}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit Card</option>
          </select>
        </div>
      </div>

      {isCredit ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {field('creditLimit', 'CREDIT LIMIT (RM)', 'number', '0')}
            {field('currentOutstanding', 'CURRENT OUTSTANDING (RM)', 'number', '0')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {field('lastFour', 'LAST 4 DIGITS', 'text', '1234')}
            {field('statementDay', 'STATEMENT DATE', 'number', '1')}
            {field('statementDueDay', 'PAYMENT DUE DAY', 'number', '15')}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {field('initialBalance', 'CURRENT BALANCE (RM)', 'number', '0')}
          <div />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleCreate}
          disabled={saving || !form.name.trim()}
          style={{
            background: saving || !form.name.trim() ? '#1a1a1a' : '#a3e635',
            color: saving || !form.name.trim() ? '#3a3a3a' : '#0d0d0d',
            border: 'none',
            borderRadius: 8,
            padding: '9px 20px',
            fontSize: 13,
            fontWeight: 600,
            cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            ...S.sans,
          }}
        >
          {saving ? 'Creating…' : 'Create account'}
        </button>
        <button
          onClick={() => setOpen(false)}
          style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 16px', fontSize: 13, color: '#5b5b59', cursor: 'pointer', ...S.sans }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/accounts').then(r => r.json()).then((data: Account[]) => {
      setAccounts(data)
      setLoading(false)
    })
  }, [])

  async function handleSave(id: string, patch: Partial<Account>) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const updated = await res.json() as Account
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updated } : a))
  }

  async function handleDelete(id: string) {
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ ...S.label, marginBottom: 14 }}>ACCOUNTS</div>
      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '16px', fontSize: 13, color: '#5b5b59', ...S.sans }}>Loading…</div>
        ) : accounts.length === 0 ? (
          <div style={{ padding: '16px', fontSize: 13, color: '#5b5b59', ...S.sans }}>No accounts yet.</div>
        ) : (
          accounts.map(a => (
            <AccountRow key={a.id} account={a} onSave={handleSave} onDelete={handleDelete} />
          ))
        )}
      </div>
      <NewAccountForm onCreated={a => setAccounts(prev => [...prev, a])} />
    </div>
  )
}
