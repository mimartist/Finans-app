'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { DebtRecord } from '@/lib/supabase'

const emptyForm = {
  person_name: '', type: 'alacak' as 'alacak' | 'verecek', amount: '', currency: 'TRY',
  description: '', transaction_date: '', due_date: '', notes: '',
  is_recurring: false, total_amount: '', paid_amount: '',
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'alacak' | 'verecek'>('alacak')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [payModal, setPayModal] = useState<DebtRecord | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)

  async function load() {
    const { data } = await supabase.from('debt_records').select('*').eq('is_settled', false).order('due_date', { nullsFirst: false })
    setDebts(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const alacaklar = debts.filter(d => d.type === 'alacak')
  const verecekler = debts.filter(d => d.type === 'verecek')
  const totalAlacak = alacaklar.reduce((s, d) => s + d.amount, 0)
  const totalVerecek = verecekler.reduce((s, d) => s + d.amount, 0)
  const shown = tab === 'alacak' ? alacaklar : verecekler
  const isOverdue = (due?: string) => due ? new Date(due) < new Date() : false

  function openAdd() { setEditId(null); setForm({ ...emptyForm, type: tab }); setShowForm(true) }
  function openEdit(d: DebtRecord) {
    setEditId(d.id)
    setForm({
      person_name: d.person_name, type: d.type, amount: String(d.amount), currency: d.currency,
      description: d.description || '', transaction_date: d.transaction_date || '',
      due_date: d.due_date || '', notes: d.notes || '',
      is_recurring: d.is_recurring || false,
      total_amount: String(d.total_amount || ''),
      paid_amount: String(d.paid_amount || ''),
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.person_name || !form.amount) return
    setSaving(true)
    const payload: any = {
      person_name: form.person_name, type: form.type,
      amount: parseFloat(form.amount) || 0, currency: form.currency,
      description: form.description || null,
      transaction_date: form.transaction_date || null, due_date: form.due_date || null,
      notes: form.notes || null, is_settled: false,
      is_recurring: form.is_recurring,
      total_amount: form.is_recurring ? (parseFloat(form.total_amount) || null) : null,
      paid_amount: form.is_recurring ? (parseFloat(form.paid_amount) || 0) : null,
    }
    if (editId) { await supabase.from('debt_records').update(payload).eq('id', editId) }
    else { await supabase.from('debt_records').insert(payload) }
    setSaving(false); closeForm(); await load()
  }

  async function handleSettle(id: number) {
    await supabase.from('debt_records').update({ is_settled: true }).eq('id', id); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('debt_records').delete().eq('id', id); setDeleteConfirm(null); await load()
  }

  async function handlePartialPay() {
    if (!payModal || !payAmount) return
    setPaying(true)
    const amt = parseFloat(payAmount) || 0
    const newPaid = (payModal.paid_amount || 0) + amt
    const newRemaining = payModal.amount - amt
    const isSettled = newRemaining <= 0
    await supabase.from('debt_records').update({
      amount: Math.max(0, newRemaining),
      paid_amount: newPaid,
      is_settled: isSettled,
    }).eq('id', payModal.id)
    setPaying(false); setPayModal(null); setPayAmount(''); await load()
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
            <div className="text-xl font-bold mt-0.5">Alacak & Verecek</div>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">+ Ekle</button>
        </div>

        <div className="flex gap-3 mx-4 mb-4">
          <div className="flex-1 card p-3 cursor-pointer" style={{ borderColor: tab === 'alacak' ? '#059669' : 'var(--border)' }} onClick={() => setTab('alacak')}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Alacak</div>
            <div className="mono text-base font-bold amt-green">{fmt(totalAlacak)}</div>
            <div className="text-[10px] mt-1 amt-green">{alacaklar.length} kisi</div>
          </div>
          <div className="flex-1 card p-3 cursor-pointer" style={{ borderColor: tab === 'verecek' ? '#dc2626' : 'var(--border)' }} onClick={() => setTab('verecek')}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Verecek</div>
            <div className="mono text-base font-bold amt-red">{fmt(totalVerecek)}</div>
            <div className="text-[10px] mt-1 amt-red">{verecekler.length} kisi</div>
          </div>
        </div>

        <div className="flex gap-2 mx-4 mb-4">
          {(['alacak', 'verecek'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 rounded-lg text-sm font-medium"
              style={{
                background: tab === t ? (t === 'alacak' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)') : 'var(--bg3)',
                border: `1px solid ${tab === t ? (t === 'alacak' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)') : 'var(--border)'}`,
                color: tab === t ? (t === 'alacak' ? '#059669' : '#dc2626') : 'var(--muted)',
              }}>
              {t === 'alacak' ? '↙ Alacaklarim' : '↗ Vereceklerim'}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Kayit bulunamadi.<br />
            <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>+ Kayit Ekle</button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 mx-4">
            {shown.map((d) => {
              const overdue = isOverdue(d.due_date)
              const color = d.type === 'alacak' ? '#059669' : '#dc2626'
              const totalAmt = d.total_amount || ((d.paid_amount || 0) + d.amount)
              const paidAmt = d.paid_amount || 0
              const remaining = d.amount
              const hasParts = d.is_recurring || paidAmt > 0
              const paidPct = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0
              return (
                <div key={d.id} className="card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">{d.person_name}</div>
                        {d.is_recurring && <span className="badge badge-blue">Taksitli</span>}
                      </div>
                      {d.description && <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{d.description}</div>}
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <div className="mono text-base font-bold" style={{ color }}>{fmt(remaining, d.currency)}</div>
                        <div className={`badge mt-1 ${d.type === 'alacak' ? 'badge-green' : 'badge-red'}`}>{d.type}</div>
                      </div>
                      <div className="flex flex-col gap-1 ml-1">
                        <button onClick={() => { setPayModal(d); setPayAmount('') }} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                          title="Taksit Al/Ver" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>💰</button>
                        <button onClick={() => handleSettle(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" title="Tamami odendi" style={{ background: 'rgba(5,150,105,0.08)' }}>✅</button>
                        <button onClick={() => openEdit(d)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--bg4)' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                      </div>
                    </div>
                  </div>

                  {/* Installment tracking */}
                  {hasParts && (
                    <div className="mb-2">
                      <div className="progress-wrap mb-1.5">
                        <div className="progress-bar" style={{ width: `${paidPct}%`, background: d.type === 'alacak' ? '#059669' : '#dc2626' }} />
                      </div>
                      <div className="flex justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
                        <span>Toplam: <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmt(totalAmt, d.currency)}</span></span>
                        <span>Odenen: <span className="amt-green font-semibold">{fmt(paidAmt, d.currency)}</span></span>
                        <span>Kalan: <span className="font-semibold" style={{ color }}>{fmt(remaining, d.currency)}</span></span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    {d.transaction_date && (
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: 'var(--muted)' }}>Tarih</span>
                        <span>{new Date(d.transaction_date).toLocaleDateString('tr-TR')}</span>
                      </div>
                    )}
                    {d.due_date && (
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: 'var(--muted)' }}>Vade</span>
                        <span style={{ color: overdue ? '#dc2626' : 'var(--text)' }}>{new Date(d.due_date).toLocaleDateString('tr-TR')}{overdue && ' Gecikmis'}</span>
                      </div>
                    )}
                    {d.notes && (
                      <div className="flex justify-between text-[11px]">
                        <span style={{ color: 'var(--muted)' }}>Not</span>
                        <span style={{ color: 'var(--muted)' }}>{d.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Delete confirmation */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Kaydi Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu kaydi kalici olarak silmek istediginize emin misiniz?</div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1 py-2.5 text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* Partial payment modal */}
        {payModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-1">Taksit {payModal.type === 'alacak' ? 'Al' : 'Ver'}</div>
              <div className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{payModal.person_name}</span> — Kalan: {fmt(payModal.amount, payModal.currency)}
              </div>
              <div className="mb-4">
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odeme Tutari</label>
                <input value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" type="number" className="input mono" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPayModal(null); setPayAmount('') }} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={handlePartialPay} disabled={paying || !payAmount || parseFloat(payAmount) <= 0}
                  className="btn-primary flex-1 py-2.5 text-sm">{paying ? 'Kaydediliyor...' : 'Onayla'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card w-full max-w-lg rounded-b-none p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editId ? 'Kaydi Duzenle' : 'Yeni Kayit'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kisi Adi</label>
                  <input value={form.person_name} onChange={e => set('person_name', e.target.value)} placeholder="Orn: Ahmet" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
                      <option value="alacak">Alacak</option><option value="verecek">Verecek</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kalan Tutar</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)} className="w-4 h-4 rounded accent-[#0d9488]" />
                  <span style={{ color: 'var(--muted)' }}>Taksitli odeme</span>
                </label>
                {form.is_recurring && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Toplam Tutar</label>
                      <input value={form.total_amount} onChange={e => set('total_amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odenen Tutar</label>
                      <input value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Aciklama</label>
                  <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Opsiyonel" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Islem Tarihi</label>
                    <input value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} type="date" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Vade Tarihi</label>
                    <input value={form.due_date} onChange={e => set('due_date', e.target.value)} type="date" className="input" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Not</label>
                  <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Opsiyonel" className="input" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.person_name || !form.amount}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
