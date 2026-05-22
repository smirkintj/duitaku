'use client'

import React, { useState, useRef, useEffect } from 'react'
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

export default function RegisterPage() {
  const router = useRouter()

  // Step 1
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Step 2
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [pendingId, setPendingId] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Registration failed')
      setLoading(false)
      return
    }
    setPendingId(data.pendingId)
    setStep('otp')
    setResendCooldown(60)
    setLoading(false)
    setTimeout(() => otpRefs.current[0]?.focus(), 100)
  }

  function handleOtpChange(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  function handleOtpKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setOtp(text.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingId, otp: code }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Verification failed')
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to resend')
    } else {
      setPendingId(data.pendingId)
      setOtp(['', '', '', '', '', ''])
      setResendCooldown(60)
      otpRefs.current[0]?.focus()
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#a3e635', ...S.sans, letterSpacing: '-0.03em', marginBottom: 6 }}>duitaku</div>
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.mono, letterSpacing: '0.08em' }}>PERSONAL FINANCE</div>
        </div>

        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '28px 28px' }}>
          {step === 'form' ? (
            <>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f4', ...S.sans, margin: '0 0 24px' }}>Create account</h1>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>YOUR NAME</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ahmad" autoComplete="name" style={S.input} />
                </div>
                <div>
                  <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>EMAIL</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={S.input} />
                </div>
                <div>
                  <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>PASSWORD</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={S.input} />
                  <div style={{ fontSize: 11, color: '#3a3a3a', ...S.sans, marginTop: 5 }}>Minimum 8 characters</div>
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
                  {loading ? 'Sending code…' : 'Continue'}
                </button>
              </form>

              <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, textAlign: 'center', margin: '20px 0 0' }}>
                Already have an account?{' '}
                <Link href="/login" style={{ color: '#a3e635', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('form'); setError(''); setOtp(['', '', '', '', '', '']) }}
                style={{ background: 'none', border: 'none', color: '#5b5b59', cursor: 'pointer', fontSize: 12, ...S.sans, padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                ← Back
              </button>
              <h1 style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f4', ...S.sans, margin: '0 0 8px' }}>Check your email</h1>
              <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, margin: '0 0 24px', lineHeight: 1.5 }}>
                We sent a 6-digit code to <span style={{ color: '#a1a1a0' }}>{email}</span>
              </p>

              <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <label style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.08em', display: 'block', marginBottom: 12 }}>VERIFICATION CODE</label>
                  <div style={{ display: 'flex', gap: 8 }} onPaste={handleOtpPaste}>
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpChange(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        style={{
                          width: 44, height: 52, textAlign: 'center', fontSize: 22, fontWeight: 700,
                          background: '#0d0d0d', border: `1px solid ${digit ? '#a3e635' : '#2a2a2a'}`,
                          borderRadius: 8, color: '#f5f5f4', outline: 'none',
                          fontFamily: '"JetBrains Mono", monospace', colorScheme: 'dark',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{ fontSize: 13, color: '#ef4444', ...S.sans, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.join('').length < 6}
                  style={{ background: (loading || otp.join('').length < 6) ? '#1a1a1a' : '#a3e635', color: (loading || otp.join('').length < 6) ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: (loading || otp.join('').length < 6) ? 'not-allowed' : 'pointer', ...S.sans }}
                >
                  {loading ? 'Verifying…' : 'Verify & create account'}
                </button>
              </form>

              <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, textAlign: 'center', margin: '20px 0 0' }}>
                {resendCooldown > 0
                  ? <span>Resend code in {resendCooldown}s</span>
                  : <button onClick={handleResend} style={{ background: 'none', border: 'none', color: '#a3e635', cursor: 'pointer', fontSize: 13, ...S.sans, padding: 0 }}>Resend code</button>
                }
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
