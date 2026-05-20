'use client'

import React, { useState, useCallback } from 'react'
import { formatRM } from '@/lib/finance-utils'

export type EpfMode = '11' | '9' | 'custom'

export interface SalaryFormValues {
  amount: number         // net take-home
  grossAmount: number
  epfEmployee: number
  epfEmployer: number
  socso: number
  eis: number
  pcb: number
  otherDeductions: number
  effectiveFrom: string
}

export interface SalaryFormDefaults {
  grossAmount?: number
  epfEmployee?: number
  socso?: number
  eis?: number
  pcb?: number
  otherDeductions?: number
  effectiveFrom?: string
}

function calcSocso(gross: number): number {
  return Math.round(Math.min(gross, 5000) * 0.005 * 100) / 100
}

function calcEis(gross: number): number {
  return Math.round(Math.min(gross, 5000) * 0.002 * 100) / 100
}

function calcEpfEmployer(gross: number): number {
  return Math.round(gross * (gross <= 5000 ? 0.13 : 0.12) * 100) / 100
}

function detectEpfMode(gross: number, epfEmp?: number): EpfMode {
  if (!epfEmp || !gross) return '11'
  const pct = epfEmp / gross
  if (Math.abs(pct - 0.11) < 0.005) return '11'
  if (Math.abs(pct - 0.09) < 0.005) return '9'
  return 'custom'
}

function DeductionInput({ label, value, onChange, placeholder, note }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  note?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <label style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>{label}</label>
        {note && <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a' }}>{note}</span>}
      </div>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', pointerEvents: 'none' }}>RM</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0.00'}
          style={{
            width: '100%',
            background: '#0d0d0d',
            border: '1px solid #222',
            borderRadius: 8,
            padding: '10px 12px 10px 38px',
            fontSize: 14,
            fontWeight: 600,
            color: '#f5f5f4',
            fontFamily: '"Geist", -apple-system, sans-serif',
            outline: 'none',
            boxSizing: 'border-box',
            colorScheme: 'dark',
          }}
        />
      </div>
    </div>
  )
}

interface SalaryFormProps {
  defaults?: SalaryFormDefaults
  fillKey?: number              // increment to re-initialize form from new defaults
  showEffectiveFrom?: boolean
  submitLabel?: string
  onSubmit: (values: SalaryFormValues) => Promise<void>
}

