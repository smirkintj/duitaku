'use client'

import React, { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'

interface MonthData {
  month: string
  income: number
  expense: number
  net: number
  byCategory: { id: string; name: string; icon: string; color: string; amount: number }[]
}

interface TopCategory {
  id: string
  name: string
  icon: string
  color: string
  total: number
}

interface TrendsData {
  months: MonthData[]
  topCategories: TopCategory[]
  salary: number
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
}

function fmt(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-MY', { month: 'short', year: '2-digit' }).toUpperCase()
}

function BarChart({ months }: { months: MonthData[] }) {
  if (months.length === 0) return null

  const maxVal = Math.max(...months.flatMap((m) => [m.income, m.expense]), 1)
  const chartH = 140
  const barW = 20
  const gap = 8
  const groupW = barW * 2 + gap + 20
  const totalW = months.length * groupW + 20

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${totalW} ${chartH + 28}`}
        style={{ width: '100%', minWidth: totalW, height: chartH + 28 }}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <line
            key={frac}
            x1={0}
            x2={totalW}
            y1={chartH - frac * chartH}
            y2={chartH - frac * chartH}
            stroke="#1a1a1a"
            strokeWidth={1}
          />
        ))}

        {months.map((m, i) => {
          const x = i * groupW + 10
          const incH = (m.income / maxVal) * chartH
          const expH = (m.expense / maxVal) * chartH

          return (
            <g key={m.month}>
              {/* Income bar */}
              <rect
                x={x}
                y={chartH - incH}
                width={barW}
                height={incH}
                rx={3}
                fill="#a3e635"
                fillOpacity={0.5}
              />
              {/* Expense bar */}
              <rect
                x={x + barW + gap}
                y={chartH - expH}
                width={barW}
                height={expH}
                rx={3}
                fill="#f87171"
                fillOpacity={0.6}
              />
              {/* Month label */}
              <text
                x={x + barW + gap / 2}
                y={chartH + 18}
                textAnchor="middle"
                fontSize={8}
                fill="#5b5b59"
                fontFamily='"JetBrains Mono", monospace'
                letterSpacing="0.04em"
              >
                {fmtMonth(m.month)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#a3e635', opacity: 0.5 }} />
          <span style={{ fontSize: 11, color: '#7a7a78', ...S.sans }}>Income</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f87171', opacity: 0.6 }} />
          <span style={{ fontSize: 11, color: '#7a7a78', ...S.sans }}>Expenses</span>
        </div>
      </div>
    </div>
  )
}

function NetChart({ months }: { months: MonthData[] }) {
  if (months.length < 2) return null

  const nets = months.map((m) => m.net)
  const min = Math.min(...nets)
  const max = Math.max(...nets, 1)
  const range = max - min || 1
  const h = 60
  const w = 400

  const points = nets.map((v, i) => {
    const x = (i / (nets.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const zeroY = h - ((0 - min) / range) * h
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h }}>
        {/* Zero line */}
        <line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="#2a2a2a" strokeWidth={1} strokeDasharray="4 4" />
        {/* Fill */}
        <path d={fillPath} fill="#a3e635" fillOpacity={0.08} />
        {/* Line */}
        <path d={linePath} fill="none" stroke="#a3e635" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={nets[i] >= 0 ? '#a3e635' : '#f87171'} />
        ))}
      </svg>
    </div>
  )
}

function CategoryTrendRow({ cat, months }: { cat: TopCategory; months: MonthData[] }) {
  const amounts = months.map((m) => m.byCategory.find((c) => c.id === cat.id)?.amount ?? 0)
  const max = Math.max(...amounts, 1)
  const total = amounts.reduce((a, b) => a + b, 0)
  const avg = total / amounts.filter((a) => a > 0).length || 0

  // Mini sparkline
  const sparkH = 24
  const sparkW = 80
  const pts = amounts.map((v, i) => ({
    x: (i / (amounts.length - 1)) * sparkW,
    y: sparkH - (v / max) * sparkH,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const last = amounts[amounts.length - 1]
  const prev = amounts[amounts.length - 2] ?? 0
  const delta = prev > 0 ? Math.round(((last - prev) / prev) * 100) : null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 80px 80px', alignItems: 'center', gap: 16, padding: '12px 20px', borderBottom: '1px solid #141414' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: '#d0d0cf', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cat.name}
        </span>
      </div>

      {/* Sparkline */}
      <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" style={{ width: '100%', maxWidth: 200, height: sparkH }}>
        <path d={line} fill="none" stroke={cat.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      </svg>

      <span style={{ fontSize: 12, color: '#7a7a78', ...S.sans, textAlign: 'right' }}>
        avg RM {fmt(avg)}
      </span>

      <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans, textAlign: 'right' }}>
        RM {fmt(last)}
      </span>

      {delta !== null ? (
        <span
          style={{
            fontSize: 11,
            ...S.mono,
            color: delta > 0 ? '#f87171' : '#a3e635',
            textAlign: 'right',
          }}
        >
          {delta > 0 ? '+' : ''}{delta}%
        </span>
      ) : (
        <span style={{ fontSize: 11, color: '#3a3a3a', ...S.mono, textAlign: 'right' }}>—</span>
      )}
    </div>
  )
}

function TrendsContent() {
  const sp = useSearchParams()
  const now = new Date()
  const defaultAnchor = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const anchor = sp.get('m') ?? defaultAnchor

  const [range, setRange] = useState(6)
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/trends?m=${anchor}&n=${range}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [anchor, range])

  useEffect(() => { load() }, [load])

  const months = data?.months ?? []
  const topCats = data?.topCategories ?? []

  const totalExpense = months.reduce((a, m) => a + m.expense, 0)
  const totalIncome = months.reduce((a, m) => a + m.income, 0)
  const avgMonthlyExpense = months.length > 0 ? totalExpense / months.length : 0
  const avgMonthlyIncome = months.length > 0 ? totalIncome / months.length : 0

  const currentMonth = months[months.length - 1]
  const prevMonth = months[months.length - 2]
  const momDelta = prevMonth && prevMonth.expense > 0
    ? Math.round(((currentMonth?.expense ?? 0) - prevMonth.expense) / prevMonth.expense * 100)
    : null

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={S.label}>TRENDS / LAST {range} MONTHS</span>
          <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Spending Trends</span>
        </div>
        {/* Range selector */}
        <div style={{ display: 'flex', gap: 4, background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, padding: 3 }}>
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              onClick={() => setRange(n)}
              style={{
                padding: '5px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
                ...S.sans,
                background: range === n ? '#1f1f1f' : 'transparent',
                color: range === n ? '#f5f5f4' : '#5b5b59',
                transition: 'all 140ms',
              }}
            >
              {n}mo
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', ...S.label }}>LOADING…</div>
        ) : (
          <>
            {/* Summary stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'AVG MONTHLY SPEND', value: `RM ${fmt(avgMonthlyExpense)}`, sub: `over ${range} months`, color: '#f5f5f4' },
                { label: 'AVG MONTHLY INCOME', value: `RM ${fmt(avgMonthlyIncome)}`, sub: `over ${range} months`, color: '#a3e635' },
                { label: 'TOTAL SPEND', value: `RM ${fmt(totalExpense)}`, sub: `${range}-month total`, color: '#f5f5f4' },
                {
                  label: 'MOM CHANGE',
                  value: momDelta !== null ? `${momDelta > 0 ? '+' : ''}${momDelta}%` : '—',
                  sub: 'latest vs prev month',
                  color: momDelta === null ? '#5b5b59' : momDelta > 0 ? '#f87171' : '#a3e635',
                },
              ].map((s) => (
                <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '18px 20px' }}>
                  <div style={{ ...S.label, marginBottom: 8 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Bar chart */}
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ ...S.label, marginBottom: 16 }}>INCOME VS EXPENSES</div>
              <BarChart months={months} />
            </div>

            {/* Net savings trend */}
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={S.label}>NET SAVINGS TREND</span>
                <div style={{ display: 'flex', gap: 16 }}>
                  {months.map((m) => (
                    <div key={m.month} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: '#3a3a3a', ...S.mono }}>{fmtMonth(m.month)}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: m.net >= 0 ? '#a3e635' : '#f87171', ...S.sans }}>
                        {m.net >= 0 ? '+' : ''}RM {fmt(Math.abs(m.net))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <NetChart months={months} />
            </div>

            {/* Monthly breakdown table */}
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
                <span style={S.label}>MONTHLY BREAKDOWN</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr 100px', gap: 12, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                {['MONTH', 'INCOME', 'EXPENSES', 'NET', 'SAVE RATE'].map((h) => (
                  <span key={h} style={S.label}>{h}</span>
                ))}
              </div>
              {months.map((m, i) => {
                const saveRate = m.income > 0 ? Math.round(((m.income - m.expense) / m.income) * 100) : 0
                const isLatest = i === months.length - 1
                return (
                  <div
                    key={m.month}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 1fr 1fr 100px',
                      gap: 12,
                      padding: '13px 20px',
                      borderBottom: i < months.length - 1 ? '1px solid #141414' : 'none',
                      background: isLatest ? 'rgba(163,230,53,0.03)' : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 12, color: isLatest ? '#a3e635' : '#7a7a78', ...S.mono, letterSpacing: '0.04em' }}>
                      {fmtMonth(m.month)}
                      {isLatest && <span style={{ fontSize: 8, marginLeft: 4, opacity: 0.7 }}>●</span>}
                    </span>
                    <span style={{ fontSize: 13, color: '#a3e635', ...S.sans }}>
                      {m.income > 0 ? `RM ${fmt(m.income)}` : '—'}
                    </span>
                    <span style={{ fontSize: 13, color: '#f5f5f4', ...S.sans }}>
                      {m.expense > 0 ? `RM ${fmt(m.expense)}` : '—'}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: m.net >= 0 ? '#a3e635' : '#f87171', ...S.sans }}>
                      {m.net >= 0 ? '+' : ''}RM {fmt(Math.abs(m.net))}
                    </span>
                    <span style={{ fontSize: 12, color: saveRate >= 20 ? '#a3e635' : saveRate >= 0 ? '#f5f5f4' : '#f87171', ...S.mono }}>
                      {m.income > 0 ? `${saveRate}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Category trends */}
            {topCats.length > 0 && (
              <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={S.label}>CATEGORY TRENDS</span>
                  <span style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>top {topCats.length} by total spend</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 100px 80px 80px', gap: 16, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                  {['CATEGORY', `TREND (${range}MO)`, 'AVG/MO', 'LATEST', 'MOM'].map((h) => (
                    <span key={h} style={S.label}>{h}</span>
                  ))}
                </div>
                {topCats.map((cat) => (
                  <CategoryTrendRow key={cat.id} cat={cat} months={months} />
                ))}
              </div>
            )}

            {months.every((m) => m.expense === 0 && m.income === 0) && (
              <div style={{ textAlign: 'center', padding: '40px 0', ...S.label }}>
                NO DATA FOR THIS PERIOD
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function TrendsPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <Suspense fallback={
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' }}>
          LOADING…
        </div>
      }>
        <TrendsContent />
      </Suspense>
    </div>
  )
}
