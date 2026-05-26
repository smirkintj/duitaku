'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import SalaryForm, { SalaryFormValues, SalaryFormDefaults } from '@/components/finance/SalaryForm'
import AccountsManager from '@/components/finance/AccountsManager'
import { formatRM } from '@/lib/finance-utils'
import { getPayCycle, getCurrentBaseMonth } from '@/lib/pay-cycle'

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const PREFS_KEY = 'duitaku_invest_prefs_v1'

interface InvestPrefs {
  setupDone: boolean
  showMarketPulse: boolean
  showWatchlist: boolean
  trackedTypes: string[]
  watchlist: string[]
}

const DEFAULT_PREFS: InvestPrefs = {
  setupDone: false,
  showMarketPulse: true,
  showWatchlist: false,
  trackedTypes: [],
  watchlist: [],
}

const TYPE_LABELS: Record<string, string> = {
  epf: 'EPF / KWSP',
  asb: 'ASB',
  tabung_haji: 'Tabung Haji',
  fixed_deposit: 'Fixed Deposit',
  gold: 'Gold',
  crypto: 'Crypto',
  stocks_bursa: 'Stocks — Bursa',
  stocks_us: 'Stocks — US',
  unit_trust: 'Unit Trust / Bonds / Other',
}

function loadInvestPrefs(): InvestPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function saveInvestPrefs(prefs: InvestPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: checked ? '#a3e635' : '#1a1a1a',
        border: `1px solid ${checked ? '#a3e635' : '#2a2a2a'}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 150ms, border-color 150ms',
        flexShrink: 0,
        outline: 'none',
        padding: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 20 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: checked ? '#0d0d0d' : '#5b5b59',
        transition: 'left 150ms, background 150ms',
      }} />
    </button>
  )
}

function UploadIcon() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1={12} y1={3} x2={12} y2={15} />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        style={{ opacity: 0.3 }} />
      <path d="M12 2v4" style={{ opacity: 1 }} />
    </svg>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#0d0d0d',
  border: '1px solid #222',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 13,
  color: '#f5f5f4',
  fontFamily: '"Geist", -apple-system, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}

// ─── Investment Preferences Card ───────────────────────────────────────────────
function InvestmentPrefsCard() {
  const [prefs, setPrefs] = useState<InvestPrefs>(DEFAULT_PREFS)
  const [mounted, setMounted] = useState(false)
  const [addTickerInput, setAddTickerInput] = useState('')
  const [showAddTicker, setShowAddTicker] = useState(false)

  useEffect(() => {
    setPrefs(loadInvestPrefs())
    setMounted(true)
  }, [])

  function updatePrefs(patch: Partial<InvestPrefs>) {
    const updated = { ...prefs, ...patch }
    setPrefs(updated)
    saveInvestPrefs(updated)
  }

  function addTicker() {
    const t = addTickerInput.trim()
    if (!t || prefs.watchlist.includes(t)) { setAddTickerInput(''); setShowAddTicker(false); return }
    updatePrefs({ watchlist: [...prefs.watchlist, t] })
    setAddTickerInput('')
    setShowAddTicker(false)
  }

  function removeTicker(t: string) {
    updatePrefs({ watchlist: prefs.watchlist.filter(x => x !== t) })
  }

  if (!mounted) return null

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 28px' }}>
      <div style={{ ...S.label, marginBottom: 18 }}>INVESTMENT VIEW</div>

      {/* Market Pulse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Market Pulse</div>
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.sans, marginTop: 2 }}>Show live market data on the investments page</div>
        </div>
        <Toggle checked={prefs.showMarketPulse} onChange={v => updatePrefs({ showMarketPulse: v })} />
      </div>

      <div style={{ borderTop: '1px solid #1a1a1a', marginBottom: 16 }} />

      {/* Watchlist toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Watchlist</div>
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.sans, marginTop: 2 }}>Show watchlist section on the investments page</div>
        </div>
        <Toggle checked={prefs.showWatchlist} onChange={v => updatePrefs({ showWatchlist: v })} />
      </div>

      <div style={{ borderTop: '1px solid #1a1a1a', marginBottom: 16 }} />

      {/* Tracked types */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ ...S.label }}>TRACKED ASSET TYPES</div>
          <a
            href="/investments"
            style={{ fontSize: 11, color: '#a3e635', textDecoration: 'none', ...S.sans, background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 6, padding: '3px 9px' }}
          >
            Edit in Investments →
          </a>
        </div>
        {prefs.trackedTypes.length === 0 ? (
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.sans }}>No types selected. Visit Investments to set up.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {prefs.trackedTypes.map(t => (
              <span key={t} style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#f5f5f4', background: '#1a1a1a', border: '1px solid #222', borderRadius: 5, padding: '3px 9px' }}>
                {TYPE_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #1a1a1a', marginBottom: 16 }} />

      {/* Watchlist tickers */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ ...S.label }}>WATCHLIST TICKERS</div>
          <button
            onClick={() => setShowAddTicker(v => !v)}
            style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#a3e635', background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', letterSpacing: '0.04em' }}
          >
            ＋ Add
          </button>
        </div>
        {showAddTicker && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              autoFocus
              value={addTickerInput}
              onChange={e => setAddTickerInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTicker(); if (e.key === 'Escape') { setShowAddTicker(false); setAddTickerInput('') } }}
              placeholder="e.g. AAPL, BTC-USD, 1155.KL"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addTicker} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', ...S.sans }}>Add</button>
            <button onClick={() => { setShowAddTicker(false); setAddTickerInput('') }} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#5b5b59', cursor: 'pointer', ...S.sans }}>✕</button>
          </div>
        )}
        {prefs.watchlist.length === 0 ? (
          <div style={{ fontSize: 12, color: '#5b5b59', ...S.sans }}>No tickers in watchlist.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {prefs.watchlist.map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#f5f5f4', background: '#1a1a1a', border: '1px solid #222', borderRadius: 5, padding: '3px 9px' }}>
                {t}
                <button onClick={() => removeTicker(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [current, setCurrent] = useState<{ amount: number; grossAmount?: number } | null>(null)
  const [defaults, setDefaults] = useState<SalaryFormDefaults | undefined>()
  const [fillKey, setFillKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [payDay, setPayDay] = useState<number>(1)
  const [payDayInput, setPayDayInput] = useState('1')
  const [payDaySaved, setPayDaySaved] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parseSuccess, setParseSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [deleteStep, setDeleteStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [logIncomePrompt, setLogIncomePrompt] = useState<{ amount: number } | null>(null)
  const [loggingIncome, setLoggingIncome] = useState(false)
  const [normalizing, setNormalizing] = useState(false)
  const [normalizeResult, setNormalizeResult] = useState<string | null>(null)

  async function handleNormalizeMerchants() {
    setNormalizing(true)
    setNormalizeResult(null)
    try {
      const res = await fetch('/api/admin/normalize-merchants', { method: 'POST' })
      const data = await res.json() as { cleared_unknown?: number; title_cased?: number; error?: string }
      if (data.error) { setNormalizeResult(`Error: ${data.error}`); return }
      setNormalizeResult(`Done — ${data.cleared_unknown} "Unknown" cleared, ${data.title_cased} merchants normalised`)
    } catch { setNormalizeResult('Request failed') } finally { setNormalizing(false) }
  }

  // Telegram state
  const [tgConnected, setTgConnected] = useState<boolean | null>(null)
  const [tgChatId, setTgChatId] = useState<string | undefined>()
  const [tgCode, setTgCode] = useState<string | null>(null)
  const [tgCodeCopied, setTgCodeCopied] = useState(false)
  const [tgGenerating, setTgGenerating] = useState(false)
  const [tgDisconnecting, setTgDisconnecting] = useState(false)
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null)

  async function handleDeleteAccount() {
    setDeleteStep('deleting')
    setDeleteError(null)
    const res = await fetch('/api/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePassword }),
    })
    if (res.ok) {
      window.location.href = '/login'
    } else {
      const data = await res.json()
      setDeleteError(data.error ?? 'Deletion failed')
      setDeleteStep('confirm')
    }
  }

  useEffect(() => {
    fetch('/api/telegram/status').then(r => r.json()).then((data: { connected: boolean; chatId?: string }) => {
      setTgConnected(data.connected)
      setTgChatId(data.chatId)
    }).catch(() => setTgConnected(false))
    fetch('/api/telegram/bot-info').then(r => r.json()).then((d: { username?: string }) => {
      if (d.username) setTgBotUsername(d.username)
    }).catch(() => {})
  }, [])

  async function handleTgGenerate() {
    setTgGenerating(true)
    setTgCode(null)
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await res.json() as { code: string }
      setTgCode(data.code)
    } finally {
      setTgGenerating(false)
    }
  }

  async function handleTgDisconnect() {
    setTgDisconnecting(true)
    try {
      await fetch('/api/telegram/link', { method: 'DELETE' })
      setTgConnected(false)
      setTgChatId(undefined)
      setTgCode(null)
    } finally {
      setTgDisconnecting(false)
    }
  }

  function handleTgCopy() {
    if (tgCode) {
      navigator.clipboard.writeText(`/start ${tgCode}`)
      setTgCodeCopied(true)
      setTimeout(() => setTgCodeCopied(false), 2000)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/salary').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([salaryData, settingsData]) => {
      if (salaryData) {
        setCurrent({ amount: salaryData.amount, grossAmount: salaryData.grossAmount })
        const today = new Date()
        const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
        setDefaults({
          grossAmount: salaryData.grossAmount ?? undefined,
          epfEmployee: salaryData.epfEmployee ?? undefined,
          socso: salaryData.socso ?? undefined,
          eis: salaryData.eis ?? undefined,
          pcb: salaryData.pcb ?? undefined,
          otherDeductions: salaryData.otherDeductions ?? undefined,
          effectiveFrom: firstOfMonth,
        })
        setFillKey(k => k + 1)
      }
      if (settingsData?.payDay) {
        setPayDay(settingsData.payDay)
        setPayDayInput(String(settingsData.payDay))
      }
      setLoading(false)
    })
  }, [])

  async function handlePayslipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setParsing(true)
    setParseError(null)
    setParseSuccess(false)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/salary/parse-payslip', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setParseError(data.error ?? 'Failed to parse payslip')
        return
      }
      const today = new Date()
      const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      setDefaults({
        grossAmount: data.grossAmount || undefined,
        epfEmployee: data.epfEmployee || undefined,
        socso: data.socso || undefined,
        eis: data.eis || undefined,
        pcb: data.pcb || undefined,
        otherDeductions: data.otherDeductions || undefined,
        effectiveFrom: firstOfMonth,
      })
      setFillKey(k => k + 1)
      setParseSuccess(true)
      setTimeout(() => setParseSuccess(false), 4000)
    } catch {
      setParseError('Network error — please try again')
    } finally {
      setParsing(false)
    }
  }

  async function handlePayDaySave() {
    const day = Math.min(31, Math.max(1, parseInt(payDayInput, 10) || 1))
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payDay: day }),
    })
    setPayDay(day)
    setPayDayInput(String(day))
    setPayDaySaved(true)
    setTimeout(() => setPayDaySaved(false), 2500)
  }

  async function handleSave(values: SalaryFormValues) {
    await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, currency: 'MYR' }),
    })
    setCurrent({ amount: values.amount, grossAmount: values.grossAmount })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    // Check if salary income has been logged this month
    const now = new Date()
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const res = await fetch(`/api/transactions?m=${monthStr}&type=income`)
    const txns = await res.json() as { type: string; merchant: string | null }[]
    const alreadyLogged = txns.some(t => t.type === 'income' && t.merchant === 'Salary')
    if (!alreadyLogged && values.amount > 0) {
      setLogIncomePrompt({ amount: values.amount })
    }
  }

  async function handleLogIncome(amount: number) {
    setLoggingIncome(true)
    const today = new Date().toISOString().slice(0, 10)
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, date: today, type: 'income', merchant: 'Salary', currency: 'MYR' }),
    })
    setLoggingIncome(false)
    setLogIncomePrompt(null)
  }

  const cardStyle: React.CSSProperties = {
    background: '#111',
    border: '1px solid #1a1a1a',
    borderRadius: 14,
    padding: '24px 28px',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>APP</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Settings</span>
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {saved && (
            <div style={{ padding: '12px 16px', background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 10 }}>
              <span style={{ fontSize: 13, color: '#a3e635', ...S.sans, fontWeight: 500 }}>Salary updated successfully.</span>
            </div>
          )}

          {logIncomePrompt && (
            <div style={{ padding: '16px 20px', background: '#111', border: '1px solid rgba(163,230,53,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans, marginBottom: 3 }}>Log this month&apos;s salary income?</div>
                <div style={{ fontSize: 12, color: '#7a7a78', ...S.sans }}>RM {logIncomePrompt.amount.toLocaleString('en-MY', { minimumFractionDigits: 2 })} will be added as income for today</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() => handleLogIncome(logIncomePrompt.amount)}
                  disabled={loggingIncome}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: loggingIncome ? 'not-allowed' : 'pointer', ...S.sans }}
                >
                  {loggingIncome ? 'Logging…' : 'Yes, log it'}
                </button>
                <button
                  onClick={() => setLogIncomePrompt(null)}
                  style={{ background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#7a7a78', cursor: 'pointer', ...S.sans }}
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* ── ROW 1: Salary summary + Pay cycle (short cards side by side) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Salary summary */}
            <div style={cardStyle}>
              <div style={{ ...S.label, marginBottom: 14 }}>SALARY</div>
              {loading ? (
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>Loading…</div>
              ) : current ? (
                <div style={{ display: 'flex', gap: 32 }}>
                  <div>
                    <div style={{ ...S.label, marginBottom: 5 }}>NET TAKE-HOME</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#a3e635', ...S.sans, letterSpacing: '-0.02em' }}>
                      RM {formatRM(current.amount)}
                    </div>
                  </div>
                  {current.grossAmount && (
                    <div>
                      <div style={{ ...S.label, marginBottom: 5 }}>GROSS</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: '#7a7a78', ...S.sans, letterSpacing: '-0.02em' }}>
                        RM {formatRM(current.grossAmount)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>No salary set yet.</div>
              )}
            </div>

            {/* Pay cycle */}
            {(() => {
              const previewDay = Math.min(31, Math.max(1, parseInt(payDayInput, 10) || 1))
              const now = new Date()
              const baseMonth = getCurrentBaseMonth(now, previewDay)
              const cycle = getPayCycle(baseMonth, previewDay)
              const isCalendarMonth = previewDay === 1
              return (
                <div style={cardStyle}>
                  <div style={{ ...S.label, marginBottom: 6 }}>PAY CYCLE</div>
                  <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, margin: '0 0 16px', lineHeight: 1.6 }}>
                    The day your salary arrives. All budget cycles and the dashboard period align to this date.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={S.label}>PAY DAY</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={payDayInput}
                        onChange={e => setPayDayInput(e.target.value)}
                        style={{ width: 80, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 8, color: '#f5f5f4', fontSize: 15, fontWeight: 600, padding: '8px 12px', fontFamily: '"JetBrains Mono", monospace', outline: 'none' }}
                      />
                    </div>
                    <button
                      onClick={handlePayDaySave}
                      style={{ marginTop: 22, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', ...S.sans }}
                    >
                      Save
                    </button>
                    {payDaySaved && (
                      <span style={{ marginTop: 22, fontSize: 13, color: '#a3e635', ...S.sans }}>Saved!</span>
                    )}
                  </div>

                  {/* Live cycle preview */}
                  <div style={{ padding: '12px 14px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a', letterSpacing: '0.08em', marginBottom: 8 }}>CURRENT CYCLE PREVIEW</div>
                    {isCalendarMonth ? (
                      <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans }}>
                        1 – {new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()} {now.toLocaleString('en-MY', { month: 'long', year: 'numeric' })}
                        <div style={{ fontSize: 11, color: '#3a3a3a', marginTop: 4 }}>Standard calendar month — change pay day to match your actual salary date</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#a3e635', ...S.sans }}>{cycle.label}</div>
                        <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 4 }}>{cycle.daysIn} days · dashboard and budget totals will use this range</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── ROW 2: Salary form (full width — it's complex) ── */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={S.label}>UPDATE SALARY</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {parseSuccess && (
                  <span style={{ fontSize: 12, color: '#a3e635', ...S.sans }}>Payslip extracted — review and save</span>
                )}
                {parseError && (
                  <span style={{ fontSize: 12, color: '#ef4444', ...S.sans }}>{parseError}</span>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={handlePayslipUpload}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsing || loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      background: parsing ? '#1a1a1a' : 'rgba(163,230,53,0.08)',
                      color: parsing ? '#3a3a3a' : '#a3e635',
                      border: `1px solid ${parsing ? '#222' : 'rgba(163,230,53,0.25)'}`,
                      borderRadius: 8,
                      padding: '7px 13px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: parsing ? 'not-allowed' : 'pointer',
                      ...S.sans,
                      transition: 'all 150ms',
                    }}
                  >
                    {parsing ? <SpinnerIcon /> : <UploadIcon />}
                    {parsing ? 'Reading payslip…' : 'Upload payslip PDF'}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="9" height="11" viewBox="0 0 9 11" fill="none"><rect x="0.5" y="4" width="8" height="6.5" rx="1.5" stroke="#3a3a3a" strokeWidth="1"/><path d="M2.5 4V3a2 2 0 0 1 4 0v1" stroke="#3a3a3a" strokeWidth="1" strokeLinecap="round"/></svg>
                    <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a', letterSpacing: '0.04em' }}>PDF never stored — only numbers are extracted</span>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>Loading…</div>
            ) : (
              <SalaryForm
                defaults={defaults}
                fillKey={fillKey}
                showEffectiveFrom
                submitLabel={current ? 'Update Salary' : 'Set Salary'}
                onSubmit={handleSave}
              />
            )}
            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.1)', borderRadius: 8 }}>
              <p style={{ fontSize: 12, color: '#5b5b59', ...S.sans, margin: 0, lineHeight: 1.6 }}>
                Salary history is preserved — each update adds a new entry. The most recent entry on or before the current month is used for budget calculations.
              </p>
            </div>
          </div>

          {/* ── ROW 3: Accounts + Telegram side by side ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
            <AccountsManager />

            {/* Connect Telegram */}
            <div style={cardStyle}>
              <div style={{ ...S.label, marginBottom: 14 }}>TELEGRAM BOT</div>

              {tgConnected === null ? (
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>Loading…</div>

              ) : tgConnected ? (
                /* ── Connected state ── */
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#a3e635', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#a3e635', ...S.sans, fontWeight: 600 }}>Connected</span>
                    {tgBotUsername && (
                      <a
                        href={`https://t.me/${tgBotUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', textDecoration: 'none' }}
                      >
                        @{tgBotUsername}
                      </a>
                    )}
                  </div>

                  {/* Command cheatsheet */}
                  <div style={{ marginBottom: 16 }}>
                    {([
                      { group: 'Log', items: ['spent RM45 at lunch', 'received RM500', 'topup RM100 to TnG', 'paid celcomdigi'] },
                      { group: 'Check', items: ['how much left', 'net worth', 'my investments', 'how much loan'] },
                      { group: 'History', items: ['last 5 transactions', 'when did i pay unifi'] },
                      { group: 'Market', items: ['gold', 'KLSE', 'BTC price'] },
                    ] as { group: string; items: string[] }[]).map(({ group, items }) => (
                      <div key={group} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a', letterSpacing: '0.08em', marginBottom: 5 }}>{group.toUpperCase()}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {items.map(cmd => (
                            <span key={cmd} style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#7a7a78' }}>"{cmd}"</span>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: '#3a3a3a', ...S.sans, marginTop: 4 }}>Send /help to the bot to see this list anytime.</div>
                  </div>

                  <button
                    onClick={handleTgDisconnect}
                    disabled={tgDisconnecting}
                    style={{ fontSize: 13, padding: '7px 16px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, color: tgDisconnecting ? '#5b5b59' : '#7a7a78', cursor: tgDisconnecting ? 'not-allowed' : 'pointer', ...S.sans }}
                  >
                    {tgDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>

              ) : (
                /* ── Not connected state ── */
                <div>
                  {/* Feature pills */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                    {['Log expenses', 'Check balance', 'Mark bills paid', 'Top up accounts', 'View investments', 'Net worth', 'Market prices', 'Payment history'].map(f => (
                      <span key={f} style={{ fontSize: 11, ...S.sans, color: '#7a7a78', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 20, padding: '3px 10px' }}>{f}</span>
                    ))}
                  </div>

                  {!tgCode ? (
                    <button
                      onClick={handleTgGenerate}
                      disabled={tgGenerating}
                      style={{ background: tgGenerating ? '#1a1a1a' : 'rgba(163,230,53,0.08)', color: tgGenerating ? '#3a3a3a' : '#a3e635', border: `1px solid ${tgGenerating ? '#222' : 'rgba(163,230,53,0.25)'}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: tgGenerating ? 'not-allowed' : 'pointer', ...S.sans }}
                    >
                      {tgGenerating ? 'Generating…' : 'Generate link code'}
                    </button>
                  ) : (
                    /* ── Setup steps ── */
                    <div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>

                        {/* Step 1 */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', flexShrink: 0 }}>1</span>
                          <div>
                            <div style={{ fontSize: 13, color: '#f5f5f4', ...S.sans, marginBottom: 4, fontWeight: 500 }}>Open the bot in Telegram</div>
                            {tgBotUsername ? (
                              <a
                                href={`https://t.me/${tgBotUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ display: 'inline-block', fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: '#a3e635', background: 'rgba(163,230,53,0.06)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}
                              >
                                @{tgBotUsername}
                              </a>
                            ) : (
                              <span style={{ fontSize: 12, color: '#5b5b59', ...S.sans }}>Search for your bot in Telegram</span>
                            )}
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', flexShrink: 0 }}>2</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: '#f5f5f4', ...S.sans, marginBottom: 8, fontWeight: 500 }}>Send this command to the bot</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 15, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: '#a3e635', letterSpacing: '0.12em', background: 'rgba(163,230,53,0.06)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 8, padding: '6px 14px', userSelect: 'all' as const }}>
                                /start {tgCode}
                              </span>
                              <button
                                onClick={handleTgCopy}
                                style={{ background: tgCodeCopied ? 'rgba(163,230,53,0.12)' : '#1a1a1a', color: tgCodeCopied ? '#a3e635' : '#7a7a78', border: `1px solid ${tgCodeCopied ? 'rgba(163,230,53,0.3)' : '#2a2a2a'}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...S.sans, transition: 'all 150ms' }}
                              >
                                {tgCodeCopied ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <div style={{ fontSize: 11, color: '#3a3a3a', ...S.sans, marginTop: 6 }}>Code expires in 15 minutes.</div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#1a1a1a', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', flexShrink: 0 }}>3</span>
                          <div style={{ fontSize: 13, color: '#f5f5f4', ...S.sans, fontWeight: 500, paddingTop: 2 }}>Done — the bot will confirm and show all commands</div>
                        </div>
                      </div>

                      <button
                        onClick={handleTgGenerate}
                        style={{ background: 'transparent', color: '#5b5b59', border: '1px solid #222', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', ...S.sans }}
                      >
                        Regenerate code
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── ROW 4: Investment Preferences ── */}
          <InvestmentPrefsCard />

          {/* ── ROW 5: Data Tools ── */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ ...S.label, marginBottom: 6 }}>DATA TOOLS</div>
            <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans, marginBottom: 16, lineHeight: 1.6 }}>
              Fix merchant names from older Telegram entries — removes "Unknown" labels and standardises capitalisation (e.g. "ryt" → "Ryt").
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleNormalizeMerchants}
                disabled={normalizing}
                style={{ fontSize: 13, padding: '8px 18px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, color: normalizing ? '#5b5b59' : '#e5e5e5', cursor: normalizing ? 'not-allowed' : 'pointer', ...S.sans }}
              >
                {normalizing ? 'Normalising…' : 'Fix merchant names'}
              </button>
              {normalizeResult && <span style={{ fontSize: 12, color: normalizeResult.startsWith('Error') ? '#ef4444' : '#a3e635', ...S.sans }}>{normalizeResult}</span>}
            </div>
          </div>

          {/* ── ROW 6: Danger Zone ── */}
          <div style={{ background: '#111', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ ...S.label, color: '#ef4444', marginBottom: 6 }}>DANGER ZONE</div>
            <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans, marginBottom: 20, lineHeight: 1.6 }}>
              Permanently deletes your account and all associated data — transactions, accounts, investments, salary history, everything. This cannot be undone.
            </div>
            {deleteStep === 'idle' && (
              <button
                onClick={() => setDeleteStep('confirm')}
                style={{ fontSize: 13, padding: '8px 18px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#ef4444', cursor: 'pointer', ...S.sans, fontWeight: 600 }}
              >
                Delete my account
              </button>
            )}
            {deleteStep === 'confirm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: '#ef4444', ...S.sans, fontWeight: 600 }}>
                  Enter your password to confirm deletion:
                </div>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => { setDeletePassword(e.target.value); setDeleteError(null) }}
                  placeholder="Your password"
                  autoFocus
                  style={{ width: 260, padding: '8px 12px', background: '#0d0d0d', border: `1px solid ${deleteError ? '#ef4444' : '#2a2a2a'}`, borderRadius: 8, color: '#e5e5e5', fontSize: 14, ...S.sans, outline: 'none' }}
                  onKeyDown={e => e.key === 'Enter' && deletePassword && handleDeleteAccount()}
                />
                {deleteError && <div style={{ fontSize: 12, color: '#ef4444', ...S.sans }}>{deleteError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={!deletePassword}
                    style={{ fontSize: 13, padding: '8px 18px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', cursor: deletePassword ? 'pointer' : 'not-allowed', opacity: deletePassword ? 1 : 0.5, ...S.sans, fontWeight: 600 }}
                  >
                    Yes, delete everything
                  </button>
                  <button
                    onClick={() => { setDeleteStep('idle'); setDeletePassword(''); setDeleteError(null) }}
                    style={{ fontSize: 13, padding: '8px 18px', background: 'transparent', border: '1px solid #2a2a2a', borderRadius: 8, color: '#7a7a78', cursor: 'pointer', ...S.sans }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {deleteStep === 'deleting' && (
              <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans }}>Deleting account…</div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
