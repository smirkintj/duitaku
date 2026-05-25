'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'
import { fetchAssetInsight, investmentTypesToAssets, resolveAsset, signalEmoji, AssetInsight } from '@/lib/market-data'

interface Investment {
  id: string
  name: string
  type: string
  provider: string | null
  costBasis: number
  currentValue: number
  currency: string
  units: number | null
  ticker: string | null
  notes: string | null
  autoSync: boolean
  lastSyncedAt: string | null
  createdAt: string
}

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

const PREFS_KEY = 'duitaku_invest_prefs_v1'

function loadPrefs(): InvestPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function savePrefs(prefs: InvestPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const TYPE_COLORS: Record<string, string> = {
  epf: '#fbbf24',
  asb: '#34d399',
  versa: '#6366f1',
  crypto: '#f97316',
  unit_trust: '#8b5cf6',
  other: '#6b7280',
  stocks_bursa: '#06b6d4',
  stocks_us: '#3b82f6',
  fixed_deposit: '#10b981',
  gold: '#f59e0b',
  bonds: '#8b5cf6',
  tabung_haji: '#f97316',
  property: '#ec4899',
}

const TYPE_LABELS: Record<string, string> = {
  epf: 'EPF',
  asb: 'ASB',
  versa: 'VERSA',
  crypto: 'CRYPTO',
  unit_trust: 'UNIT TRUST',
  other: 'OTHER',
  stocks_bursa: 'BURSA STOCKS',
  stocks_us: 'US STOCKS',
  fixed_deposit: 'FIXED DEPOSIT',
  gold: 'GOLD',
  bonds: 'BONDS',
  tabung_haji: 'TABUNG HAJI',
  property: 'PROPERTY',
}

// Asset types that have live price feeds
const LIVE_TYPES = ['gold', 'crypto', 'stocks_bursa', 'stocks_us']

// All setup wizard types (regardless of what user holds)
const WIZARD_TYPES = [
  { value: 'epf', label: 'EPF / KWSP', hasLive: false, note: 'Updated manually, no live feed' },
  { value: 'asb', label: 'ASB', hasLive: false, note: 'Updated manually, no live feed' },
  { value: 'tabung_haji', label: 'Tabung Haji', hasLive: false, note: 'Updated manually, no live feed' },
  { value: 'fixed_deposit', label: 'Fixed Deposit', hasLive: false, note: 'Updated manually, no live feed' },
  { value: 'gold', label: 'Gold', hasLive: true, note: 'Live price available' },
  { value: 'crypto', label: 'Crypto', hasLive: true, note: 'Live price available' },
  { value: 'stocks_bursa', label: 'Stocks — Bursa', hasLive: true, note: 'Live price available' },
  { value: 'stocks_us', label: 'Stocks — US', hasLive: true, note: 'Live price available' },
  { value: 'unit_trust', label: 'Unit Trust / Bonds / Other', hasLive: false, note: 'No live feed' },
]

function fmtMYR(v: number) {
  return `RM ${Math.abs(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtDate(s: string | null) {
  if (!s) return 'Never'
  const d = new Date(s)
  return d.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' })
}

const inputStyle: React.CSSProperties = {
  width: '100%',
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

const labelStyle: React.CSSProperties = {
  ...S.label,
  marginBottom: 5,
  display: 'block',
}

const EMPTY_FORM = {
  name: '',
  type: 'other',
  provider: '',
  costBasis: '',
  currentValue: '',
  currency: 'MYR',
  units: '',
  ticker: '',
  notes: '',
}

const TYPE_OPTIONS = [
  { value: 'epf', label: 'EPF' },
  { value: 'asb', label: 'ASB' },
  { value: 'versa', label: 'Versa' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'unit_trust', label: 'Unit Trust' },
  { value: 'stocks_bursa', label: 'Bursa Stocks' },
  { value: 'stocks_us', label: 'US Stocks' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'gold', label: 'Gold' },
  { value: 'bonds', label: 'Bonds' },
  { value: 'tabung_haji', label: 'Tabung Haji' },
  { value: 'property', label: 'Property' },
  { value: 'other', label: 'Other' },
]

// ─── Signal badge ─────────────────────────────────────────────────────────────
function SignalBadge({ signal }: { signal: AssetInsight['signal'] }) {
  const colors: Record<string, { bg: string; text: string }> = {
    buy:     { bg: 'rgba(34,197,94,0.12)',  text: '#22c55e' },
    sell:    { bg: 'rgba(239,68,68,0.12)',  text: '#ef4444' },
    hold:    { bg: 'rgba(234,179,8,0.12)',  text: '#eab308' },
    neutral: { bg: 'rgba(156,163,175,0.12)', text: '#9ca3af' },
  }
  const c = colors[signal] ?? colors.neutral
  return (
    <span style={{
      fontSize: 10,
      fontFamily: '"JetBrains Mono", monospace',
      letterSpacing: '0.06em',
      background: c.bg,
      color: c.text,
      borderRadius: 5,
      padding: '2px 7px',
      fontWeight: 700,
    }}>
      {signalEmoji(signal)} {signal.toUpperCase()}
    </span>
  )
}

// ─── Asset insight card row ────────────────────────────────────────────────────
function AssetCard({ insight }: { insight: AssetInsight }) {
  const changeColor = insight.change30d >= 0 ? '#a3e635' : '#ef4444'
  const priceDisplay = insight.priceMYR != null
    ? `RM ${insight.priceMYR.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${insight.currency} ${insight.price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid #1a1a1a',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{insight.label}</span>
          <span style={{ fontSize: 10, color: '#5b5b59', ...S.mono }}>{insight.ticker}</span>
        </div>
        <div style={{ fontSize: 11, color: '#7a7a78', ...S.sans, lineHeight: 1.5 }}>{insight.signalReason}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f4', ...S.mono }}>{priceDisplay}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: changeColor, ...S.mono }}>{fmtPct(insight.change30d)} 30d</span>
        <SignalBadge signal={insight.signal} />
      </div>
    </div>
  )
}

// ─── Market Pulse section ──────────────────────────────────────────────────────
function MarketPulseSection({ prefs, investments }: { prefs: InvestPrefs; investments: Investment[] }) {
  const [insights, setInsights] = useState<AssetInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const hasLiveTypes = prefs.trackedTypes.some(t => LIVE_TYPES.includes(t))
  if (!prefs.showMarketPulse || !hasLiveTypes) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let cancelled = false
    async function fetch_() {
      setLoading(true)
      // Filter investments to only those matching tracked live types
      const filtered = investments.filter(inv => LIVE_TYPES.includes(inv.type) && prefs.trackedTypes.includes(inv.type))
      const assets = investmentTypesToAssets(filtered)

      // Also add watchlist tickers if showMarketPulse
      const watchlistAssets = prefs.watchlist.flatMap(ticker => {
        const resolved = resolveAsset(ticker)
        return resolved ? [resolved] : []
      })

      // Deduplicate
      const seen = new Set(assets.map(a => a.ticker))
      const allAssets = [...assets]
      for (const wa of watchlistAssets) {
        if (!seen.has(wa.ticker)) {
          seen.add(wa.ticker)
          allAssets.push(wa)
        }
      }

      const results = await Promise.all(
        allAssets.map(a => fetchAssetInsight(a.ticker, a.label, a.currency, a.isMYR))
      )
      if (!cancelled) {
        setInsights(results.filter((r): r is AssetInsight => r !== null))
        setLastUpdated(new Date())
        setLoading(false)
      }
    }
    fetch_()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.trackedTypes, prefs.watchlist, investments])

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ ...S.label }}>MARKET PULSE</div>
        {lastUpdated && !loading && (
          <span style={{ fontSize: 10, color: '#5b5b59', ...S.mono }}>Last updated: {fmtTime(lastUpdated)}</span>
        )}
      </div>
      {loading ? (
        <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, padding: '12px 0' }}>⏳ Loading market data…</div>
      ) : insights.length === 0 ? (
        <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, padding: '12px 0' }}>No market data available for tracked types.</div>
      ) : (
        <div>
          {insights.map(ins => <AssetCard key={ins.ticker} insight={ins} />)}
        </div>
      )}
    </div>
  )
}

