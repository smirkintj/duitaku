'use client'

import React, { useEffect, useRef, useState } from 'react'
import { formatRM } from '@/lib/finance-utils'

interface MonthPoint {
  month: string
  assets: number
  liabilities: number
  netWorth: number
}

interface HistoryData {
  months: MonthPoint[]
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthAbbr(yyyyMM: string): string {
  const m = parseInt(yyyyMM.split('-')[1], 10)
  return MONTH_ABBR[m - 1] ?? yyyyMM
}

const CHART_H = 200
const PAD_LEFT = 8
const PAD_RIGHT = 8
const PAD_TOP = 12
const PAD_BOTTOM = 28

export default function NetWorthChart() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [chartWidth, setChartWidth] = useState(800)

  // Track actual container width so text never stretches
  useEffect(() => {
    const update = () => {
      if (containerRef.current) setChartWidth(containerRef.current.clientWidth)
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    fetch('/api/net-worth/history')
      .then(r => r.json())
      .then((d: HistoryData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const PLOT_W = chartWidth - PAD_LEFT - PAD_RIGHT
  const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM

  if (loading) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' }}>
          Loading…
        </span>
      </div>
    )
  }

  const months = data?.months ?? []
  const allZero = months.every(m => m.assets === 0 && m.liabilities === 0 && m.netWorth === 0)

  if (months.length === 0 || allZero) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', lineHeight: 1.6 }}>
          Add accounts and investments to see your net worth trend.
        </span>
      </div>
    )
  }

  const n = months.length
  const allValues = months.flatMap(m => [m.assets, m.liabilities, m.netWorth])
  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const range = rawMax - rawMin || 1
  const padding = range * 0.1
  const yMin = rawMin - padding
  const yMax = rawMax + padding
  const yRange = yMax - yMin || 1

  function xPos(idx: number): number {
    return PAD_LEFT + (idx / Math.max(n - 1, 1)) * PLOT_W
  }

  function yPos(val: number): number {
    return PAD_TOP + (1 - (val - yMin) / yRange) * PLOT_H
  }

  function toPoints(getter: (m: MonthPoint) => number): string {
    return months.map((m, i) => `${xPos(i)},${yPos(getter(m))}`).join(' ')
  }

  const assetsPoints = toPoints(m => m.assets)
  const liabPoints  = toPoints(m => m.liabilities)
  const nwPoints    = toPoints(m => m.netWorth)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const idx = Math.round(((relX - PAD_LEFT) / PLOT_W) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  let tooltipX = 0, tooltipY = 0
  let hovered: MonthPoint | null = null
  const TOOLTIP_W = 158

  if (hoverIdx !== null) {
    hovered = months[hoverIdx]
    tooltipX = xPos(hoverIdx)
    const highestY = Math.min(yPos(hovered.assets), yPos(hovered.liabilities), yPos(hovered.netWorth))
    tooltipY = Math.max(PAD_TOP, highestY - 76)
  }

  const tooltipXAdj = hoverIdx !== null && tooltipX + TOOLTIP_W > chartWidth - PAD_RIGHT
    ? tooltipX - TOOLTIP_W - 8
    : tooltipX + 8

  // Show every label if ≤6 months, every other if ≤12, every third if more
  function showLabel(i: number): boolean {
    if (n <= 6) return true
    if (n <= 12) return i % 2 === 0
    return i % 3 === 0
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${chartWidth} ${CHART_H}`}
        style={{ width: '100%', height: CHART_H, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line
            key={f}
            x1={PAD_LEFT} y1={PAD_TOP + f * PLOT_H}
            x2={chartWidth - PAD_RIGHT} y2={PAD_TOP + f * PLOT_H}
            stroke="#1a1a1a" strokeWidth="1"
          />
        ))}

        {/* Series lines */}
        <polyline points={assetsPoints} fill="none" stroke="#a3e635" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={liabPoints}   fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        <polyline points={nwPoints}     fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

        {/* X-axis labels */}
        {months.map((m, i) => showLabel(i) && (
          <text
            key={m.month}
            x={xPos(i)}
            y={CHART_H - 6}
            textAnchor="middle"
            fill="#3a3a3a"
            fontSize="9"
            fontFamily='"JetBrains Mono", monospace'
          >
            {monthAbbr(m.month)}
          </text>
        ))}

        {/* Hover */}
        {hoverIdx !== null && hovered && (
          <>
            <line x1={xPos(hoverIdx)} y1={PAD_TOP} x2={xPos(hoverIdx)} y2={PAD_TOP + PLOT_H} stroke="#2a2a2a" strokeWidth="1" />
            <circle cx={xPos(hoverIdx)} cy={yPos(hovered.assets)}      r="3.5" fill="#a3e635" />
            <circle cx={xPos(hoverIdx)} cy={yPos(hovered.liabilities)} r="3.5" fill="#ef4444" />
            <circle cx={xPos(hoverIdx)} cy={yPos(hovered.netWorth)}    r="3.5" fill="#60a5fa" />

            <rect x={tooltipXAdj} y={tooltipY} width={TOOLTIP_W} height={76} rx="4" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1" />
            <text x={tooltipXAdj + 8} y={tooltipY + 14} fill="#5b5b59" fontSize="8" fontFamily='"JetBrains Mono", monospace'>{hovered.month}</text>
            <text x={tooltipXAdj + 8} y={tooltipY + 30} fill="#a3e635" fontSize="9" fontFamily='"JetBrains Mono", monospace'>Assets  RM {formatRM(hovered.assets)}</text>
            <text x={tooltipXAdj + 8} y={tooltipY + 46} fill="#ef4444" fontSize="9" fontFamily='"JetBrains Mono", monospace'>Liab    RM {formatRM(hovered.liabilities)}</text>
            <text x={tooltipXAdj + 8} y={tooltipY + 62} fill="#60a5fa" fontSize="9" fontFamily='"JetBrains Mono", monospace'>Net     RM {formatRM(hovered.netWorth)}</text>
          </>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
        {[
          { color: '#a3e635', label: 'Assets' },
          { color: '#ef4444', label: 'Liabilities' },
          { color: '#60a5fa', label: 'Net Worth' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 16, height: 2, background: color, borderRadius: 1 }} />
            <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
              {label.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
