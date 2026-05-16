import React from 'react'

interface SparklineProps {
  data: number[]
  height?: number
  color?: string
  fill?: boolean
}

export default function Sparkline({ data, height = 28, color = '#a3e635', fill = true }: SparklineProps) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const w = 100
  const h = height
  const pad = 2

  const points = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((v / max) * (h - pad * 2)),
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
    >
      {fill && (
        <path
          d={fillPath}
          fill={color}
          fillOpacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
