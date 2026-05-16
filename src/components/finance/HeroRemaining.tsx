'use client'

import React from 'react'
import { formatRM } from '@/lib/finance-utils'
import { Icon } from './icons'
import { Starfield, OrbitDot, PulseHalo } from './celestial'

interface HeroRemainingProps {
  remaining: number
  salary: number
  spent: number
  daysIn: number
  dayOfMonth: number
  dailySpend: number[]
  month: string // YYYY-MM
}

function DayPacingDial({
  dayOfMonth,
  daysIn,
  spent,
  salary,
}: {
  dayOfMonth: number
  daysIn: number
  spent: number
  salary: number
}) {
  const SIZE = 116
  const cx = SIZE / 2
  const cy = SIZE / 2
  const R_OUTER = 44
  const R_INNER = 35
  const STROKE = 6

  const elapsedPct = dayOfMonth / daysIn
  const spentPct = spent / salary

  // Arc helper: draws arc from startAngle to endAngle (in degrees, 0=top, clockwise)
  function arc(r: number, startDeg: number, endDeg: number): string {
    const toRad = (d: number) => ((d - 90) * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startDeg))
    const y1 = cy + r * Math.sin(toRad(startDeg))
    const x2 = cx + r * Math.cos(toRad(endDeg))
    const y2 = cy + r * Math.sin(toRad(endDeg))
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }

  const outerEnd = Math.min(elapsedPct * 360, 359.99)
  const innerEnd = Math.min(spentPct * 360, 359.99)

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} style={{ position: 'absolute', inset: 0 }}>
        {/* Tracks */}
        <circle cx={cx} cy={cy} r={R_OUTER} fill="none" stroke="#2a2a2a" strokeWidth={STROKE} />
        <circle cx={cx} cy={cy} r={R_INNER} fill="none" stroke="#2a2a2a" strokeWidth={STROKE} />
        {/* Elapsed (outer) */}
        {outerEnd > 0 && (
          <path
            d={arc(R_OUTER, 0, outerEnd)}
            fill="none"
            stroke="#3a3a3a"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}
        {/* Spent (inner) */}
        {innerEnd > 0 && (
          <path
            d={arc(R_INNER, 0, innerEnd)}
            fill="none"
            stroke="#a3e635"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
        )}
        {/* Center text */}
        <text
          x={cx}
          y={cy - 7}
          textAnchor="middle"
          fill="#f5f5f4"
          fontSize={18}
          fontWeight={700}
          fontFamily='"Geist", -apple-system, sans-serif'
        >
          {Math.round(spentPct * 100)}%
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="#5b5b59"
          fontSize={9}
          fontFamily='"JetBrains Mono", monospace'
        >
          DAY {dayOfMonth}/{daysIn}
        </text>
      </svg>
      <OrbitDot />
    </div>
  )
}

function SpendCurve({ data, dayOfMonth }: { data: number[]; dayOfMonth: number }) {
  const W = 1000
  const CANVAS_H = 64
  const LABEL_H = 0
  const PAD_L = 4
  const PAD_R = 4

  const n = data.length
  const max = Math.max(...data, 1)

  const xOf = (i: number) => PAD_L + (i / (n - 1)) * (W - PAD_L - PAD_R)
  const yOf = (v: number) => CANVAS_H - (v / max) * (CANVAS_H - 8)

  const todayIdx = dayOfMonth - 1
  const todayX = xOf(todayIdx)
  const todayY = yOf(data[todayIdx] ?? 0)

  // Build line path for actual data (0..todayIdx)
  const actualPoints = data.slice(0, todayIdx + 1).map((v, i) => ({ x: xOf(i), y: yOf(v) }))
  const linePath = actualPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillPath = actualPoints.length > 1
    ? `${linePath} L ${actualPoints[actualPoints.length - 1].x} ${CANVAS_H} L ${actualPoints[0].x} ${CANVAS_H} Z`
    : ''

  // Average daily spend for projection
  const totalSpent = data.slice(0, todayIdx + 1).reduce((a, b) => a + b, 0)
  const avg = totalSpent / (todayIdx + 1)

  // Projection path for remaining days
  const projPoints: { x: number; y: number }[] = [{ x: todayX, y: todayY }]
  for (let i = todayIdx + 1; i < n; i++) {
    projPoints.push({ x: xOf(i), y: yOf(avg) })
  }
  const projPath = projPoints.length > 1
    ? projPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    : ''

  // Grid lines
  const g1Y = CANVAS_H * 0.33
  const g2Y = CANVAS_H * 0.66

  return (
    <svg viewBox={`0 0 ${W} ${CANVAS_H}`} style={{ width: '100%', height: CANVAS_H }} preserveAspectRatio="none">
      {/* Grid lines */}
      <line x1={0} y1={g1Y} x2={W} y2={g1Y} stroke="#1f1f1f" strokeWidth={1} strokeDasharray="4 4" />
      <line x1={0} y1={g2Y} x2={W} y2={g2Y} stroke="#1f1f1f" strokeWidth={1} strokeDasharray="4 4" />

      {/* Fill */}
      {fillPath && (
        <path d={fillPath} fill="#a3e635" fillOpacity={0.1} />
      )}

      {/* Line */}
      {linePath && (
        <path d={linePath} fill="none" stroke="#a3e635" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Projection */}
      {projPath && (
        <path d={projPath} fill="none" stroke="#a3e635" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.45} />
      )}

      {/* Today vertical marker */}
      <line
        x1={todayX}
        y1={0}
        x2={todayX}
        y2={CANVAS_H}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />

      {/* Today dot */}
      <circle cx={todayX} cy={todayY} r={5} fill="#0d0d0d" stroke="#a3e635" strokeWidth={2} />

      {/* PulseHalo at today */}
      <circle
        cx={todayX}
        cy={todayY}
        r={10}
        fill="none"
        stroke="#a3e635"
        strokeWidth={1}
        opacity={0.3}
      />

    </svg>
  )
}

