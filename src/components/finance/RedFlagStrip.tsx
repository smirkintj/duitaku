'use client'

import React from 'react'
import Link from 'next/link'
import { Icon } from './icons'

interface RedFlag {
  title: string
  metric: string
  detail: string
  tip: string
  tone?: 'danger' | 'warn'
  link?: string
}

interface RedFlagStripProps {
  flag: RedFlag
  onDismiss: () => void
}

export default function RedFlagStrip({ flag, onDismiss }: RedFlagStripProps) {
  const isWarn = flag.tone === 'warn'
  const c = isWarn
    ? { solid: '#fbbf24', border: 'rgba(251,191,36,0.28)', bg: 'rgba(251,191,36,0.10)', bgGrad: 'rgba(251,191,36,0.10)', faint: 'rgba(251,191,36,0.02)', label: '#fde68a', badge: 'rgba(251,191,36,0.4)' }
    : { solid: '#ef4444', border: 'rgba(239,68,68,0.28)', bg: 'rgba(239,68,68,0.10)', bgGrad: 'rgba(239,68,68,0.10)', faint: 'rgba(239,68,68,0.02)', label: '#fca5a5', badge: 'rgba(239,68,68,0.4)' }

  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${c.border}`,
        background: `linear-gradient(90deg, ${c.bgGrad}, ${c.faint} 60%, transparent)`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
      }}
    >
      {/* Left edge stripe */}
      <div
        style={{
          width: 6,
          flexShrink: 0,
          background: `repeating-linear-gradient(135deg, ${c.solid} 0 3px, transparent 3px 6px)`,
        }}
      />

      {/* Body */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 16px 14px 14px',
        }}
      >
        {/* Icon tile */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: c.bg,
            border: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: c.solid,
            flexShrink: 0,
          }}
        >
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span
              style={{
                fontSize: 9,
                fontFamily: '"JetBrains Mono", monospace',
                color: c.label,
                letterSpacing: '0.1em',
              }}
            >
              {isWarn ? 'BUDGET WARNING' : 'RED FLAG'}
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: c.solid,
                border: `1px solid ${c.badge}`,
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {flag.metric}
            </span>
          </div>
          <div
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: '#f5f5f4',
              fontFamily: '"Geist", -apple-system, sans-serif',
              marginBottom: 4,
            }}
          >
            {flag.title}
          </div>
          <div style={{ fontSize: 12.5, color: '#a0a09e', fontFamily: '"Geist", -apple-system, sans-serif', marginBottom: 3 }}>
            {flag.detail}
          </div>
          <div style={{ fontSize: 12, fontFamily: '"Geist", -apple-system, sans-serif' }}>
            <span style={{ color: '#a3e635' }}>Tip · </span>
            <span style={{ color: '#7a7a78' }}>{flag.tip}</span>
          </div>
        </div>

        {/* Investigate button */}
        {flag.link && (
          <Link
            href={flag.link}
            style={{
              background: 'transparent',
              border: `1px solid ${c.border}`,
              borderRadius: 8,
              color: c.solid,
              fontSize: 12,
              fontFamily: '"Geist", -apple-system, sans-serif',
              padding: '7px 14px',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Investigate →
          </Link>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#5b5b59',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 4,
          }}
        >
          <Icon name="close" width={14} height={14} />
        </button>
      </div>
    </div>
  )
}
