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

  useEffect(() => {
    fetch('/api/salary').then(r => r.json()).then(data => {
      if (data) {
        setCurrent({ amount: data.amount, grossAmount: data.grossAmount })
        const today = new Date()
        const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
        setDefaults({
          grossAmount: data.grossAmount ?? undefined,
          epfEmployee: data.epfEmployee ?? undefined,
          socso: data.socso ?? undefined,
          eis: data.eis ?? undefined,
          pcb: data.pcb ?? undefined,
          otherDeductions: data.otherDeductions ?? undefined,
          effectiveFrom: firstOfMonth,
        })
      }
      setLoading(false)
    })
  }, [])

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
        </div>
      </div>
    </div>
  )
}
