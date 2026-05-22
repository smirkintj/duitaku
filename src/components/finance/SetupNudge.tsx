'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

export interface NudgeItem {
  id: string
  title: string
  body: string
  href: string
  actionLabel: string
}

const DISMISS_KEY = 'setup_nudge_dismissed_v1'

function CheckIcon({ done }: { done: boolean }) {
  return (
    <div style={{
      width: 20,
      height: 20,
      borderRadius: '50%',
      border: done ? 'none' : '1.5px solid #3a3a3a',
      background: done ? '#a3e635' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {done && (
        <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
          <path d="M1 4L4 7L10 1" stroke="#0d0d0d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

export default function SetupNudge({ nudges, total }: { nudges: NudgeItem[]; total: number }) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === 'true') setDismissed(true)
  }, [])

  if (dismissed || nudges.length === 0) return null

  const done = total - nudges.length

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
  }

  const S = {
    mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
    sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  }

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid #1e2a14',
      background: '#0d1208',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#a3e635',
            boxShadow: '0 0 6px #a3e63580',
            flexShrink: 0,
          }} />
          <span style={{ ...S.mono, fontSize: 10, color: '#a3e635', letterSpacing: '0.08em' }}>SETUP ASSISTANT</span>
          <span style={{ ...S.sans, fontSize: 12, color: '#5b5b59' }}>·</span>
          <span style={{ ...S.sans, fontSize: 12, color: '#5b5b59' }}>{done}/{total} complete</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress bar */}
          <div style={{ width: 64, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((done / total) * 100)}%`, background: '#a3e635', borderRadius: 2, transition: 'width 400ms ease' }} />
          </div>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            style={{ background: 'none', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
            title="Dismiss"
          >×</button>
          <span style={{ color: '#3a3a3a', fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Nudge items */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1a1a1a' }}>
          {nudges.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 16px',
                borderTop: i > 0 ? '1px solid #141414' : undefined,
              }}
            >
              <CheckIcon done={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...S.sans, fontSize: 13, fontWeight: 600, color: '#d4d4d0', marginBottom: 2 }}>{n.title}</div>
                <div style={{ ...S.sans, fontSize: 12, color: '#5b5b59', lineHeight: 1.4 }}>{n.body}</div>
              </div>
              <Link
                href={n.href}
                style={{
                  ...S.sans,
                  fontSize: 11,
                  color: '#a3e635',
                  textDecoration: 'none',
                  border: '1px solid #1e2a14',
                  borderRadius: 6,
                  padding: '4px 10px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: '#0d1208',
                  transition: 'border-color 200ms',
                }}
              >
                {n.actionLabel}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
