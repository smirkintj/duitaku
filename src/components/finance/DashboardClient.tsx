'use client'

import React, { useState, useCallback } from 'react'
import TopHeader from './TopHeader'
import PaydayModal from './PaydayModal'
import SearchModal from './SearchModal'
import AffordModal from './AffordModal'
import OnboardingWizard from './OnboardingWizard'
import { useRouter } from 'next/navigation'

interface DashboardClientProps {
  remaining: number
  salary: number
  month: string
  cycleLabel?: string
  hasPaidThisMonth: boolean
  salaryDefault: number
  projectedRemaining: number
  daysLeft: number
  isNewUser?: boolean
}

export default function DashboardClient({ remaining, salary, month, cycleLabel, hasPaidThisMonth, salaryDefault, projectedRemaining, daysLeft, isNewUser }: DashboardClientProps) {
  const [showPayday, setShowPayday] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [showAfford, setShowAfford] = useState(false)
  const router = useRouter()

  const refresh = useCallback(() => router.refresh(), [router])

  // Global keyboard shortcuts
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') { e.preventDefault(); setShowAfford(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <OnboardingWizard isNewUser={isNewUser} />
      <TopHeader
        remaining={remaining}
        salary={salary}
        month={month}
        cycleLabel={cycleLabel}
        onAdd={() => window.dispatchEvent(new CustomEvent('open-add-modal'))}
        onPayday={() => setShowPayday(true)}
        onSearch={() => setShowSearch(true)}
        onAfford={() => setShowAfford(true)}
        hasPaidThisMonth={hasPaidThisMonth}
      />
      {showPayday && (
        <PaydayModal
          defaultAmount={salaryDefault}
          onClose={() => setShowPayday(false)}
          onSaved={() => { setShowPayday(false); refresh() }}
        />
      )}
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showAfford && (
        <AffordModal
          remaining={remaining}
          projectedRemaining={projectedRemaining}
          daysLeft={daysLeft}
          onClose={() => setShowAfford(false)}
        />
      )}
    </>
  )
}
