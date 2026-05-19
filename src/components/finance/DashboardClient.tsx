'use client'

import React, { useState, useCallback } from 'react'
import TopHeader from './TopHeader'
import PaydayModal from './PaydayModal'
import { useRouter } from 'next/navigation'

interface DashboardClientProps {
  remaining: number
  salary: number
  month: string
  hasPaidThisMonth: boolean
  salaryDefault: number
}

export default function DashboardClient({ remaining, salary, month, hasPaidThisMonth, salaryDefault }: DashboardClientProps) {
  const [showPayday, setShowPayday] = useState(false)
  const router = useRouter()

  const refresh = useCallback(() => router.refresh(), [router])

  return (
    <>
      <TopHeader
        remaining={remaining}
        salary={salary}
        month={month}
        onAdd={() => window.dispatchEvent(new CustomEvent('open-add-modal'))}
        onPayday={() => setShowPayday(true)}
        hasPaidThisMonth={hasPaidThisMonth}
      />
      {showPayday && (
        <PaydayModal
          defaultAmount={salaryDefault}
          onClose={() => setShowPayday(false)}
          onSaved={() => { setShowPayday(false); refresh() }}
        />
      )}
    </>
  )
}
