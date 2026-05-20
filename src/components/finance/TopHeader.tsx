'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { BreathingDot } from './celestial'
import { formatRM } from '@/lib/finance-utils'
import { usePrivacyMode } from '@/lib/privacy'

interface TopHeaderProps {
  remaining: number
  salary: number
  month: string
  cycleLabel?: string
  onAdd?: () => void
  onPayday?: () => void
  hasPaidThisMonth?: boolean
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  let pm = m - 1
  let py = y
  if (pm < 1) { pm = 12; py-- }
  return `${py}-${String(pm).padStart(2, '0')}`
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  let nm = m + 1
  let ny = y
  if (nm > 12) { nm = 1; ny++ }
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase()
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function EyeIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1={1} y1={1} x2={23} y2={23} />
    </svg>
  )
}

export default function TopHeader({ remaining, month, cycleLabel, onAdd, onPayday, hasPaidThisMonth }: TopHeaderProps) {
  const router = useRouter()
  const monthLabel = cycleLabel ?? formatMonthLabel(month)
  const [hidden, togglePrivacy] = usePrivacyMode()

  const goToPrev = () => router.push(`/?m=${prevMonth(month)}`)
  const goToNext = () => router.push(`/?m=${nextMonth(month)}`)

  return (
    <div
      style={{
        height: 72,
        background: '#0d0d0d',
        borderBottom: '1px solid #141414',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        flexShrink: 0,
      }}
    >
      {/* Left */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span
          style={{
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            color: '#5b5b59',
            letterSpacing: '0.08em',
          }}
        >
          CYCLE / {monthLabel}
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            fontFamily: '"Geist", -apple-system, sans-serif',
            color: '#f5f5f4',
          }}
        >
          {greeting()}, Putra.
        </span>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Month nav pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            border: '1px solid #1f1f1f',
            borderRadius: 10,
            padding: '3px 4px',
          }}
        >
          <button
            onClick={goToPrev}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#7a7a78',
              display: 'flex',
              alignItems: 'center',
              padding: '3px 5px',
              borderRadius: 7,
            }}
          >
            <Icon name="chevL" width={14} height={14} />
          </button>
          <span
            style={{
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              color: '#d0d0cf',
              letterSpacing: '0.06em',
              padding: '0 4px',
              maxWidth: cycleLabel ? 180 : undefined,
              textAlign: 'center',
            }}
          >
            {cycleLabel ?? monthLabel}
          </span>
          <button
            onClick={goToNext}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#7a7a78',
              display: 'flex',
              alignItems: 'center',
              padding: '3px 5px',
              borderRadius: 7,
            }}
          >
            <Icon name="chevR" width={14} height={14} />
          </button>
        </div>

        {/* Remaining pill */}
        <div
          style={{
            background: 'linear-gradient(180deg, #131313, #0d0d0d)',
            border: '1px solid #1f1f1f',
            borderRadius: 12,
            padding: '8px 14px 8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <BreathingDot size={6} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontSize: 9,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#5b5b59',
                letterSpacing: '0.08em',
              }}
            >
              REMAINING
            </span>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                fontFamily: hidden ? '"JetBrains Mono", monospace' : '"Geist", -apple-system, sans-serif',
                color: '#a3e635',
                letterSpacing: '-0.02em',
              }}
            >
              {hidden ? '••••••' : `RM ${formatRM(remaining)}`}
            </span>
          </div>
        </div>

        {/* Privacy toggle */}
        <button
          onClick={togglePrivacy}
          title={hidden ? 'Show amounts' : 'Hide amounts'}
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            border: `1px solid ${hidden ? 'rgba(163,230,53,0.3)' : '#1f1f1f'}`,
            background: hidden ? 'rgba(163,230,53,0.06)' : 'transparent',
            color: hidden ? '#a3e635' : '#7a7a78',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 160ms',
          }}
        >
          {hidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>

        {/* Search */}
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            border: '1px solid #1f1f1f',
            background: 'transparent',
            color: '#7a7a78',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="search" width={16} height={16} />
        </button>

        {/* Bell */}
        <button
          style={{
            width: 36,
            height: 36,
            borderRadius: 9,
            border: '1px solid #1f1f1f',
            background: 'transparent',
            color: '#7a7a78',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Icon name="bell" width={16} height={16} />
          <span
            style={{
              position: 'absolute',
              top: 7,
              right: 7,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#ef4444',
              border: '1.5px solid #0d0d0d',
            }}
          />
        </button>

        {/* Payday button — shown when income not yet recorded */}
        {!hasPaidThisMonth && onPayday && (
          <button
            onClick={onPayday}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(163,230,53,0.1)',
              color: '#a3e635',
              border: '1px solid rgba(163,230,53,0.3)',
              borderRadius: 9, padding: '0 12px', height: 36,
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: '"Geist", -apple-system, sans-serif',
            }}
          >
            <Icon name="arrowDown" width={14} height={14} />
            Got paid?
          </button>
        )}

        {/* Add button */}
        <button
          onClick={onAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: '#a3e635',
            color: '#0d0d0d',
            border: 'none',
            borderRadius: 9,
            padding: '0 12px',
            height: 36,
            cursor: 'pointer',
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: '"Geist", -apple-system, sans-serif',
          }}
        >
          + Add
          <span
            style={{
              background: 'rgba(13,13,13,0.12)',
              borderRadius: 4,
              padding: '1px 5px',
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            ⌘N
          </span>
        </button>
      </div>
    </div>
  )
}
