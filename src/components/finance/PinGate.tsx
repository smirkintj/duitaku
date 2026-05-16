'use client'

import React, { useState, useEffect, useRef } from 'react'

const PIN = 'PTR9406'
const STORAGE_KEY = 'duitaku_auth'

export default function PinGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false)
  const [checked, setChecked] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'yes') setUnlocked(true)
    setChecked(true)
  }, [])

  useEffect(() => {
    if (checked && !unlocked) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [checked, unlocked])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (value === PIN) {
      localStorage.setItem(STORAGE_KEY, 'yes')
      setUnlocked(true)
    } else {
      setError(true)
      setShake(true)
      setValue('')
      setTimeout(() => setShake(false), 500)
      setTimeout(() => setError(false), 2000)
    }
  }

  if (!checked) return null
  if (unlocked) return <>{children}</>

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0d0d0d',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
        animation: shake ? 'shake 0.4s ease' : undefined,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 52, height: 52, background: '#a3e635', borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 24, color: '#0d0d0d',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            d
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
            duitaku<span style={{ color: '#a3e635' }}>.</span>
          </span>
        </div>

        {/* PIN form */}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.1em' }}>
            ENTER PIN
          </span>
          <input
            ref={inputRef}
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            maxLength={12}
            autoComplete="off"
            style={{
              background: '#111',
              border: `1px solid ${error ? '#ef4444' : '#222'}`,
              borderRadius: 10,
              padding: '12px 20px',
              fontSize: 20,
              letterSpacing: '0.25em',
              color: error ? '#ef4444' : '#f5f5f4',
              fontFamily: '"JetBrains Mono", monospace',
              outline: 'none',
              textAlign: 'center',
              width: 200,
              colorScheme: 'dark',
              transition: 'border-color 160ms, color 160ms',
            }}
          />
          {error && (
            <span style={{ fontSize: 11, color: '#ef4444', fontFamily: '"Geist", -apple-system, sans-serif' }}>
              Incorrect PIN
            </span>
          )}
          <button
            type="submit"
            disabled={!value}
            style={{
              background: value ? '#a3e635' : '#1a1a1a',
              color: value ? '#0d0d0d' : '#3a3a3a',
              border: 'none', borderRadius: 9,
              padding: '10px 32px',
              fontSize: 13, fontWeight: 700,
              fontFamily: '"Geist", -apple-system, sans-serif',
              cursor: value ? 'pointer' : 'not-allowed',
              transition: 'background 160ms, color 160ms',
            }}
          >
            Unlock
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
