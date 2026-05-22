'use client'

import React, { useState } from 'react'
import { formatRM } from '@/lib/finance-utils'
import { CategoryIcon } from './icons'
import BudgetBar from './BudgetBar'
import Sparkline from './Sparkline'

type CategoryIconName = Parameters<typeof CategoryIcon>[0]['name']

interface Category {
  id: string
  name: string
  icon: CategoryIconName
  budget: number
  spent: number
  prior3moAvg: number
  flag?: boolean
  spark: number[]
}

interface CategoriesBlockProps {
  categories: Category[]
  month: string
}

function sortCategories(cats: Category[], mode: string): Category[] {
  return [...cats].sort((a, b) => {
    if (a.flag && !b.flag) return -1
    if (!a.flag && b.flag) return 1
    const aOver = a.spent > a.budget
    const bOver = b.spent > b.budget
    if (aOver && !bOver) return -1
    if (!aOver && bOver) return 1
    if (mode === 'spend') return b.spent - a.spent
    if (mode === 'delta') return (b.spent / (b.budget || 1)) - (a.spent / (a.budget || 1))
    if (mode === 'az') return a.name.localeCompare(b.name)
    return b.spent - a.spent
  })
}

function CategoryCard({ cat }: { cat: Category }) {
  const isOver = cat.budget > 0 && cat.spent > cat.budget
  const isFlagged = cat.flag
  const pctLeft = cat.budget > 0 ? Math.max(0, (cat.budget - cat.spent) / cat.budget * 100) : 0
  const overAmt = cat.spent - cat.budget
  const deltaVsAvg = cat.prior3moAvg > 0
    ? ((cat.spent - cat.prior3moAvg) / cat.prior3moAvg) * 100
    : 0
  const deltaUp = deltaVsAvg > 0

  return (
    <div
      style={{
        borderRadius: 12,
        border: isFlagged ? '1px solid rgba(239,68,68,0.35)' : '1px solid #1a1a1a',
        background: isFlagged
          ? 'linear-gradient(180deg, rgba(239,68,68,0.05), transparent 60%)'
          : '#0f0f0f',
        padding: '14px 16px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {isFlagged && (
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            fontSize: 9,
            fontFamily: '"JetBrains Mono", monospace',
            color: '#fca5a5',
            border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: 4,
            padding: '1px 5px',
            letterSpacing: '0.08em',
          }}
        >
          FLAG
        </span>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: isFlagged ? 'rgba(239,68,68,0.12)' : '#161616',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isFlagged ? '#fca5a5' : '#a0a09e',
            flexShrink: 0,
          }}
        >
          <CategoryIcon name={cat.icon} width={16} height={16} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>
            {cat.name}
          </span>
          {cat.prior3moAvg > 0 && (
            <span
              style={{
                fontSize: 10,
                fontFamily: '"JetBrains Mono", monospace',
                color: deltaUp ? '#fbbf24' : '#a3e635',
              }}
            >
              {deltaUp ? '↑' : '↓'} {Math.abs(Math.round(deltaVsAvg))}% vs avg
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 9, fontFamily: '"JetBrains Mono", monospace', color: '#7a7a78', marginBottom: 1 }}>RM</span>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            fontFamily: '"Geist", -apple-system, sans-serif',
            color: isOver ? '#ef4444' : '#f5f5f4',
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatRM(cat.spent, 0)}
        </span>
        {cat.budget > 0 && (
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59' }}>
            / {formatRM(cat.budget, 0)}
          </span>
        )}
      </div>

      {/* Budget bar */}
      {cat.budget > 0 && <BudgetBar spent={cat.spent} budget={cat.budget} height={5} />}

      {/* Bottom: sparkline + caption */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ width: 80, flexShrink: 0 }}>
          <Sparkline data={cat.spark} height={28} color={isOver ? '#ef4444' : '#a3e635'} />
        </div>
        <span
          style={{
            fontSize: 10,
            fontFamily: '"JetBrains Mono", monospace',
            color: isOver ? '#ef4444' : '#5b5b59',
            textAlign: 'right',
          }}
        >
          {isOver
            ? `+RM ${formatRM(overAmt, 0)} over`
            : cat.budget > 0
              ? `${Math.round(pctLeft)}% left`
              : ''}
        </span>
      </div>
    </div>
  )
}

type SortMode = 'spend' | 'delta' | 'az'

const SORT_PILLS: { key: SortMode; label: string }[] = [
  { key: 'spend', label: 'By spend' },
  { key: 'delta', label: 'Over budget' },
  { key: 'az', label: 'A-Z' },
]

export default function CategoriesBlock({ categories, month }: CategoriesBlockProps) {
  const [sort, setSort] = useState<SortMode>('spend')
  const sorted = sortCategories(categories, sort)

  const monthLabel = new Date(month + '-01').toLocaleString('en-MY', { month: 'short', year: 'numeric' })

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0 }}>
            Categories
          </h2>
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
            {sorted.length} active · {monthLabel}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {SORT_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => setSort(p.key)}
              style={{
                fontSize: 11,
                fontFamily: '"JetBrains Mono", monospace',
                padding: '4px 10px',
                borderRadius: 6,
                border: sort === p.key ? '1px solid rgba(163,230,53,0.4)' : '1px solid #1f1f1f',
                background: sort === p.key ? 'rgba(163,230,53,0.06)' : 'transparent',
                color: sort === p.key ? '#a3e635' : '#7a7a78',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#5b5b59', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
          No category data for this month
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}
        >
          {sorted.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </div>
  )
}
