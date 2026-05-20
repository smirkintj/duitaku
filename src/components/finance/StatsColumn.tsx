'use client'

import React from 'react'
import { formatRM } from '@/lib/finance-utils'
import { usePrivacyMode } from '@/lib/privacy'

interface StatsColumnProps {
  income: number
  committedTotal: number
  committedBills: number
  committedBnpl: number
  billsPaidCount: number
  billsCashCount: number
  variableSpent: number
  remaining: number
  saved: number
  dayOfMonth: number
  daysIn: number
}

function Bucket({
  label,
  amount,
  pct,
  barColor,
  sub,
  hidden,
  highlight,
}: {
  label: string
  amount: number
  pct: number
  barColor: string
  sub: string
  hidden?: boolean
  highlight?: boolean
}) {
  const S = {
    label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
    sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
    mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  }
  const rmStr = formatRM(amount)
  const dot = rmStr.indexOf('.')
  const intPart = dot >= 0 ? rmStr.slice(0, dot) : rmStr
  const decPart = dot >= 0 ? rmStr.slice(dot) : '.00'

  return (
    <div style={{
      borderRadius: 14,
      border: highlight ? `1px solid ${barColor}28` : '1px solid #1a1a1a',
      background: highlight ? `${barColor}06` : '#0f0f0f',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ ...S.label }}>{label}</span>
        <span style={{ fontSize: 9, ...S.mono, color: '#3a3a3a' }}>{Math.round(pct)}% OF SALARY</span>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, lineHeight: 1 }}>
        {hidden ? (
          <span style={{ ...S.mono, fontSize: 20, color: '#5b5b59', letterSpacing: '0.1em' }}>••••••</span>
        ) : (
          <>
            <span style={{ fontSize: 11, ...S.mono, color: '#7a7a78', marginBottom: 3, marginRight: 2 }}>RM</span>
            <span style={{ ...S.sans, fontWeight: 700, fontSize: 26, color: '#f5f5f4', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>{intPart}</span>
            <span style={{ ...S.sans, fontWeight: 500, fontSize: 14, color: '#5b5b59', marginBottom: 2 }}>{decPart}</span>
          </>
        )}
      </div>

      {/* Bar */}
      <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor, borderRadius: 2, transition: 'width 600ms ease' }} />
      </div>

      <span style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>{sub}</span>
    </div>
  )
}

export default function StatsColumn({
  income,
  committedTotal,
  committedBills,
  committedBnpl,
  billsPaidCount,
  billsCashCount,
  variableSpent,
  remaining,
  saved,
  dayOfMonth,
  daysIn,
}: StatsColumnProps) {
  const [hidden] = usePrivacyMode()

  const pct = (n: number) => income > 0 ? (n / income) * 100 : 0

  const billsSub = billsCashCount > 0
    ? `${billsPaidCount}/${billsCashCount} bills paid${committedBnpl > 0 ? ` · RM ${formatRM(committedBnpl, 0)} BNPL` : ''}`
    : committedBnpl > 0 ? `BNPL RM ${formatRM(committedBnpl, 0)}` : 'no commitments set'

  const varSub = `ad-hoc · ${daysIn - dayOfMonth} days left`

  const bufferPct = pct(remaining)
  const bufferSub = bufferPct >= 20
    ? 'healthy buffer'
    : bufferPct >= 10
      ? 'tight — watch variable spend'
      : 'very tight this month'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Bucket
        label="COMMITTED"
        amount={committedTotal}
        pct={pct(committedTotal)}
        barColor="#f97316"
        sub={billsSub}
        hidden={hidden}
      />
      <Bucket
        label="VARIABLE"
        amount={variableSpent}
        pct={pct(variableSpent)}
        barColor="#60a5fa"
        sub={varSub}
        hidden={hidden}
      />
      <Bucket
        label="BUFFER"
        amount={remaining}
        pct={bufferPct}
        barColor={bufferPct >= 20 ? '#a3e635' : bufferPct >= 10 ? '#fbbf24' : '#ef4444'}
        sub={hidden ? '' : bufferSub}
        hidden={hidden}
        highlight
      />
    </div>
  )
}
