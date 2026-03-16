'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { RecurringExpense } from '@/lib/supabase'

const catIcon: Record<string, string> = { fatura: '📄', aidat: '🏢', personel: '👤', sirket: '🏭', vergi: '📋', kredi: '🏦', sigorta: '🛡', nakit: '💵', diger: '📦' }
const catColor: Record<string, string> = { fatura: '#0d9488', aidat: '#d97706', personel: '#7c3aed', sirket: '#059669', vergi: '#dc2626', kredi: '#dc2626', sigorta: '#059669', nakit: '#64748b', diger: '#64748b' }

const emptyForm = { name: '', category: 'fatura', subcategory: '', amount: '', currency: 'TRY', payment_day: '', is_variable: false, remind_days_before: '3' }

export default function RecurringPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('tumu')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function load() {
    const { data } = await supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day', { nullsFirst: false })
    setExpenses(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const categories = ['tumu', ...Array.from(new Set(expenses.map(e => e.category)))]
  const filtered = filter === 'tumu' ? expenses : expenses.filter(e => e.category === filter)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(e: RecurringExpense) {
    setEditId(e.id)
    setForm({ name: e.name, category: e.category, subcategory: e.subcategory || '', amount: String(e.amount), currency: e.currency, payment_day: String(e.payment_day || ''), is_variable: e.is_variable, remind_days_before: String(e.remind_days_before || '3') })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const payload = { name: form.name, category: form.category, subcategory: form.subcategory || null, amount: parseFloat(form.amount) || 0, currency: form.currency, payment_day: parseInt(form.payment_day) || null, is_variable: form.is_variable, remind_days_before: parseInt(form.remind_days_before) || 3, is_active: true }
    if (editId) { await supabase.from('recurring_expenses').update(payload).eq('id', editId) }
    else { await supabase.from('recurring_expenses').insert(payload) }
    setSaving(false); closeForm(); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('recurring_expenses').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null); await load()
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <BottomNav />
      <div className="app-main pb-24 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>Modul</div>
            <div className="text-xl font-bold mt-0.5">Duzenli Giderler</div>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">+ Ekle</button>
        </div>

        <div className="flex gap-3 mx-4 mb-4">
          <div className="flex-1 card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Aylik</div>
            <div className="mono text-base font-bold amt-red">{fmt(totalAll)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{expenses.length} kalem</div>
          </div>
          <div className="flex-1 card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Secili Filtre</div>
            <div className="mono text-base font-bold amt-blue">{fmt(total)}</div>
            <div className="text-[10px] mt-1 capitalize" style={{ color: 'var(--muted)' }}>{filter}</div>
          </div>
        </div>

        <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize"
              style={{
                background: filter === cat ? 'var(--accent-mid)' : 'var(--bg3)',
                border: `1px solid ${filter === cat ? 'var(--accent)' : 'var(--border)'}`,
                color: filter === cat ? 'var(--accent)' : 'var(--muted)',
                boxShadow: filter === cat ? 'none' : 'var(--shadow)',
              }}>
              {catIcon[cat] || ''} {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 mx-4">
          {filtered.map((exp) => {
            const days = exp.payment_day ? daysUntil(exp.payment_day) : null
            const color = catColor[exp.category] || '#64748b'
            return (
              <div key={exp.id} className="card px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'var(--bg4)' }}>
                  {catIcon[exp.category] || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{exp.name}</div>
                  <div className="text-[11px] mt-0.5 capitalize" style={{ color: 'var(--muted)' }}>
                    {exp.category}{exp.subcategory ? ` · ${exp.subcategory}` : ''}{days !== null ? ` · ${daysUntilLabel(days)}` : ''}
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <div className="mono text-sm font-semibold" style={{ color }}>{fmt(exp.amount, exp.currency)}</div>
                    {exp.payment_day && <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>ayin {exp.payment_day}'i</div>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(exp)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--bg4)' }}>✏️</button>
                    <button onClick={() => setDeleteConfirm(exp.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Gideri Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu gideri silmek istediginize emin misiniz?</div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1 py-2.5 text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card w-full max-w-lg rounded-b-none p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editId ? 'Gideri Duzenle' : 'Yeni Gider'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Gider Adi</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: Elektrik" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kategori</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
                      {Object.keys(catIcon).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Alt Kategori</label>
                    <input value={form.subcategory} onChange={e => set('subcategory', e.target.value)} placeholder="Opsiyonel" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                    <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odeme Gunu</label>
                    <input value={form.payment_day} onChange={e => set('payment_day', e.target.value)} placeholder="1-31" type="number" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hatirlatma (gun)</label>
                    <input value={form.remind_days_before} onChange={e => set('remind_days_before', e.target.value)} type="number" className="input" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_variable} onChange={e => set('is_variable', e.target.checked)} className="w-4 h-4 rounded accent-[#0d9488]" />
                  <span style={{ color: 'var(--muted)' }}>Degisken tutar</span>
                </label>
              </div>
              <button onClick={handleSave} disabled={saving || !form.name || !form.amount}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