export default function SalaryForm({ defaults, fillKey, showEffectiveFrom = false, submitLabel = 'Save', onSubmit }: SalaryFormProps) {
  const today = new Date()
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

  function initFromDefaults(d?: SalaryFormDefaults) {
    const gross = d?.grossAmount ? String(d.grossAmount) : ''
    const mode = detectEpfMode(d?.grossAmount ?? 0, d?.epfEmployee)
    return {
      gross,
      epfMode: mode as EpfMode,
      epfCustom: mode === 'custom' && d?.epfEmployee ? String(d.epfEmployee) : '',
      socsoOverride: d?.socso != null ? String(d.socso) : '',
      eisOverride: d?.eis != null ? String(d.eis) : '',
      pcb: d?.pcb ? String(d.pcb) : '',
      other: d?.otherDeductions ? String(d.otherDeductions) : '',
      effectiveFrom: d?.effectiveFrom ?? firstOfMonth,
    }
  }

  const init = initFromDefaults(defaults)
  const [gross, setGross] = useState(init.gross)
  const [epfMode, setEpfMode] = useState<EpfMode>(init.epfMode)
  const [epfCustom, setEpfCustom] = useState(init.epfCustom)
  const [socsoOverride, setSocsoOverride] = useState(init.socsoOverride)
  const [eisOverride, setEisOverride] = useState(init.eisOverride)
  const [pcb, setPcb] = useState(init.pcb)
  const [other, setOther] = useState(init.other)
  const [effectiveFrom, setEffectiveFrom] = useState(init.effectiveFrom)

  // Re-initialize when fillKey changes (payslip parsed)
  const prevFillKey = React.useRef(fillKey)
  if (fillKey !== prevFillKey.current) {
    prevFillKey.current = fillKey
    const next = initFromDefaults(defaults)
    setGross(next.gross)
    setEpfMode(next.epfMode)
    setEpfCustom(next.epfCustom)
    setSocsoOverride(next.socsoOverride)
    setEisOverride(next.eisOverride)
    setPcb(next.pcb)
    setOther(next.other)
    setEffectiveFrom(next.effectiveFrom)
  }
  const [loading, setLoading] = useState(false)
  const grossNum = parseFloat(gross) || 0
  const hasGross = grossNum > 0

  const epfEmployee = epfMode === 'custom'
    ? (parseFloat(epfCustom) || 0)
    : Math.round(grossNum * (epfMode === '11' ? 0.11 : 0.09) * 100) / 100

  const socso = socsoOverride !== '' ? (parseFloat(socsoOverride) || 0) : calcSocso(grossNum)
  const eis = eisOverride !== '' ? (parseFloat(eisOverride) || 0) : calcEis(grossNum)
  const pcbNum = parseFloat(pcb) || 0
  const otherNum = parseFloat(other) || 0
  const epfEmployerNum = calcEpfEmployer(grossNum)
  const netTakeHome = Math.max(0, grossNum - epfEmployee - socso - eis - pcbNum - otherNum)

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasGross) return
    setLoading(true)
    try {
      await onSubmit({
        amount: netTakeHome,
        grossAmount: grossNum,
        epfEmployee,
        epfEmployer: epfEmployerNum,
        socso,
        eis,
        pcb: pcbNum,
        otherDeductions: otherNum,
        effectiveFrom,
      })
    } finally {
      setLoading(false)
    }
  }, [hasGross, netTakeHome, grossNum, epfEmployee, epfEmployerNum, socso, eis, pcbNum, otherNum, effectiveFrom, onSubmit])

  const btnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: '"JetBrains Mono", monospace',
    letterSpacing: '0.04em',
    border: active ? '1px solid #a3e635' : '1px solid #222',
    borderRadius: 7,
    background: active ? '#a3e63518' : '#0d0d0d',
    color: active ? '#a3e635' : '#5b5b59',
    cursor: 'pointer',
    transition: 'all 150ms',
  })

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Gross */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', marginBottom: 6 }}>
          GROSS SALARY (MYR)
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', pointerEvents: 'none' }}>RM</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={gross}
            onChange={e => setGross(e.target.value)}
            placeholder="0.00"
            required
            style={{
              width: '100%',
              background: '#0d0d0d',
              border: '1px solid #222',
              borderRadius: 8,
              padding: '12px 14px 12px 44px',
              fontSize: 22,
              fontWeight: 700,
              color: '#a3e635',
              fontFamily: '"Geist", -apple-system, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              colorScheme: 'dark',
            }}
          />
        </div>
      </div>

      {/* Deductions box */}
      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '16px 16px 4px' }}>
        <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a', letterSpacing: '0.08em' }}>DEDUCTIONS</span>

        {/* EPF */}
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>EPF (EMPLOYEE)</label>
            <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a' }}>EMPLOYER +{formatRM(epfEmployerNum)} est.</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: epfMode === 'custom' ? 8 : 0 }}>
            {(['11', '9', 'custom'] as EpfMode[]).map(m => (
              <button key={m} type="button" style={btnStyle(epfMode === m)} onClick={() => setEpfMode(m)}>
                {m === 'custom' ? 'CUSTOM' : `${m}%`}
              </button>
            ))}
          </div>
          {epfMode === 'custom' && (
            <div style={{ position: 'relative', marginTop: 6 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', pointerEvents: 'none' }}>RM</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={epfCustom}
                onChange={e => setEpfCustom(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  background: '#111',
                  border: '1px solid #222',
                  borderRadius: 8,
                  padding: '9px 12px 9px 38px',
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#f5f5f4',
                  fontFamily: '"Geist", -apple-system, sans-serif',
                  outline: 'none',
                  boxSizing: 'border-box',
                  colorScheme: 'dark',
                }}
              />
            </div>
          )}
        </div>

        {/* SOCSO + EIS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <DeductionInput
            label="SOCSO"
            value={socsoOverride !== '' ? socsoOverride : (hasGross ? String(socso) : '')}
            onChange={v => setSocsoOverride(v)}
            placeholder={hasGross ? String(calcSocso(grossNum)) : '0.00'}
            note="~0.5% est."
          />
          <DeductionInput
            label="EIS"
            value={eisOverride !== '' ? eisOverride : (hasGross ? String(eis) : '')}
            onChange={v => setEisOverride(v)}
            placeholder={hasGross ? String(calcEis(grossNum)) : '0.00'}
            note="~0.2% est."
          />
        </div>

        {/* PCB + Other */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <DeductionInput
            label="PCB / INCOME TAX"
            value={pcb}
            onChange={setPcb}
            placeholder="from payslip"
          />
          <DeductionInput
            label="OTHER"
            value={other}
            onChange={setOther}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Effective from date */}
      {showEffectiveFrom && (
        <div>
          <label style={{ display: 'block', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', marginBottom: 6 }}>
            EFFECTIVE FROM
          </label>
          <input
            required
            type="date"
            value={effectiveFrom}
            onChange={e => setEffectiveFrom(e.target.value)}
            style={{
              width: '100%',
              background: '#0d0d0d',
              border: '1px solid #222',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 14,
              color: '#f5f5f4',
              fontFamily: '"Geist", -apple-system, sans-serif',
              outline: 'none',
              boxSizing: 'border-box',
              colorScheme: 'dark',
            }}
          />
        </div>
      )}

      {/* Breakdown preview */}
      {hasGross && (
        <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12, padding: '4px 16px 0' }}>
          {[
            { label: 'Gross salary', val: grossNum, color: '#7a7a78' as string },
            { label: `EPF (${epfMode === 'custom' ? 'custom' : epfMode + '%'})`, val: -epfEmployee, color: '#5b5b59' as string, sub: 'employee contribution' },
            { label: 'SOCSO', val: -socso, color: '#5b5b59' as string },
            { label: 'EIS', val: -eis, color: '#5b5b59' as string },
            ...(pcbNum > 0 ? [{ label: 'PCB / Income tax', val: -pcbNum, color: '#5b5b59' as string }] : []),
            ...(otherNum > 0 ? [{ label: 'Other deductions', val: -otherNum, color: '#5b5b59' as string }] : []),
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderBottom: '1px solid #1a1a1a' }}>
              <div>
                <span style={{ fontSize: 13, fontFamily: '"Geist", -apple-system, sans-serif', color: row.color }}>
                  {row.label}
                </span>
                {'sub' in row && row.sub && (
                  <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a', marginTop: 1 }}>{row.sub}</div>
                )}
              </div>
              <span style={{ fontSize: 13, fontFamily: '"JetBrains Mono", monospace', color: row.color }}>
                RM {formatRM(Math.abs(row.val))}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 12, marginTop: 4 }}>
            <div>
              <span style={{ fontSize: 13, fontFamily: '"Geist", -apple-system, sans-serif', color: '#f5f5f4', fontWeight: 600 }}>Net take-home</span>
              <div style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#3a3a3a', marginTop: 1 }}>used as monthly income base</div>
            </div>
            <span style={{ fontSize: 20, fontFamily: '"JetBrains Mono", monospace', color: '#a3e635', fontWeight: 700 }}>
              RM {formatRM(netTakeHome)}
            </span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !hasGross}
        style={{
          background: loading || !hasGross ? '#1a1a1a' : '#a3e635',
          color: loading || !hasGross ? '#3a3a3a' : '#0d0d0d',
          border: 'none',
          borderRadius: 10,
          padding: '13px 0',
          fontSize: 14,
          fontWeight: 700,
          fontFamily: '"Geist", -apple-system, sans-serif',
          cursor: loading || !hasGross ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Saving…' : submitLabel}
      </button>

      <p style={{ fontSize: 11, color: '#3a3a3a', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
        SOCSO and EIS are estimated — override if your payslip differs. PCB varies by tax bracket; enter from your payslip.
      </p>
    </form>
  )
}
