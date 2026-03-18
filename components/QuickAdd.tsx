'use client'
import { useState, useRef } from 'react'
import { supabase, fmt, isDemo } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, CATEGORY_GROUPS } from '@/lib/categories'

type Props = { onClose: () => void }

export default function QuickAdd({ onClose }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [form, setForm] = useState({
    name: '', amount: '', category: 'market', currency: 'TRY',
    expense_type: 'one_time' as 'recurring' | 'one_time',
    expense_date: new Date().toISOString().split('T')[0],
    payment_day: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!form.name || !form.amount) return
    setSaving(true); setSaveError(null)

    if (isDemo) {
      await new Promise(r => setTimeout(r, 500))
      setSaving(false)
      onClose()
      return
    }

    if (type === 'expense') {
      const payload: any = {
        name: form.name, category: form.category, amount: parseFloat(form.amount) || 0,
        currency: form.currency, is_variable: false, is_active: true,
        expense_type: form.expense_type, remind_days_before: 3,
      }
      if (form.expense_type === 'one_time') {
        payload.expense_date = form.expense_date || null
        payload.payment_day = form.expense_date ? new Date(form.expense_date).getDate() : null
      } else {
        payload.payment_day = parseInt(form.payment_day) || null
      }
      let result = await supabase.from('recurring_expenses').insert(payload)
      if (result.error) {
        if (result.error.message?.includes('column') || result.error.code === '42703') {
          const { expense_type, expense_date, end_date, ...fallback } = payload
          result = await supabase.from('recurring_expenses').insert(fallback)
        }
        if (result.error) {
          setSaveError(`Hata: ${result.error.message}`)
          setSaving(false); return
        }
      }
    }

    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-t-3xl p-6 slide-up" style={{ background: 'var(--bg2)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Handle bar */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border2)' }} />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div className="text-lg font-bold">Hizli Ekle</div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg4)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Type toggle: Gider / Gelir */}
        <div className="flex gap-2 mb-5 p-1 rounded-xl" style={{ background: 'var(--bg4)' }}>
          <button onClick={() => setType('expense')}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-center transition-all"
            style={{
              background: type === 'expense' ? 'var(--bg2)' : 'transparent',
              boxShadow: type === 'expense' ? 'var(--shadow)' : 'none',
              color: type === 'expense' ? '#e5484d' : 'var(--muted)',
            }}>
            Gider
          </button>
          <button onClick={() => setType('income')}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-center transition-all"
            style={{
              background: type === 'income' ? 'var(--bg2)' : 'transparent',
              boxShadow: type === 'income' ? 'var(--shadow)' : 'none',
              color: type === 'income' ? '#30a46c' : 'var(--muted)',
            }}>
            Gelir
          </button>
        </div>

        {type === 'income' ? (
          <div className="text-center py-10">
            <div className="text-3xl mb-3">🚧</div>
            <div className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Gelir modulu yakinda eklenecek</div>
          </div>
        ) : (
          <>
            {/* Photo section */}
            <div className="flex gap-2 mb-4">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              <button onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'var(--bg4)', border: '1.5px dashed var(--border2)', color: 'var(--muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Kamera
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-medium transition-all"
                style={{ background: 'var(--bg4)', border: '1.5px dashed var(--border2)', color: 'var(--muted)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                Galeri
              </button>
            </div>

            {/* Photo preview */}
            {photo && (
              <div className="relative mb-4 rounded-xl overflow-hidden">
                <img src={photo} alt="Fis" className="w-full" style={{ maxHeight: 160, objectFit: 'cover' }} />
                <div className="absolute top-2 right-2">
                  <button onClick={() => setPhoto(null)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, border: 'none' }}>✕</button>
                </div>
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: 'rgba(0,0,0,0.5)', color: '#b0b7c3' }}>
                    OCR yakinda
                  </span>
                </div>
              </div>
            )}

            {/* Expense type: one_time / recurring */}
            <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg4)' }}>
              <button onClick={() => set('expense_type', 'one_time')}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-center transition-all"
                style={{
                  background: form.expense_type === 'one_time' ? 'var(--bg2)' : 'transparent',
                  boxShadow: form.expense_type === 'one_time' ? 'var(--shadow)' : 'none',
                  color: form.expense_type === 'one_time' ? 'var(--accent)' : 'var(--muted)',
                }}>
                Tek Seferlik
              </button>
              <button onClick={() => set('expense_type', 'recurring')}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-center transition-all"
                style={{
                  background: form.expense_type === 'recurring' ? 'var(--bg2)' : 'transparent',
                  boxShadow: form.expense_type === 'recurring' ? 'var(--shadow)' : 'none',
                  color: form.expense_type === 'recurring' ? 'var(--accent)' : 'var(--muted)',
                }}>
                Duzenli
              </button>
            </div>

            {/* Form fields */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Aciklama</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: Market alisverisi" className="input" autoFocus />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Tutar</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                </div>
                <div style={{ width: 80 }}>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Doviz</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                    <option value="TRY">₺ TRY</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Kategori</label>
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
              {form.expense_type === 'one_time' ? (
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Tarih</label>
                  <input value={form.expense_date} onChange={e => set('expense_date', e.target.value)} type="date" className="input" />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Odeme Gunu (1-31)</label>
                  <input value={form.payment_day} onChange={e => set('payment_day', e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                </div>
              )}
            </div>

            {saveError && (
              <div className="mt-3 p-3 rounded-xl text-xs font-medium" style={{ background: 'rgba(229,72,77,0.06)', color: '#e5484d' }}>{saveError}</div>
            )}
            <button onClick={handleSave} disabled={saving || !form.name || !form.amount}
              className="btn-primary w-full mt-5 py-3.5 text-sm font-bold">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
