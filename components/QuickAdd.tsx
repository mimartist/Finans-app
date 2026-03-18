'use client'
import { useState, useRef } from 'react'
import { supabase, fmt } from '@/lib/supabase'
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
    setSaving(true)

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
      await supabase.from('recurring_expenses').insert(payload)
    }
    // income type placeholder for future

    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card w-full max-w-lg rounded-b-none p-5" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-base font-semibold">Hizli Ekle</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
        </div>

        {/* Type toggle: Gider / Gelir */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setType('expense')}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-center"
            style={{
              background: type === 'expense' ? 'rgba(220,38,38,0.08)' : 'var(--bg3)',
              border: `1.5px solid ${type === 'expense' ? '#dc2626' : 'var(--border)'}`,
              color: type === 'expense' ? '#dc2626' : 'var(--muted)',
            }}>
            📤 Gider
          </button>
          <button onClick={() => setType('income')}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-medium text-center"
            style={{
              background: type === 'income' ? 'rgba(5,150,105,0.08)' : 'var(--bg3)',
              border: `1.5px solid ${type === 'income' ? '#059669' : 'var(--border)'}`,
              color: type === 'income' ? '#059669' : 'var(--muted)',
            }}>
            📥 Gelir
          </button>
        </div>

        {type === 'income' ? (
          <div className="text-center py-8">
            <div className="text-2xl mb-2">🚧</div>
            <div className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Gelir modülü yakında eklenecek</div>
          </div>
        ) : (
          <>
            {/* Photo section */}
            <div className="flex gap-2 mb-4">
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              <button onClick={() => cameraRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-medium"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                📷 Kamera
              </button>
              <button onClick={() => fileRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[12px] font-medium"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                🖼️ Galeri
              </button>
            </div>

            {/* Photo preview */}
            {photo && (
              <div className="relative mb-4">
                <img src={photo} alt="Fiş" className="w-full rounded-lg" style={{ maxHeight: 160, objectFit: 'cover' }} />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button onClick={() => setPhoto(null)}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>✕</button>
                </div>
                <div className="absolute bottom-2 left-2">
                  <span className="px-2 py-1 rounded-md text-[10px] font-medium"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#9ca3af' }}>
                    🔜 OCR yakında
                  </span>
                </div>
              </div>
            )}

            {/* Expense type: one_time / recurring */}
            <div className="flex gap-2 mb-3">
              <button onClick={() => set('expense_type', 'one_time')}
                className="flex-1 py-2 rounded-lg text-[12px] font-medium text-center"
                style={{
                  background: form.expense_type === 'one_time' ? 'var(--accent-mid)' : 'var(--bg3)',
                  border: `1px solid ${form.expense_type === 'one_time' ? 'var(--accent)' : 'var(--border)'}`,
                  color: form.expense_type === 'one_time' ? 'var(--accent)' : 'var(--muted)',
                }}>
                📌 Tek Seferlik
              </button>
              <button onClick={() => set('expense_type', 'recurring')}
                className="flex-1 py-2 rounded-lg text-[12px] font-medium text-center"
                style={{
                  background: form.expense_type === 'recurring' ? 'var(--accent-mid)' : 'var(--bg3)',
                  border: `1px solid ${form.expense_type === 'recurring' ? 'var(--accent)' : 'var(--border)'}`,
                  color: form.expense_type === 'recurring' ? 'var(--accent)' : 'var(--muted)',
                }}>
                🔄 Düzenli
              </button>
            </div>

            {/* Form fields */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Aciklama</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: Market alışverişi" className="input" autoFocus />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                </div>
                <div style={{ width: 80 }}>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                  <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                    <option value="TRY">₺</option><option value="EUR">€</option><option value="USD">$</option>
                  </select>
                </div>
              </div>
              <div>
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
              {form.expense_type === 'one_time' ? (
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tarih</label>
                  <input value={form.expense_date} onChange={e => set('expense_date', e.target.value)} type="date" className="input" />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odeme Gunu (1-31)</label>
                  <input value={form.payment_day} onChange={e => set('payment_day', e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                </div>
              )}
            </div>

            <button onClick={handleSave} disabled={saving || !form.name || !form.amount}
              className="btn-primary w-full mt-4 py-3 text-sm font-semibold">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
