'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'
import AICoachCard from './AICoachCard'
import { RedFlag } from '@/lib/red-flags'

interface CategoryStat {
  id: string
  name: string
  icon: string
  color: string
  budget: number
  spent: number
  prevMonthSpent: number
  prior3moAvg: number
}

interface Merchant {
  name: string
  amount: number
}

interface InsightsClientProps {
  month: string
  salary: number
  income: number
  spent: number
  remaining: number
  savingsRate: number
  categories: CategoryStat[]
  topMerchants: Merchant[]
  flags: RedFlag[]
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  let pm = mo - 1, py = y
  if (pm < 1) { pm = 12; py-- }
  return `${py}-${String(pm).padStart(2, '0')}`
}

function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  let nm = mo + 1, ny = y
  if (nm > 12) { nm = 1; ny++ }
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString('en-MY', { month: 'short', year: 'numeric' }).toUpperCase()
}

function fmt(n: number) {
  return n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev <= 0) return null
  const pct = Math.round(((current - prev) / prev) * 100)
  const up = pct > 0
  return (
    <span
      style={{
        fontSize: 10,
        ...S.mono,
        color: up ? '#f87171' : '#a3e635',
        background: up ? 'rgba(248,113,113,0.1)' : 'rgba(163,230,53,0.1)',
        borderRadius: 4,
        padding: '2px 5px',
        letterSpacing: '0.04em',
      }}
    >
      {up ? '+' : ''}{pct}%
    </span>
  )
}

