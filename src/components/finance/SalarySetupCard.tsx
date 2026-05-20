'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import SalaryForm, { SalaryFormValues } from './SalaryForm'

export default function SalarySetupCard() {
  const router = useRouter()

  async function handleSubmit(values: SalaryFormValues) {
    const today = new Date().toISOString().slice(0, 10)
    await fetch('/api/salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...values, effectiveFrom: today, currency: 'MYR' }),
    })
    router.refresh()
  }

  return (
    <div
      style={{
        background: '#111',
        border: '1px solid #222',
        borderRadius: 20,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 42, height: 42, background: '#a3e635', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 20, color: '#0d0d0d', fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
        }}>d</div>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: '0 0 3px' }}>Welcome to duitaku.</h1>
          <p style={{ fontSize: 13, color: '#5b5b59', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0 }}>Set up your monthly payslip to get started.</p>
        </div>
      </div>

      <SalaryForm submitLabel="Get started →" onSubmit={handleSubmit} />
    </div>
  )
}
