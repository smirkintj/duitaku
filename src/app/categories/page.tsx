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
  blockLabel: { display: 'block', fontSize: 10, fontFamily: '"JetBrains Mono", monospace', color: '#5b5b59', letterSpacing: '0.08em', marginBottom: 6 } as React.CSSProperties,
  sans: { fontFamily: '"Geist", -apple-system, sans-serif' } as React.CSSProperties,
  input: { background: '#0d0d0d', border: '1px solid #222', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#f5f5f4', fontFamily: '"Geist", -apple-system, sans-serif', outline: 'none', width: '100%', boxSizing: 'border-box', colorScheme: 'dark' } as React.CSSProperties,
}

function CategoryForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial: { name: string; icon: CatIconName; type: string; monthlyLimit: string }
  onSubmit: (v: typeof initial) => Promise<void>
  submitLabel: string
}) {
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSubmit(form)
    setSaving(false)
  }

  return (
    <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <label style={S.blockLabel}>NAME</label>
        <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Food & Drink" style={S.input} />
      </div>
      <div>
        <label style={S.blockLabel}>TYPE</label>
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
        <label style={S.blockLabel}>ICON</label>
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
        <label style={S.blockLabel}>MONTHLY LIMIT (RM, optional)</label>
        <input type="number" min="0" step="0.01" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} placeholder="e.g. 500" style={S.input} />
      </div>
      <button type="submit" disabled={saving}
        style={{ background: saving ? '#1a1a1a' : '#a3e635', color: saving ? '#3a3a3a' : '#0d0d0d', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', ...S.sans, marginTop: 4 }}>
        {saving ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
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
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/categories')
    setCats(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addCategory(form: { name: string; icon: CatIconName; type: string; monthlyLimit: string }) {
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, icon: form.icon, type: form.type, monthlyLimit: form.monthlyLimit ? parseFloat(form.monthlyLimit) : null }),
    })
    setShowAdd(false)
    load()
  }

  async function editCategory(form: { name: string; icon: CatIconName; type: string; monthlyLimit: string }) {
    if (!editCat) return
    await fetch(`/api/categories/${editCat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, icon: form.icon, type: form.type, monthlyLimit: form.monthlyLimit ? parseFloat(form.monthlyLimit) : null }),
    })
    setEditCat(null)
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
            [{ label: 'EXPENSE CATEGORIES', items: expense }, { label: 'INCOME CATEGORIES', items: income }].map(group =>
              group.items.length > 0 && (
                <div key={group.label}>
                  <div style={{ ...S.label, marginBottom: 12 }}>{group.label}</div>
                  <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 36px 36px', gap: 12, padding: '10px 20px', borderBottom: '1px solid #1a1a1a' }}>
                      {['', 'NAME', 'MONTHLY LIMIT', '', ''].map((h, i) => <span key={i} style={S.label}>{h}</span>)}
                    </div>
                    {group.items.map((cat, i) => (
                      <div key={cat.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 36px 36px', gap: 12, padding: '13px 20px', borderBottom: i < group.items.length - 1 ? '1px solid #141414' : 'none', alignItems: 'center' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3e635' }}>
                          <CategoryIcon name={cat.icon as CatIconName} width={16} height={16} />
                        </div>
                        <span style={{ fontSize: 13, color: '#f5f5f4', ...S.sans }}>{cat.name}</span>
                        <span style={{ fontSize: 12, color: cat.monthlyLimit ? '#d0d0cf' : '#3a3a3a', fontFamily: '"JetBrains Mono", monospace' }}>
                          {cat.monthlyLimit ? `RM ${cat.monthlyLimit.toFixed(0)}` : '—'}
                        </span>
                        <button
                          onClick={() => setEditCat(cat)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 4, transition: 'color 140ms' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#a3e635' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                          title="Edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          disabled={deleting === cat.id}
                          style={{ background: 'transparent', border: 'none', cursor: deleting === cat.id ? 'default' : 'pointer', color: '#3a3a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, padding: 4, transition: 'color 140ms' }}
                          onMouseEnter={e => { if (deleting !== cat.id) e.currentTarget.style.color = '#ef4444' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#3a3a3a' }}
                          title="Delete"
                        >
                          <Icon name="close" width={14} height={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )
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
          <CategoryForm
            initial={{ name: '', icon: 'bag', type: 'expense', monthlyLimit: '' }}
            onSubmit={addCategory}
            submitLabel="Create Category"
          />
        </Modal>
      )}

      {editCat && (
        <Modal title="Edit Category" onClose={() => setEditCat(null)}>
          <CategoryForm
            initial={{ name: editCat.name, icon: editCat.icon as CatIconName, type: editCat.type, monthlyLimit: editCat.monthlyLimit?.toString() ?? '' }}
            onSubmit={editCategory}
            submitLabel="Save Changes"
          />
        </Modal>
      )}
    </div>
  )
}
