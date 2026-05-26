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
  cashflow: '/cashflow',
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
  '/cashflow': 'cashflow',
  '/savings': 'savings',
  '/investments': 'investments',
  '/loans': 'loans',
  '/merchants': 'merchants',
  '/categories': 'categories',
  '/accounts': 'accounts',
  '/settings': 'settings',
}

// Map feature flag keys to sidebar nav item keys
const FLAG_TO_NAV: Record<string, string> = {
  nav_dashboard: 'dashboard',
  nav_transactions: 'transactions',
  nav_trends: 'trends',
  nav_import: 'import',
  nav_ai: 'ai',
  nav_bills: 'bills',
  nav_cashflow: 'cashflow',
  nav_savings: 'savings',
  nav_investments: 'investments',
  nav_loans: 'loans',
  nav_merchants: 'merchants',
  nav_categories: 'categories',
  nav_accounts: 'accounts',
}

export default function SidebarClient() {
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null)
  const [disabledKeys, setDisabledKeys] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d) setUser(d) })
  }, [])

  useEffect(() => {
    fetch('/api/feature-flags')
      .then(r => r.ok ? r.json() : {})
      .then((flags: Record<string, boolean>) => {
        const disabled: string[] = []
        for (const [flagKey, navKey] of Object.entries(FLAG_TO_NAV)) {
          if (flags[flagKey] === false) disabled.push(navKey)
        }
        setDisabledKeys(disabled)
      })
      .catch(() => {})
  }, [])

  const active = PATH_TO_KEY[pathname] ?? 'dashboard'

  function handleSetActive(key: string) {
    if (key === 'add') {
      window.dispatchEvent(new CustomEvent('open-add-modal'))
      return
    }
    const route = ROUTE_MAP[key]
    if (!route) return
    // Preserve the ?m= cycle param when navigating between cycle-aware pages
    const cycleAware = new Set(['dashboard', 'transactions', 'cashflow', 'trends'])
    if (cycleAware.has(key)) {
      const m = new URLSearchParams(window.location.search).get('m')
      router.push(m ? `${route}?m=${m}` : route)
    } else {
      router.push(route)
    }
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
      disabledKeys={disabledKeys}
    />
  )
}
