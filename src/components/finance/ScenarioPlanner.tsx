'use client'

import React, { useState, useEffect } from 'react'
import { formatRM } from '@/lib/finance-utils'

interface ScenarioData {
  netSalary: number
  totalExpenses: number
  totalBills: number
  categories: { id: string; name: string; spent: number; monthlyLimit: number | null }[]
  totalBnpl: number
  totalLoans: number
}

interface Props {
  onClose: () => void
}

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
}

export default function ScenarioPlanner({ onClose }: Props) {
  const [data, setData] = useState<ScenarioData | null>(null)
  const [loading, setLoading] = useState(true)

  // Knobs
  const [salaryPct, setSalaryPct] = useState(0)       // -50 to +50
  const [expensePct, setExpensePct] = useState(0)     // -50 to +50 (cut across all variable expenses)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [salRes, txRes, billsRes, nwRes] = await Promise.all([
        fetch('/api/salary'),
        fetch(`/api/transactions?m=${m}`),
        fetch(`/api/bills?m=${m}`),
        fetch('/api/net-worth'),
      ])
      const salary = salRes.ok ? await salRes.json() : null
      const txs: { amount: number; type: string; categoryId: string | null }[] = txRes.ok ? await txRes.json() : []
      const bills: { amount: number }[] = billsRes.ok ? await billsRes.json() : []
      const nw: { liabilities: { bnpl: number; loans: number } } = nwRes.ok ? await nwRes.json() : { liabilities: { bnpl: 0, loans: 0 } }

      const netSalary = salary?.amount ?? 0
      const totalExpenses = txs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
      const totalBills = bills.reduce((a, b) => a + b.amount, 0)

      setData({
        netSalary,
        totalExpenses,
        totalBills,
        categories: [],
        totalBnpl: nw.liabilities.bnpl,
        totalLoans: nw.liabilities.loans,
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading || !data) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }} onClick={onClose}>
        <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: 32, width: 480, maxWidth: 'calc(100vw - 40px)' }} onClick={e => e.stopPropagation()}>
          <span style={S.label}>{loading ? 'LOADING…' : 'No data available'}</span>
        </div>
      </div>
    )
  }

  // Scenario calculations
  const adjSalary = data.netSalary * (1 + salaryPct / 100)
  const variableExpenses = Math.max(0, data.totalExpenses - data.totalBills)
  const adjVariableExpenses = variableExpenses * (1 + expensePct / 100)
  const adjTotalExpenses = data.totalBills + adjVariableExpenses

  const currentBuffer = data.netSalary - data.totalExpenses
  const scenarioBuffer = adjSalary - adjTotalExpenses
  const bufferDelta = scenarioBuffer - currentBuffer

  const currentSavingsRate = data.netSalary > 0 ? (currentBuffer / data.netSalary) * 100 : 0
  const scenarioSavingsRate = adjSalary > 0 ? (scenarioBuffer / adjSalary) * 100 : 0

  const hasData = data.netSalary > 0 || data.totalExpenses > 0

  function SliderRow({ label, value, setValue, min = -50, max = 50 }: { label: string; value: number; setValue: (v: number) => void; min?: number; max?: number }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ ...S.label }}>{label}</span>
          <span style={{ fontSize: 12, fontFamily: '"JetBrains Mono", monospace', color: value === 0 ? '#5b5b59' : value > 0 ? '#a3e635' : '#ef4444', fontWeight: 600 }}>
            {value > 0 ? '+' : ''}{value}%
          </span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => setValue(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#a3e635', cursor: 'pointer' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 9, ...S.mono, color: '#3a3a3a' }}>{min}%</span>
          <span style={{ fontSize: 9, ...S.mono, color: '#3a3a3a' }}>0%</span>
          <span style={{ fontSize: 9, ...S.mono, color: '#3a3a3a' }}>+{max}%</span>
        </div>
      </div>
    )
  }

  function DeltaChip({ delta, prefix = '' }: { delta: number; prefix?: string }) {
    const pos = delta >= 0
    return (
      <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: pos ? '#a3e635' : '#ef4444', background: pos ? 'rgba(163,230,53,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${pos ? 'rgba(163,230,53,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 4, padding: '2px 6px', marginLeft: 6 }}>
        {pos ? '+' : ''}{prefix}{formatRM(Math.abs(delta))}
      </span>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 20, padding: '28px 32px', width: 500, maxWidth: 'calc(100vw - 40px)', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={S.label}>WHAT IF CALCULATOR</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#f5f5f4', ...S.sans, marginTop: 4 }}>Scenario Planner</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59', padding: 4 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {!hasData && (
          <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans, padding: '24px 0', textAlign: 'center' }}>
            Add your salary and transactions to see projections.
          </div>
        )}

        {hasData && (
          <>
            {/* Current state */}
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
              <div style={{ ...S.label, marginBottom: 10 }}>CURRENT STATE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', marginBottom: 4 }}>NET SALARY</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#a3e635', ...S.sans }}>RM {formatRM(data.netSalary)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', marginBottom: 4 }}>EXPENSES</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>RM {formatRM(data.totalExpenses)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', marginBottom: 4 }}>BUFFER</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: currentBuffer >= 0 ? '#a3e635' : '#ef4444', ...S.sans }}>
                    {currentBuffer < 0 ? '-' : ''}RM {formatRM(Math.abs(currentBuffer))}
                  </div>
                </div>
              </div>
              {data.netSalary > 0 && (
                <div style={{ marginTop: 8, fontSize: 10, ...S.mono, color: '#5b5b59' }}>
                  SAVINGS RATE: {currentSavingsRate.toFixed(1)}%
                </div>
              )}
            </div>

            {/* Sliders */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
              <SliderRow label="SALARY CHANGE" value={salaryPct} setValue={setSalaryPct} />
              <SliderRow label="VARIABLE SPENDING CHANGE" value={expensePct} setValue={setExpensePct} min={-80} max={50} />
            </div>

            {/* Scenario result */}
            <div style={{ background: scenarioBuffer >= 0 ? 'rgba(163,230,53,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${scenarioBuffer >= 0 ? 'rgba(163,230,53,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ ...S.label, marginBottom: 12 }}>PROJECTED OUTCOME</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', marginBottom: 4 }}>PROJECTED SALARY</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#a3e635', ...S.sans }}>RM {formatRM(adjSalary)}</span>
                    {salaryPct !== 0 && <DeltaChip delta={adjSalary - data.netSalary} prefix="RM " />}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, ...S.mono, color: '#5b5b59', marginBottom: 4 }}>PROJECTED EXPENSES</div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f4', ...S.sans }}>RM {formatRM(adjTotalExpenses)}</span>
                    {expensePct !== 0 && <DeltaChip delta={-(adjTotalExpenses - data.totalExpenses)} prefix="RM " />}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #1a1a1a', paddingTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 9, ...S.mono, color: '#5b5b59' }}>PROJECTED BUFFER</span>
                  {bufferDelta !== 0 && <DeltaChip delta={bufferDelta} prefix="RM " />}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: scenarioBuffer >= 0 ? '#a3e635' : '#ef4444', ...S.sans, letterSpacing: '-0.02em', marginTop: 4 }}>
                  {scenarioBuffer < 0 ? '-' : ''}RM {formatRM(Math.abs(scenarioBuffer))}
                </div>
                {adjSalary > 0 && (
                  <div style={{ fontSize: 11, ...S.mono, color: '#5b5b59', marginTop: 4 }}>
                    SAVINGS RATE: {scenarioSavingsRate.toFixed(1)}%
                    {currentSavingsRate > 0 && (
                      <span style={{ color: scenarioSavingsRate >= currentSavingsRate ? '#a3e635' : '#ef4444', marginLeft: 6 }}>
                        ({scenarioSavingsRate >= currentSavingsRate ? '+' : ''}{(scenarioSavingsRate - currentSavingsRate).toFixed(1)} pp)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Reset */}
            {(salaryPct !== 0 || expensePct !== 0) && (
              <button
                onClick={() => { setSalaryPct(0); setExpensePct(0) }}
                style={{ marginTop: 14, background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, color: '#5b5b59', ...S.sans, width: '100%' }}
              >
                Reset to baseline
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
