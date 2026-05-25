'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setTokenValid(false); setTokenError('No reset token found in URL.'); return }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(data => {
        setTokenValid(data.valid)
        if (!data.valid) setTokenError(data.error ?? 'Invalid link')
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Reset failed'); setLoading(false); return }
    setDone(true)
    setTimeout(() => router.push('/login'), 2500)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#a3e635', ...S.sans, letterSpacing: '-0.03em', marginBottom: 6 }}>duitaku</div>
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.mono, letterSpacing: '0.08em' }}>PERSONAL FINANCE</div>
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '28px 28px' }}>
          {tokenValid === null && (
            <div style={{ textAlign: 'center', color: '#5b5b59', fontSize: 13, ...S.sans }}>Validating link…</div>
          )}

          {tokenValid === false && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🔗</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f5f5f4', ...S.sans, margin: '0 0 12px' }}>Link invalid</h2>
              <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, lineHeight: 1.6, margin: '0 0 24px' }}>{tokenError}</p>
              <Link href="/forgot-password" style={{ fontSize: 13, color: '#a3e635', ...S.sans, textDecoration: 'none' }}>
                Request a new link
              </Link>
            </div>
          )}

          {done && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f5f5f4', ...S.sans, margin: '0 0 12px' }}>Password updated</h2>
              <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans }}>Redirecting to sign in…</p>
            </div>
          )}

          {tokenValid === true && !done && (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f4', ...S.sans, margin: '0 0 8px' }}>Set new password</h1>
              <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, lineHeight: 1.6, margin: '0 0 24px' }}>
                Choose a new password for your account.
              </p>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>NEW PASSWORD</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus style={S.input} />
                </div>
                <div>
                  <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>CONFIRM PASSWORD</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={S.input} />
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
                  {loading ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d0d0d' }} />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
