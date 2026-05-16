'use client'

import React from 'react'
import { Icon } from './icons'

interface RedFlag {
  title: string
  metric: string
  detail: string
  tip: string
}

interface RedFlagStripProps {
  flag: RedFlag
  onDismiss: () => void
}

export default function RedFlagStrip({ flag, onDismiss }: RedFlagStripProps) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(239,68,68,0.28)',
        background: 'linear-gradient(90deg, rgba(239,68,68,0.10), rgba(239,68,68,0.02) 60%, transparent)',
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
          background: 'repeating-linear-gradient(135deg, #ef4444 0 3px, transparent 3px 6px)',
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
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
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
                color: '#fca5a5',
                letterSpacing: '0.1em',
              }}
            >
              RED FLAG · #1
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.4)',
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
        <button
          style={{
            background: 'transparent',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            color: '#ef4444',
            fontSize: 12,
            fontFamily: '"Geist", -apple-system, sans-serif',
            padding: '7px 14px',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          Investigate →
        </button>

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
