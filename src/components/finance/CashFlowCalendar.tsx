'use client'

import React, { useMemo } from 'react'

export interface CashFlowEvent {
  date: string
  type: 'bill' | 'bnpl' | 'cc'
  name: string
  amount: number
  paid: boolean
  icon: string
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

const TYPE_META = {
  bill: { color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.25)', label: 'BILL' },
  bnpl: { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.25)', label: 'BNPL' },
  cc:   { color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.25)',  label: 'CC DUE' },
}

function fmt(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return {
    dayNum: String(d).padStart(2, '0'),
    dayName: date.toLocaleString('en-MY', { weekday: 'short' }).toUpperCase(),
    monthShort: date.toLocaleString('en-MY', { month: 'short' }).toUpperCase(),
    isWeekend: date.getDay() === 0 || date.getDay() === 6,
    full: date.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function rm(n: number) {
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function EventPill({ event }: { event: CashFlowEvent }) {
  const meta = TYPE_META[event.type]
  const muted = event.paid
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '5px 10px',
      borderRadius: 8,
      background: muted ? 'rgba(255,255,255,0.02)' : meta.bg,
      border: `1px solid ${muted ? '#1f1f1f' : meta.border}`,
      opacity: muted ? 0.45 : 1,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 8,
        ...S.mono,
        letterSpacing: '0.08em',
        color: muted ? '#3a3a3a' : meta.color,
        border: `1px solid ${muted ? '#252525' : meta.border}`,
        borderRadius: 3,
        padding: '1px 4px',
        flexShrink: 0,
      }}>
        {meta.label}
      </span>
      <span style={{
        fontSize: 12.5,
        fontWeight: 500,
        color: muted ? '#3a3a3a' : '#d0d0cf',
        ...S.sans,
        textDecoration: muted ? 'line-through' : 'none',
        maxWidth: 160,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {event.name}
      </span>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: muted ? '#3a3a3a' : meta.color,
        ...S.mono,
        flexShrink: 0,
        letterSpacing: '-0.01em',
      }}>
        {rm(event.amount)}
      </span>
      {event.paid && (
        <svg width={11} height={11} viewBox="0 0 10 10" fill="none" stroke="#3a3a3a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M1.5 5l2.5 2.5 4.5-4.5" />
        </svg>
      )}
    </div>
  )
}

interface DayRowProps {
  dateStr: string
  events: CashFlowEvent[]
  isToday: boolean
  runningTotal: number
}

function DayRow({ dateStr, events, isToday, runningTotal }: DayRowProps) {
  const d = fmt(dateStr)
  const dayOutflow = events.filter(e => !e.paid).reduce((a, e) => a + e.amount, 0)

  return (
    <div style={{
      display: 'flex',
      gap: 0,
      borderBottom: '1px solid #141414',
      background: isToday ? 'rgba(163,230,53,0.025)' : 'transparent',
      alignItems: 'flex-start',
      minHeight: 52,
    }}>
      {/* Date column */}
      <div style={{
        width: 88,
        minWidth: 88,
        padding: '12px 14px 12px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
        borderRight: `1px solid ${isToday ? 'rgba(163,230,53,0.15)' : '#141414'}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: isToday ? '#a3e635' : d.isWeekend ? '#5b5b59' : '#d0d0cf',
            ...S.mono,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {d.dayNum}
          </span>
        </div>
        <div style={{
          fontSize: 9,
          ...S.mono,
          letterSpacing: '0.08em',
          color: isToday ? '#a3e635' : '#3a3a3a',
        }}>
          {d.dayName}
        </div>
        <div style={{
          fontSize: 8,
          ...S.mono,
          letterSpacing: '0.06em',
          color: '#2a2a2a',
        }}>
          {d.monthShort}
        </div>
      </div>

      {/* Events column */}
      <div style={{ flex: 1, padding: '11px 16px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 52 }}>
        {events.length === 0 ? (
          <span style={{ fontSize: 11, color: '#222', ...S.mono }}>—</span>
        ) : (
          events.map((ev, i) => <EventPill key={i} event={ev} />)
        )}
      </div>

      {/* Daily outflow + running total */}
      {events.length > 0 && (
        <div style={{
          width: 130,
          minWidth: 130,
          padding: '12px 18px 12px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
          borderLeft: '1px solid #141414',
        }}>
          {dayOutflow > 0 && (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', ...S.mono, letterSpacing: '-0.01em' }}>
              −{rm(dayOutflow)}
            </span>
          )}
          <span style={{ ...S.label, fontSize: 9 }}>
            BALANCE {rm(Math.max(runningTotal, 0))}
          </span>
        </div>
      )}
    </div>
  )
}

interface Props {
  events: CashFlowEvent[]
  fromDate: string   // YYYY-MM-DD
  days: number
  salaryAmount: number
}

export default function CashFlowCalendar({ events, fromDate, days, salaryAmount }: Props) {
  const today = new Date().toISOString().slice(0, 10)

  // Build all date strings in window
  const dateStrings = useMemo(() => {
    const arr: string[] = []
    const base = new Date(fromDate)
    base.setHours(0, 0, 0, 0)
    for (let i = 0; i < days; i++) {
      const d = new Date(base)
      d.setDate(d.getDate() + i)
      arr.push(d.toISOString().slice(0, 10))
    }
    return arr
  }, [fromDate, days])

  // Group events by date
  const byDate = useMemo(() => {
    const m = new Map<string, CashFlowEvent[]>()
    for (const ev of events) {
      if (!m.has(ev.date)) m.set(ev.date, [])
      m.get(ev.date)!.push(ev)
    }
    return m
  }, [events])

  // Compute stats
  const totalOutflow = events.filter(e => !e.paid).reduce((a, e) => a + e.amount, 0)
  const daysWithEvents = new Set(events.map(e => e.date)).size
  const upcomingCount = events.filter(e => !e.paid && e.date >= today).length

  // Running balance — simple cumulative subtract from salary
  let runningBalance = salaryAmount
  const runningByDate = new Map<string, number>()
  for (const ds of dateStrings) {
    const dayEvs = byDate.get(ds) ?? []
    const outflow = dayEvs.filter(e => !e.paid).reduce((a, e) => a + e.amount, 0)
    runningBalance -= outflow
    runningByDate.set(ds, runningBalance)
  }

  // Filter: only show dates with events (skip empty days to keep compact)
  const activeDates = dateStrings.filter(d => byDate.has(d))

  const typeBreakdown = [
    { type: 'bill' as const, count: events.filter(e => e.type === 'bill').length },
    { type: 'bnpl' as const, count: events.filter(e => e.type === 'bnpl').length },
    { type: 'cc'   as const, count: events.filter(e => e.type === 'cc').length },
  ].filter(t => t.count > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'TOTAL OUTFLOWS', value: rm(totalOutflow), sub: `next ${days} days` },
          { label: 'UPCOMING EVENTS', value: String(upcomingCount), sub: 'unpaid' },
          { label: 'DAYS WITH EVENTS', value: String(daysWithEvents), sub: `of ${days}` },
          { label: 'EST. REMAINING', value: rm(Math.max(salaryAmount - totalOutflow, 0)), sub: 'after all outflows', color: salaryAmount - totalOutflow < 0 ? '#ef4444' : '#a3e635' },
        ].map(s => (
          <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, padding: '12px 18px' }}>
            <div style={{ ...S.label, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: s.color ?? '#f5f5f4', ...S.sans, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {s.value}
            </div>
            <div style={{ ...S.label, marginTop: 4, fontSize: 9 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...S.label, marginRight: 4 }}>LEGEND</span>
        {Object.entries(TYPE_META).map(([key, meta]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color }} />
            <span style={{ fontSize: 10, ...S.mono, color: '#5b5b59', letterSpacing: '0.06em' }}>{meta.label}</span>
          </div>
        ))}
        {typeBreakdown.map(t => (
          <span key={t.type} style={{ fontSize: 9, ...S.mono, color: TYPE_META[t.type].color, border: `1px solid ${TYPE_META[t.type].border}`, borderRadius: 4, padding: '1px 6px' }}>
            {t.count} {TYPE_META[t.type].label}
          </span>
        ))}
      </div>

      {/* Calendar timeline */}
      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'flex',
          gap: 0,
          padding: '8px 0',
          borderBottom: '1px solid #1a1a1a',
          background: '#0d0d0d',
        }}>
          <div style={{ width: 88, minWidth: 88, padding: '0 14px 0 18px', ...S.label }}>DATE</div>
          <div style={{ flex: 1, padding: '0 16px', ...S.label }}>EVENTS</div>
          <div style={{ width: 130, minWidth: 130, padding: '0 18px 0 10px', ...S.label, textAlign: 'right' }}>DAILY / BALANCE</div>
        </div>

        {activeDates.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ ...S.label, marginBottom: 8 }}>NO UPCOMING EVENTS</div>
            <div style={{ fontSize: 12, color: '#3a3a3a', ...S.sans }}>Add bills or BNPL plans to see them here.</div>
          </div>
        ) : (
          activeDates.map(ds => (
            <DayRow
              key={ds}
              dateStr={ds}
              events={byDate.get(ds) ?? []}
              isToday={ds === today}
              runningTotal={runningByDate.get(ds) ?? 0}
            />
          ))
        )}
      </div>

      {/* Footer note */}
      <div style={{ padding: '0 2px' }}>
        <span style={{ ...S.label, fontSize: 9 }}>
          SHOWING NEXT {days} DAYS FROM {fromDate} · BNPL DUE DATES SHOWN ON 1ST OF EACH ACTIVE MONTH · PAID ITEMS ARE MUTED
        </span>
      </div>
    </div>
  )
}
