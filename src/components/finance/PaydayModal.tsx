'use client'

import React, { useState } from 'react'
import { Icon } from './icons'

interface Props {
  defaultAmount: number
  onClose: () => void
  onSaved: () => void
}

export default function PaydayModal({ defaultAmount, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? defaultAmount.toString() : '')
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [saving, setSaving] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amount),
        date,
        type: 'income',
        merchant: 'Salary',
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: '28px 32px', width: 380, maxWidth: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>
            🎉 Got paid?
          </span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59' }}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: '#7a7a78', fontFamily: '"Geist", -apple-system, sans-serif', margin: '0 0 20px', lineHeight: 1.5 }}>
          Record your income for this month to start tracking.
        </p>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 6 }}>AMOUNT RECEIVED (RM)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', pointerEvents: 'none' }}>RM</span>
              <input
                autoFocus
                required
                type="number" min="1" step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '12px 14px 12px 44px', fontSize: 22, fontWeight: 700, color: '#a3e635', fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 6 }}>DATE RECEIVED</label>
            <input
              required type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }}
            />
          </div>
          <button type="submit" disabled={saving || !amount}
            style={{ background: saving || !amount ? '#1a1a1a' : '#a3e635', color: saving || !amount ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 700, fontFamily: '"Geist", -apple-system, sans-serif', cursor: saving || !amount ? 'not-allowed' : 'pointer', marginTop: 4 }}>
            {saving ? 'Recording…' : 'Record Income'}
          </button>
        </form>
      </div>
    </div>
  )
}