export default function HeroRemaining({
  remaining,
  salary,
  spent,
  daysIn,
  dayOfMonth,
  dailySpend,
  month,
}: HeroRemainingProps) {
  const monthLabel = new Date(month + '-01').toLocaleString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase()
  const rmStr = formatRM(remaining)
  const dotIdx = rmStr.indexOf('.')
  const intPart = dotIdx >= 0 ? rmStr.slice(0, dotIdx) : rmStr
  const decPart = dotIdx >= 0 ? rmStr.slice(dotIdx) : '.00'

  const paceDelta = spent - (salary / daysIn) * dayOfMonth
  const pacingAhead = paceDelta > 0

  const avgDaily = dailySpend.slice(0, dayOfMonth).reduce((a, b) => a + b, 0) / dayOfMonth
  const peakDay = dailySpend.indexOf(Math.max(...dailySpend)) + 1
  const peakAmt = Math.max(...dailySpend)

  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid #1a1a1a',
        background: 'linear-gradient(180deg, #111 0%, #0d0d0d 100%)',
        padding: '28px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Starfield */}
      <Starfield />

      {/* Lime glow */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: '#a3e635',
          opacity: 0.06,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      {/* Main flex row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontSize: 10,
              fontFamily: '"JetBrains Mono", monospace',
              color: '#a3e635',
              letterSpacing: '0.1em',
              marginBottom: 8,
            }}
          >
            REMAINING · {monthLabel}
          </span>

          {/* Big number */}
          <div style={{ display: 'flex', alignItems: 'flex-end', lineHeight: 1 }}>
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 16,
                color: '#7a7a78',
                transform: 'translateY(-22px)',
                marginRight: 4,
              }}
            >
              RM
            </span>
            <span
              style={{
                fontFamily: '"Geist", -apple-system, sans-serif',
                fontWeight: 700,
                fontSize: 88,
                color: '#f5f5f4',
                letterSpacing: '-3.2px',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {intPart}
            </span>
            <span
              style={{
                fontFamily: '"Geist", -apple-system, sans-serif',
                fontWeight: 500,
                fontSize: 42,
                color: '#5b5b59',
                lineHeight: 1,
                alignSelf: 'flex-end',
                marginBottom: 6,
              }}
            >
              {decPart}
            </span>
          </div>

          {/* Subline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 13, color: '#a0a09e', fontFamily: '"Geist", -apple-system, sans-serif' }}>
              of RM {formatRM(salary)} salary
            </span>
            <span style={{ color: '#2a2a2a', fontSize: 12 }}>·</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11,
                color: pacingAhead ? '#ef4444' : '#a3e635',
              }}
            >
              <Icon name={pacingAhead ? 'arrowUp' : 'arrowDown'} width={12} height={12} />
              RM {formatRM(Math.abs(paceDelta))} {pacingAhead ? 'ahead of pace' : 'under pace'}
            </span>
          </div>
        </div>

        {/* Right — Dial */}
        <DayPacingDial dayOfMonth={dayOfMonth} daysIn={daysIn} spent={spent} salary={salary} />
      </div>

      {/* Spend curve section */}
      <div style={{ marginTop: 28, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' }}>
            DAILY SPEND · MTD
          </span>
          <div style={{ display: 'flex', gap: 16 }}>
            <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59' }}>
              peak RM {formatRM(peakAmt, 0)} · day {peakDay}
            </span>
            <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59' }}>
              avg RM {formatRM(avgDaily, 0)}
            </span>
          </div>
        </div>
        <SpendCurve data={dailySpend} dayOfMonth={dayOfMonth} />
      </div>
    </div>
  )
}
