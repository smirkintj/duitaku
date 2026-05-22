'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'

export interface NudgeItem {
  id: string
  step: number
  title: string
  body: string
  href: string
  actionLabel: string
}

const DISMISS_KEY = 'setup_nudge_dismissed_v1'

const S = {
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

export default function SetupNudge({ nudges, total }: { nudges: NudgeItem[]; total: number }) {
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === 'true') setDismissed(true)
  }, [])

  if (dismissed || nudges.length === 0) return null

  const done = total - nudges.length
  const pct = Math.round((done / total) * 100)
  const allDone = done === total

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, 'true')
    setDismissed(true)
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
            width: 7, height: 7, borderRadius: '50%',
            background: '#a3e635', boxShadow: '0 0 6px #a3e63580', flexShrink: 0,
          }} />
          <span style={{ ...S.mono, fontSize: 10, color: '#a3e635', letterSpacing: '0.08em' }}>GETTING STARTED</span>
          <span style={{ ...S.sans, fontSize: 12, color: '#5b5b59' }}>·</span>
          <span style={{ ...S.sans, fontSize: 12, color: '#5b5b59' }}>{done}/{total} complete</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#a3e635', borderRadius: 2, transition: 'width 400ms ease' }} />
          </div>
          <span style={{ ...S.mono, fontSize: 10, color: '#3a3a3a' }}>{pct}%</span>
          <button
            onClick={e => { e.stopPropagation(); dismiss() }}
            style={{ background: 'none', border: 'none', color: '#3a3a3a', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
            title="Dismiss"
          >×</button>
          <span style={{ color: '#3a3a3a', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div style={{ borderTop: '1px solid #1a1a1a' }}>
          {/* Intro text — only show if less than half done */}
          {done < Math.ceil(total / 2) && (
            <div style={{ padding: '12px 16px 0', borderBottom: 'none' }}>
              <p style={{ ...S.sans, fontSize: 12, color: '#5b5b59', margin: 0, lineHeight: 1.6 }}>
                Complete these steps to get the most out of your dashboard. Each one unlocks more accurate numbers.
              </p>
            </div>
          )}

          {nudges.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '14px 16px',
                borderTop: i > 0 || done < Math.ceil(total / 2) ? '1px solid #141414' : undefined,
              }}
            >
              {/* Step number */}
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: '#111', border: '1px solid #2a2a2a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}>
                <span style={{ ...S.mono, fontSize: 10, color: '#a3e635' }}>{n.step}</span>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...S.sans, fontSize: 13, fontWeight: 600, color: '#d4d4d0', marginBottom: 3 }}>{n.title}</div>
                <div style={{ ...S.sans, fontSize: 12, color: '#5b5b59', lineHeight: 1.5 }}>{n.body}</div>
              </div>

              <Link
                href={n.href}
                style={{
                  ...S.sans,
                  fontSize: 11, fontWeight: 600,
                  color: '#a3e635',
                  textDecoration: 'none',
                  border: '1px solid #1e2a14',
                  borderRadius: 7,
                  padding: '5px 12px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: 'rgba(163,230,53,0.06)',
                }}
              >
                {n.actionLabel} →
              </Link>
            </div>
          ))}

          {/* Footer hint */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #111' }}>
            <span style={{ ...S.sans, fontSize: 11, color: '#3a3a3a' }}>
              Each step improves the accuracy of your budget, buffer, and net worth numbers.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
