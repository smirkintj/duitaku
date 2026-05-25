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

const CHART_W = 800
const CHART_H = 200
const PAD_LEFT = 8
const PAD_RIGHT = 8
const PAD_TOP = 12
const PAD_BOTTOM = 28 // space for x-axis labels

const PLOT_W = CHART_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = CHART_H - PAD_TOP - PAD_BOTTOM

export default function NetWorthChart() {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    fetch('/api/net-worth/history')
      .then(r => r.json())
      .then((d: HistoryData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' }}>
          Loading…
        </span>
      </div>
    )
  }

  if (!data || data.months.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', lineHeight: 1.6 }}>
          Add accounts and investments to see your net worth trend.
        </span>
      </div>
    )
  }

  const months = data.months
  const n = months.length

  // Check if all zeros
  const allZero = months.every(m => m.assets === 0 && m.liabilities === 0 && m.netWorth === 0)
  if (allZero) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', lineHeight: 1.6 }}>
          Add accounts and investments to see your net worth trend.
        </span>
      </div>
    )
  }

  // Compute min/max across all three series
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
  const liabPoints = toPoints(m => m.liabilities)
  const nwPoints = toPoints(m => m.netWorth)

  // Hover handler
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    // Map client X to viewBox X
    const scaleX = CHART_W / rect.width
    const vbX = (e.clientX - rect.left) * scaleX
    // Find nearest index
    const idx = Math.round(((vbX - PAD_LEFT) / PLOT_W) * (n - 1))
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
  }

  function handleMouseLeave() {
    setHoverIdx(null)
  }

  // Tooltip positioning
  let tooltipX = 0
  let tooltipY = 0
  let hovered: MonthPoint | null = null

  if (hoverIdx !== null) {
    hovered = months[hoverIdx]
    tooltipX = xPos(hoverIdx)
    // Position tooltip above the highest point at this index
    const highestY = Math.min(yPos(hovered.assets), yPos(hovered.liabilities), yPos(hovered.netWorth))
    tooltipY = Math.max(PAD_TOP, highestY - 72)
  }

  // Adjust tooltip X so it doesn't go off the right edge
  const TOOLTIP_W = 148
  const tooltipXAdj = tooltipX + TOOLTIP_W > CHART_W - PAD_RIGHT
    ? tooltipX - TOOLTIP_W - 8
    : tooltipX + 8

  return (
    <div style={{ width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 200, display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Lines */}
        <polyline
          points={assetsPoints}
          fill="none"
          stroke="#a3e635"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={liabPoints}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={nwPoints}
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X axis labels */}
        {months.map((m, i) => {
          // Show every other label for 12 months
          if (n >= 10 && i % 2 !== 0) return null
          return (
            <text
              key={m.month}
              x={xPos(i)}
              y={CHART_H - 6}
              textAnchor="middle"
              fill="#5b5b59"
              fontSize="9"
              fontFamily='"JetBrains Mono", monospace'
            >
              {monthAbbr(m.month)}
            </text>
          )
        })}

        {/* Hover: vertical line + circles */}
        {hoverIdx !== null && hovered && (
          <>
            <line
              x1={xPos(hoverIdx)}
              y1={PAD_TOP}
              x2={xPos(hoverIdx)}
              y2={PAD_TOP + PLOT_H}
              stroke="#2a2a2a"
              strokeWidth="1"
            />
            <circle cx={xPos(hoverIdx)} cy={yPos(hovered.assets)} r="4" fill="#a3e635" />
            <circle cx={xPos(hoverIdx)} cy={yPos(hovered.liabilities)} r="4" fill="#ef4444" />
            <circle cx={xPos(hoverIdx)} cy={yPos(hovered.netWorth)} r="4" fill="#60a5fa" />

            {/* Tooltip box */}
            <rect
              x={tooltipXAdj}
              y={tooltipY}
              width={TOOLTIP_W}
              height={72}
              rx="4"
              ry="4"
              fill="#1a1a1a"
              stroke="#2a2a2a"
              strokeWidth="1"
            />
            <text x={tooltipXAdj + 8} y={tooltipY + 14} fill="#5b5b59" fontSize="8" fontFamily='"JetBrains Mono", monospace'>
              {hovered.month}
            </text>
            <text x={tooltipXAdj + 8} y={tooltipY + 29} fill="#a3e635" fontSize="9" fontFamily='"JetBrains Mono", monospace'>
              Assets  RM {formatRM(hovered.assets)}
            </text>
            <text x={tooltipXAdj + 8} y={tooltipY + 43} fill="#ef4444" fontSize="9" fontFamily='"JetBrains Mono", monospace'>
              Liab    RM {formatRM(hovered.liabilities)}
            </text>
            <text x={tooltipXAdj + 8} y={tooltipY + 57} fill="#60a5fa" fontSize="9" fontFamily='"JetBrains Mono", monospace'>
              Net     RM {formatRM(hovered.netWorth)}
            </text>
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
