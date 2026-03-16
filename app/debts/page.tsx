'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { DebtRecord } from '@/lib/supabase'

const emptyForm = {
  person_name: '', type: 'alacak' as 'alacak' | 'verecek', amount: '', currency: 'TRY',
  description: '', transaction_date: '', due_date: '', notes: '',
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

  async function load() {
    const { data } = await supabase
      .from('debt_records')
      .select('*')
      .eq('is_settled', false)
      .order('due_date', { nullsFirst: false })
    setDebts(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const alacaklar = debts.filter(d => d.type === 'alacak')
  const verecekler = debts.filter(d => d.type === 'verecek')
  const totalAlacak = alacaklar.reduce((s, d) => s + d.amount, 0)
  const totalVerecek = verecekler.reduce((s, d) => s + d.amount, 0)
  const shown = tab === 'alacak' ? alacaklar : verecekler

  const isOverdue = (due?: string) => {
    if (!due) return false
    return new Date(due) < new Date()
  }

  function openAdd() {
    setEditId(null)
    setForm({ ...emptyForm, type: tab })
    setShowForm(true)
  }

  function openEdit(d: DebtRecord) {
    setEditId(d.id)
    setForm({
      person_name: d.person_name, type: d.type, amount: String(d.amount), currency: d.currency,
      description: d.description || '', transaction_date: d.transaction_date || '',
      due_date: d.due_date || '', notes: d.notes || '',
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.person_name || !form.amount) return
    setSaving(true)
    const payload = {
      person_name: form.person_name, type: form.type, amount: parseFloat(form.amount) || 0,
      currency: form.currency, description: form.description || null,
      transaction_date: form.transaction_date || null, due_date: form.due_date || null,
      notes: form.notes || null, is_settled: false,
    }
    if (editId) {
      await supabase.from('debt_records').update(payload).eq('id', editId)
    } else {
      await supabase.from('debt_records').insert(payload)
    }
    setSaving(false)
    closeForm()
    await load()
  }

  async function handleSettle(id: number) {
    await supabase.from('debt_records').update({ is_settled: true }).eq('id', id)
    await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('debt_records').delete().eq('id', id)
    setDeleteConfirm(null)
    await load()
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>

  return (
    <div className="pb-24 page-enter">
      <div className="flex justify-between items-center px-5 pt-5 pb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Modül</div>
          <div className="text-lg font-semibold mt-0.5">Alacak & Verecek</div>
        </div>
        <button onClick={openAdd} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'rgba(108,143,255,0.15)', color: '#6c8fff' }}>+</button>
      </div>

      {/* Özet */}
      <div className="flex gap-2 mx-4 mb-4">
        <div className="flex-1 card p-3 cursor-pointer"
          style={{ borderColor: tab === 'alacak' ? 'rgba(74,222,154,0.4)' : 'var(--border)' }}
          onClick={() => setTab('alacak')}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Alacak</div>
          <div className="mono text-base font-medium amt-green">{fmt(totalAlacak)}</div>
          <div className="text-[10px] mt-1 amt-green">{alacaklar.length} kişi</div>
        </div>
        <div className="flex-1 card p-3 cursor-pointer"
          style={{ borderColor: tab === 'verecek' ? 'rgba(248,113,113,0.4)' : 'var(--border)' }}
          onClick={() => setTab('verecek')}>
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Verecek</div>
          <div className="mono text-base font-medium amt-red">{fmt(totalVerecek)}</div>
          <div className="text-[10px] mt-1 amt-red">{verecekler.length} kişi</div>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-2 mx-4 mb-4">
        {(['alacak', 'verecek'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{
              background: tab === t ? (t === 'alacak' ? 'rgba(74,222,154,0.15)' : 'rgba(248,113,113,0.15)') : 'var(--bg3)',
              border: `1px solid ${tab === t ? (t === 'alacak' ? 'rgba(74,222,154,0.3)' : 'rgba(248,113,113,0.3)') : 'var(--border)'}`,
              color: tab === t ? (t === 'alacak' ? '#4ade9a' : '#f87171') : 'var(--muted)',
            }}>
            {t === 'alacak' ? '↙ Alacaklarım' : '↗ Vereceklerim'}
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Kayıt bulunamadı.<br />
          <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: '#6c8fff' }}>+ Kayit Ekle</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mx-4">
          {shown.map((d) => {
            const overdue = isOverdue(d.due_date)
            const color = d.type === 'alacak' ? '#4ade9a' : '#f87171'
            return (
              <div key={d.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{d.person_name}</div>
                    {d.description && (
                      <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{d.description}</div>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className="mono text-base font-medium" style={{ color }}>{fmt(d.amount, d.currency)}</div>
                      <div className={`badge mt-1 ${d.type === 'alacak' ? 'badge-green' : 'badge-red'}`}>{d.type}</div>
                    </div>
                    <div className="flex flex-col gap-1 ml-1">
                      <button onClick={() => handleSettle(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                        title="Tahsil edildi" style={{ background: 'rgba(74,222,154,0.12)' }}>✅</button>
                      <button onClick={() => openEdit(d)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                        style={{ background: 'var(--bg4)' }}>✏️</button>
                      <button onClick={() => setDeleteConfirm(d.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                        style={{ background: 'rgba(248,113,113,0.12)' }}>🗑️</button>
                    </div>
                  </div>
                </div>

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
                      <span style={{ color: overdue ? '#f87171' : 'var(--text)' }}>
                        {new Date(d.due_date).toLocaleDateString('tr-TR')}
                        {overdue && ' ⚠️ Gecikmiş'}
                      </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card p-5 w-full max-w-sm">
            <div className="text-sm font-semibold mb-2">Kaydi Sil</div>
            <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu kaydi kalici olarak silmek istediginize emin misiniz?</div>
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
              <div className="text-sm font-semibold">{editId ? 'Kaydi Duzenle' : 'Yeni Kayit'}</div>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kisi Adi</label>
                <input value={form.person_name} onChange={e => set('person_name', e.target.value)} placeholder="Orn: Ahmet"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option value="alacak">Alacak</option>
                    <option value="verecek">Verecek</option>
                  </select>
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
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mono"
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Aciklama</label>
                <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Opsiyonel"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Islem Tarihi</label>
                  <input value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} type="date"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Vade Tarihi</label>
                  <input value={form.due_date} onChange={e => set('due_date', e.target.value)} type="date"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Not</label>
                <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Opsiyonel"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.person_name || !form.amount}
              className="w-full mt-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #6c8fff, #a78bfa)', color: '#fff',
                opacity: saving || !form.person_name || !form.amount ? 0.4 : 1 }}>
              {saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
