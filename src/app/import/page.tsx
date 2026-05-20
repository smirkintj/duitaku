'use client'

import React, { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon } from '@/components/finance/icons'

interface ParsedTx {
  date: string
  merchant: string
  amount: number
  type: string
  importHash: string
  categoryId?: string
}

interface ReviewRow extends ParsedTx {
  _id: number
  excluded: boolean
  editing: boolean
  duplicate: boolean  // flagged as likely already in the system
}

interface Category {
  id: string
  name: string
}

const S = {
  label: { display: 'block', fontSize: 11, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em', marginBottom: 6 } as React.CSSProperties,
  input: { width: '100%', background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none', boxSizing: 'border-box' as const, colorScheme: 'dark' as const },
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    setRows([])
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (password) formData.append('password', password)

      const res = await fetch('/api/import/pdf', { method: 'POST', body: formData })
      const data = await res.json() as { transactions?: ParsedTx[]; error?: string; needsPassword?: boolean }

      if (!res.ok || data.error) {
        if (data.needsPassword) setNeedsPassword(true)
        throw new Error(data.error ?? 'Import failed')
      }

      setNeedsPassword(false)
      const parsed = data.transactions ?? []
      const initialRows: ReviewRow[] = parsed.map((tx, i) => ({ ...tx, _id: i, excluded: false, editing: false, duplicate: false }))
      setRows(initialRows)

      const [catsRes, dupRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/import/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactions: initialRows }),
        }),
      ])
      setCategories(await catsRes.json())

      const { duplicateIds } = await dupRes.json() as { duplicateIds: number[] }
      if (duplicateIds.length > 0) {
        const dupSet = new Set(duplicateIds)
        setRows(prev => prev.map(r => dupSet.has(r._id) ? { ...r, duplicate: true, excluded: true } : r))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const update = useCallback((id: number, patch: Partial<ReviewRow>) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, ...patch } : r))
  }, [])

  const included = rows.filter(r => !r.excluded)
  const autoExcluded = rows.filter(r => r.duplicate).length
  const totalExpense = included.filter(r => r.type === 'expense').reduce((a, r) => a + r.amount, 0)
  const totalIncome = included.filter(r => r.type === 'income').reduce((a, r) => a + r.amount, 0)

  async function handleConfirm() {
    setConfirming(true)
    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: included }),
      })
      const data = await res.json() as { imported: number; skipped: number }
      setResult(data)
      setTimeout(() => router.push('/'), 2000)
    } catch {
      setError('Failed to save transactions')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ ...S.mono, fontSize: 10, color: '#5b5b59', letterSpacing: '0.08em' }}>FINANCE</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Import Statement</span>
          </div>
        </div>

        <div style={{ padding: '28px 32px', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Upload card */}
          <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, padding: '24px 28px' }}>
            <div style={{ ...S.mono, fontSize: 10, color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 14 }}>UPLOAD PDF</div>
            <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setFile(f) }}
                style={{ border: `1.5px dashed ${file ? '#a3e635' : '#2a2a2a'}`, borderRadius: 10, padding: '24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 140ms', background: file ? 'rgba(163,230,53,0.03)' : 'transparent' }}
              >
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <div style={{ fontSize: 13, color: file ? '#a3e635' : '#5b5b59', ...S.sans }}>
                  {file ? file.name : 'Drop PDF here or click to browse'}
                </div>
              </div>

              {(needsPassword || password) && (
                <div>
                  <label style={S.label}>PDF Password</label>
                  <input autoFocus type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter PDF password" style={{ ...S.input, borderColor: needsPassword && !password ? '#ef4444' : undefined }} />
                </div>
              )}

              {error && <div style={{ fontSize: 13, color: '#ef4444', ...S.sans }}>{error}</div>}

              <button type="submit" disabled={!file || loading} style={{ background: !file || loading ? '#1a1a1a' : '#a3e635', color: !file || loading ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 14, fontWeight: 700, ...S.sans, cursor: !file || loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Parsing PDF…' : 'Parse PDF'}
              </button>
            </form>
          </div>

          {/* Review */}
          {rows.length > 0 && (
            <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
              {/* Summary bar */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f5f5f4', ...S.sans }}>{included.length} of {rows.length} selected</span>
                  {autoExcluded > 0 && (
                    <span style={{ fontSize: 11, ...S.mono, color: '#fbbf24', marginLeft: 10, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 5, padding: '2px 7px' }}>
                      {autoExcluded} already recorded
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  {totalExpense > 0 && <div style={{ fontSize: 12, ...S.mono, color: '#ef4444' }}>−RM {totalExpense.toFixed(2)} expenses</div>}
                  {totalIncome > 0 && <div style={{ fontSize: 12, ...S.mono, color: '#a3e635' }}>+RM {totalIncome.toFixed(2)} income</div>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setRows(prev => prev.map(r => ({ ...r, excluded: false })))} style={{ fontSize: 11, ...S.mono, color: '#5b5b59', background: 'transparent', border: '1px solid #222', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>select all</button>
                  <button onClick={() => setRows(prev => prev.map(r => ({ ...r, excluded: true })))} style={{ fontSize: 11, ...S.mono, color: '#5b5b59', background: 'transparent', border: '1px solid #222', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>deselect all</button>
                </div>
                {result ? (
                  <div style={{ fontSize: 13, color: '#a3e635', ...S.sans, fontWeight: 500 }}>
                    Saved {result.imported}, skipped {result.skipped} duplicates. Redirecting…
                  </div>
                ) : (
                  <button onClick={handleConfirm} disabled={confirming || included.length === 0} style={{ background: confirming || included.length === 0 ? '#1a1a1a' : '#a3e635', color: confirming || included.length === 0 ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, ...S.sans, cursor: confirming || included.length === 0 ? 'not-allowed' : 'pointer' }}>
                    {confirming ? 'Saving…' : `Save ${included.length} transactions`}
                  </button>
                )}
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '32px 100px 1fr 96px 130px 80px 32px', gap: 10, padding: '8px 16px', borderBottom: '1px solid #1a1a1a' }}>
                {['', 'Date', 'Merchant', 'Amount', 'Category', 'Type', ''].map((h, i) => (
                  <span key={i} style={{ fontSize: 10, ...S.mono, color: '#3a3a3a', letterSpacing: '0.06em' }}>{h}</span>
                ))}
              </div>

              {/* Rows */}
              {rows.map(row => (
                <ReviewRowItem key={row._id} row={row} categories={categories} onUpdate={update} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewRowItem({ row, categories, onUpdate }: {
  row: ReviewRow
  categories: Category[]
  onUpdate: (id: number, patch: Partial<ReviewRow>) => void
}) {
  const dim = row.excluded

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px 100px 1fr 96px 130px 80px 32px',
      gap: 10,
      padding: '10px 16px',
      borderBottom: '1px solid #0f0f0f',
      alignItems: 'center',
      opacity: dim ? 0.35 : 1,
      transition: 'opacity 150ms',
      background: dim ? 'transparent' : undefined,
    }}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={!row.excluded}
        onChange={e => onUpdate(row._id, { excluded: !e.target.checked })}
        style={{ accentColor: '#a3e635', width: 14, height: 14, cursor: 'pointer' }}
      />

      {/* Date */}
      {row.editing ? (
        <input
          type="date"
          value={row.date}
          onChange={e => onUpdate(row._id, { date: e.target.value })}
          style={{ ...editInput, fontSize: 11 }}
        />
      ) : (
        <span style={{ fontSize: 11, ...{ fontFamily: '"JetBrains Mono", monospace' }, color: '#7a7a78', cursor: 'text' }} onClick={() => onUpdate(row._id, { editing: true })}>
          {row.date}
        </span>
      )}

      {/* Merchant */}
      {row.editing ? (
        <input
          value={row.merchant}
          onChange={e => onUpdate(row._id, { merchant: e.target.value })}
          style={{ ...editInput }}
        />
      ) : (
        <span style={{ fontSize: 13, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={() => onUpdate(row._id, { editing: true })} title={row.merchant}>
          {row.merchant}
        </span>
      )}

      {/* Amount */}
      {row.editing ? (
        <input
          type="number"
          step="0.01"
          min="0"
          value={row.amount}
          onChange={e => onUpdate(row._id, { amount: parseFloat(e.target.value) || 0 })}
          style={{ ...editInput }}
        />
      ) : (
        <span style={{ fontSize: 13, fontWeight: 600, color: row.type === 'income' ? '#a3e635' : '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', cursor: 'text' }} onClick={() => onUpdate(row._id, { editing: true })}>
          RM {row.amount.toFixed(2)}
        </span>
      )}

      {/* Category */}
      <select
        value={row.categoryId ?? ''}
        onChange={e => onUpdate(row._id, { categoryId: e.target.value || undefined })}
        style={{ background: '#0d0d0d', border: '1px solid #1f1f1f', borderRadius: 6, padding: '4px 6px', fontSize: 11, color: '#d0d0cf', fontFamily: '"Geist", -apple-system, sans-serif', colorScheme: 'dark', outline: 'none', width: '100%' }}
      >
        <option value="">Uncategorized</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Type toggle / duplicate badge */}
      {row.duplicate && row.excluded ? (
        <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 5, padding: '3px 7px', whiteSpace: 'nowrap' }}>
          DUPLICATE
        </span>
      ) : (
        <button
          onClick={() => onUpdate(row._id, { type: row.type === 'expense' ? 'income' : 'expense' })}
          style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: row.type === 'income' ? '#a3e635' : '#7a7a78', border: `1px solid ${row.type === 'income' ? 'rgba(163,230,53,0.3)' : '#222'}`, borderRadius: 5, padding: '3px 7px', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {row.type.toUpperCase()}
        </button>
      )}

      {/* Edit / done */}
      <button
        onClick={() => onUpdate(row._id, { editing: !row.editing })}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: row.editing ? '#a3e635' : '#3a3a3a', padding: 0, display: 'flex', alignItems: 'center' }}
        title={row.editing ? 'Done' : 'Edit'}
      >
        {row.editing
          ? <Icon name="close" width={14} height={14} />
          : <Icon name="arrowDown" width={14} height={14} />
        }
      </button>
    </div>
  )
}

const editInput: React.CSSProperties = {
  background: '#0d0d0d',
  border: '1px solid #333',
  borderRadius: 5,
  padding: '4px 6px',
  fontSize: 12,
  color: '#f5f5f4',
  fontFamily: '"Geist", -apple-system, sans-serif',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}
