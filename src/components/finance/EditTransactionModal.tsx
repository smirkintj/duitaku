'use client'

import React, { useState } from 'react'
import { Icon } from './icons'

interface Category {
  id: string
  name: string
  type: string
}

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

interface Props {
  tx: Transaction
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

const S = {
  label: { display: 'block', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 6 } as React.CSSProperties,
  input: { width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' } as React.CSSProperties,
}

export default function EditTransactionModal({ tx, categories, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(tx.amount.toString())
  const [date, setDate] = useState(tx.date)
  const [type, setType] = useState(tx.type)
  const [merchant, setMerchant] = useState(tx.merchant ?? '')
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? '')
  const [isRecurring, setIsRecurring] = useState(tx.isRecurring)
  const [saving, setSaving] = useState(false)

  const filteredCats = categories.filter(c => c.type === type)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/transactions/${tx.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: parseFloat(amount),
        date,
        type,
        merchant: merchant || null,
        categoryId: categoryId || null,
        isRecurring,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: '28px 32px', width: 420, maxWidth: '92vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>Edit Transaction</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59' }}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type toggle */}
          <div>
            <label style={S.label}>TYPE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['expense', 'income'] as const).map(t => (
                <button key={t} type="button" onClick={() => { setType(t); setCategoryId('') }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${type === t ? '#a3e635' : '#222'}`, background: type === t ? 'rgba(163,230,53,0.08)' : 'transparent', color: type === t ? '#a3e635' : '#7a7a78', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: '"Geist", -apple-system, sans-serif' }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label style={S.label}>AMOUNT (RM)</label>
            <input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={S.input} />
          </div>

          {/* Merchant */}
          <div>
            <label style={S.label}>MERCHANT / DESCRIPTION</label>
            <input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="e.g. Grab Food" style={S.input} />
          </div>

          {/* Date */}
          <div>
            <label style={S.label}>DATE</label>
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
          </div>

          {/* Category */}
          <div>
            <label style={S.label}>CATEGORY</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              style={{ ...S.input, colorScheme: 'dark' }}>
              <option value="">Uncategorized</option>
              {filteredCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Recurring */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: '#a3e635', cursor: 'pointer' }} />
            <span style={{ fontSize: 13, color: '#d0d0cf', fontFamily: '"Geist", -apple-system, sans-serif' }}>Recurring transaction</span>
          </label>

          <button type="submit" disabled={saving}
            style={{ background: saving ? '#1a1a1a' : '#a3e635', color: saving ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 700, fontFamily: '"Geist", -apple-system, sans-serif', cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}
