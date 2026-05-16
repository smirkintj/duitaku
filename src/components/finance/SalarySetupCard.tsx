'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SalarySetupCard() {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const today = new Date().toISOString().slice(0, 10)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || isNaN(Number(amount))) return

    setLoading(true)
    try {
      await fetch('/api/salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          currency: 'MYR',
          effectiveFrom: today,
        }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #222',
        borderRadius: 20,
        padding: '40px 48px',
        width: '100%',
        maxWidth: 420,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}
    >
      {/* Logo */}
      <div
        style={{
          width: 48,
          height: 48,
          background: '#a3e635',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: 22,
          color: '#0d0d0d',
          fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        d
      </div>

      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: '0 0 8px' }}>
          Welcome to duitaku.
        </h1>
        <p style={{ fontSize: 14, color: '#7a7a78', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0, lineHeight: 1.6 }}>
          To get started, let us know your monthly salary so we can track your spending.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              color: '#5b5b59',
              letterSpacing: '0.06em',
              marginBottom: 6,
            }}
          >
            MONTHLY SALARY (MYR)
          </label>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 14,
                color: '#5b5b59',
                fontFamily: '"JetBrains Mono", monospace',
                pointerEvents: 'none',
              }}
            >
              RM
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              autoFocus
              style={{
                width: '100%',
                background: '#0d0d0d',
                border: '1px solid #222',
                borderRadius: 8,
                padding: '12px 14px 12px 44px',
                fontSize: 22,
                fontWeight: 700,
                color: '#a3e635',
                fontFamily: '"Geist", -apple-system, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !amount}
          style={{
            background: loading ? '#555' : '#a3e635',
            color: '#0d0d0d',
            border: 'none',
            borderRadius: 10,
            padding: '13px 0',
            fontSize: 14,
            fontWeight: 700,
            fontFamily: '"Geist", -apple-system, sans-serif',
            cursor: loading || !amount ? 'not-allowed' : 'pointer',
            opacity: loading || !amount ? 0.7 : 1,
          }}
        >
          {loading ? 'Setting up…' : 'Get started →'}
        </button>
      </form>
    </div>
  )
}
