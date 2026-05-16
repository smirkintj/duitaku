import React from 'react'
import SidebarClient from '@/components/finance/SidebarClient'

export default function TransactionsPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.1em' }}>
            COMING SOON
          </span>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: '12px 0 8px' }}>
            Transactions
          </h1>
          <p style={{ fontSize: 14, color: '#7a7a78', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0 }}>
            Full transaction history and filtering coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
