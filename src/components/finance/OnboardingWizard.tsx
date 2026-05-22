'use client'

import React, { useState, useEffect, useRef } from 'react'

interface Props {
  isNewUser?: boolean
}

const STORAGE_KEY = 'duitaku_onboarded_v1'
const TOTAL_STEPS = 4

function DLogo() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        borderRadius: 14,
        background: 'rgba(163,230,53,0.1)',
        border: '1px solid rgba(163,230,53,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
      }}
    >
      <span
        style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 28,
          fontWeight: 700,
          color: '#a3e635',
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        d
      </span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  color: '#f5f5f4',
  padding: '11px 14px',
  fontSize: 14,
  fontFamily: '"Geist", -apple-system, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  background: '#a3e635',
  color: '#0d0d0d',
  border: 'none',
  borderRadius: 9,
  padding: '12px 0',
  fontSize: 14,
  fontWeight: 700,
  fontFamily: '"Geist", -apple-system, sans-serif',
  cursor: 'pointer',
  marginTop: 4,
}

const skipStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#5b5b59',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  display: 'block',
  textAlign: 'center',
  width: '100%',
  marginTop: 12,
  fontFamily: '"Geist", -apple-system, sans-serif',
  textDecoration: 'none',
  padding: 0,
}

export default function OnboardingWizard({ isNewUser }: Props) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(1)
  const [mounted, setMounted] = useState(false)
  const [fade, setFade] = useState(true)

  // Step 2 state
  const [salaryInput, setSalaryInput] = useState('')
  const [savingSalary, setSavingSalary] = useState(false)

  // Step 3 state
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [savingBill, setSavingBill] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isNewUser && typeof window !== 'undefined') {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) {
        setVisible(true)
      }
    }
  }, [isNewUser])

  if (!mounted || !visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  function goToStep(next: number) {
    setFade(false)
    setTimeout(() => {
      setStep(next)
      setFade(true)
    }, 200)
  }

  async function handleSaveSalary() {
    const amount = parseFloat(salaryInput)
    if (!salaryInput || isNaN(amount) || amount <= 0) {
      goToStep(3)
      return
    }
    setSavingSalary(true)
    const today = new Date().toISOString().slice(0, 10)
    try {
      await fetch('/api/salary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, effectiveFrom: today }),
      })
    } catch {
      // continue anyway
    }
    setSavingSalary(false)
    goToStep(3)
  }

  async function handleSaveBill() {
    const amount = parseFloat(billAmount)
    if (!billName || !billAmount || isNaN(amount) || amount <= 0) {
      goToStep(4)
      return
    }
    setSavingBill(true)
    try {
      await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: billName,
          amount,
          dueDay: 1,
          icon: 'bolt',
          paymentMethod: 'direct_debit',
        }),
      })
    } catch {
      // continue anyway
    }
    setSavingBill(false)
    goToStep(4)
  }

  function ProgressDots() {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const active = i + 1 === step
          return (
            <div
              key={i}
              style={{
                width: active ? 8 : 6,
                height: active ? 8 : 6,
                borderRadius: '50%',
                background: active ? '#a3e635' : '#2a2a2a',
                transition: 'all 200ms ease',
              }}
            />
          )
        })}
      </div>
    )
  }

  function StepHeader() {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div style={{ width: 24 }} />
        <span
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            color: '#5b5b59',
            letterSpacing: '0.05em',
          }}
        >
          {step} of {TOTAL_STEPS}
        </span>
        <button
          onClick={dismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#5b5b59',
            fontSize: 18,
            lineHeight: 1,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      <div
        style={{
          background: '#111',
          border: '1px solid #1a1a1a',
          borderRadius: 20,
          padding: '36px 32px',
          maxWidth: 440,
          width: 'calc(100% - 48px)',
          boxSizing: 'border-box',
          opacity: fade ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 && (
          <div>
            <StepHeader />
            <DLogo />
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#f5f5f4',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 10px',
                letterSpacing: '-0.02em',
              }}
            >
              Welcome to duitaku.
            </h1>
            <p
              style={{
                fontSize: 14,
                color: '#7a7a78',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 28px',
                lineHeight: 1.6,
              }}
            >
              Your personal finance dashboard. Let&apos;s get you set up in 4 quick steps — takes about 2 minutes.
            </p>
            <button
              style={primaryBtnStyle}
              onClick={() => goToStep(2)}
            >
              Let&apos;s go →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepHeader />
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#f5f5f4',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
              }}
            >
              What&apos;s your monthly take-home?
            </h2>
            <p
              style={{
                fontSize: 14,
                color: '#7a7a78',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              This is your starting budget. Everything else is measured against it.
            </p>
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 13,
                  color: '#5b5b59',
                  fontFamily: '"JetBrains Mono", monospace',
                  pointerEvents: 'none',
                }}
              >
                RM
              </span>
              <input
                autoFocus
                type="number"
                min="1"
                step="0.01"
                value={salaryInput}
                onChange={(e) => setSalaryInput(e.target.value)}
                placeholder="e.g. 5000"
                style={{ ...inputStyle, paddingLeft: 44 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveSalary()
                }}
              />
            </div>
            <button
              style={{
                ...primaryBtnStyle,
                background: savingSalary ? '#1a1a1a' : '#a3e635',
                color: savingSalary ? '#3a3a3a' : '#0d0d0d',
                cursor: savingSalary ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSaveSalary}
              disabled={savingSalary}
            >
              {savingSalary ? 'Saving…' : 'Save & continue'}
            </button>
            <button style={skipStyle} onClick={() => goToStep(3)}>
              Skip for now
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <StepHeader />
            <h2
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#f5f5f4',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 8px',
                letterSpacing: '-0.02em',
              }}
            >
              Any fixed monthly payments?
            </h2>
            <p
              style={{
                fontSize: 14,
                color: '#7a7a78',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 24px',
                lineHeight: 1.6,
              }}
            >
              Rent, Netflix, phone plan — add one now to see how bills work. You can add more later.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <input
                autoFocus
                type="text"
                value={billName}
                onChange={(e) => setBillName(e.target.value)}
                placeholder="e.g. Rent"
                style={inputStyle}
              />
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 13,
                    color: '#5b5b59',
                    fontFamily: '"JetBrains Mono", monospace',
                    pointerEvents: 'none',
                  }}
                >
                  RM
                </span>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="e.g. 1200"
                  style={{ ...inputStyle, paddingLeft: 44 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveBill()
                  }}
                />
              </div>
            </div>
            <button
              style={{
                ...primaryBtnStyle,
                background: savingBill ? '#1a1a1a' : '#a3e635',
                color: savingBill ? '#3a3a3a' : '#0d0d0d',
                cursor: savingBill ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSaveBill}
              disabled={savingBill}
            >
              {savingBill ? 'Saving…' : 'Add bill & continue'}
            </button>
            <button style={skipStyle} onClick={() => goToStep(4)}>
              Skip for now
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <StepHeader />
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'rgba(163,230,53,0.1)',
                border: '1px solid rgba(163,230,53,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: '#f5f5f4',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 10px',
                letterSpacing: '-0.02em',
              }}
            >
              You&apos;re all set.
            </h2>
            <p
              style={{
                fontSize: 14,
                color: '#7a7a78',
                fontFamily: '"Geist", -apple-system, sans-serif',
                margin: '0 0 28px',
                lineHeight: 1.6,
              }}
            >
              Your dashboard is ready. Import a bank statement to see your spending automatically, or add transactions manually.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                style={primaryBtnStyle}
                onClick={() => {
                  dismiss()
                  window.location.href = '/import'
                }}
              >
                Import bank statement →
              </button>
              <button
                style={{
                  width: '100%',
                  background: 'transparent',
                  color: '#7a7a78',
                  border: '1px solid #2a2a2a',
                  borderRadius: 9,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: '"Geist", -apple-system, sans-serif',
                  cursor: 'pointer',
                }}
                onClick={dismiss}
              >
                Go to dashboard
              </button>
            </div>
          </div>
        )}

        <ProgressDots />
      </div>
    </div>
  )
}
