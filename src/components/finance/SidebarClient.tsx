'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/',
  transactions: '/transactions',
  trends: '/trends',
  import: '/import',
  ai: '/insights',
  bills: '/bills',
  savings: '/savings',
  investments: '/investments',
  loans: '/loans',
  merchants: '/merchants',
  categories: '/categories',
  accounts: '/accounts',
  settings: '/settings',
}

const PATH_TO_KEY: Record<string, string> = {
  '/': 'dashboard',
  '/transactions': 'transactions',
  '/trends': 'trends',
  '/import': 'import',
  '/insights': 'ai',
  '/bills': 'bills',
  '/savings': 'savings',
  '/investments': 'investments',
  '/loans': 'loans',
  '/merchants': 'merchants',
  '/categories': 'categories',
  '/accounts': 'accounts',
  '/settings': 'settings',
}

export default function SidebarClient() {
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d) })
  }, [])

  const active = PATH_TO_KEY[pathname] ?? 'dashboard'

  function handleSetActive(key: string) {
    if (key === 'add') {
      window.dispatchEvent(new CustomEvent('open-add-modal'))
      return
    }
    const route = ROUTE_MAP[key]
    if (route) router.push(route)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar
      active={active}
      setActive={handleSetActive}
      expanded={expanded}
      setExpanded={setExpanded}
      userName={user?.name}
      userEmail={user?.email}
      onLogout={handleLogout}
    />
  )
}
