'use client'

import React from 'react'
import { formatRM } from '@/lib/finance-utils'
import { CategoryIcon } from './icons'

type CategoryIconName = Parameters<typeof CategoryIcon>[0]['name']

interface Transaction {
  id: string
  merchant: string
  cat: string
  icon: CategoryIconName
  amount: number
  when: string
  recurring?: boolean
  income?: boolean
}

interface RecentTransactionsProps {
  transactions: Transaction[]
}

function TxRow({ tx, isLast }: { tx: Transaction; isLast: boolean }) {
  const isIncome = tx.income

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        gap: 14,
        padding: '12px 4px',
        borderBottom: isLast ? 'none' : '1px solid #141414',
        alignItems: 'center',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: isIncome ? 'rgba(163,230,53,0.10)' : '#161616',
          border: isIncome ? '1px solid rgba(163,230,53,0.3)' : '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isIncome ? '#a3e635' : '#a0a09e',
          flexShrink: 0,
        }}
      >
        <CategoryIcon name={tx.icon} width={15} height={15} />
      </div>

      {/* Middle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: '#f5f5f4',
              fontFamily: '"Geist", -apple-system, sans-serif',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {tx.merchant}
          </span>
          {tx.recurring && (
            <span
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: '#7a7a78',
                border: '1px solid #222',
                borderRadius: 4,
                padding: '1px 4px',
              }}
            >
              ↺
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            color: '#5b5b59',
          }}
        >
          {tx.cat} · {tx.when}
        </span>
      </div>

      {/* Amount */}
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          fontFamily: '"Geist", -apple-system, sans-serif',
          color: isIncome ? '#a3e635' : '#f5f5f4',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {isIncome ? '+' : '−'} RM {formatRM(Math.abs(tx.amount))}
      </span>
    </div>
  )
}

export default function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid #1a1a1a',
        background: '#0d0d0d',
        padding: '20px 24px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0 }}>
            Recent activity
          </h2>
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
            Last {transactions.length} transactions
          </span>
        </div>
        <button
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#a3e635',
            fontSize: 12,
            fontFamily: '"Geist", -apple-system, sans-serif',
            fontWeight: 500,
          }}
        >
          View all →
        </button>
      </div>

      {/* List */}
      {transactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
          No transactions this month
        </div>
      ) : (
        <div>
          {transactions.map((tx, i) => (
            <TxRow key={tx.id} tx={tx} isLast={i === transactions.length - 1} />
          ))}
        </div>
      )}
    </div>
  )
}
