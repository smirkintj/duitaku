'use client'

import React, { useState, useEffect } from 'react'

interface Props {
  isNewUser?: boolean
  onboardingStep?: number // 0=done, 2=no accounts, 3=has accounts but no transactions
}

const STORAGE_KEY = 'duitaku_onboarded_v2'

const S = {
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8,
  color: '#f5f5f4', padding: '11px 14px', fontSize: 14,
  fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none',
  boxSizing: 'border-box', colorScheme: 'dark',
}

const primaryBtn: React.CSSProperties = {
  width: '100%', background: '#a3e635', color: '#0d0d0d', border: 'none',
  borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 700,
  fontFamily: '"Geist", -apple-system, sans-serif', cursor: 'pointer', marginTop: 4,
}

const skipBtn: React.CSSProperties = {
  fontSize: 12, color: '#5b5b59', cursor: 'pointer', background: 'none', border: 'none',
  display: 'block', textAlign: 'center', width: '100%', marginTop: 12,
  fontFamily: '"Geist", -apple-system, sans-serif', padding: 0,
}

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank account', desc: 'Savings or current account' },
  { value: 'cash', label: 'Cash / e-wallet', desc: 'Touch\'n\'Go, GrabPay, physical cash' },
  { value: 'credit', label: 'Credit card', desc: 'Track spending and statements' },
]

// Preset categories for quick budget setup
const BUDGET_PRESETS = [
  { name: 'Groceries', icon: 'bag', color: '#a3e635', defaultBudget: 500 },
  { name: 'Food & Drinks', icon: 'bowl', color: '#fbbf24', defaultBudget: 400 },
  { name: 'Transport', icon: 'car', color: '#60a5fa', defaultBudget: 200 },
  { name: 'Entertainment', icon: 'play', color: '#a78bfa', defaultBudget: 150 },
]

// Total steps shown in progress bar (Welcome + Account + Salary + Bill + Budget + Done)
const TOTAL_STEPS = 6

