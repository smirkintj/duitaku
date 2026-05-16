'use client'

import React, { useState, useEffect, useCallback } from 'react'
import SidebarClient from '@/components/finance/SidebarClient'
import { Icon, CategoryIcon } from '@/components/finance/icons'

interface Category {
  id: string
  name: string
  icon: string
  color: string
  type: string
  monthlyLimit: number | null
}

const ICONS = ['bag', 'bowl', 'leaf', 'plane', 'car', 'bolt', 'play', 'pulse', 'film', 'income', 'expense'] as const
type CatIconName = typeof ICONS[number]

const S = {
  label: { fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em' } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  mono: { fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
  input: {
    background: '#0d0d0d', border: '1px solid #222', borderRadius: 8,
    padding: '9px 12px', fontSize: 13, color: '#f5f5f4',
    fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none',
    width: '100%', boxSizing: 'border-box', colorScheme: 'dark',
  } as React.CSSProperties,
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: '28px 32px', width: 400, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f4', ...S.sans }}>{title}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5b5b59' }}>
            <Icon name="close" width={18} height={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Add form state
  const [form, setForm] = useState({ name: '', icon: 'bag' as CatIconName, type: 'expense', monthlyLimit: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/categories')
    setCats(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        icon: form.icon,
        type: form.type,
        monthlyLimit: form.monthlyLimit ? parseFloat(form.monthlyLimit) : null,
      }),
    })
    setForm({ name: '', icon: 'bag', type: 'expense', monthlyLimit: '' })
    setShowAdd(false)
    load()
  }

  async function saveLimit(id: string, limit: string) {
    await fetch(`/api/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthlyLimit: limit ? parseFloat(limit) : null }),
    })
    setEditId(null)
    load()
  }

  async function deleteCategory(id: string) {
    setDeleting(id)
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    setCats(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  const expense = cats.filter(c => c.type === 'expense')
  const income = cats.filter(c => c.type === 'income')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SidebarClient />
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ height: 72, background: '#0d0d0d', borderBottom: '1px solid #141414', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={S.label}>MANAGE</span>
            <span style={{ fontSize: 18, fontWeight: 600, ...S.sans, color: '#f5f5f4' }}>Categories</span>
          </div>
          <button onClick={() => setShowAdd(true)} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '0 14px', height: 36, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, ...S.sans }}>
            + New Category
          </button>
        </div>

        <div style={{ padding: '24px 32px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loading ? (
            <div style={{ ...S.label, padding: '40px 0', textAlign: 'center' }}>LOADING…</div>
          ) : (
            [{ label: 'EXPENSE CATEGORIES', items: expense }, { label: 'INCOME CATEGORIES', items: income }].map(group => (
              group.items.length > 0 && (
                <div key={group.label}>
                  <div style={{ ...S.label, marginBottom: 12 }}>{group.label}</div>
                  <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
                    {/* Header row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 36px', gap: 12, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                      {['', 'NAME', 'MONTHLY LIMIT', ''].map((h, i) => <span key={i} style={S.label}>{h}</span>)}
                    </div>
                    {group.items.map((cat, i) => (
                      <CatRow
                        key={cat.id}
                        cat={cat}
                        isLast={i === group.items.length - 1}
                        editId={editId}
                        setEditId={setEditId}
                        onSaveLimit={saveLimit}
                        onDelete={deleteCategory}
                        deleting={deleting}
                      />
                    ))}
                  </div>
                </div>
              )
            ))
          )}

          {!loading && cats.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ ...S.label, marginBottom: 12 }}>NO CATEGORIES YET</div>
              <button onClick={() => setShowAdd(true)} style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 9, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600, ...S.sans }}>
                Add your first category
              </button>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <Modal title="New Category" onClose={() => setShowAdd(false)}>
          <form onSubmit={addCategory} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>NAME</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Food & Drink" style={S.input} />
            </div>
            <div>
              <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>TYPE</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['expense', 'income'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${form.type === t ? '#a3e635' : '#222'}`, background: form.type === t ? 'rgba(163,230,53,0.08)' : 'transparent', color: form.type === t ? '#a3e635' : '#7a7a78', cursor: 'pointer', fontSize: 12, fontWeight: 600, ...S.sans }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>ICON</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${form.icon === ic ? '#a3e635' : '#222'}`, background: form.icon === ic ? 'rgba(163,230,53,0.08)' : 'transparent', color: form.icon === ic ? '#a3e635' : '#5b5b59', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CategoryIcon name={ic} width={16} height={16} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ ...S.label, display: 'block', marginBottom: 6 }}>MONTHLY LIMIT (RM, optional)</label>
              <input type="number" min="0" step="0.01" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} placeholder="e.g. 500" style={S.input} />
            </div>
            <button type="submit" style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', ...S.sans, marginTop: 4 }}>
              Create Category
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function CatRow({ cat, isLast, editId, setEditId, onSaveLimit, onDelete, deleting }: {
  cat: Category
  isLast: boolean
  editId: string | null
  setEditId: (id: string | null) => void
  onSaveLimit: (id: string, limit: string) => void
  onDelete: (id: string) => void
  deleting: string | null
}) {
  const [limitVal, setLimitVal] = useState(cat.monthlyLimit?.toString() ?? '')
  const isEditing = editId === cat.id

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px 36px', gap: 12, padding: '13px 20px', borderBottom: isLast ? 'none' : '1px solid #141414', alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3e635' }}>
        <CategoryIcon name={cat.icon as CatIconName} width={16} height={16} />
      </div>
      <span style={{ fontSize: 13, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif' }}>{cat.name}</span>
      <div>
        {isEditing ? (
          <form onSubmit={e => { e.preventDefault(); onSaveLimit(cat.id, limitVal) }} style={{ display: 'flex', gap: 6 }}>
            <input
              autoFocus
              type="number" min="0" step="0.01"
              value={limitVal}
              onChange={e => setLimitVal(e.target.value)}
              placeholder="No limit"
              style={{ flex: 1, background: '#0d0d0d', border: '1px solid #333', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: '#f5f5f4', fontFamily: '"JetBrains Mono", monospace', outline: 'none', colorScheme: 'dark' }}
            />
            <button type="submit" style={{ background: '#a3e635', color: '#0d0d0d', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
            <button type="button" onClick={() => setEditId(null)} style={{ background: 'transparent', border: '1px solid #222', borderRadius: 6, padding: '4px 8px', fontSize: 11, color: '#5b5b59', cursor: 'pointer' }}>✕</button>
          </form>
        ) : (
          <button onClick={() => { setLimitVal(cat.monthlyLimit?.toString() ?? ''); setEditId(cat.id) }}
            style={{ background: 'transparent', border: '1px dashed #222', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: cat.monthlyLimit ? '#d0d0cf' : '#3a3a3a', fontFamily: '"JetBrains Mono", monospace', cursor: 'pointer', transition: 'border-color 140ms' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#444'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#222'}
          >
            {cat.monthlyLimit ? `RM ${cat.monthlyLimit.toFixed(0)}` : 'Set limit'}
          </button>
        )}
      </div>
      <button
        onClick={() => onDelete(cat.id)}
        disabled={deleting === cat.id}
        style={{ background: 'transparent', border: 'none', cursor: deleting === cat.id ? 'default' : 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 4, transition: 'color 140ms' }}
        onMouseEnter={e => { if (deleting !== cat.id) e.currentTarget.style.color = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
      >
        <Icon name="close" width={14} height={14} />
      </button>
    </div>
  )
}
