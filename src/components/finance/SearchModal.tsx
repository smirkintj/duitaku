'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { formatRM } from '@/lib/finance-utils'

interface SearchResult {
  id: string
  amount: number
  date: string
  type: string
  merchant: string | null
  note: string | null
  categoryName: string | null
  categoryIcon: string | null
  isRecurring: boolean
}

const S = {
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(163,230,53,0.25)', color: '#a3e635', borderRadius: 2, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const search = useCallback(async (query: string, typeFilter: string, fromDate: string, toDate: string) => {
    if (!query && !typeFilter && !fromDate && !toDate) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (typeFilter) params.set('type', typeFilter)
    if (fromDate) params.set('from', fromDate)
    if (toDate) params.set('to', toDate)
    try {
      const res = await fetch(`/api/transactions/search?${params}`)
      const data = await res.json()
      setResults(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(q, type, from, to), 280)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [q, type, from, to, search])

  const totalShown = results.reduce((a, r) => a + (r.type === 'expense' ? -r.amount : r.amount), 0)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', maxWidth: 660, background: '#111', border: '1px solid #222', borderRadius: 16, overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #1a1a1a' }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5b5b59" strokeWidth={2} strokeLinecap="round">
            <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search merchant, note…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 16, color: '#f5f5f4', ...S.sans }}
          />
          {(q || type || from || to) && (
            <button onClick={() => { setQ(''); setType(''); setFrom(''); setTo(''); setResults([]); setSearched(false) }}
              style={{ background: 'none', border: 'none', color: '#5b5b59', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
          )}
          <kbd style={{ fontSize: 10, color: '#3a3a3a', ...S.mono, border: '1px solid #2a2a2a', borderRadius: 4, padding: '2px 6px' }}>ESC</kbd>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 20px', borderBottom: '1px solid #1a1a1a', flexWrap: 'wrap' }}>
          {[{ v: '', label: 'All' }, { v: 'expense', label: 'Expenses' }, { v: 'income', label: 'Income' }].map(t => (
            <button key={t.v} onClick={() => setType(t.v)}
              style={{ fontSize: 11, ...S.mono, padding: '4px 10px', borderRadius: 6, border: `1px solid ${type === t.v ? '#a3e635' : '#222'}`, background: type === t.v ? 'rgba(163,230,53,0.1)' : 'transparent', color: type === t.v ? '#a3e635' : '#5b5b59', cursor: 'pointer' }}>
              {t.label}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 6, color: '#7a7a78', fontSize: 11, padding: '3px 8px', ...S.mono, colorScheme: 'dark' }} />
            <span style={{ color: '#3a3a3a', fontSize: 11 }}>–</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ background: '#0d0d0d', border: '1px solid #222', borderRadius: 6, color: '#7a7a78', fontSize: 11, padding: '3px 8px', ...S.mono, colorScheme: 'dark' }} />
          </div>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 440, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: '#5b5b59', ...S.sans }}>Searching…</div>
          )}
          {!loading && searched && results.length === 0 && (
            <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: '#5b5b59', ...S.sans }}>No transactions found.</div>
          )}
          {!loading && !searched && (
            <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: '#3a3a3a', ...S.sans }}>Type to search across all transactions</div>
          )}
          {!loading && results.length > 0 && results.map((r, i) => {
            const isIncome = r.type === 'income'
            const label = r.merchant || r.note || 'Unknown'
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px', borderBottom: i < results.length - 1 ? '1px solid #141414' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 13 }}>{r.categoryIcon ?? (isIncome ? '↓' : '↑')}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {highlight(label, q)}
                  </div>
                  <div style={{ fontSize: 11, color: '#5b5b59', ...S.mono, marginTop: 1 }}>
                    {r.date} {r.categoryName ? `· ${r.categoryName}` : ''}{r.isRecurring ? ' · recurring' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, ...S.mono, color: isIncome ? '#a3e635' : '#f5f5f4', flexShrink: 0 }}>
                  {isIncome ? '+' : '-'}RM {formatRM(r.amount)}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#5b5b59', ...S.mono }}>{results.length} result{results.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 12, ...S.mono, color: totalShown >= 0 ? '#a3e635' : '#ef4444', fontWeight: 700 }}>
              {totalShown >= 0 ? '+' : ''}RM {formatRM(Math.abs(totalShown))}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
