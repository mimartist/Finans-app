'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { RecurringExpense } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, CATEGORY_GROUPS, getCategoryIcon, getCategoryLabel } from '@/lib/categories'
import { getCatIcon } from '@/components/Icons'

const emptyForm = {
  name: '', category: 'fatura', subcategory: '', amount: '', currency: 'TRY',
  payment_day: '', is_variable: false, remind_days_before: '3',
  expense_type: 'recurring' as 'recurring' | 'one_time',
  expense_date: '', end_date: '',
}

export default function RecurringPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('tumu')
  const [typeFilter, setTypeFilter] = useState<'all' | 'recurring' | 'one_time'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day', { nullsFirst: false })
    setExpenses(data || []); setLoading(false)
  }
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    load()
  }, [])

  const categories = ['tumu', ...Array.from(new Set(expenses.map(e => e.category)))]
  // Sort by payment day ascending (1-31 calendar order), items without day go last
  const getPayDay = (e: RecurringExpense) => {
    if (e.expense_type === 'one_time' && e.expense_date) {
      return new Date(e.expense_date).getDate()
    }
    return e.payment_day || 99
  }
  const filtered = (filter === 'tumu' ? expenses : expenses.filter(e => e.category === filter))
    .filter(e => typeFilter === 'all' ? true : (e.expense_type || 'recurring') === typeFilter)
    .sort((a, b) => getPayDay(a) - getPayDay(b))
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)
  const recurringCount = expenses.filter(e => (e.expense_type || 'recurring') === 'recurring').length
  const oneTimeCount = expenses.filter(e => e.expense_type === 'one_time').length

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(e: RecurringExpense) {
    setEditId(e.id)
    setForm({
      name: e.name, category: e.category, subcategory: e.subcategory || '',
      amount: String(e.amount), currency: e.currency,
      payment_day: String(e.payment_day || ''), is_variable: e.is_variable,
      remind_days_before: String(e.remind_days_before || '3'),
      expense_type: e.expense_type || 'recurring',
      expense_date: e.expense_date || '',
      end_date: e.end_date || '',
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name || !form.amount) return
    setSaving(true); setSaveError(null)
    const payload: any = {
      name: form.name, category: form.category, subcategory: form.subcategory || null,
      amount: parseFloat(form.amount) || 0, currency: form.currency,
      is_variable: form.is_variable, is_active: true,
      expense_type: form.expense_type,
      remind_days_before: parseInt(form.remind_days_before) || 3,
      ...(userId ? { user_id: userId } : {}),
    }
    if (form.expense_type === 'one_time') {
      payload.expense_date = form.expense_date || null
      payload.payment_day = form.expense_date ? new Date(form.expense_date).getDate() : null
      payload.end_date = null
    } else {
      payload.payment_day = parseInt(form.payment_day) || null
      payload.end_date = form.end_date || null
      payload.expense_date = null
    }
    let result
    if (editId) { result = await supabase.from('recurring_expenses').update(payload).eq('id', editId) }
    else { result = await supabase.from('recurring_expenses').insert(payload) }
    if (result.error) {
      console.error('Save error:', result.error)
      // Retry without new columns if they don't exist yet
      if (result.error.message?.includes('column') || result.error.code === '42703') {
        const { expense_type, expense_date, end_date, ...fallback } = payload
        if (editId) { result = await supabase.from('recurring_expenses').update(fallback).eq('id', editId) }
        else { result = await supabase.from('recurring_expenses').insert(fallback) }
        if (result.error) {
          setSaveError(`Hata: ${result.error.message}`)
          setSaving(false); return
        }
      } else {
        setSaveError(`Hata: ${result.error.message}`)
        setSaving(false); return
      }
    }
    setSaving(false); closeForm(); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('recurring_expenses').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null); await load()
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function getExpenseDate(exp: RecurringExpense) {
    if (exp.expense_type === 'one_time' && exp.expense_date) {
      const d = new Date(exp.expense_date)
      return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    }
    return null
  }

  function getDaysInfo(exp: RecurringExpense) {
    if (exp.expense_type === 'one_time' && exp.expense_date) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const target = new Date(exp.expense_date)
      target.setHours(0, 0, 0, 0)
      const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (diff < 0) return { days: diff, label: `${Math.abs(diff)} gün geçti`, isUrgent: true, isPast: true }
      return { days: diff, label: daysUntilLabel(diff), isUrgent: diff <= 3, isPast: false }
    }
    if (exp.payment_day) {
      const days = daysUntil(exp.payment_day)
      return { days, label: daysUntilLabel(days), isUrgent: days <= 3, isPast: false }
    }
    return null
  }

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <div className="bg-blobs"><div className="bg-blob-3" /><div className="bg-blob-4" /></div>
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold mt-0.5">Giderler</div>
          </div>
        </div>

        {/* Hero Card */}
        <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
          <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Aylik Gider</div>
          <div className="mono text-2xl font-extrabold mt-1" style={{ position: 'relative', zIndex: 2 }}>{fmt(totalAll)}</div>
          <div className="flex gap-2 mt-4" style={{ position: 'relative', zIndex: 2 }}>
            <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
              style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>DÜZENLİ</div>
              <div className="mono text-[12px] font-bold mt-0.5">{recurringCount}</div>
              <div className="mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(expenses.filter(e => (e.expense_type || 'recurring') === 'recurring').reduce((s, e) => s + e.amount, 0))}</div>
            </div>
            <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
              style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>TEK SEFERLİK</div>
              <div className="mono text-[12px] font-bold mt-0.5">{oneTimeCount}</div>
              <div className="mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(expenses.filter(e => e.expense_type === 'one_time').reduce((s, e) => s + e.amount, 0))}</div>
            </div>
            {filter !== 'tumu' && (
              <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                style={{ border: '1px solid rgba(134,239,172,0.25)', background: 'rgba(134,239,172,0.08)' }}>
                <div className="text-[9px] font-medium capitalize" style={{ color: 'rgba(134,239,172,0.7)' }}>{filter}</div>
                <div className="mono text-[12px] font-bold mt-0.5" style={{ color: '#86efac' }}>{fmt(total)}</div>
              </div>
            )}
          </div>
          <div className="text-[10px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)', position: 'relative', zIndex: 2 }}>
            {filtered.length} gider gösteriliyor
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 px-4 mb-3">
          {([['all', 'Tümü'], ['recurring', 'Düzenli'], ['one_time', 'Tek Seferlik']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setTypeFilter(val)}
              className="px-3 py-1.5 rounded-full text-[12px] font-medium"
              style={{
                background: typeFilter === val ? 'linear-gradient(135deg, #2b2d6e, #3d3f8f)' : 'transparent',
                border: typeFilter === val ? 'none' : '1.5px solid var(--border2)',
                color: typeFilter === val ? '#fff' : 'var(--text2)',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Category filter — no emojis, clean pills */}
        <div className="flex gap-1.5 px-4 mb-4 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-semibold capitalize"
              style={{
                background: filter === cat ? 'linear-gradient(135deg, #2b2d6e, #3d3f8f)' : 'transparent',
                border: filter === cat ? 'none' : '1.5px solid var(--border2)',
                color: filter === cat ? '#fff' : 'var(--text2)',
              }}>
              {getCategoryLabel(cat) || cat}
            </button>
          ))}
        </div>

        {/* Expense list */}
        <div className="flex flex-col mx-4">
          {filtered.map((exp) => {
            const info = getDaysInfo(exp)
            const isOneTime = exp.expense_type === 'one_time'
            const monthLabel = new Date().toLocaleDateString('tr-TR', { month: 'short' })
            const dayLabel = isOneTime && exp.expense_date
              ? `${new Date(exp.expense_date).getDate()} ${new Date(exp.expense_date).toLocaleDateString('tr-TR', { month: 'short' })}`
              : exp.payment_day ? `${exp.payment_day} ${monthLabel}` : ''
            const statusColor = info?.isUrgent ? '#e5484d' : info?.isPast ? '#e5a000' : 'var(--muted)'
            return (
              <div key={exp.id} className="tx-item" style={{ cursor: 'pointer' }} onClick={() => openEdit(exp)}>
                <div className="tx-icon">
                  {getCatIcon(exp.category, { color: 'var(--primary)', size: 20 })}
                </div>
                <div className="tx-info">
                  <div className="tx-name">
                    {exp.name}
                    {isOneTime && (
                      <span className="ml-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ background: 'var(--accent-light)', color: 'var(--primary)', verticalAlign: 'middle' }}>
                        TEK
                      </span>
                    )}
                  </div>
                  <div className="tx-detail" style={{ color: statusColor }}>
                    {dayLabel}{dayLabel && info ? ' · ' : ''}{info?.label || ''}
                  </div>
                </div>
                <div className="tx-amount">
                  <div className="tx-value">{fmt(exp.amount, exp.currency)}</div>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(exp) }}
                    className="tx-badge" style={{ background: 'var(--accent-light)', color: 'var(--primary)', border: 'none', cursor: 'pointer' }}>
                    Duzenle
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--muted)' }}>
              Gider bulunamadı
            </div>
          )}
        </div>

        {/* Delete confirm */}
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

        {/* Add/Edit form */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editId ? 'Gideri Duzenle' : 'Yeni Gider'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>

              {/* Expense type toggle */}
              <div className="flex gap-2 mb-4">
                <button onClick={() => set('expense_type', 'recurring')}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-center"
                  style={{
                    background: form.expense_type === 'recurring' ? 'var(--accent-mid)' : 'var(--bg3)',
                    border: `1.5px solid ${form.expense_type === 'recurring' ? 'var(--accent)' : 'var(--border)'}`,
                    color: form.expense_type === 'recurring' ? 'var(--accent)' : 'var(--muted)',
                  }}>
                  🔄 Düzenli
                </button>
                <button onClick={() => set('expense_type', 'one_time')}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-center"
                  style={{
                    background: form.expense_type === 'one_time' ? 'var(--accent-mid)' : 'var(--bg3)',
                    border: `1.5px solid ${form.expense_type === 'one_time' ? 'var(--accent)' : 'var(--border)'}`,
                    color: form.expense_type === 'one_time' ? 'var(--accent)' : 'var(--muted)',
                  }}>
                  📌 Tek Seferlik
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Gider Adi</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: Elektrik" className="input" />
                </div>

                {/* Category - grouped select */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kategori</label>
                    <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
                      {CATEGORY_GROUPS.map(group => (
                        <optgroup key={group} label={group}>
                          {EXPENSE_CATEGORIES.filter(c => c.group === group).map(c => (
                            <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Alt Kategori</label>
                    <input value={form.subcategory} onChange={e => set('subcategory', e.target.value)} placeholder="Opsiyonel" className="input" />
                  </div>
                </div>

                {/* Amount */}
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

                {/* Date fields - conditional on expense_type */}
                {form.expense_type === 'one_time' ? (
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Gider Tarihi</label>
                    <input value={form.expense_date} onChange={e => set('expense_date', e.target.value)} type="date" className="input" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odeme Gunu</label>
                        <input value={form.payment_day} onChange={e => set('payment_day', e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Bitis Tarihi</label>
                        <input value={form.end_date} onChange={e => set('end_date', e.target.value)} type="date" className="input" placeholder="Opsiyonel" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hatirlatma (gun)</label>
                      <input value={form.remind_days_before} onChange={e => set('remind_days_before', e.target.value)} type="number" className="input" />
                    </div>
                  </>
                )}

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_variable} onChange={e => set('is_variable', e.target.checked)} className="w-4 h-4 rounded accent-[#0d9488]" />
                  <span style={{ color: 'var(--muted)' }}>Degisken tutar</span>
                </label>
              </div>
              {saveError && (
                <div className="mt-3 p-2.5 rounded-lg text-[12px]" style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>{saveError}</div>
              )}
              <button onClick={handleSave} disabled={saving || !form.name || !form.amount}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
              {editId && (
                <button onClick={() => { closeForm(); setDeleteConfirm(editId) }}
                  className="w-full mt-2 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: 'none', cursor: 'pointer' }}>
                  Gideri Sil
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