export default function OnboardingWizard({ isNewUser, onboardingStep = 0 }: Props) {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [fade, setFade] = useState(true)

  const startStep = onboardingStep === 3 ? 4 : 1
  const [step, setStep] = useState(startStep)

  // Account step state
  const [acctName, setAcctName] = useState('')
  const [acctType, setAcctType] = useState('bank')
  const [acctBalance, setAcctBalance] = useState('')
  const [savingAcct, setSavingAcct] = useState(false)
  const [acctError, setAcctError] = useState('')

  // Salary step state
  const [payDay, setPayDay] = useState('27')
  const [grossSalary, setGrossSalary] = useState('')
  const [savingSalary, setSavingSalary] = useState(false)

  // Bill step state
  const [billName, setBillName] = useState('')
  const [billAmount, setBillAmount] = useState('')
  const [savingBill, setSavingBill] = useState(false)

  // Budget step state — map preset name → monthly limit string
  const [budgets, setBudgets] = useState<Record<string, string>>(
    Object.fromEntries(BUDGET_PRESETS.map(p => [p.name, String(p.defaultBudget)]))
  )
  const [selectedBudgets, setSelectedBudgets] = useState<Set<string>>(new Set(BUDGET_PRESETS.map(p => p.name)))
  const [savingBudgets, setSavingBudgets] = useState(false)

  useEffect(() => {
    setMounted(true)
    const shouldShow = (onboardingStep === 2 || onboardingStep === 3 || isNewUser)
    if (shouldShow && typeof window !== 'undefined') {
      const done = localStorage.getItem(STORAGE_KEY)
      if (!done) setVisible(true)
    }
  }, [isNewUser, onboardingStep])

  useEffect(() => {
    if (onboardingStep === 3) setStep(4)
  }, [onboardingStep])

  if (!mounted || !visible) return null

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setVisible(false)
  }

  function goToStep(next: number) {
    setFade(false)
    setTimeout(() => { setStep(next); setFade(true) }, 180)
  }

  async function handleSaveAccount() {
    if (!acctName.trim()) { setAcctError('Give the account a name'); return }
    setSavingAcct(true)
    setAcctError('')
    try {
      await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: acctName.trim(), type: acctType, initialBalance: parseFloat(acctBalance) || 0 }),
      })
    } catch { /* continue */ }
    setSavingAcct(false)
    goToStep(3)
  }

  async function handleSaveSalary() {
    const gross = parseFloat(grossSalary)
    if (!grossSalary || isNaN(gross) || gross <= 0) { goToStep(4); return }
    setSavingSalary(true)
    try {
      await Promise.all([
        fetch('/api/salary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grossAmount: gross, currency: 'MYR' }),
        }),
        fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payDay: parseInt(payDay) }),
        }),
      ])
    } catch { /* continue */ }
    setSavingSalary(false)
    goToStep(4)
  }

  async function handleSaveBill() {
    const amt = parseFloat(billAmount)
    if (!billName || !billAmount || isNaN(amt) || amt <= 0) { goToStep(5); return }
    setSavingBill(true)
    try {
      await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: billName, amount: amt, dueDay: 1, icon: 'bolt', paymentMethod: 'direct_debit' }),
      })
    } catch { /* continue */ }
    setSavingBill(false)
    goToStep(5)
  }

  async function handleSaveBudgets() {
    if (selectedBudgets.size === 0) { goToStep(6); return }
    setSavingBudgets(true)
    try {
      const toCreate = BUDGET_PRESETS.filter(p => selectedBudgets.has(p.name))
      await Promise.all(toCreate.map(p => {
        const limit = parseFloat(budgets[p.name])
        return fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: p.name, icon: p.icon, color: p.color, type: 'expense', monthlyLimit: isNaN(limit) ? null : limit }),
        })
      }))
    } catch { /* continue */ }
    setSavingBudgets(false)
    goToStep(6)
  }

  function ProgressDots() {
    if (startStep === 4) return null
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const active = i + 1 === step
          const done = i + 1 < step
          return (
            <div key={i} style={{
              width: active ? 20 : 6, height: 6, borderRadius: 3,
              background: done ? '#a3e635' : active ? '#a3e635' : '#2a2a2a',
              transition: 'all 200ms ease',
              opacity: done ? 0.5 : 1,
            }} />
          )
        })}
      </div>
    )
  }

  function Header({ label }: { label: string }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <span style={{ ...S.mono, fontSize: 10, color: '#5b5b59', letterSpacing: '0.06em' }}>{label}</span>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5b5b59', fontSize: 20, lineHeight: 1, padding: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Close">×</button>
      </div>
    )
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div
        style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: '32px', maxWidth: 440, width: 'calc(100% - 48px)', boxSizing: 'border-box', opacity: fade ? 1 : 0, transition: 'opacity 180ms ease' }}
        onClick={e => e.stopPropagation()}
      >

        {/* Step 1 — Welcome */}
        {step === 1 && (
          <div>
            <Header label="WELCOME" />
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <span style={{ ...S.mono, fontSize: 24, fontWeight: 700, color: '#a3e635', lineHeight: 1 }}>d</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f4', ...S.sans, margin: '0 0 10px', letterSpacing: '-0.02em' }}>Welcome to duitaku.</h1>
            <p style={{ fontSize: 14, color: '#7a7a78', ...S.sans, margin: '0 0 28px', lineHeight: 1.6 }}>
              Let's get you set up in 4 quick steps — takes about 2 minutes.
            </p>
            <button style={primaryBtn} onClick={() => goToStep(2)}>Let's go →</button>
            <button style={skipBtn} onClick={dismiss}>Skip setup</button>
          </div>
        )}

        {/* Step 2 — Add account */}
        {step === 2 && (
          <div>
            <Header label="STEP 1 OF 4 — ACCOUNT" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Add your first account</h2>
            <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, margin: '0 0 22px', lineHeight: 1.6 }}>
              Where do you keep your money? This links transactions to a real account.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {ACCOUNT_TYPES.map(t => (
                <label key={t.value} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px', background: acctType === t.value ? 'rgba(163,230,53,0.06)' : 'transparent', border: `1px solid ${acctType === t.value ? 'rgba(163,230,53,0.3)' : '#2a2a2a'}`, borderRadius: 10, cursor: 'pointer' }}>
                  <input type="radio" name="acct-type" value={t.value} checked={acctType === t.value} onChange={() => setAcctType(t.value)} style={{ accentColor: '#a3e635', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>{t.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <input value={acctName} onChange={e => { setAcctName(e.target.value); setAcctError('') }} placeholder={acctType === 'bank' ? 'e.g. Maybank Savings' : acctType === 'credit' ? 'e.g. CIMB Visa' : 'e.g. Touch\'n\'Go'} style={{ ...inputStyle, marginBottom: 10 }} autoFocus />

            <div style={{ position: 'relative', marginBottom: 16 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#5b5b59', ...S.mono, pointerEvents: 'none' }}>RM</span>
              <input type="number" value={acctBalance} onChange={e => setAcctBalance(e.target.value)} placeholder="0.00" min={0} style={{ ...inputStyle, paddingLeft: 44 }} />
            </div>

            {acctError && <div style={{ fontSize: 12, color: '#ef4444', ...S.sans, marginBottom: 10 }}>{acctError}</div>}

            <button style={{ ...primaryBtn, background: savingAcct ? '#1a1a1a' : '#a3e635', color: savingAcct ? '#3a3a3a' : '#0d0d0d', cursor: savingAcct ? 'not-allowed' : 'pointer' }} onClick={handleSaveAccount} disabled={savingAcct}>
              {savingAcct ? 'Saving…' : 'Save & continue →'}
            </button>
            <button style={skipBtn} onClick={() => goToStep(3)}>Skip for now</button>
          </div>
        )}

        {/* Step 3 — Salary */}
        {step === 3 && (
          <div>
            <Header label="STEP 2 OF 4 — SALARY" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans, margin: '0 0 8px', letterSpacing: '-0.02em' }}>When do you get paid?</h2>
            <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, margin: '0 0 22px', lineHeight: 1.6 }}>
              This sets your monthly budget cycle. Your dashboard resets on pay day.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', marginBottom: 6 }}>PAY DAY (day of month)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[1, 5, 10, 15, 20, 25, 27, 28, 30].map(d => (
                    <button key={d} type="button" onClick={() => setPayDay(String(d))}
                      style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${payDay === String(d) ? '#a3e635' : '#2a2a2a'}`, background: payDay === String(d) ? 'rgba(163,230,53,0.08)' : 'transparent', color: payDay === String(d) ? '#a3e635' : '#7a7a78', cursor: 'pointer', fontSize: 13, fontFamily: '"JetBrains Mono", monospace' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', marginBottom: 6 }}>GROSS MONTHLY SALARY (RM, optional)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#5b5b59', ...S.mono, pointerEvents: 'none' }}>RM</span>
                  <input autoFocus type="number" min={0} value={grossSalary} onChange={e => setGrossSalary(e.target.value)} placeholder="e.g. 5000" style={{ ...inputStyle, paddingLeft: 44 }} onKeyDown={e => e.key === 'Enter' && handleSaveSalary()} />
                </div>
              </div>
            </div>
            <button style={{ ...primaryBtn, background: savingSalary ? '#1a1a1a' : '#a3e635', color: savingSalary ? '#3a3a3a' : '#0d0d0d', cursor: savingSalary ? 'not-allowed' : 'pointer' }} onClick={handleSaveSalary} disabled={savingSalary}>
              {savingSalary ? 'Saving…' : 'Save & continue →'}
            </button>
            <button style={skipBtn} onClick={() => goToStep(4)}>Skip for now</button>
          </div>
        )}

        {/* Step 4 — Bills */}
        {step === 4 && (
          <div>
            <Header label={startStep === 4 ? 'QUICK SETUP' : 'STEP 3 OF 4 — BILLS'} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
              {startStep === 4 ? 'One last thing — fixed bills?' : 'Any fixed monthly payments?'}
            </h2>
            <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, margin: '0 0 22px', lineHeight: 1.6 }}>
              Rent, subscriptions, phone plan — add one now. You can always add more later.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <input autoFocus type="text" value={billName} onChange={e => setBillName(e.target.value)} placeholder="e.g. Rent" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleSaveBill()} />
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#5b5b59', ...S.mono, pointerEvents: 'none' }}>RM</span>
                <input type="number" min={1} value={billAmount} onChange={e => setBillAmount(e.target.value)} placeholder="e.g. 1200" style={{ ...inputStyle, paddingLeft: 44 }} onKeyDown={e => e.key === 'Enter' && handleSaveBill()} />
              </div>
            </div>
            <button style={{ ...primaryBtn, background: savingBill ? '#1a1a1a' : '#a3e635', color: savingBill ? '#3a3a3a' : '#0d0d0d', cursor: savingBill ? 'not-allowed' : 'pointer' }} onClick={handleSaveBill} disabled={savingBill}>
              {savingBill ? 'Saving…' : 'Add bill & continue →'}
            </button>
            <button style={skipBtn} onClick={() => goToStep(5)}>Skip for now</button>
          </div>
        )}

        {/* Step 5 — Category Budgets */}
        {step === 5 && (
          <div>
            <Header label="STEP 4 OF 4 — SPENDING LIMITS" />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Set monthly spending limits</h2>
            <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, margin: '0 0 20px', lineHeight: 1.6 }}>
              Pick the categories you want to track and set a monthly budget. You&apos;ll see a progress bar on your dashboard when you&apos;re close to the limit.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {BUDGET_PRESETS.map(p => {
                const isOn = selectedBudgets.has(p.name)
                return (
                  <div
                    key={p.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: isOn ? 'rgba(163,230,53,0.04)' : 'transparent', border: `1px solid ${isOn ? 'rgba(163,230,53,0.2)' : '#2a2a2a'}`, borderRadius: 10 }}
                  >
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => {
                        const next = new Set(selectedBudgets)
                        if (next.has(p.name)) next.delete(p.name)
                        else next.add(p.name)
                        setSelectedBudgets(next)
                      }}
                      style={{ accentColor: '#a3e635', width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isOn ? '#f5f5f4' : '#5b5b59', ...S.sans }}>{p.name}</div>
                    </div>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#5b5b59', ...S.mono, pointerEvents: 'none' }}>RM</span>
                      <input
                        type="number"
                        min={0}
                        value={budgets[p.name]}
                        onChange={e => setBudgets(prev => ({ ...prev, [p.name]: e.target.value }))}
                        disabled={!isOn}
                        style={{ width: 90, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 7, padding: '6px 8px 6px 28px', fontSize: 13, color: isOn ? '#f5f5f4' : '#3a3a3a', ...S.mono, outline: 'none', colorScheme: 'dark', opacity: isOn ? 1 : 0.4 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <button
              style={{ ...primaryBtn, background: savingBudgets ? '#1a1a1a' : '#a3e635', color: savingBudgets ? '#3a3a3a' : '#0d0d0d', cursor: savingBudgets ? 'not-allowed' : 'pointer' }}
              onClick={handleSaveBudgets}
              disabled={savingBudgets}
            >
              {savingBudgets ? 'Saving…' : selectedBudgets.size > 0 ? `Save ${selectedBudgets.size} budget${selectedBudgets.size > 1 ? 's' : ''} →` : 'Skip →'}
            </button>
            <button style={skipBtn} onClick={() => goToStep(6)}>Skip for now</button>
          </div>
        )}

        {/* Step 6 — Done */}
        {step === 6 && (
          <div>
            <Header label="DONE" />
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a3e635" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f4', ...S.sans, margin: '0 0 10px', letterSpacing: '-0.02em' }}>You&apos;re all set.</h2>
            <p style={{ fontSize: 14, color: '#7a7a78', ...S.sans, margin: '0 0 24px', lineHeight: 1.6 }}>
              Log your first expense now to start tracking, import a bank statement, or go straight to the dashboard.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button style={primaryBtn} onClick={() => { dismiss(); window.dispatchEvent(new CustomEvent('open-add-modal')) }}>Log first expense →</button>
              <button style={{ width: '100%', background: 'transparent', color: '#a3e635', border: '1px solid rgba(163,230,53,0.3)', borderRadius: 9, padding: '12px 0', fontSize: 14, fontWeight: 600, ...S.sans, cursor: 'pointer' }} onClick={() => { dismiss(); window.location.href = '/import' }}>Import bank statement →</button>
              <button style={{ width: '100%', background: 'transparent', color: '#5b5b59', border: 'none', borderRadius: 9, padding: '8px 0', fontSize: 13, ...S.sans, cursor: 'pointer' }} onClick={dismiss}>Go to dashboard</button>
            </div>
          </div>
        )}

        <ProgressDots />
      </div>
    </div>
  )
}
