'use client'

import React, { useState, useEffect, useRef } from 'react'
import { formatRM } from '@/lib/finance-utils'

interface AffordModalProps {
  remaining: number
  projectedRemaining: number
  daysLeft: number
  onClose: () => void
}

export default function AffordModal({ remaining, projectedRemaining, daysLeft, onClose }: AffordModalProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const amount = parseFloat(input) || 0
  const afterNow = remaining - amount
  const afterProjected = projectedRemaining - amount

  function verdict() {
    if (amount <= 0) return null
    if (afterNow < 0) return { label: 'Over budget now', color: '#ef4444', desc: `You don't have this in your current buffer.` }
    if (afterProjected < 0) return { label: 'Risky', color: '#f97316', desc: `You can cover it today but projections suggest you'll run short by end of cycle.` }
    if (afterProjected / remaining < 0.1) return { label: 'Tight', color: '#fbbf24', desc: `Affordable but leaves very little buffer at cycle end.` }
    return { label: 'Looks good', color: '#a3e635', desc: `You can comfortably cover this.` }
  }

  const v = verdict()

  const S = {
    mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
    sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  }

  function Row({ label, value, color, dimmed }: { label: string; value: number; color?: string; dimmed?: boolean }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #1a1a1a' }}>
        <span style={{ fontSize: 12, color: dimmed ? '#3a3a3a' : '#7a7a78', ...S.sans }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, ...S.mono, color: color ?? (value < 0 ? '#ef4444' : '#f5f5f4') }}>
          {value < 0 ? '-' : ''}RM {formatRM(Math.abs(value))}
        </span>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 400, background: '#111', border: '1px solid #222', borderRadius: 16, padding: '28px 28px 24px', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 6 }}>CAN I AFFORD THIS?</div>
          <div style={{ fontSize: 14, color: '#7a7a78', ...S.sans }}>Enter an amount to check against your budget</div>
        </div>

        {/* Amount input */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#5b5b59', ...S.mono }}>RM</span>
          <input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%',
              background: '#0d0d0d',
              border: `1px solid ${v ? v.color + '50' : '#222'}`,
              borderRadius: 10,
              padding: '14px 16px 14px 52px',
              fontSize: 28,
              fontWeight: 700,
              color: '#f5f5f4',
              ...S.mono,
              outline: 'none',
              boxSizing: 'border-box',
              colorScheme: 'dark',
              transition: 'border-color 200ms',
            }}
          />
        </div>

        {/* Verdict */}
        {v && (
          <div style={{ background: `${v.color}10`, border: `1px solid ${v.color}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: v.color, ...S.sans }}>{v.label}</div>
              <div style={{ fontSize: 11, color: '#7a7a78', ...S.sans, marginTop: 2 }}>{v.desc}</div>
            </div>
          </div>
        )}

        {/* Breakdown */}
        <div>
          <Row label="Buffer now" value={remaining} color="#f5f5f4" />
          {amount > 0 && <Row label="After this purchase" value={afterNow} />}
          <Row label={`Projected at cycle end (${daysLeft}d left)`} value={projectedRemaining} dimmed={amount === 0} />
          {amount > 0 && <Row label="Projected after purchase" value={afterProjected} />}
        </div>

        <button onClick={onClose} style={{ marginTop: 20, width: '100%', background: '#1a1a1a', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13, color: '#7a7a78', cursor: 'pointer', ...S.sans }}>
          Close
        </button>
      </div>
    </div>
  )
}
