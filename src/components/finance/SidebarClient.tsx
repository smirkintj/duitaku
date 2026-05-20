'use client'

import React, { useState } from 'react'
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
  '/categories': 'categories',
  '/accounts': 'accounts',
  '/settings': 'settings',
}

export default function SidebarClient() {
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)

  const active = PATH_TO_KEY[pathname] ?? 'dashboard'

  function handleSetActive(key: string) {
    if (key === 'add') {
      // Fire custom event for DashboardClient to pick up
      window.dispatchEvent(new CustomEvent('open-add-modal'))
      return
    }
    const route = ROUTE_MAP[key]
    if (route) router.push(route)
  }

  return (
    <Sidebar
      active={active}
      setActive={handleSetActive}
      expanded={expanded}
      setExpanded={setExpanded}
    />
  )
}
