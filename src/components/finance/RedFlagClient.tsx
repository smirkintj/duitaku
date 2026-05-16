'use client'

import React, { useState } from 'react'
import RedFlagStrip from './RedFlagStrip'
import type { RedFlag } from '@/lib/red-flags'

interface RedFlagClientProps {
  flags: RedFlag[]
}

export default function RedFlagClient({ flags }: RedFlagClientProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  const visible = flags.filter((_, i) => !dismissed.has(i))

  if (visible.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map((flag, i) => {
        const originalIndex = flags.indexOf(flag)
        return (
          <RedFlagStrip
            key={originalIndex}
            flag={flag}
            onDismiss={() => setDismissed((prev) => new Set([...prev, originalIndex]))}
          />
        )
      })}
    </div>
  )
}
