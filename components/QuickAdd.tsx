'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase, fmt, isDemo } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, CATEGORY_GROUPS } from '@/lib/categories'

type Props = { onClose: () => void }

export default function QuickAdd({ onClose }: Props) {
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [userId, setUserId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '', amount: '', category: 'market', currency: 'TRY',
    expense_type: 'one_time' as 'recurring' | 'one_time',
    expense_date: new Date().toISOString().split('T')[0],
    payment_day: '',
    payment_method: 'nakit' as 'nakit' | 'kredi_karti' | 'duzenli',
  })
  const [incomeForm, setIncomeForm] = useState({
    person_name: '', amount: '', currency: 'TRY',
    description: '', due_date: '',
    is_recurring: false,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [photo, setPhoto] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setInc = (k: string, v: any) => setIncomeForm(f => ({ ...f, [k]: v }))

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleScan() {
    if (!photo) return
    setScanning(true); setScanError(null)
    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo, type: 'fis' }),
      })
      const data = await res.json()
      if (data.success && data.transactions?.length > 0) {
        const tx = data.transactions[0]
        set('name', tx.description || '')
        set('amount', String(tx.amount || ''))
        set('category', tx.category || 'diger')
        if (tx.transaction_date) set('expense_date', tx.transaction_date)
      } else {
        setScanError(data.error || 'Fis okunamadi')
      }
    } catch (err: any) {
      setScanError(err.message || 'Bağlantı hatasi')
    }
    setScanning(false)
  }

  async function handleSave() {
    setSaving(true); setSaveError(null)

    if (isDemo) {
      await new Promise(r => setTimeout(r, 500))
      setSaving(false); onClose(); return
    }

    if (type === 'income') {
      if (!incomeForm.person_name || !incomeForm.amount) { setSaving(false); return }
      const payload = {
        person_name: incomeForm.person_name,
        type: 'alacak',
        amount: parseFloat(incomeForm.amount) || 0,
        currency: incomeForm.currency,
        description: incomeForm.description || null,
        due_date: incomeForm.due_date || null,
        transaction_date: new Date().toISOString().split('T')[0],
        is_settled: false,
        is_recurring: incomeForm.is_recurring,
        frequency: incomeForm.is_recurring ? 'aylik' : null,
        ...(userId ? { user_id: userId } : {}),
      }
      const result = await supabase.from('debt_records').insert(payload)
      if (result.error) {
        setSaveError(`Hata: ${result.error.message}`)
        setSaving(false); return
      }
    } else {
      if (!form.name || !form.amount) { setSaving(false); return }
      const isRecurring = form.payment_method === 'duzenli'
      const payload: any = {
        name: form.name, category: form.category,
        amount: parseFloat(form.amount) || 0,
        currency: form.currency, is_variable: false, is_active: true,
        expense_type: isRecurring ? 'recurring' : 'one_time',
        remind_days_before: 3,
        ...(userId ? { user_id: userId } : {}),
      }
      if (isRecurring) {
        payload.payment_day = parseInt(form.payment_day) || null
      } else {
        payload.expense_date = form.expense_date || null
        payload.payment_day = form.expense_date ? new Date(form.expense_date).getDate() : null
      }
      if (form.payment_method === 'kredi_karti') {
        payload.subcategory = 'Kredi Kartı'
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

    setSaving(false); onClose()
  }

  const pillBtn = (active: boolean, color: string) => ({
    background: active ? 'var(--bg2)' : 'transparent',
    boxShadow: active ? 'var(--shadow)' : 'none',
    color: active ? color : 'var(--muted)',
  })

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
            style={pillBtn(type === 'expense', '#e5484d')}>
            Gider
          </button>
          <button onClick={() => setType('income')}
            className="flex-1 py-2.5 rounded-lg text-[13px] font-semibold text-center transition-all"
            style={pillBtn(type === 'income', '#30a46c')}>
            Gelir
          </button>
        </div>

        {type === 'income' ? (
          <>
            {/* Income form */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Kişi / Firma</label>
                <input value={incomeForm.person_name} onChange={e => setInc('person_name', e.target.value)} placeholder="Örn: Mimosso" className="input" autoFocus />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Tutar</label>
                  <input value={incomeForm.amount} onChange={e => setInc('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                </div>
                <div style={{ width: 80 }}>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Döviz</label>
                  <select value={incomeForm.currency} onChange={e => setInc('currency', e.target.value)} className="input">
                    <option value="TRY">₺ TRY</option><option value="EUR">€ EUR</option><option value="USD">$ USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Aciklama</label>
                <input value={incomeForm.description} onChange={e => setInc('description', e.target.value)} placeholder="Opsiyonel" className="input" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Vade Tarihi</label>
                <input value={incomeForm.due_date} onChange={e => setInc('due_date', e.target.value)} type="date" className="input" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={incomeForm.is_recurring} onChange={e => setInc('is_recurring', e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: '#2b2d6e' }} />
                <span className="text-[12px]" style={{ color: 'var(--muted)' }}>Düzenli gelir (aylık)</span>
              </label>
            </div>

            {saveError && (
              <div className="mt-3 p-3 rounded-xl text-xs font-medium" style={{ background: 'rgba(229,72,77,0.06)', color: '#e5484d' }}>{saveError}</div>
            )}
            <button onClick={handleSave} disabled={saving || !incomeForm.person_name || !incomeForm.amount}
              className="w-full mt-5 py-3.5 text-sm font-bold rounded-xl"
              style={{ background: 'linear-gradient(135deg, #059669, #30a46c)', color: '#fff', border: 'none', cursor: 'pointer', opacity: saving || !incomeForm.person_name || !incomeForm.amount ? 0.5 : 1 }}>
              {saving ? 'Kaydediliyor...' : 'Gelir Ekle'}
            </button>
          </>
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

            {/* Photo preview + OCR scan */}
            {photo && (
              <div className="mb-4">
                <div className="relative rounded-xl overflow-hidden">
                  <img src={photo} alt="Fis" className="w-full" style={{ maxHeight: 160, objectFit: 'cover' }} />
                  <div className="absolute top-2 right-2">
                    <button onClick={() => { setPhoto(null); setScanError(null) }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, border: 'none' }}>✕</button>
                  </div>
                </div>
                <button onClick={handleScan} disabled={scanning}
                  className="w-full mt-2 py-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', border: 'none', cursor: 'pointer', opacity: scanning ? 0.6 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M2 7V2h5" /><path d="M22 7V2h-5" /><path d="M2 17v5h5" /><path d="M22 17v5h-5" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {scanning ? 'Taraniyor...' : 'Fisi Tara (OCR)'}
                </button>
                {scanError && (
                  <div className="mt-2 text-[11px] font-medium px-3 py-1.5 rounded-lg" style={{ background: 'rgba(229,72,77,0.06)', color: '#e5484d' }}>{scanError}</div>
                )}
              </div>
            )}

            {/* Payment method: Nakit / Kredi Kartı / Düzenli */}
            <div className="flex gap-2 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg4)' }}>
              {([['nakit', 'Nakit'], ['kredi_karti', 'Kredi Kartı'], ['duzenli', 'Düzenli']] as const).map(([val, label]) => (
                <button key={val} onClick={() => set('payment_method', val)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold text-center transition-all"
                  style={pillBtn(form.payment_method === val, '#2b2d6e')}>
                  {label}
                </button>
              ))}
            </div>

            {/* Form fields */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Aciklama</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Örn: Market alisverisi" className="input" autoFocus />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Tutar</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                </div>
                <div style={{ width: 80 }}>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Döviz</label>
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
              {form.payment_method === 'duzenli' ? (
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Ödeme Günü (1-31)</label>
                  <input value={form.payment_day} onChange={e => set('payment_day', e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Tarih</label>
                  <input value={form.expense_date} onChange={e => set('expense_date', e.target.value)} type="date" className="input" />
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
