'use client'

import React, { useState, useEffect } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { formatRM } from '@/lib/finance-utils'

interface MerchantRow {
  merchant: string
  total: number
  count: number
  prev1: number
  prev3avg: number
  trend: number | null  // fraction: 0.4 = +40%
}

const S = {
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
}

function TrendPill({ trend }: { trend: number | null }) {
  if (trend === null) return <span style={{ fontSize: 10, ...S.mono, color: '#3a3a3a' }}>NEW</span>
  const pct = Math.round(Math.abs(trend) * 100)
  const up = trend > 0.05
  const down = trend < -0.05
  if (!up && !down) return <span style={{ fontSize: 10, ...S.mono, color: '#5b5b59' }}>≈ same</span>
  return (
    <span style={{ fontSize: 10, ...S.mono, color: up ? '#ef4444' : '#a3e635', fontWeight: 700 }}>
      {up ? '↑' : '↓'}{pct}%
    </span>
  )
}

export default function MerchantsPage() {
  const [merchants, setMerchants] = useState<MerchantRow[]>([])
  const [cycleLabel, setCycleLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<'total' | 'trend' | 'count'>('total')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
    ]).then(([settings]) => {
      const payDay = settings?.payDay ?? 1
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const baseMonth = `${y}-${m}`
      fetch(`/api/merchants?m=${baseMonth}&payDay=${payDay}`)
        .then(r => r.json())
        .then(data => {
          setMerchants(data.merchants ?? [])
          setCycleLabel(data.cycle?.label ?? '')
          setLoading(false)
        })
    })
  }, [])

  const sorted = [...merchants]
    .filter(m => m.merchant.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'total') return b.total - a.total
      if (sortBy === 'count') return b.count - a.count
      if (sortBy === 'trend') {
        const ta = a.trend ?? 0; const tb = b.trend ?? 0
        return Math.abs(tb) - Math.abs(ta)
      }
      return 0
    })

  const totalSpend = merchants.reduce((s, m) => s + m.total, 0)
  const top = sorted[0]?.total ?? 1

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>ANALYTICS</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Merchant Spend</span>
          </div>
          {cycleLabel && <span style={{ fontSize: 11, ...S.mono, color: '#5b5b59' }}>{cycleLabel}</span>}
        </div>

        <div style={{ padding: '28px 32px', maxWidth: 800 }}>
          {/* Summary */}
          {!loading && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'TOTAL SPENT', value: `RM ${formatRM(totalSpend)}` },
                { label: 'MERCHANTS', value: String(merchants.length) },
                { label: 'TOP MERCHANT', value: sorted[0]?.merchant ?? '—' },
              ].map(s => (
                <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 18px', flex: 1 }}>
                  <div style={{ ...S.label, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f4', ...S.sans, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <input
              placeholder="Filter merchant…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ flex: 1, background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#f5f5f4', ...S.sans, outline: 'none', colorScheme: 'dark' }}
            />
            {([['total', 'By Amount'], ['trend', 'By Trend'], ['count', 'By Visits']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setSortBy(v)}
                style={{ fontSize: 11, ...S.mono, padding: '7px 12px', borderRadius: 7, border: `1px solid ${sortBy === v ? '#a3e635' : '#1a1a1a'}`, background: sortBy === v ? 'rgba(163,230,53,0.08)' : '#111', color: sortBy === v ? '#a3e635' : '#5b5b59', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#5b5b59', ...S.sans }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#5b5b59', ...S.sans }}>No transactions this cycle.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sorted.map((m) => {
                const barW = (m.total / top) * 100
                const pctOfTotal = totalSpend > 0 ? (m.total / totalSpend) * 100 : 0
                return (
                  <div key={m.merchant} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f4', ...S.sans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.merchant}</div>
                        <div style={{ fontSize: 11, color: '#5b5b59', ...S.mono, marginTop: 2 }}>
                          {m.count} visit{m.count !== 1 ? 's' : ''} · {pctOfTotal.toFixed(1)}% of spend
                          {m.prev3avg > 0 ? ` · avg RM ${formatRM(m.prev3avg, 0)}/cycle` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, ...S.mono, color: '#f5f5f4' }}>RM {formatRM(m.total)}</div>
                        <div style={{ marginTop: 3 }}><TrendPill trend={m.trend} /></div>
                      </div>
                    </div>
                    <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: m.trend !== null && m.trend > 0.3 ? '#ef4444' : '#a3e635', opacity: 0.7, borderRadius: 2, transition: 'width 500ms ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
