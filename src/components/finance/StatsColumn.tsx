'use client'

import React from 'react'
import { formatRM } from '@/lib/finance-utils'

interface StatsColumnProps {
  income: number
  spent: number
  dayOfMonth: number
  daysIn: number
}

interface StatCardProps {
  eyebrow: string
  amount: number
  caption: string
  delta?: { label: string; tone: 'lime' | 'warn' | 'danger' }
}

function StatCard({ eyebrow, amount, caption, delta }: StatCardProps) {
  const rmStr = formatRM(amount)
  const dotIdx = rmStr.indexOf('.')
  const intPart = dotIdx >= 0 ? rmStr.slice(0, dotIdx) : rmStr
  const decPart = dotIdx >= 0 ? rmStr.slice(dotIdx) : '.00'

  const deltaColors = {
    lime: { border: 'rgba(163,230,53,0.3)', color: '#a3e635' },
    warn: { border: 'rgba(251,191,36,0.3)', color: '#fbbf24' },
    danger: { border: 'rgba(239,68,68,0.3)', color: '#ef4444' },
  }

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid #1a1a1a',
        background: '#0f0f0f',
        padding: '18px 20px',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            color: '#5b5b59',
            letterSpacing: '0.08em',
          }}
        >
          {eyebrow}
        </span>
        {delta && (
          <span
            style={{
              fontSize: 9,
              fontFamily: '"JetBrains Mono", monospace',
              color: deltaColors[delta.tone].color,
              border: `1px solid ${deltaColors[delta.tone].border}`,
              borderRadius: 5,
              padding: '2px 6px',
            }}
          >
            {delta.label}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', lineHeight: 1, gap: 1 }}>
        <span
          style={{
            fontSize: 12,
            fontFamily: '"JetBrains Mono", monospace',
            color: '#7a7a78',
            marginBottom: 4,
            marginRight: 2,
          }}
        >
          RM
        </span>
        <span
          style={{
            fontFamily: '"Geist", -apple-system, sans-serif',
            fontWeight: 700,
            fontSize: 28,
            color: '#f5f5f4',
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {intPart}
        </span>
        <span
          style={{
            fontFamily: '"Geist", -apple-system, sans-serif',
            fontWeight: 500,
            fontSize: 16,
            color: '#5b5b59',
            marginBottom: 2,
          }}
        >
          {decPart}
        </span>
      </div>

      <span
        style={{
          fontSize: 12,
          color: '#7a7a78',
          fontFamily: '"Geist", -apple-system, sans-serif',
        }}
      >
        {caption}
      </span>
    </div>
  )
}

export default function StatsColumn({ income, spent, dayOfMonth, daysIn }: StatsColumnProps) {
  const projected = Math.round((spent / dayOfMonth) * daysIn)
  const projectedDelta = projected - income

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatCard
        eyebrow="INCOME · MTD"
        amount={income}
        caption="Mei salary received May 14"
      />
      <StatCard
        eyebrow="SPENT · MTD"
        amount={spent}
        caption="across 47 transactions"
        delta={{ label: '+3.6%', tone: 'warn' }}
      />
      <StatCard
        eyebrow="PROJECTED END OF MAY"
        amount={projected}
        caption="if current pace continues"
        delta={{
          label: projectedDelta > 0 ? `RM ${formatRM(projectedDelta, 0)} short` : `RM ${formatRM(Math.abs(projectedDelta), 0)} surplus`,
          tone: projectedDelta > 0 ? 'danger' : 'lime',
        }}
      />
    </div>
  )
}
