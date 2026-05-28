'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import { Icon } from './icons'

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

// Bottom nav items shown on mobile (most-used pages)
const BOTTOM_NAV_ITEMS = [
  { key: 'dashboard', icon: 'dashboard' as const, label: 'Home' },
  { key: 'transactions', icon: 'tx' as const, label: 'Txns' },
  { key: 'bills', icon: 'bills' as const, label: 'Bills' },
  { key: 'accounts', icon: 'accounts' as const, label: 'Accounts' },
  { key: 'settings', icon: 'settings' as const, label: 'More' },
]

export default function SidebarClient() {
  const router = useRouter()
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
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

  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const active = PATH_TO_KEY[pathname] ?? 'dashboard'

  function handleSetActive(key: string) {
    setMobileOpen(false)
    if (key === 'add') {
      window.dispatchEvent(new CustomEvent('open-add-modal'))
      return
    }
    const route = ROUTE_MAP[key]
    if (!route) return
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
    <>
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
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
      </div>

      {/* Mobile hamburger — shown via CSS class */}
      <button
        className="mobile-hamburger"
        onClick={() => setMobileOpen(true)}
        style={{
          position: 'fixed', top: 14, left: 14, zIndex: 150,
          background: '#0a0a0a', border: '1px solid #1a1a1a',
          borderRadius: 9, width: 40, height: 40,
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#7a7a78',
        }}
        aria-label="Open menu"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setMobileOpen(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            <Sidebar
              active={active}
              setActive={handleSetActive}
              expanded={true}
              setExpanded={() => {}}
              userName={user?.name}
              userEmail={user?.email}
              onLogout={handleLogout}
              disabledKeys={disabledKeys}
            />
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {BOTTOM_NAV_ITEMS.map(item => {
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => handleSetActive(item.key)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: isActive ? '#a3e635' : '#5b5b59',
                padding: '6px 12px', borderRadius: 8, minWidth: 52,
              }}
            >
              <Icon name={item.icon} width={20} height={20} />
              <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.04em' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
