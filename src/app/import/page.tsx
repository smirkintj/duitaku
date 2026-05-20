'use client'

import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import SidebarClient from '@/components/finance/SidebarClient'

interface ParsedTx {
  date: string
  merchant: string
  amount: number
  type: string
  importHash: string
  categoryId?: string
}

interface Category {
  id: string
  name: string
}

export default function ImportPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsPassword, setNeedsPassword] = useState(false)
  const [transactions, setTransactions] = useState<ParsedTx[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError('')
    setTransactions([])

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
      setTransactions(data.transactions ?? [])

      // Load categories for dropdowns
      const catsRes = await fetch('/api/categories')
      const cats = await catsRes.json() as Category[]
      setCategories(cats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      const res = await fetch('/api/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      })
      const data = await res.json() as { imported: number; skipped: number }
      setResult(data)
      setTimeout(() => router.push('/'), 1500)
    } catch {
      setError('Failed to save transactions')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: '0 0 8px' }}>
            Import CC Statement
          </h1>
          <p style={{ fontSize: 13, color: '#7a7a78', fontFamily: '"Geist", -apple-system, sans-serif', margin: '0 0 32px' }}>
            Upload a PDF credit card statement to automatically extract and import transactions.
          </p>

          {/* Upload card */}
          <div
            style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: 16,
              padding: '28px 32px',
              marginBottom: 24,
            }}
          >
            <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: '1.5px dashed #2a2a2a',
                  borderRadius: 12,
                  padding: '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 140ms',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files[0]
                  if (f?.type === 'application/pdf') setFile(f)
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, color: file ? '#a3e635' : '#5b5b59', fontFamily: '"Geist", -apple-system, sans-serif' }}>
                  {file ? file.name : 'Drop PDF here or click to browse'}
                </div>
                {!file && (
                  <div style={{ fontSize: 11, color: '#3a3a3a', fontFamily: '"JetBrains Mono", monospace', marginTop: 4 }}>
                    PDF files only
                  </div>
                )}
              </div>

              {/* Password — shown always if user typed one, or after server says it's needed */}
              {(needsPassword || password) && (
                <div>
                  <label style={labelStyle}>PDF Password</label>
                  <input
                    autoFocus
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter PDF password"
                    style={{ ...inputStyle, borderColor: needsPassword && !password ? '#ef4444' : undefined }}
                  />
                </div>
              )}

              {error && (
                <div style={{ fontSize: 13, color: '#ef4444', fontFamily: '"Geist", -apple-system, sans-serif' }}>
                  {error}
                  {needsPassword && !password && (
                    <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: '#7a7a78' }}>
                      Enter the password above and try again.
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!file || loading}
                style={{
                  background: !file || loading ? '#222' : '#a3e635',
                  color: !file || loading ? '#555' : '#0d0d0d',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: '"Geist", -apple-system, sans-serif',
                  cursor: !file || loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Parsing PDF…' : 'Import'}
              </button>
            </form>
          </div>

          {/* Review table */}
          {transactions.length > 0 && (
            <div
              style={{
                background: '#111',
                border: '1px solid #222',
                borderRadius: 16,
                padding: '24px 28px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', margin: 0 }}>
                  Review — {transactions.length} transactions found
                </h2>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  style={{
                    background: confirming ? '#222' : '#a3e635',
                    color: '#0d0d0d',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 20px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: '"Geist", -apple-system, sans-serif',
                    cursor: confirming ? 'not-allowed' : 'pointer',
                  }}
                >
                  {confirming ? 'Saving…' : 'Confirm & Save'}
                </button>
              </div>

              {result && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.3)', borderRadius: 8, fontSize: 13, color: '#a3e635', fontFamily: '"Geist", -apple-system, sans-serif' }}>
                  Saved {result.imported} transactions, skipped {result.skipped} duplicates. Redirecting…
                </div>
              )}

              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px 140px 90px', gap: 12, paddingBottom: 8, borderBottom: '1px solid #1a1a1a', marginBottom: 4 }}>
                {['Date', 'Merchant', 'Amount', 'Category', 'Type'].map((h) => (
                  <span key={h} style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.06em' }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Rows */}
              {transactions.map((tx, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 100px 140px 90px',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: i < transactions.length - 1 ? '1px solid #141414' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 12, color: '#a0a09e', fontFamily: '"JetBrains Mono", monospace' }}>
                    {tx.date}
                  </span>
                  <span style={{ fontSize: 13, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.merchant}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: tx.type === 'income' ? '#a3e635' : '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>
                    RM {tx.amount.toFixed(2)}
                  </span>
                  <select
                    value={tx.categoryId ?? ''}
                    onChange={(e) => {
                      const updated = [...transactions]
                      updated[i] = { ...updated[i], categoryId: e.target.value || undefined }
                      setTransactions(updated)
                    }}
                    style={{
                      background: '#0d0d0d',
                      border: '1px solid #222',
                      borderRadius: 6,
                      padding: '4px 8px',
                      fontSize: 12,
                      color: '#d0d0cf',
                      fontFamily: '"Geist", -apple-system, sans-serif',
                      colorScheme: 'dark',
                    }}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: '"JetBrains Mono", monospace',
                      color: tx.type === 'income' ? '#a3e635' : '#7a7a78',
                      border: `1px solid ${tx.type === 'income' ? 'rgba(163,230,53,0.3)' : '#222'}`,
                      borderRadius: 4,
                      padding: '2px 6px',
                      textAlign: 'center',
                    }}
                  >
                    {tx.type.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#5b5b59',
  letterSpacing: '0.06em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0d0d0d',
  border: '1px solid #222',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 14,
  color: '#f5f5f4',
  fontFamily: '"Geist", -apple-system, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  colorScheme: 'dark',
}
