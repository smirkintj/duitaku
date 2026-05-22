'use client'

import React, { useState, useEffect, useCallback } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'

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

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const TYPE_COLORS: Record<string, string> = {
  epf: '#f59e0b',
  asb: '#10b981',
  versa: '#6366f1',
  crypto: '#f97316',
  unit_trust: '#8b5cf6',
  other: '#6b7280',
}

const TYPE_LABELS: Record<string, string> = {
  epf: 'EPF',
  asb: 'ASB',
  versa: 'VERSA',
  crypto: 'CRYPTO',
  unit_trust: 'UNIT TRUST',
  other: 'OTHER',
}

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

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncWarnings, setSyncWarnings] = useState<string[]>([])

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
    // Find existing EPF investment entries or create new ones
    const epfInvestments = investments.filter(i => i.type === 'epf')
    if (epfInvestments.length === 1) {
      // Update the single EPF entry with total balance
      await fetch(`/api/investments/${epfInvestments[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentValue: epfResult.totalBalance }),
      })
    } else if (epfInvestments.length === 0) {
      // Create a new EPF entry
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

  const totalCostBasis = investments.reduce((a, b) => a + b.costBasis, 0)
  const totalCurrentValue = investments.reduce((a, b) => a + b.currentValue, 0)
  const totalReturn = totalCurrentValue - totalCostBasis
  const totalReturnPct = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0

  const lastSynced = investments
    .filter(i => i.autoSync && i.lastSyncedAt)
    .sort((a, b) => new Date(b.lastSyncedAt!).getTime() - new Date(a.lastSyncedAt!).getTime())[0]?.lastSyncedAt ?? null

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
          <button
            onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 16px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}
          >
            + Add
          </button>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {investments.map(inv => {
                const gain = inv.currentValue - inv.costBasis
                const gainPct = inv.costBasis > 0 ? (gain / inv.costBasis) * 100 : 0
                const gainColor = gain >= 0 ? '#a3e635' : '#ef4444'
                const typeColor = TYPE_COLORS[inv.type] ?? '#6b7280'
                const typeLabel = TYPE_LABELS[inv.type] ?? inv.type.toUpperCase()

                return (
                  <div key={inv.id} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                )
              })}
            </div>
          )}
        </div>

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
                      <option value="epf">EPF</option>
                      <option value="asb">ASB</option>
                      <option value="versa">Versa</option>
                      <option value="crypto">Crypto</option>
                      <option value="unit_trust">Unit Trust</option>
                      <option value="other">Other</option>
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
                      <option value="epf">EPF</option>
                      <option value="asb">ASB</option>
                      <option value="versa">Versa</option>
                      <option value="crypto">Crypto</option>
                      <option value="unit_trust">Unit Trust</option>
                      <option value="other">Other</option>
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
