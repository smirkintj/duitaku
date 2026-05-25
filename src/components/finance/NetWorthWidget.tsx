'use client'

import React, { useEffect, useState } from 'react'
import { formatRM } from '@/lib/finance-utils'
import NetWorthChart from './NetWorthChart'

interface NetWorthData {
  assets: {
    accounts: number
    investments: number
    savings: number
    total: number
  }
  liabilities: {
    cc: number
    loans: number
    bnpl: number
    total: number
  }
  netWorth: number
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

interface NetWorthWidgetProps {
  month: string
}

export default function NetWorthWidget({ month: _month }: NetWorthWidgetProps) {
  const [data, setData] = useState<NetWorthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/net-worth')
      .then(r => r.json())
      .then((d: NetWorthData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '16px 20px' }}>
        <span style={S.label}>LOADING NET WORTH…</span>
      </div>
    )
  }

  if (!data) return null

  const { assets, liabilities, netWorth } = data
  const positive = netWorth >= 0
  const totalSum = assets.total + liabilities.total
  const assetsPct = totalSum > 0 ? (assets.total / totalSum) * 100 : 50
  const liabPct = 100 - assetsPct

  return (
    <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '18px 24px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
        {/* Left: label + net worth number */}
        <div>
          <div style={{ ...S.label, marginBottom: 6 }}>NET WORTH</div>
          <div style={{
            fontSize: 28,
            fontWeight: 700,
            color: positive ? '#a3e635' : '#ef4444',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            ...S.sans,
          }}>
            {positive ? '' : '-'}RM {formatRM(Math.abs(netWorth))}
          </div>
        </div>

        {/* Right: assets vs liabilities */}
        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...S.label, marginBottom: 4, color: '#a3e63588' }}>ASSETS</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#a3e635', ...S.sans }}>
              RM {formatRM(assets.total)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...S.label, marginBottom: 4, color: '#ef444488' }}>LIABILITIES</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#ef4444', ...S.sans }}>
              RM {formatRM(liabilities.total)}
            </div>
          </div>
        </div>
      </div>

      {/* Balance bar */}
      <div style={{ height: 6, background: '#1a1a1a', borderRadius: 3, overflow: 'hidden', marginBottom: 12, display: 'flex' }}>
        {totalSum > 0 ? (
          <>
            <div style={{ width: `${assetsPct}%`, background: '#a3e635', borderRadius: '3px 0 0 3px', transition: 'width 500ms ease' }} />
            <div style={{ width: `${liabPct}%`, background: '#ef4444', borderRadius: liabPct > 0 ? '0 3px 3px 0' : 0, transition: 'width 500ms ease' }} />
          </>
        ) : (
          <div style={{ width: '100%', background: '#2a2a2a', borderRadius: 3 }} />
        )}
      </div>

      {/* Debt breakdown pills */}
      {liabilities.total > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {liabilities.cc > 0 && (
            <span style={{
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: '0.06em',
              color: '#60a5fa',
              background: '#60a5fa14',
              border: '1px solid #60a5fa30',
              borderRadius: 20,
              padding: '3px 10px',
            }}>
              CC RM {formatRM(liabilities.cc)}
            </span>
          )}
          {liabilities.loans > 0 && (
            <span style={{
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: '0.06em',
              color: '#f97316',
              background: '#f9731614',
              border: '1px solid #f9731630',
              borderRadius: 20,
              padding: '3px 10px',
            }}>
              LOANS RM {formatRM(liabilities.loans)}
            </span>
          )}
          {liabilities.bnpl > 0 && (
            <span style={{
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              letterSpacing: '0.06em',
              color: '#a78bfa',
              background: '#a78bfa14',
              border: '1px solid #a78bfa30',
              borderRadius: 20,
              padding: '3px 10px',
            }}>
              BNPL RM {formatRM(liabilities.bnpl)}
            </span>
          )}
        </div>
      )}

      {/* 12-month trend chart */}
      <div style={{ marginTop: 16, borderTop: '1px solid #1a1a1a', paddingTop: 16 }}>
        <div style={{ ...S.label, marginBottom: 12 }}>12-MONTH TREND</div>
        <NetWorthChart />
      </div>
    </div>
  )
}
