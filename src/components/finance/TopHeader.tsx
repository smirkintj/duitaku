'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import { BreathingDot } from './celestial'
import { formatRM } from '@/lib/finance-utils'

interface TopHeaderProps {
  remaining: number
  salary: number
  month: string // YYYY-MM
  onAdd?: () => void
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

export default function TopHeader({ remaining, month, onAdd }: TopHeaderProps) {
  const router = useRouter()
  const monthLabel = formatMonthLabel(month)

  const goToPrev = () => router.push(`/?m=${prevMonth(month)}`)
  const goToNext = () => router.push(`/?m=${nextMonth(month)}`)

  return (
    <div
      style={{
        height: 72,
        background: 'rgba(13,13,13,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
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
          DASHBOARD / {monthLabel}
        </span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            fontFamily: '"Geist", -apple-system, sans-serif',
            color: '#f5f5f4',
          }}
        >
          Good afternoon, Aiman.
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
            }}
          >
            {monthLabel}
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
                fontFamily: '"Geist", -apple-system, sans-serif',
                color: '#a3e635',
                letterSpacing: '-0.02em',
              }}
            >
              RM {formatRM(remaining)}
            </span>
          </div>
        </div>

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
