'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Category {
  id: string
  name: string
  icon: string
  type: string
}

interface Account {
  id: string
  name: string
  type: string
}

interface AddTransactionModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function AddTransactionModal({ onClose, onSuccess }: AddTransactionModalProps) {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [merchant, setMerchant] = useState('')
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus amount on open
    amountRef.current?.focus()

    // Load categories and accounts
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ]).then(([cats, accs]: [Category[], Account[]]) => {
      setCategories(cats)
      setAccounts(accs)
    }).catch(() => {
      // silently handle
    })
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return

    setLoading(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          type,
          categoryId: categoryId || null,
          accountId: accountId || null,
          date,
          merchant: merchant || null,
          currency: 'MYR',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      onSuccess()
    } catch {
      // could show error toast here
    } finally {
      setLoading(false)
    }
  }, [amount, type, categoryId, accountId, date, merchant, onSuccess])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: '#111',
          border: '1px solid #222',
          borderRadius: 20,
          padding: '28px 32px',
          width: '100%',
          maxWidth: 460,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>
            Add Transaction
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid #222',
              borderRadius: 8,
              color: '#7a7a78',
              width: 32,
              height: 32,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Type toggle */}
          <div
            style={{
              display: 'flex',
              background: '#0d0d0d',
              border: '1px solid #1f1f1f',
              borderRadius: 10,
              padding: 4,
            }}
          >
            {(['expense', 'income'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: '"Geist", -apple-system, sans-serif',
                  background: type === t
                    ? t === 'expense' ? '#ef4444' : '#a3e635'
                    : 'transparent',
                  color: type === t
                    ? '#0d0d0d'
                    : '#7a7a78',
                  transition: 'all 140ms',
                }}
              >
                {t === 'expense' ? 'Expense' : 'Income'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label style={labelStyle}>Amount (MYR)</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 14,
                color: '#5b5b59',
                fontFamily: '"JetBrains Mono", monospace',
                pointerEvents: 'none',
              }}>
                RM
              </span>
              <input
                ref={amountRef}
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                style={{
                  ...inputStyle,
                  paddingLeft: 44,
                  fontSize: 24,
                  fontWeight: 700,
                  color: type === 'expense' ? '#ef4444' : '#a3e635',
                  fontFamily: '"Geist", -apple-system, sans-serif',
                }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Uncategorized</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {/* Merchant/Note */}
          <div>
            <label style={labelStyle}>Merchant / Note (optional)</label>
            <input
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Grab, Starbucks..."
              style={inputStyle}
            />
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div>
              <label style={labelStyle}>Account (optional)</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={inputStyle}
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !amount}
            style={{
              marginTop: 4,
              background: loading ? '#555' : '#a3e635',
              color: '#0d0d0d',
              border: 'none',
              borderRadius: 10,
              padding: '12px 0',
              fontSize: 14,
              fontWeight: 700,
              fontFamily: '"Geist", -apple-system, sans-serif',
              cursor: loading || !amount ? 'not-allowed' : 'pointer',
              opacity: loading || !amount ? 0.7 : 1,
              transition: 'opacity 140ms',
            }}
          >
            {loading ? 'Saving…' : 'Add Transaction'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#5b5b59',
  letterSpacing: '0.06em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid #222',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: '#f5f5f4',
  fontFamily: '"Geist", -apple-system, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}