export default function InsightsClient({
  month, salary, income, spent, remaining, savingsRate, categories, topMerchants, flags,
}: InsightsClientProps) {
  const router = useRouter()
  const [expandedFlag, setExpandedFlag] = useState<number | null>(null)

  const spendRate = income > 0 ? Math.min(100, (spent / income) * 100) : 0
  const topCatSpent = categories[0]?.spent ?? 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={S.label}>INSIGHTS / {fmtMonth(month)}</span>
          <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Monthly Analysis</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #1f1f1f', borderRadius: 10, padding: '3px 4px' }}>
          <button
            onClick={() => router.push(`/insights?m=${prevMonth(month)}`)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7a7a78', display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 7 }}
          >
            <Icon name="chevL" width={14} height={14} />
          </button>
          <span style={{ fontSize: 11, ...S.mono, color: '#d0d0cf', letterSpacing: '0.06em', padding: '0 4px' }}>{fmtMonth(month)}</span>
          <button
            onClick={() => router.push(`/insights?m=${nextMonth(month)}`)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7a7a78', display: 'flex', alignItems: 'center', padding: '3px 5px', borderRadius: 7 }}
          >
            <Icon name="chevR" width={14} height={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'INCOME', value: `RM ${fmt(income)}`, sub: salary > 0 && income !== salary ? `Salary: RM ${fmt(salary)}` : undefined, color: '#a3e635' },
            { label: 'SPENT', value: `RM ${fmt(spent)}`, sub: `${income > 0 ? Math.round((spent / income) * 100) : 0}% of income`, color: '#f5f5f4' },
            { label: 'REMAINING', value: `RM ${fmt(remaining)}`, sub: `${savingsRate}% savings rate`, color: remaining < income * 0.1 ? '#f87171' : '#a3e635' },
            { label: 'CATEGORIES', value: String(categories.filter((c) => c.spent > 0).length), sub: `${categories.filter((c) => c.budget > 0 && c.spent > c.budget).length} over budget`, color: '#f5f5f4' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ ...S.label, marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, ...S.sans, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.value}</div>
              {s.sub && <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Spend meter */}
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={S.label}>MONTHLY BURN RATE</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: spendRate > 90 ? '#f87171' : '#f5f5f4', ...S.sans }}>
              {Math.round(spendRate)}% spent
            </span>
          </div>
          <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${spendRate}%`,
                borderRadius: 4,
                background: spendRate > 90 ? '#f87171' : spendRate > 75 ? '#fbbf24' : '#a3e635',
                transition: 'width 600ms ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>RM 0</span>
            <span style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>RM {fmt(income)}</span>
          </div>
        </div>

        {/* Red flags */}
        {flags.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={S.label}>ALERTS ({flags.length})</span>
            {flags.map((flag, i) => (
              <div
                key={i}
                style={{ background: '#111', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, padding: '14px 18px', cursor: 'pointer' }}
                onClick={() => setExpandedFlag(expandedFlag === i ? null : i)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{flag.title}</span>
                    <span style={{ fontSize: 12, color: '#f87171', ...S.mono }}>{flag.metric}</span>
                  </div>
                  <Icon name={expandedFlag === i ? 'chevL' : 'chevR'} width={12} height={12} style={{ color: '#5b5b59', transform: expandedFlag === i ? 'rotate(90deg)' : 'rotate(-90deg)' }} />
                </div>
                {expandedFlag === i && (
                  <div style={{ marginTop: 12, paddingLeft: 20 }}>
                    <p style={{ fontSize: 13, color: '#7a7a78', ...S.sans, margin: '0 0 8px', lineHeight: 1.55 }}>{flag.detail}</p>
                    <p style={{ fontSize: 12, color: '#a3e635', ...S.sans, margin: 0 }}>💡 {flag.tip}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Category breakdown */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={S.label}>CATEGORY BREAKDOWN</span>
            <span style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>{categories.filter((c) => c.spent > 0).length} active</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {categories.filter((c) => c.spent > 0).map((cat) => {
              const barPct = topCatSpent > 0 ? (cat.spent / topCatSpent) * 100 : 0
              const budgetPct = cat.budget > 0 ? Math.min(100, (cat.spent / cat.budget) * 100) : 0
              const overBudget = cat.budget > 0 && cat.spent > cat.budget

              return (
                <div
                  key={cat.id}
                  style={{
                    background: '#111',
                    border: `1px solid ${overBudget ? 'rgba(248,113,113,0.2)' : '#1a1a1a'}`,
                    borderRadius: 12,
                    padding: '14px 18px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: `${cat.color}18`,
                        border: `1px solid ${cat.color}30`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: cat.color,
                        fontSize: 12,
                      }}
                    >
                      {cat.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#d0d0cf', ...S.sans }}>{cat.name}</span>
                        <DeltaBadge current={cat.spent} prev={cat.prevMonthSpent} />
                        {overBudget && (
                          <span style={{ fontSize: 9, ...S.mono, color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 3, padding: '1px 5px' }}>
                            OVER BUDGET
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#5b5b59', ...S.sans }}>
                        {cat.budget > 0
                          ? `RM ${fmt(cat.spent)} / RM ${fmt(cat.budget)} budget`
                          : `RM ${fmt(cat.spent)}`}
                        {cat.prior3moAvg > 0 && (
                          <span style={{ marginLeft: 8, color: '#3a3a3a' }}>3mo avg: RM {fmt(cat.prior3moAvg)}</span>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: overBudget ? '#f87171' : '#f5f5f4', ...S.sans }}>
                      RM {fmt(cat.spent)}
                    </span>
                  </div>

                  {/* Relative bar */}
                  <div style={{ height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${barPct}%`,
                        background: cat.color,
                        borderRadius: 2,
                        opacity: 0.7,
                      }}
                    />
                  </div>

                  {/* Budget bar (if set) */}
                  {cat.budget > 0 && (
                    <div style={{ marginTop: 4, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${budgetPct}%`,
                          background: overBudget ? '#f87171' : '#a3e635',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Top merchants + spending stats side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Top merchants */}
          {topMerchants.length > 0 && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ ...S.label, marginBottom: 16 }}>TOP MERCHANTS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topMerchants.map((m, i) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 10, color: '#3a3a3a', ...S.mono, width: 16, textAlign: 'right', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: '#d0d0cf', ...S.sans, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}
                      </div>
                      <div style={{ height: 2, background: '#1a1a1a', borderRadius: 1, marginTop: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${topMerchants[0].amount > 0 ? (m.amount / topMerchants[0].amount) * 100 : 0}%`,
                            background: '#a3e635',
                            borderRadius: 1,
                            opacity: 0.5,
                          }}
                        />
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans, flexShrink: 0 }}>
                      RM {fmt(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spending breakdown donut-style */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ ...S.label, marginBottom: 16 }}>SPEND DISTRIBUTION</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.filter((c) => c.spent > 0).slice(0, 5).map((cat) => {
                const pct = spent > 0 ? Math.round((cat.spent / spent) * 100) : 0
                return (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#7a7a78', ...S.sans, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}
                    </span>
                    <span style={{ fontSize: 12, color: '#d0d0cf', ...S.mono, flexShrink: 0 }}>{pct}%</span>
                  </div>
                )
              })}
              {categories.filter((c) => c.spent > 0).length > 5 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3a3a3a', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: '#5b5b59', ...S.sans, flex: 1 }}>
                    {categories.filter((c) => c.spent > 0).length - 5} more
                  </span>
                  <span style={{ fontSize: 12, color: '#5b5b59', ...S.mono }}>
                    {spent > 0 ? Math.round((categories.filter((c) => c.spent > 0).slice(5).reduce((a, c) => a + c.spent, 0) / spent) * 100) : 0}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Coach */}
        <AICoachCard month={month} />
      </div>
    </div>
  )
}
