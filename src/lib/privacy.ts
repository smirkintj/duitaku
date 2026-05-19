'use client'

import { useState, useEffect } from 'react'

export function usePrivacyMode(): [boolean, () => void] {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHidden(localStorage.getItem('duitaku_privacy') === '1')

    const handler = () => setHidden(localStorage.getItem('duitaku_privacy') === '1')
    window.addEventListener('privacy-toggle', handler)
    return () => window.removeEventListener('privacy-toggle', handler)
  }, [])

  const toggle = () => {
    const next = localStorage.getItem('duitaku_privacy') === '1' ? '0' : '1'
    localStorage.setItem('duitaku_privacy', next)
    window.dispatchEvent(new Event('privacy-toggle'))
  }

  return [hidden, toggle]
}
