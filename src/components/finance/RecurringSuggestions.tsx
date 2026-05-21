'use client'

import React, { useState, useEffect } from 'react'
import { formatRM } from '@/lib/finance-utils'

interface Suggestion {
  merchant: string
  amount: number
  occurrences: number
  lastDate: string
  transactionIds: string[]
}

const S = {
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
}

export default function RecurringSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/transactions/suggest-recurring')
      .then(r => r.json())
      .then(d => { setSuggestions(d.suggestions ?? []); setLoaded(true) })
  }, [])

  async function markRecurring(s: Suggestion) {
    setConfirming(prev => new Set(prev).add(s.merchant))
    await fetch('/api/transactions/suggest-recurring', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds: s.transactionIds, isRecurring: true }),
    })
    setDismissed(prev => new Set(prev).add(s.merchant))
  }

  function dismiss(merchant: string) {
    setDismissed(prev => new Set(prev).add(merchant))
  }

  const visible = suggestions.filter(s => !dismissed.has(s.merchant))
  if (!loaded || visible.length === 0) return null

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24' }} />
        <span style={S.label}>RECURRING DETECTED</span>
        <span style={{ fontSize: 10, ...S.mono, color: '#3a3a3a', marginLeft: 'auto' }}>{visible.length} pattern{visible.length !== 1 ? 's' : ''}</span>
      </div>
      <p style={{ fontSize: 12, color: '#5b5b59', ...S.sans, margin: '0 0 14px', lineHeight: 1.5 }}>
        These transactions repeat regularly but aren't marked as recurring. Flag them to exclude from variable spend tracking.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(s => (
          <div key={s.merchant} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.merchant}</div>
              <div style={{ fontSize: 11, color: '#5b5b59', ...S.mono, marginTop: 2 }}>
                RM {formatRM(s.amount)} · {s.occurrences}× in 90 days · last {s.lastDate}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={() => markRecurring(s)}
                disabled={confirming.has(s.merchant)}
                style={{ fontSize: 11, ...S.sans, fontWeight: 600, padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(163,230,53,0.3)', background: 'rgba(163,230,53,0.08)', color: '#a3e635', cursor: 'pointer' }}>
                Mark recurring
              </button>
              <button
                onClick={() => dismiss(s.merchant)}
                style={{ fontSize: 11, ...S.sans, padding: '5px 10px', borderRadius: 7, border: '1px solid #1a1a1a', background: 'transparent', color: '#5b5b59', cursor: 'pointer' }}>
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
