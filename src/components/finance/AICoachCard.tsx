'use client'

import React, { useState, useEffect } from 'react'
import { Icon } from './icons'
import { ShootingStarLayer } from './celestial'

interface Bullet {
  tone: 'warn' | 'ok' | 'tip'
  text: string
}

interface PlanStep {
  step: number
  title: string
  amount: number
  status: 'Done' | 'Recommended' | 'Optional'
  note: string
}

interface CoachData {
  summary: string
  bullets: Bullet[]
  plan: PlanStep[]
  noApiKey?: boolean
  generatedAt?: string
}

interface AICoachCardProps {
  month: string // YYYY-MM
}

const BULLET_COLORS: Record<string, string> = {
  warn: '#fbbf24',
  ok: '#a3e635',
  tip: '#7a7a78',
}

const STATUS_STYLES: Record<string, { color: string; label: string }> = {
  Done: { color: '#a3e635', label: '✓ DONE' },
  Recommended: { color: '#a3e635', label: 'RECOMMENDED' },
  Optional: { color: '#5b5b59', label: 'OPTIONAL' },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AICoachCard({ month }: AICoachCardProps) {
  const [coach, setCoach] = useState<CoachData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [noApiKey, setNoApiKey] = useState(false)

  useEffect(() => {
    setCoach(null)
    setError('')
    setNoApiKey(false)
    setLoading(true)
    fetch(`/api/insights?month=${month}`)
      .then((r) => r.json())
      .then((data: { stored: CoachData | null; generatedAt?: string }) => {
        if (data.stored) setCoach({ ...data.stored, generatedAt: data.generatedAt })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month])

  const generate = async () => {
    setGenerating(true)
    setError('')
    setNoApiKey(false)
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const data = await res.json() as CoachData & { error?: string; generatedAt?: string }
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      if (data.noApiKey) {
        setNoApiKey(true)
      } else {
        setCoach(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: '1px solid #1a1a1a',
        background: 'linear-gradient(180deg, #0f0f0f 0%, #0d0d0d 100%)',
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <ShootingStarLayer />

      {/* Lime glow */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          left: -100,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: '#a3e635',
          opacity: 0.05,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, position: 'relative', zIndex: 1 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                border: '1px solid rgba(163,230,53,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a3e635',
              }}
            >
              <Icon name="ai" width={15} height={15} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 600, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>
              AI Coach
            </span>
          </div>
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
            {coach?.generatedAt
              ? `LAST GENERATED ${fmtDate(coach.generatedAt).toUpperCase()}`
              : 'AI-POWERED FINANCIAL INSIGHTS'}
          </span>
        </div>
        <button
          onClick={generate}
          disabled={generating || loading}
          style={{
            background: 'transparent',
            border: '1px solid #1f1f1f',
            borderRadius: 8,
            color: generating || loading ? '#5b5b59' : '#7a7a78',
            fontSize: 12,
            fontFamily: '"Geist", -apple-system, sans-serif',
            padding: '6px 12px',
            cursor: generating || loading ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'Generating…' : coach ? 'Regenerate' : 'Generate insights'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: '#ef4444', fontSize: 13, fontFamily: '"Geist", -apple-system, sans-serif', marginBottom: 16, position: 'relative', zIndex: 1 }}>
          {error}
        </div>
      )}

      {/* No API key notice */}
      {noApiKey && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '16px',
            borderRadius: 10,
            border: '1px solid rgba(163,230,53,0.15)',
            background: 'rgba(163,230,53,0.04)',
            marginBottom: 16,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1, color: '#a3e635' }}>
            <Icon name="ai" width={18} height={18} />
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#d0d0cf', fontFamily: '"Geist", -apple-system, sans-serif' }}>
              Anthropic API key not configured
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#7a7a78', fontFamily: '"Geist", -apple-system, sans-serif', lineHeight: 1.5 }}>
              Add <code style={{ fontFamily: '"JetBrains Mono", monospace', color: '#a3e635', fontSize: 11 }}>ANTHROPIC_API_KEY</code> to your Vercel environment variables to enable AI-powered insights. Get a key at{' '}
              <span style={{ color: '#a3e635' }}>console.anthropic.com</span>.
            </p>
          </div>
        </div>
      )}

      {/* Loading state (initial fetch) */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', position: 'relative', zIndex: 1, color: '#3a3a3a', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>
          LOADING…
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div style={{ padding: '32px 0', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #a3e63540', borderTopColor: '#a3e635', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: '#a3e635', letterSpacing: '0.06em' }}>ANALYZING YOUR FINANCES…</span>
          </div>
          <div style={{ width: 240, height: 2, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #a3e635 0%, #a3e63560 50%, #a3e635 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite', borderRadius: 2 }} />
          </div>
          <div style={{ fontFamily: '"Geist", -apple-system, sans-serif', fontSize: 12, color: '#5b5b59', textAlign: 'center', maxWidth: 280 }}>
            Reading spending patterns, bills, savings goals and CC data for {month}
          </div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
          `}</style>
        </div>
      )}

      {/* Empty state */}
      {!coach && !loading && !generating && !error && !noApiKey && (
        <div style={{ textAlign: 'center', padding: '40px 0', position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 14, color: '#5b5b59', fontFamily: '"Geist", -apple-system, sans-serif', margin: '0 0 8px' }}>
            Get personalized financial insights powered by Claude AI.
          </p>
          <p style={{ fontSize: 12, color: '#3a3a3a', fontFamily: '"JetBrains Mono", monospace', margin: 0 }}>
            Click &quot;Generate insights&quot; to analyze your spending for {month}
          </p>
        </div>
      )}

      {/* Body */}
      {coach && !generating && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            gap: 24,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Left */}
          <div>
            <p
              style={{
                fontSize: 16,
                fontFamily: '"Geist", -apple-system, sans-serif',
                color: '#d0d0cf',
                lineHeight: 1.55,
                margin: '0 0 16px',
              }}
            >
              {coach.summary}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {coach.bullets.map((bullet, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: BULLET_COLORS[bullet.tone] ?? '#7a7a78',
                      marginTop: 5,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 13.5, color: '#a0a09e', fontFamily: '"Geist", -apple-system, sans-serif', lineHeight: 1.5 }}>
                    {bullet.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' }}>
                WHERE TO DEPLOY SURPLUS
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {coach.plan.map((step) => {
                const isRec = step.status === 'Recommended'
                const isDone = step.status === 'Done'
                const statusStyle = STATUS_STYLES[step.status] ?? STATUS_STYLES['Optional']

                return (
                  <div
                    key={step.step}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: isRec ? '1px solid rgba(163,230,53,0.2)' : '1px solid transparent',
                      background: isRec ? 'rgba(163,230,53,0.04)' : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        background: isDone ? 'rgba(163,230,53,0.12)' : '#161616',
                        border: isDone ? '1px solid rgba(163,230,53,0.3)' : '1px solid #222',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        color: isDone ? '#a3e635' : '#7a7a78',
                        flexShrink: 0,
                      }}
                    >
                      {step.step}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#d0d0cf', fontFamily: '"Geist", -apple-system, sans-serif', display: 'block' }}>
                        {step.title}
                      </span>
                      <span style={{ fontSize: 11.5, color: '#5b5b59', fontFamily: '"Geist", -apple-system, sans-serif' }}>
                        {step.note}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isDone ? (
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: '"JetBrains Mono", monospace',
                            color: '#a3e635',
                            border: '1px solid rgba(163,230,53,0.3)',
                            borderRadius: 4,
                            padding: '2px 6px',
                          }}
                        >
                          ✓ DONE
                        </span>
                      ) : step.amount > 0 ? (
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', display: 'block' }}>
                          RM {step.amount.toLocaleString()}
                        </span>
                      ) : null}
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: '"JetBrains Mono", monospace',
                          color: statusStyle.color,
                          letterSpacing: '0.06em',
                          display: 'block',
                          marginTop: 2,
                        }}
                      >
                        {isDone ? '' : statusStyle.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