// ─── Watchlist section ─────────────────────────────────────────────────────────
function WatchlistSection({ prefs, onPrefsChange }: { prefs: InvestPrefs; onPrefsChange: (p: InvestPrefs) => void }) {
  const [insights, setInsights] = useState<AssetInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [addInput, setAddInput] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)

  if (!prefs.showWatchlist || prefs.watchlist.length === 0) return null

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let cancelled = false
    async function fetch_() {
      setLoading(true)
      const results = await Promise.all(
        prefs.watchlist.map(async (ticker) => {
          const resolved = resolveAsset(ticker)
          if (!resolved) return null
          return fetchAssetInsight(resolved.ticker, resolved.label, resolved.currency, resolved.isMYR)
        })
      )
      if (!cancelled) {
        setInsights(results.filter((r): r is AssetInsight => r !== null))
        setLastUpdated(new Date())
        setLoading(false)
      }
    }
    fetch_()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.watchlist])

  function addTicker() {
    const t = addInput.trim()
    if (!t || prefs.watchlist.includes(t)) { setAddInput(''); setShowAddInput(false); return }
    const updated = { ...prefs, watchlist: [...prefs.watchlist, t] }
    onPrefsChange(updated)
    savePrefs(updated)
    setAddInput('')
    setShowAddInput(false)
  }

  function removeTicker(ticker: string) {
    const updated = { ...prefs, watchlist: prefs.watchlist.filter(t => t !== ticker) }
    onPrefsChange(updated)
    savePrefs(updated)
  }

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ ...S.label }}>WATCHLIST</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && !loading && (
            <span style={{ fontSize: 10, color: '#5b5b59', ...S.mono }}>Last updated: {fmtTime(lastUpdated)}</span>
          )}
          <button
            onClick={() => setShowAddInput(v => !v)}
            style={{ fontSize: 11, ...S.mono, color: '#a3e635', background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 6, padding: '3px 9px', cursor: 'pointer', letterSpacing: '0.04em' }}
          >
            ＋ Add
          </button>
        </div>
      </div>
      {showAddInput && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            autoFocus
            value={addInput}
            onChange={e => setAddInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTicker(); if (e.key === 'Escape') { setShowAddInput(false); setAddInput('') } }}
            placeholder="e.g. AAPL, BTC-USD, 1155.KL"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addTicker} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer', ...S.sans }}>Add</button>
          <button onClick={() => { setShowAddInput(false); setAddInput('') }} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#5b5b59', cursor: 'pointer', ...S.sans }}>✕</button>
        </div>
      )}
      {/* Ticker pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {prefs.watchlist.map(t => (
          <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, ...S.mono, color: '#f5f5f4', background: '#1a1a1a', border: '1px solid #222', borderRadius: 5, padding: '3px 8px' }}>
            {t}
            <button onClick={() => removeTicker(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 0, lineHeight: 1, fontSize: 11 }}>×</button>
          </span>
        ))}
      </div>
      {loading ? (
        <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, padding: '12px 0' }}>⏳ Loading watchlist data…</div>
      ) : insights.length === 0 ? (
        <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, padding: '12px 0' }}>No data available for watchlist tickers.</div>
      ) : (
        <div>
          {insights.map(ins => <AssetCard key={ins.ticker} insight={ins} />)}
        </div>
      )}
    </div>
  )
}

// ─── Setup wizard modal ────────────────────────────────────────────────────────
function SetupWizard({
  investments,
  initialPrefs,
  isUpdate,
  onDone,
  onClose,
}: {
  investments: Investment[]
  initialPrefs: InvestPrefs
  isUpdate: boolean
  onDone: (prefs: InvestPrefs) => void
  onClose: () => void
}) {
  const [step, setStep] = useState(1)
  const [checkedTypes, setCheckedTypes] = useState<string[]>(initialPrefs.trackedTypes)
  const [watchlist, setWatchlist] = useState<string[]>(initialPrefs.watchlist)
  const [tickerInput, setTickerInput] = useState('')

  // Portfolio types the user already holds
  const portfolioTypes = Array.from(new Set(investments.map(i => i.type)))

  function toggleType(val: string) {
    setCheckedTypes(prev => prev.includes(val) ? prev.filter(t => t !== val) : [...prev, val])
  }

  function addTicker() {
    const t = tickerInput.trim()
    if (!t || watchlist.includes(t)) { setTickerInput(''); return }
    setWatchlist(prev => [...prev, t])
    setTickerInput('')
  }

  function removeTicker(t: string) {
    setWatchlist(prev => prev.filter(x => x !== t))
  }

  function handleDone() {
    const newPrefs: InvestPrefs = {
      setupDone: true,
      showMarketPulse: initialPrefs.showMarketPulse,
      showWatchlist: watchlist.length > 0,
      trackedTypes: checkedTypes,
      watchlist,
    }
    savePrefs(newPrefs)
    onDone(newPrefs)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 18, padding: 32, width: 520, maxWidth: '94vw', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 6 }}>STEP {step} OF 3</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f4', ...S.sans }}>
              {isUpdate ? 'Update your view' : 'Set up your view'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>

        {/* Step 1 — What do you hold? */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans, marginBottom: 6 }}>What do you hold?</div>
            <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans, marginBottom: 20, lineHeight: 1.6 }}>
              Select asset types to track market data for. We&#39;ll show live prices for supported types.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {WIZARD_TYPES.map(wt => {
                const isInPortfolio = portfolioTypes.includes(wt.value)
                const checked = checkedTypes.includes(wt.value)
                return (
                  <label key={wt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '10px 14px', background: checked ? 'rgba(163,230,53,0.06)' : '#0d0d0d', border: `1px solid ${checked ? 'rgba(163,230,53,0.25)' : '#1a1a1a'}`, borderRadius: 10, userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleType(wt.value)}
                      style={{ marginTop: 2, accentColor: '#a3e635', width: 15, height: 15, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{wt.label}</span>
                        {isInPortfolio && (
                          <span style={{ fontSize: 9, ...S.mono, letterSpacing: '0.06em', color: '#a3e635', background: 'rgba(163,230,53,0.1)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 4, padding: '1px 5px' }}>IN PORTFOLIO</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: wt.hasLive ? '#a3e635' : '#5b5b59', ...S.sans, marginTop: 2 }}>{wt.note}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setStep(2)} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...S.sans }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Watchlist */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans, marginBottom: 6 }}>Want a watchlist?</div>
            <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans, marginBottom: 20, lineHeight: 1.6 }}>
              Track assets you&#39;re considering buying. Add tickers like <span style={{ color: '#f5f5f4', ...S.mono }}>1155</span>, <span style={{ color: '#f5f5f4', ...S.mono }}>BTC-USD</span>, or <span style={{ color: '#f5f5f4', ...S.mono }}>AAPL</span>.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTicker() }}
                placeholder="e.g. AAPL, BTC-USD, 1155.KL"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addTicker} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...S.sans, flexShrink: 0 }}>Add</button>
            </div>
            {watchlist.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {watchlist.map(t => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, ...S.mono, color: '#f5f5f4', background: '#1a1a1a', border: '1px solid #222', borderRadius: 5, padding: '4px 10px' }}>
                    {t}
                    <button onClick={() => removeTicker(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 0, lineHeight: 1, fontSize: 12 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 9, padding: '10px 18px', fontSize: 13, color: '#7a7a78', cursor: 'pointer', ...S.sans }}>← Back</button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setWatchlist([]); setStep(3) }} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 9, padding: '10px 18px', fontSize: 13, color: '#7a7a78', cursor: 'pointer', ...S.sans }}>Skip</button>
                <button onClick={() => setStep(3)} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...S.sans }}>Next →</button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f4', ...S.sans, marginBottom: 8 }}>Your view is set up.</div>
            <div style={{ fontSize: 13, color: '#7a7a78', ...S.sans, marginBottom: 8, lineHeight: 1.6 }}>
              Tracking <strong style={{ color: '#a3e635' }}>{checkedTypes.length}</strong> asset type{checkedTypes.length !== 1 ? 's' : ''}
              {watchlist.length > 0 && <>, watching <strong style={{ color: '#a3e635' }}>{watchlist.length}</strong> ticker{watchlist.length !== 1 ? 's' : ''}</>}.
            </div>
            <div style={{ marginTop: 28 }}>
              <button onClick={handleDone} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '12px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer', ...S.sans }}>Go to portfolio</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncWarnings, setSyncWarnings] = useState<string[]>([])

  // Prefs
  const [prefs, setPrefs] = useState<InvestPrefs>(DEFAULT_PREFS)
  const [showWizard, setShowWizard] = useState(false)
  const [isUpdateWizard, setIsUpdateWizard] = useState(false)
  const prefsLoaded = useRef(false)

  // Credential check
  const [kucoinConfigured, setKucoinConfigured] = useState(false)

  // EPF import state
  const [epfParsing, setEpfParsing] = useState(false)
  const [epfResult, setEpfResult] = useState<{ account1Balance: number; account2Balance: number; account3Balance: number; totalBalance: number; asOf: string; memberName: string | null; annualDividendRate: number | null } | null>(null)
  const [epfError, setEpfError] = useState<string | null>(null)
  const epfFileRef = React.useRef<HTMLInputElement>(null)

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null)
  const [showKucoinConfig, setShowKucoinConfig] = useState(false)

  // Form states
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // KuCoin credentials form
  const [kcApiKey, setKcApiKey] = useState('')
  const [kcApiSecret, setKcApiSecret] = useState('')
  const [kcApiPassphrase, setKcApiPassphrase] = useState('')
  const [kcSaving, setKcSaving] = useState(false)

  // Quick inline value update
  const [quickEditId, setQuickEditId] = useState<string | null>(null)
  const [quickEditValue, setQuickEditValue] = useState('')
  const [quickEditSaving, setQuickEditSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/investments')
    setInvestments(await res.json())
    setLoading(false)
  }, [])

  const checkKucoin = useCallback(async () => {
    const res = await fetch('/api/investments/kucoin/credentials')
    const data = await res.json()
    setKucoinConfigured(data.configured)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { checkKucoin() }, [checkKucoin])

  // Load prefs from localStorage once mounted
  useEffect(() => {
    if (prefsLoaded.current) return
    prefsLoaded.current = true
    const p = loadPrefs()
    setPrefs(p)
    if (!p.setupDone) {
      setIsUpdateWizard(false)
      setShowWizard(true)
    }
  }, [])

  async function handleEpfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setEpfParsing(true)
    setEpfError(null)
    setEpfResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/investments/epf-import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setEpfError(data.error ?? 'Failed to parse EPF statement'); return }
      setEpfResult(data)
    } catch { setEpfError('Network error') }
    finally { setEpfParsing(false) }
  }

  async function applyEpfResult() {
    if (!epfResult) return
    const epfInvestments = investments.filter(i => i.type === 'epf')
    if (epfInvestments.length === 1) {
      await fetch(`/api/investments/${epfInvestments[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentValue: epfResult.totalBalance }),
      })
    } else if (epfInvestments.length === 0) {
      await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'EPF / KWSP',
          type: 'epf',
          provider: 'KWSP',
          costBasis: epfResult.totalBalance,
          currentValue: epfResult.totalBalance,
          currency: 'MYR',
          notes: epfResult.memberName ? `Member: ${epfResult.memberName}` : undefined,
        }),
      })
    }
    setEpfResult(null)
    await load()
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.type) return
    setSaving(true)
    await fetch('/api/investments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        type: form.type,
        provider: form.provider.trim() || undefined,
        costBasis: parseFloat(form.costBasis) || 0,
        currentValue: parseFloat(form.currentValue) || 0,
        currency: form.currency || 'MYR',
        units: form.units ? parseFloat(form.units) : undefined,
        ticker: form.ticker.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    })
    setForm(EMPTY_FORM)
    setShowAdd(false)
    setSaving(false)
    await load()
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingInvestment) return
    setSaving(true)
    await fetch(`/api/investments/${editingInvestment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingInvestment.name,
        type: editingInvestment.type,
        provider: editingInvestment.provider ?? undefined,
        costBasis: editingInvestment.costBasis,
        currentValue: editingInvestment.currentValue,
        currency: editingInvestment.currency,
        units: editingInvestment.units ?? undefined,
        ticker: editingInvestment.ticker ?? undefined,
        notes: editingInvestment.notes ?? undefined,
      }),
    })
    setEditingInvestment(null)
    setSaving(false)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this investment?')) return
    await fetch(`/api/investments/${id}`, { method: 'DELETE' })
    await load()
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncWarnings([])
    const res = await fetch('/api/investments/kucoin/sync', { method: 'POST' })
    const data = await res.json()
    if (data.error) {
      setSyncResult(`Error: ${data.error}`)
    } else {
      setSyncResult(`Synced ${data.synced} holding${data.synced !== 1 ? 's' : ''}`)
      setSyncWarnings(data.warnings ?? [])
      await load()
    }
    setSyncing(false)
  }

  async function handleSaveKucoin(e: React.FormEvent) {
    e.preventDefault()
    if (!kcApiKey.trim() || !kcApiSecret.trim() || !kcApiPassphrase.trim()) return
    setKcSaving(true)
    await fetch('/api/investments/kucoin/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: kcApiKey.trim(), apiSecret: kcApiSecret.trim(), apiPassphrase: kcApiPassphrase.trim() }),
    })
    setKcSaving(false)
    setShowKucoinConfig(false)
    setKcApiKey(''); setKcApiSecret(''); setKcApiPassphrase('')
    await checkKucoin()
  }

  function openQuickEdit(inv: Investment) {
    setQuickEditId(inv.id)
    setQuickEditValue(String(inv.currentValue))
  }

  function closeQuickEdit() {
    setQuickEditId(null)
    setQuickEditValue('')
  }

  async function handleQuickEditSave(id: string) {
    const val = Number(quickEditValue)
    if (isNaN(val)) return
    setQuickEditSaving(true)
    await fetch(`/api/investments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentValue: val }),
    })
    setQuickEditSaving(false)
    closeQuickEdit()
    await load()
  }

  const totalCostBasis = investments.reduce((a, b) => a + b.costBasis, 0)
  const totalCurrentValue = investments.reduce((a, b) => a + b.currentValue, 0)
  const totalReturn = totalCurrentValue - totalCostBasis
  const totalReturnPct = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0

  const lastSynced = investments
    .filter(i => i.autoSync && i.lastSyncedAt)
    .sort((a, b) => new Date(b.lastSyncedAt!).getTime() - new Date(a.lastSyncedAt!).getTime())[0]?.lastSyncedAt ?? null

  const allocationByType: Record<string, number> = {}
  for (const inv of investments) {
    allocationByType[inv.type] = (allocationByType[inv.type] ?? 0) + inv.currentValue
  }
  const allocationTypes = Object.keys(allocationByType).filter(t => allocationByType[t] > 0)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#0d0d0d' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>PORTFOLIO</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Investments</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => { setIsUpdateWizard(true); setShowWizard(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#7a7a78', border: '1px solid #222', borderRadius: 9, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13, fontWeight: 500, ...S.sans }}
            >
              ⚙ Customise
            </button>
            <button
              onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 16px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}
            >
              + Add
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 32px 48px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'TOTAL INVESTED', value: fmtMYR(totalCostBasis), color: '#f5f5f4' },
              { label: 'CURRENT VALUE', value: fmtMYR(totalCurrentValue), color: '#f5f5f4' },
              {
                label: 'TOTAL RETURN',
                value: `${totalReturn >= 0 ? '+' : '-'}${fmtMYR(totalReturn)} (${fmtPct(totalReturnPct)})`,
                color: totalReturn >= 0 ? '#a3e635' : '#ef4444',
              },
            ].map(s => (
              <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em', wordBreak: 'break-all' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Market Pulse */}
          {!loading && <MarketPulseSection prefs={prefs} investments={investments} />}

          {/* Watchlist */}
          {!loading && <WatchlistSection prefs={prefs} onPrefsChange={setPrefs} />}

          {/* KuCoin sync section */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', ...S.mono }}>KC</span>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>KuCoin</div>
                  <div style={{ ...S.label, marginTop: 2 }}>
                    {kucoinConfigured ? (
                      <>LAST SYNCED: {lastSynced ? fmtDate(lastSynced).toUpperCase() : 'NEVER'}</>
                    ) : (
                      <>NOT CONFIGURED</>
                    )}
                  </div>
                </div>
                {syncResult && (
                  <span style={{ fontSize: 11, ...S.mono, color: syncResult.startsWith('Error') ? '#ef4444' : '#a3e635', letterSpacing: '0.06em' }}>
                    {syncResult.toUpperCase()}
                  </span>
                )}
                {syncWarnings.map((w, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#f97316', ...S.sans, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 6, padding: '6px 10px', marginTop: 4 }}>
                    {w}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setShowKucoinConfig(true)}
                  style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#7a7a78', ...S.sans }}
                >
                  Configure API Keys
                </button>
                {kucoinConfigured && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    style={{ background: syncing ? '#1a1a1a' : '#f97316', color: syncing ? '#5b5b59' : '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', cursor: syncing ? 'default' : 'pointer', fontSize: 12, fontWeight: 600, ...S.sans, opacity: syncing ? 0.7 : 1 }}
                  >
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* EPF statement import */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ ...S.label, marginBottom: 4 }}>EPF / KWSP STATEMENT IMPORT</div>
                <p style={{ fontSize: 12, color: '#5b5b59', ...S.sans, margin: 0 }}>Upload your EPF statement PDF to sync Akaun 1, 2 & 3 balances automatically.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {epfError && <span style={{ fontSize: 12, color: '#ef4444', ...S.sans }}>{epfError}</span>}
                <input ref={epfFileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleEpfUpload} />
                <button
                  onClick={() => epfFileRef.current?.click()}
                  disabled={epfParsing}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, background: epfParsing ? '#1a1a1a' : 'rgba(245,158,11,0.1)', color: epfParsing ? '#3a3a3a' : '#f59e0b', border: `1px solid ${epfParsing ? '#222' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: epfParsing ? 'not-allowed' : 'pointer', ...S.sans }}
                >
                  {epfParsing ? 'Reading…' : 'Upload EPF PDF'}
                </button>
              </div>
            </div>
            {epfResult && (
              <div style={{ marginTop: 14, background: '#0d0d0d', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {[
                      { label: 'AKAUN 1', value: epfResult.account1Balance },
                      { label: 'AKAUN 2', value: epfResult.account2Balance },
                      ...(epfResult.account3Balance > 0 ? [{ label: 'AKAUN 3', value: epfResult.account3Balance }] : []),
                      { label: 'TOTAL', value: epfResult.totalBalance },
                    ].map(s => (
                      <div key={s.label}>
                        <div style={{ ...S.label, marginBottom: 4 }}>{s.label}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', ...S.mono }}>{fmtMYR(s.value)}</div>
                      </div>
                    ))}
                    {epfResult.annualDividendRate && (
                      <div>
                        <div style={{ ...S.label, marginBottom: 4 }}>DIVIDEND</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#a3e635', ...S.mono }}>{epfResult.annualDividendRate}%</div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#5b5b59', ...S.mono }}>as of {epfResult.asOf}</span>
                    <button
                      onClick={applyEpfResult}
                      style={{ background: '#f59e0b', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', ...S.sans }}>
                      Sync to portfolio
                    </button>
                    <button
                      onClick={() => setEpfResult(null)}
                      style={{ background: 'transparent', border: '1px solid #222', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#5b5b59', cursor: 'pointer', ...S.sans }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Investments grid */}
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', ...S.label }}>LOADING…</div>
          ) : investments.length === 0 ? (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 16, padding: '40px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#181818', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18, color: '#3a3a3a' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                    <polyline points="16 7 22 7 22 13"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#d0d0cf', ...S.sans, marginBottom: 8 }}>No investments tracked</div>
                <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, lineHeight: 1.6, marginBottom: 24 }}>
                  Add your EPF, ASB, unit trusts, or crypto holdings. The AI Coach will factor your portfolio into its analysis and show your overall net worth picture.
                </div>
                <button
                  onClick={() => setShowAdd(true)}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, ...S.sans, cursor: 'pointer' }}
                >
                  + Add investment
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Portfolio Summary Panel */}
              <div style={{
                background: '#111',
                border: '1px solid #1a1a1a',
                borderRadius: 14,
                padding: '20px 24px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 32,
                marginBottom: 16,
              }}>
                {/* Left — totals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <div style={{ ...S.label, marginBottom: 4 }}>TOTAL VALUE</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.03em' }}>
                      {fmtMYR(totalCurrentValue)}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom: 3 }}>TOTAL COST</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#7a7a78', ...S.sans }}>
                      {fmtMYR(totalCostBasis)}
                    </div>
                  </div>
                  <div>
                    <div style={{ ...S.label, marginBottom: 3 }}>OVERALL RETURN</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: totalReturn >= 0 ? '#a3e635' : '#ef4444', ...S.sans }}>
                        {totalReturn >= 0 ? '+' : '-'}{fmtMYR(totalReturn)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: totalReturn >= 0 ? '#a3e635' : '#ef4444', ...S.mono }}>
                        {fmtPct(totalReturnPct)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right — allocation bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ ...S.label }}>ALLOCATION BY TYPE</div>
                  {/* Stacked bar */}
                  <div style={{ height: 10, borderRadius: 6, overflow: 'hidden', display: 'flex', width: '100%', background: '#1a1a1a' }}>
                    {allocationTypes.map(t => {
                      const pct = totalCurrentValue > 0 ? (allocationByType[t] / totalCurrentValue) * 100 : 0
                      return (
                        <div
                          key={t}
                          title={`${TYPE_LABELS[t] ?? t}: ${pct.toFixed(1)}%`}
                          style={{
                            width: `${pct}%`,
                            background: TYPE_COLORS[t] ?? '#6b7280',
                            flexShrink: 0,
                          }}
                        />
                      )
                    })}
                  </div>
                  {/* Legend */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                    {allocationTypes.map(t => {
                      const pct = totalCurrentValue > 0 ? (allocationByType[t] / totalCurrentValue) * 100 : 0
                      return (
                        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: TYPE_COLORS[t] ?? '#6b7280',
                            flexShrink: 0,
                          }} />
                          <span style={{ fontSize: 10, ...S.mono, color: '#7a7a78', letterSpacing: '0.06em' }}>
                            {TYPE_LABELS[t] ?? t.toUpperCase()} {pct.toFixed(1)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Investment cards grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, alignItems: 'start' }}>
                {investments.map(inv => {
                  const gain = inv.currentValue - inv.costBasis
                  const gainPct = inv.costBasis > 0 ? (gain / inv.costBasis) * 100 : 0
                  const gainColor = gain >= 0 ? '#a3e635' : '#ef4444'
                  const typeColor = TYPE_COLORS[inv.type] ?? '#6b7280'
                  const typeLabel = TYPE_LABELS[inv.type] ?? inv.type.toUpperCase()
                  const isQuickEdit = quickEditId === inv.id

                  return (
                    <div key={inv.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: isQuickEdit ? '14px 14px 0 0' : 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Card header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                              <span style={{
                                fontSize: 9,
                                ...S.mono,
                                letterSpacing: '0.08em',
                                color: typeColor,
                                border: `1px solid ${typeColor}40`,
                                borderRadius: 4,
                                padding: '2px 6px',
                              }}>
                                {typeLabel}
                              </span>
                              {inv.autoSync && (
                                <span style={{
                                  fontSize: 9,
                                  ...S.mono,
                                  letterSpacing: '0.08em',
                                  color: '#f97316',
                                  border: '1px solid rgba(249,115,22,0.3)',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                }}>
                                  AUTO
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 15, fontWeight: 600, color: '#f5f5f4', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {inv.name}
                            </div>
                            {inv.provider && (
                              <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans, marginTop: 2 }}>{inv.provider}</div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {/* Quick value update button */}
                            <button
                              onClick={() => isQuickEdit ? closeQuickEdit() : openQuickEdit(inv)}
                              title="Quick update value"
                              style={{ background: isQuickEdit ? 'rgba(163,230,53,0.1)' : 'transparent', border: 'none', cursor: 'pointer', color: isQuickEdit ? '#a3e635' : '#3a3a3a', padding: 4, borderRadius: 6 }}
                              onMouseEnter={e => { if (!isQuickEdit) e.currentTarget.style.color = '#a3e635' }}
                              onMouseLeave={e => { if (!isQuickEdit) e.currentTarget.style.color = '#3a3a3a' }}
                            >
                              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                <path d="M15 6l3 3" />
                              </svg>
                            </button>
                            {!inv.autoSync && (
                              <button
                                onClick={() => setEditingInvestment({ ...inv })}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6 }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#a3e635' }}
                                onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                              >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(inv.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, borderRadius: 6 }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                            >
                              <Icon name="close" width={14} height={14} />
                            </button>
                          </div>
                        </div>

                        {/* Ticker + units (crypto) */}
                        {(inv.ticker || inv.units != null) && (
                          <div style={{ display: 'flex', gap: 12 }}>
                            {inv.ticker && (
                              <div>
                                <div style={{ ...S.label, marginBottom: 2 }}>TICKER</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.mono }}>{inv.ticker}</div>
                              </div>
                            )}
                            {inv.units != null && (
                              <div>
                                <div style={{ ...S.label, marginBottom: 2 }}>UNITS</div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.mono }}>
                                  {inv.units.toLocaleString('en-MY', { maximumSignificantDigits: 6 })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Values */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <div style={{ ...S.label, marginBottom: 3 }}>COST BASIS</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#7a7a78', ...S.sans }}>
                              {fmtMYR(inv.costBasis)}
                            </div>
                          </div>
                          <div>
                            <div style={{ ...S.label, marginBottom: 3 }}>CURRENT VALUE</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>
                              {fmtMYR(inv.currentValue)}
                            </div>
                          </div>
                        </div>

                        {/* Gain/loss */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid #1a1a1a' }}>
                          <div>
                            <div style={{ ...S.label, marginBottom: 3 }}>GAIN / LOSS</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: gainColor, ...S.sans, letterSpacing: '-0.02em' }}>
                              {gain >= 0 ? '+' : '-'}{fmtMYR(gain)}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ ...S.label, marginBottom: 3 }}>RETURN</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: gainColor, ...S.mono }}>
                              {fmtPct(gainPct)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick edit inline row */}
                      {isQuickEdit && (
                        <div style={{
                          background: '#0d0d0d',
                          border: '1px solid #1a1a1a',
                          borderTop: 'none',
                          borderRadius: '0 0 14px 14px',
                          padding: '10px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                        }}>
                          <span style={{ fontSize: 9, ...S.mono, letterSpacing: '0.08em', color: '#5b5b59', flexShrink: 0 }}>UPDATE CURRENT VALUE</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: '#7a7a78', ...S.mono, flexShrink: 0 }}>RM</span>
                            <input
                              type="number"
                              value={quickEditValue}
                              onChange={e => setQuickEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleQuickEditSave(inv.id)
                                if (e.key === 'Escape') closeQuickEdit()
                              }}
                              min="0"
                              step="0.01"
                              autoFocus
                              style={{
                                width: 160,
                                background: '#111',
                                border: '1px solid #222',
                                borderRadius: 6,
                                padding: '6px 10px',
                                fontSize: 12,
                                color: '#f5f5f4',
                                fontFamily: '"JetBrains Mono", monospace',
                                outline: 'none',
                                colorScheme: 'dark',
                              }}
                            />
                          </div>
                          <button
                            onClick={() => handleQuickEditSave(inv.id)}
                            disabled={quickEditSaving}
                            style={{
                              background: quickEditSaving ? '#1a1a1a' : '#a3e635',
                              color: quickEditSaving ? '#5b5b59' : '#0d0d0d',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: quickEditSaving ? 'default' : 'pointer',
                              ...S.sans,
                              flexShrink: 0,
                            }}
                          >
                            {quickEditSaving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={closeQuickEdit}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 11,
                              color: '#5b5b59',
                              ...S.sans,
                              padding: '6px 4px',
                              flexShrink: 0,
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Setup Wizard Modal */}
        {showWizard && (
          <SetupWizard
            investments={investments}
            initialPrefs={prefs}
            isUpdate={isUpdateWizard}
            onDone={(newPrefs) => { setPrefs(newPrefs); setShowWizard(false) }}
            onClose={() => {
              // If first time and user closes without completing, mark done to avoid re-showing
              if (!prefs.setupDone) {
                const p = { ...prefs, setupDone: true }
                savePrefs(p)
                setPrefs(p)
              }
              setShowWizard(false)
            }}
          />
        )}

        {/* Add Investment Modal */}
        {showAdd && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 480, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Add Investment</span>
                <button onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>NAME</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. EPF Account, BTC Holdings" style={inputStyle} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>TYPE</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                      {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>PROVIDER (OPTIONAL)</label>
                    <input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} placeholder="e.g. KWSP, Maybank" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>COST BASIS (RM)</label>
                    <input type="number" value={form.costBasis} onChange={e => setForm(f => ({ ...f, costBasis: e.target.value }))} placeholder="0.00" min="0" step="0.01" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>CURRENT VALUE (RM)</label>
                    <input type="number" value={form.currentValue} onChange={e => setForm(f => ({ ...f, currentValue: e.target.value }))} placeholder="0.00" min="0" step="0.01" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>UNITS (OPTIONAL)</label>
                    <input type="number" value={form.units} onChange={e => setForm(f => ({ ...f, units: e.target.value }))} placeholder="e.g. 1000.5" min="0" step="any" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>TICKER (OPTIONAL)</label>
                    <input value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} placeholder="e.g. BTC, ETH" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>NOTES (OPTIONAL)</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={inputStyle} />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: saving ? 0.7 : 1, marginTop: 4 }}
                >
                  {saving ? 'Adding…' : 'Add Investment'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Investment Modal */}
        {editingInvestment && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 480, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>Edit Investment</span>
                <button onClick={() => setEditingInvestment(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>NAME</label>
                  <input value={editingInvestment.name} onChange={e => setEditingInvestment(p => p && ({ ...p, name: e.target.value }))} style={inputStyle} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>TYPE</label>
                    <select value={editingInvestment.type} onChange={e => setEditingInvestment(p => p && ({ ...p, type: e.target.value }))} style={inputStyle}>
                      {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>PROVIDER (OPTIONAL)</label>
                    <input value={editingInvestment.provider ?? ''} onChange={e => setEditingInvestment(p => p && ({ ...p, provider: e.target.value || null }))} placeholder="e.g. KWSP, Maybank" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>COST BASIS (RM)</label>
                    <input type="number" value={editingInvestment.costBasis} onChange={e => setEditingInvestment(p => p && ({ ...p, costBasis: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>CURRENT VALUE (RM)</label>
                    <input type="number" value={editingInvestment.currentValue} onChange={e => setEditingInvestment(p => p && ({ ...p, currentValue: parseFloat(e.target.value) || 0 }))} min="0" step="0.01" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>UNITS (OPTIONAL)</label>
                    <input type="number" value={editingInvestment.units ?? ''} onChange={e => setEditingInvestment(p => p && ({ ...p, units: e.target.value ? parseFloat(e.target.value) : null }))} min="0" step="any" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>TICKER (OPTIONAL)</label>
                    <input value={editingInvestment.ticker ?? ''} onChange={e => setEditingInvestment(p => p && ({ ...p, ticker: e.target.value || null }))} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>NOTES (OPTIONAL)</label>
                  <input value={editingInvestment.notes ?? ''} onChange={e => setEditingInvestment(p => p && ({ ...p, notes: e.target.value || null }))} placeholder="Optional notes" style={inputStyle} />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', cursor: saving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: saving ? 0.7 : 1, marginTop: 4 }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* KuCoin Config Modal */}
        {showKucoinConfig && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 28, width: 440, maxWidth: '92vw', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <div>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>KuCoin API Keys</span>
                  <div style={{ ...S.label, marginTop: 4 }}>Keys are stored securely and never exposed</div>
                </div>
                <button onClick={() => setShowKucoinConfig(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
                  <Icon name="close" width={18} height={18} />
                </button>
              </div>
              <form onSubmit={handleSaveKucoin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle}>API KEY</label>
                  <input value={kcApiKey} onChange={e => setKcApiKey(e.target.value)} placeholder="Your KuCoin API key" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>API SECRET</label>
                  <input type="password" value={kcApiSecret} onChange={e => setKcApiSecret(e.target.value)} placeholder="Your KuCoin API secret" style={inputStyle} required />
                </div>
                <div>
                  <label style={labelStyle}>API PASSPHRASE</label>
                  <input type="password" value={kcApiPassphrase} onChange={e => setKcApiPassphrase(e.target.value)} placeholder="Your KuCoin API passphrase" style={inputStyle} required />
                </div>
                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ ...S.label, marginBottom: 4 }}>PERMISSIONS REQUIRED</div>
                  <div style={{ fontSize: 12, color: '#7a7a78', ...S.sans }}>
                    Enable <strong style={{ color: '#f5f5f4' }}>General</strong> (read-only). No withdrawal permissions needed.
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={kcSaving}
                  style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 0', cursor: kcSaving ? 'default' : 'pointer', fontSize: 14, fontWeight: 600, ...S.sans, opacity: kcSaving ? 0.7 : 1, marginTop: 4 }}
                >
                  {kcSaving ? 'Saving…' : 'Save API Keys'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
