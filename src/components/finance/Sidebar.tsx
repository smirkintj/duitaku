'use client'

import React, { useState } from 'react'
import { Icon } from './icons'

interface SidebarProps {
  active: string
  setActive: (s: string) => void
  expanded: boolean
  setExpanded: (v: boolean) => void
  userName?: string
  userEmail?: string
  onLogout?: () => void
}

interface NavItem {
  key: string
  label: string
  icon: Parameters<typeof Icon>[0]['name']
  pill?: string
  disabled?: boolean
}

const NAV_MAIN: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'add', label: 'Add', icon: 'add' },
  { key: 'transactions', label: 'Transactions', icon: 'tx' },
  { key: 'bills', label: 'Bills', icon: 'bills' },
  { key: 'trends', label: 'Trends', icon: 'trends' },
  { key: 'import', label: 'Import', icon: 'import' },
  { key: 'ai', label: 'AI Coach', icon: 'ai', pill: 'AI' },
]

const NAV_SECONDARY: NavItem[] = [
  { key: 'savings', label: 'Savings', icon: 'savings' },
  { key: 'investments', label: 'Investments', icon: 'invest' },
  { key: 'loans', label: 'Loans', icon: 'loans' },
  { key: 'merchants', label: 'Merchants', icon: 'merchant' },
  { key: 'categories', label: 'Categories', icon: 'cats' },
  { key: 'accounts', label: 'Accounts', icon: 'accounts' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

function NavButton({
  item,
  active,
  expanded,
  onClick,
}: {
  item: NavItem
  active: boolean
  expanded: boolean
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const disabled = !!item.disabled

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: expanded ? '9px 14px' : '9px 0',
        justifyContent: expanded ? 'flex-start' : 'center',
        borderRadius: 8,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: active
          ? 'rgba(163,230,53,0.08)'
          : hovered
            ? 'rgba(255,255,255,0.03)'
            : 'transparent',
        color: disabled ? '#3a3a38' : active ? '#a3e635' : hovered ? '#d0d0cf' : '#7a7a78',
        transition: 'background 160ms, color 160ms',
        outline: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {active && (
        <span
          style={{
            position: 'absolute',
            left: expanded ? -10 : -8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 18,
            borderRadius: 2,
            background: '#a3e635',
          }}
        />
      )}
      <Icon name={item.icon} width={18} height={18} style={{ flexShrink: 0 }} />
      {expanded && (
        <>
          <span style={{ fontSize: 13.5, fontFamily: '"Geist", -apple-system, sans-serif', fontWeight: 500 }}>
            {item.label}
          </span>
          {disabled ? (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 9,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#3a3a38',
                border: '1px solid #2a2a2a',
                borderRadius: 4,
                padding: '1px 5px',
                letterSpacing: '0.06em',
              }}
            >
              SOON
            </span>
          ) : item.pill ? (
            <span
              style={{
                marginLeft: 'auto',
                fontSize: 9,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#a3e635',
                border: '1px solid rgba(163,230,53,0.4)',
                borderRadius: 4,
                padding: '1px 5px',
                letterSpacing: '0.06em',
              }}
            >
              {item.pill}
            </span>
          ) : null}
        </>
      )}
    </button>
  )
}

export default function Sidebar({ active, setActive, expanded, setExpanded, userName, userEmail, onLogout }: SidebarProps) {
  return (
    <div
      style={{
        width: expanded ? 220 : 64,
        minWidth: expanded ? 220 : 64,
        background: '#0a0a0a',
        borderRight: '1px solid #1a1a1a',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 240ms cubic-bezier(.2,.8,.2,1), min-width 240ms cubic-bezier(.2,.8,.2,1)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: expanded ? '18px 14px 16px' : '18px 0 16px',
          justifyContent: expanded ? 'flex-start' : 'center',
          borderBottom: '1px solid #141414',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: '#a3e635',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 15,
            color: '#0d0d0d',
            flexShrink: 0,
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          d
        </div>
        {expanded && (
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#f5f5f4',
              fontFamily: '"Geist", -apple-system, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            duitaku<span style={{ color: '#a3e635' }}>.</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_MAIN.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={active === item.key}
            expanded={expanded}
            onClick={() => setActive(item.key)}
          />
        ))}

        <div style={{ height: 1, background: '#141414', margin: '8px 0' }} />

        {NAV_SECONDARY.map((item) => (
          <NavButton
            key={item.key}
            item={item}
            active={active === item.key}
            expanded={expanded}
            onClick={() => setActive(item.key)}
          />
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: '10px 8px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #141414', flexShrink: 0 }}>
        {/* Collapse toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: expanded ? '8px 10px' : '8px 0',
            justifyContent: expanded ? 'flex-start' : 'center',
            borderRadius: 8,
            border: '1px solid #1f1f1f',
            cursor: 'pointer',
            background: 'transparent',
            color: '#5b5b59',
            outline: 'none',
          }}
        >
          {expanded && (
            <span
              style={{
                fontSize: 9,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: '0.1em',
                color: '#5b5b59',
              }}
            >
              COLLAPSE
            </span>
          )}
          <Icon name={expanded ? 'chevL' : 'chevR'} width={14} height={14} style={{ marginLeft: expanded ? 'auto' : undefined }} />
        </button>

        {/* Profile chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: expanded ? '6px 10px' : '6px 0', justifyContent: expanded ? 'flex-start' : 'center', borderRadius: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #a3e635 0%, #4ade80 100%)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#0d0d0d', fontFamily: '"Geist", -apple-system, sans-serif' }}>
            {(userName ?? userEmail ?? 'U')[0].toUpperCase()}
          </div>
          {expanded && (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#d0d0cf', fontFamily: '"Geist", -apple-system, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName ?? userEmail ?? 'My Account'}
              </span>
              <span style={{ fontSize: 9, color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.06em' }}>
                {userEmail ?? ''}
              </span>
            </div>
          )}
          {expanded && onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
