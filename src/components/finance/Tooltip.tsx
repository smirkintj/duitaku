'use client'

import React, { useState, useRef } from 'react'

interface TooltipProps {
  text: string
  width?: number  // px, default 220
}

export default function Tooltip({ text, width = 220 }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 15,
          height: 15,
          borderRadius: '50%',
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          color: '#5b5b59',
          fontSize: 9,
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 700,
          cursor: 'default',
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
        aria-label="More info"
      >
        ?
      </button>
      {open && (
        <span
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width,
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11,
            fontFamily: '"Geist", -apple-system, sans-serif',
            color: '#a0a09e',
            lineHeight: 1.5,
            zIndex: 50,
            pointerEvents: 'none',
            whiteSpace: 'normal',
          }}
        >
          {text}
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #2a2a2a',
            }}
          />
        </span>
      )}
    </span>
  )
}
