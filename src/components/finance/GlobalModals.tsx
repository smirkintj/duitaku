'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import AddTransactionModal from './AddTransactionModal'

export default function GlobalModals({ children }: { children: React.ReactNode }) {
  const [showAdd, setShowAdd] = useState(false)
  const router = useRouter()

  const open = useCallback(() => setShowAdd(true), [])

  useEffect(() => {
    window.addEventListener('open-add-modal', open)
    return () => window.removeEventListener('open-add-modal', open)
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setShowAdd(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {children}
      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); router.refresh() }}
        />
      )}
    </>
  )
}
