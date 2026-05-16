'use client'

import React, { useState, useEffect, useCallback } from 'react'
import TopHeader from './TopHeader'
import AddTransactionModal from './AddTransactionModal'
import { useRouter } from 'next/navigation'

interface DashboardClientProps {
  remaining: number
  salary: number
  month: string // YYYY-MM
}

export default function DashboardClient({ remaining, salary, month }: DashboardClientProps) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  const openModal = useCallback(() => setShowModal(true), [])
  const closeModal = useCallback(() => setShowModal(false), [])

  // ⌘N keyboard shortcut
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
        onAdd={openModal}
      />
      {showModal && (
        <AddTransactionModal
          onClose={closeModal}
          onSuccess={() => {
            closeModal()
            router.refresh()
          }}
        />
      )}
    </>
  )
}
