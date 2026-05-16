'use client'

import React, { useState, useEffect } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  input: {
    background: '#0d0d0d', border: '1px solid #222', borderRadius: 8,
    padding: '10px 14px', fontSize: 14, color: '#f5f5f4',
    fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none',
    boxSizing: 'border-box' as const, colorScheme: 'dark',
  },
}

export default function SettingsPage() {
  const [currentSalary, setCurrentSalary] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date()
    setEffectiveFrom(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`)
    fetch('/api/salary').then(r => r.json()).then(data => {
      if (data?.amount) {
        setCurrentSalary(data.amount)
        setAmount(data.amount.toString())
      }
      setLoading(false)
    })
  }, [])

  async function saveSalary(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(amount), effectiveFrom }),
    })
    setCurrentSalary(parseFloat(amount))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>APP</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Settings</span>
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: 560 }}>
          {/* Salary card */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...S.label, marginBottom: 6 }}>MONTHLY SALARY</div>
              {loading ? (
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>Loading…</div>
              ) : currentSalary ? (
                <div style={{ fontSize: 28, fontWeight: 700, color: '#a3e635', ...S.sans, letterSpacing: '-0.02em' }}>
                  RM {currentSalary.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>Not set yet</div>
              )}
            </div>

            <form onSubmit={saveSalary} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>NEW AMOUNT (RM)</label>
                <input
                  required
                  type="number" min="1" step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  style={{ ...S.input, width: '100%' }}
                />
              </div>
              <div>
                <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>EFFECTIVE FROM</label>
                <input
                  required
                  type="date"
                  value={effectiveFrom}
                  onChange={e => setEffectiveFrom(e.target.value)}
                  style={{ ...S.input, width: '100%' }}
                />
              </div>
              <button
                type="submit"
                disabled={saving || !amount}
                style={{ background: saved ? '#4ade80' : saving || !amount ? '#1a1a1a' : '#a3e635', color: saving || !amount ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: saving || !amount ? 'not-allowed' : 'pointer', ...S.sans, transition: 'background 200ms' }}
              >
                {saved ? 'Saved ✓' : saving ? 'Saving…' : currentSalary ? 'Update Salary' : 'Set Salary'}
              </button>
            </form>
          </div>

          {/* Info */}
          <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.1)', borderRadius: 10 }}>
            <p style={{ fontSize: 12, color: '#5b5b59', ...S.sans, margin: 0, lineHeight: 1.6 }}>
              Salary history is preserved — each update adds a new entry. The most recent entry effective on or before the current month is used for budget calculations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
