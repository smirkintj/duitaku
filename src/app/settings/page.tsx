'use client'

import React, { useState, useEffect } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import SalaryForm, { SalaryFormValues, SalaryFormDefaults } from '@/components/finance/SalaryForm'
import { formatRM } from '@/lib/finance-utils'

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

export default function SettingsPage() {
  const [current, setCurrent] = useState<{ amount: number; grossAmount?: number } | null>(null)
  const [defaults, setDefaults] = useState<SalaryFormDefaults | undefined>()
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [payDay, setPayDay] = useState<number>(1)
  const [payDayInput, setPayDayInput] = useState('1')
  const [payDaySaved, setPayDaySaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/salary').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([salaryData, settingsData]) => {
      if (salaryData) {
        setCurrent({ amount: salaryData.amount, grossAmount: salaryData.grossAmount })
        const today = new Date()
        const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
        setDefaults({
          grossAmount: salaryData.grossAmount ?? undefined,
          epfEmployee: salaryData.epfEmployee ?? undefined,
          socso: salaryData.socso ?? undefined,
          eis: salaryData.eis ?? undefined,
          pcb: salaryData.pcb ?? undefined,
          otherDeductions: salaryData.otherDeductions ?? undefined,
          effectiveFrom: firstOfMonth,
        })
      }
      if (settingsData?.payDay) {
        setPayDay(settingsData.payDay)
        setPayDayInput(String(settingsData.payDay))
      }
      setLoading(false)
    })
  }, [])

  async function handlePayDaySave() {
    const day = Math.min(31, Math.max(1, parseInt(payDayInput, 10) || 1))
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payDay: day }),
    })
    setPayDay(day)
    setPayDayInput(String(day))
    setPayDaySaved(true)
    setTimeout(() => setPayDaySaved(false), 2500)
  }

  async function handleSave(values: SalaryFormValues) {
    await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, currency: 'MYR' }),
    })
    setCurrent({ amount: values.amount, grossAmount: values.grossAmount })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>APP</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Settings</span>
          </div>
        </div>

        <div style={{ padding: '32px', maxWidth: 560 }}>
          {/* Current salary summary */}
          {!loading && current && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '18px 24px', marginBottom: 20, display: 'flex', gap: 32 }}>
              <div>
                <div style={{ ...S.label, marginBottom: 5 }}>NET TAKE-HOME</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#a3e635', ...S.sans, letterSpacing: '-0.02em' }}>
                  RM {formatRM(current.amount)}
                </div>
              </div>
              {current.grossAmount && (
                <div>
                  <div style={{ ...S.label, marginBottom: 5 }}>GROSS</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#7a7a78', ...S.sans, letterSpacing: '-0.02em' }}>
                    RM {formatRM(current.grossAmount)}
                  </div>
                </div>
              )}
            </div>
          )}

          {saved && (
            <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.2)', borderRadius: 10 }}>
              <span style={{ fontSize: 13, color: '#a3e635', fontFamily: '"Geist", -apple-system, sans-serif', fontWeight: 500 }}>Salary updated successfully.</span>
            </div>
          )}

          {/* Salary form */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ ...S.label, marginBottom: 16 }}>UPDATE PAYSLIP</div>
            {loading ? (
              <div style={{ fontSize: 13, color: '#5b5b59', ...S.sans }}>Loading…</div>
            ) : (
              <SalaryForm
                defaults={defaults}
                showEffectiveFrom
                submitLabel={current ? 'Update Salary' : 'Set Salary'}
                onSubmit={handleSave}
              />
            )}
          </div>

          <div style={{ marginTop: 12, padding: '12px 16px', background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.1)', borderRadius: 10 }}>
            <p style={{ fontSize: 12, color: '#5b5b59', ...S.sans, margin: 0, lineHeight: 1.6 }}>
              Salary history is preserved — each update adds a new entry. The most recent entry on or before the current month is used for budget calculations.
            </p>
          </div>

          {/* Pay cycle section */}
          <div style={{ marginTop: 28, background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ ...S.label, marginBottom: 6 }}>PAY CYCLE</div>
            <p style={{ fontSize: 13, color: '#5b5b59', ...S.sans, margin: '0 0 20px', lineHeight: 1.6 }}>
              Set the day your salary arrives. Budget cycles will run from this day each month — e.g. day 28 means 28 Nov → 27 Dec.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ ...S.label }}>SALARY ARRIVES ON DAY</label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={payDayInput}
                  onChange={e => setPayDayInput(e.target.value)}
                  style={{
                    width: 80,
                    background: '#0d0d0d',
                    border: '1px solid #2a2a2a',
                    borderRadius: 8,
                    color: '#f5f5f4',
                    fontSize: 15,
                    fontWeight: 600,
                    padding: '8px 12px',
                    fontFamily: '"JetBrains Mono", monospace',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={handlePayDaySave}
                style={{
                  marginTop: 22,
                  background: '#a3e635',
                  color: '#0d0d0d',
                  border: 'none',
                  borderRadius: 8,
                  padding: '9px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  ...S.sans,
                }}
              >
                Save
              </button>
              {payDaySaved && (
                <span style={{ marginTop: 22, fontSize: 13, color: '#a3e635', ...S.sans }}>Saved!</span>
              )}
            </div>
            {payDay > 1 && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.12)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: '#7a7a78', ...S.sans }}>
                  Current cycle: <span style={{ color: '#a3e635', fontWeight: 600 }}>day {payDay} of each month</span>. Dashboard navigates by pay cycle instead of calendar month.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
