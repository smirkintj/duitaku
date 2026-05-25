'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const S = {
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  input: {
    width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8,
    color: '#f5f5f4', fontSize: 14, padding: '11px 14px',
    fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none',
    boxSizing: 'border-box', colorScheme: 'dark',
  } as React.CSSProperties,
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Login failed')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#a3e635', ...S.sans, letterSpacing: '-0.03em', marginBottom: 6 }}>duitaku</div>
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.mono, letterSpacing: '0.08em' }}>PERSONAL FINANCE</div>
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '28px 28px' }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f4', ...S.sans, margin: '0 0 24px' }}>Sign in</h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={S.input} />
            </div>
            <div>
              <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" style={S.input} />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: '#ef4444', ...S.sans, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ background: loading ? '#1a1a1a' : '#a3e635', color: loading ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', ...S.sans, marginTop: 4 }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Link href="/forgot-password" style={{ fontSize: 13, color: '#5b5b59', ...S.sans, textDecoration: 'none' }}>Forgot password?</Link>
            <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, margin: 0 }}>
              No account?{' '}
              <Link href="/register" style={{ color: '#a3e635', textDecoration: 'none', fontWeight: 500 }}>Create one</Link>
            </p>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#3a3a3a', ...S.sans, textAlign: 'center', margin: '16px 0 0' }}>
          <Link href="/privacy" style={{ color: '#3a3a3a', textDecoration: 'none' }}>Privacy notice</Link>
        </p>
      </div>
    </div>
  )
}
