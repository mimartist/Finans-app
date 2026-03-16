'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { RecurringExpense } from '@/lib/supabase'

const catIcon: Record<string, string> = {
  fatura: '📄', aidat: '🏢', personel: '👤',
  sirket: '🏭', vergi: '📋', kredi: '🏦',
  sigorta: '🛡', nakit: '💵', diger: '📦',
}
const catColor: Record<string, string> = {
  fatura: '#6c8fff', aidat: '#f59e0b', personel: '#a78bfa',
  sirket: '#4ade9a', vergi: '#f87171', kredi: '#f87171',
  sigorta: '#4ade9a', nakit: '#6b7280', diger: '#6b7280',
}

const emptyForm = { name: '', category: 'fatura', subcategory: '', amount: '', currency: 'TRY', payment_day: '', is_variable: false, remind_days_before: '3' }

export default function RecurringPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('tümü')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function load() {
    const { data } = await supabase
      .from('recurring_expenses')
      .select('*')
      .eq('is_active', true)
      .order('payment_day', { nullsFirst: false })
    setExpenses(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const categories = ['tümü', ...Array.from(new Set(expenses.map(e => e.category)))]
  const filtered = filter === 'tümü' ? expenses : expenses.filter(e => e.category === filter)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }

  function openEdit(e: RecurringExpense) {
    setEditId(e.id)
    setForm({
      name: e.name, category: e.category, subcategory: e.subcategory || '',
      amount: String(e.amount), currency: e.currency, payment_day: String(e.payment_day || ''),
      is_variable: e.is_variable, remind_days_before: String(e.remind_days_before || '3'),
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const payload = {
      name: form.name, category: form.category, subcategory: form.subcategory || null,
      amount: parseFloat(form.amount) || 0, currency: form.currency,
      payment_day: parseInt(form.payment_day) || null,
      is_variable: form.is_variable, remind_days_before: parseInt(form.remind_days_before) || 3,
      is_active: true,
    }
    if (editId) {
      await supabase.from('recurring_expenses').update(payload).eq('id', editId)
    } else {
      await supabase.from('recurring_expenses').insert(payload)
    }
    setSaving(false)
    closeForm()
    await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('recurring_expenses').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null)
    await load()
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>

  return (
    <div className="pb-24 page-enter">
      <div className="flex justify-between items-center px-5 pt-5 pb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Modül</div>
          <div className="text-lg font-semibold mt-0.5">Düzenli Giderler</div>
        </div>
        <button onClick={openAdd} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'rgba(108,143,255,0.15)', color: '#6c8fff' }}>+</button>
      </div>

      {/* Özet */}
      <div className="flex gap-2 mx-4 mb-4">
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Aylık</div>
          <div className="mono text-base font-medium amt-red">{fmt(totalAll)}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{expenses.length} kalem</div>
        </div>
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Seçili Filtre</div>
          <div className="mono text-base font-medium amt-blue">{fmt(total)}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{filter}</div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium capitalize"
            style={{
              background: filter === cat ? '#6c8fff22' : 'var(--bg3)',
              border: `1px solid ${filter === cat ? '#6c8fff60' : 'var(--border)'}`,
              color: filter === cat ? '#6c8fff' : 'var(--muted)',
            }}
          >
            {catIcon[cat] || ''} {cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 mx-4">
        {filtered.map((exp) => {
          const days = exp.payment_day ? daysUntil(exp.payment_day) : null
          const color = catColor[exp.category] || '#6b7280'
          return (
            <div key={exp.id} className="card px-4 py-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: color + '18' }}
              >
                {catIcon[exp.category] || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{exp.name}</div>
                <div className="text-[11px] mt-0.5 capitalize" style={{ color: 'var(--muted)' }}>
                  {exp.category}{exp.subcategory ? ` · ${exp.subcategory}` : ''}
                  {days !== null ? ` · ${daysUntilLabel(days)}` : ''}
                </div>
              </div>
              <div className="text-right flex items-center gap-2">
                <div>
                  <div className="mono text-sm font-medium" style={{ color }}>{fmt(exp.amount, exp.currency)}</div>
                  {exp.payment_day && (
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>ayın {exp.payment_day}'i</div>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(exp)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{ background: 'var(--bg4)' }}>✏️</button>
                  <button onClick={() => setDeleteConfirm(exp.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                    style={{ background: 'rgba(248,113,113,0.12)' }}>🗑️</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card p-5 w-full max-w-sm">
            <div className="text-sm font-semibold mb-2">Gideri Sil</div>
            <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu gideri silmek istediginize emin misiniz?</div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'var(--bg4)', color: 'var(--text)' }}>Iptal</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(248,113,113,0.2)', color: '#f87171' }}>Sil</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card w-full max-w-lg rounded-b-none p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm font-semibold">{editId ? 'Gideri Duzenle' : 'Yeni Gider'}</div>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Gider Adi</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: Elektrik"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kategori</label>
                  <select value={form.category} onChange={e => set('category', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    {Object.keys(catIcon).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Alt Kategori</label>
                  <input value={form.subcategory} onChange={e => set('subcategory', e.target.value)} placeholder="Opsiyonel"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mono"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option value="TRY">TRY</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odeme Gunu</label>
                  <input value={form.payment_day} onChange={e => set('payment_day', e.target.value)} placeholder="1-31" type="number"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hatirlatma (gun)</label>
                  <input value={form.remind_days_before} onChange={e => set('remind_days_before', e.target.value)} type="number"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_variable} onChange={e => set('is_variable', e.target.checked)}
                  className="w-4 h-4 rounded" />
                <span style={{ color: 'var(--muted)' }}>Degisken tutar</span>
              </label>
            </div>
            <button onClick={handleSave} disabled={saving || !form.name || !form.amount}
              className="w-full mt-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #6c8fff, #a78bfa)', color: '#fff',
                opacity: saving || !form.name || !form.amount ? 0.4 : 1 }}>
              {saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
