'use client'

import React, { useState, useEffect, useCallback } from 'react'
import TopHeader from './TopHeader'
import AddTransactionModal from './AddTransactionModal'
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
  const [showModal, setShowModal] = useState(false)
  const [showPayday, setShowPayday] = useState(false)
  const router = useRouter()

  const refresh = useCallback(() => router.refresh(), [router])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setShowModal(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <>
      <TopHeader
        remaining={remaining}
        salary={salary}
        month={month}
        onAdd={() => setShowModal(true)}
        onPayday={() => setShowPayday(true)}
        hasPaidThisMonth={hasPaidThisMonth}
      />
      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); refresh() }}
        />
      )}
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
