import React from 'react'

interface BudgetBarProps {
  spent: number
  budget: number
  height?: number
}

export default function BudgetBar({ spent, budget, height = 6 }: BudgetBarProps) {
  const isOver = spent > budget
  const pct = isOver ? (budget / spent) * 100 : (spent / budget) * 100

  return (
    <div
      style={{
        background: '#161616',
        borderRadius: 100,
        height,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {!isOver ? (
        <div
          style={{
            width: `${Math.min(pct, 100)}%`,
            height: '100%',
            background: '#a3e635',
            borderRadius: 100,
          }}
        />
      ) : (
        <>
          {/* lime portion up to budget */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: `${pct}%`,
              height: '100%',
              background: '#a3e635',
              borderRadius: 100,
            }}
          />
          {/* red hatch for overspend */}
          <div
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: 0,
              right: 0,
              height: '100%',
              background: 'repeating-linear-gradient(135deg, transparent 0 3px, #ef4444 3px 4.4px)',
              borderRadius: '0 100px 100px 0',
            }}
          />
        </>
      )}
    </div>
  )
}
