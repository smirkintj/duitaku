'use client'

import React from 'react'
import { formatRM } from '@/lib/finance-utils'
import { usePrivacyMode } from '@/lib/privacy'

interface StatsColumnProps {
  income: number
  spent: number
  saved: number
  dayOfMonth: number
  daysIn: number
}

interface StatCardProps {
  eyebrow: string
  amount: number
  caption: string
  delta?: { label: string; tone: 'lime' | 'warn' | 'danger' }
}

function StatCard({ eyebrow, amount, caption, delta, hidden }: StatCardProps & { hidden?: boolean }) {
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
        {hidden ? (
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 22, color: '#5b5b59', letterSpacing: '0.1em' }}>
            ••••••
          </span>
        ) : (
          <>
            <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#7a7a78', marginBottom: 4, marginRight: 2 }}>
              RM
            </span>
            <span style={{ fontFamily: '"Geist", -apple-system, sans-serif', fontWeight: 700, fontSize: 28, color: '#f5f5f4', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
              {intPart}
            </span>
            <span style={{ fontFamily: '"Geist", -apple-system, sans-serif', fontWeight: 500, fontSize: 16, color: '#5b5b59', marginBottom: 2 }}>
              {decPart}
            </span>
          </>
        )}
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

export default function StatsColumn({ income, spent, saved, dayOfMonth, daysIn }: StatsColumnProps) {
  const [hidden] = usePrivacyMode()
  const projected = dayOfMonth > 0 ? Math.round((spent / dayOfMonth) * daysIn) : 0
  const projectedDelta = projected - income

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <StatCard
        eyebrow="RECEIVED"
        amount={income}
        caption="income this month"
        hidden={hidden}
      />
      <StatCard
        eyebrow="SPENT"
        amount={spent}
        caption="expenses this month"
        hidden={hidden}
        delta={
          !hidden && dayOfMonth > 0 && income > 0
            ? { label: projectedDelta > 0 ? `proj. RM ${formatRM(projectedDelta, 0)} short` : `on track`, tone: projectedDelta > 0 ? 'danger' : 'lime' }
            : undefined
        }
      />
      <StatCard
        eyebrow="SAVED"
        amount={saved}
        caption="set aside this month"
        hidden={hidden}
        delta={!hidden && saved > 0 && income > 0 ? { label: `${Math.round((saved / income) * 100)}% of income`, tone: 'lime' } : undefined}
      />
    </div>
  )
}
