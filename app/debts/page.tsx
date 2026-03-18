'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { DebtRecord } from '@/lib/supabase'

const freqLabels: Record<string, string> = { aylik: 'Aylik', haftalik: 'Haftalik', '2haftada1': '2 Haftada 1', duzensiz: 'Duzensiz' }

const emptyForm = {
  person_name: '', type: 'alacak' as 'alacak' | 'verecek', amount: '', currency: 'TRY',
  description: '', transaction_date: '', due_date: '', notes: '',
  is_recurring: false, frequency: 'aylik', expected_day: '', total_amount: '', paid_amount: '',
}

function daysOverdue(due: string): number {
  const diff = new Date().getTime() - new Date(due).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function daysUntilDue(due: string): number {
  const diff = new Date(due).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function sortDebts(list: DebtRecord[]): DebtRecord[] {
  const now = new Date()
  return [...list].sort((a, b) => {
    // Priority: 1=overdue, 2=due within 7d, 3=normal with due, 4=no due
    const scoreA = !a.due_date && !a.is_recurring ? 4 : a.due_date && new Date(a.due_date) < now ? 1 : a.due_date && daysUntilDue(a.due_date) <= 7 ? 2 : 3
    const scoreB = !b.due_date && !b.is_recurring ? 4 : b.due_date && new Date(b.due_date) < now ? 1 : b.due_date && daysUntilDue(b.due_date) <= 7 ? 2 : 3
    if (scoreA !== scoreB) return scoreA - scoreB
    // Within same priority, sort by due date
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date) return -1
    if (b.due_date) return 1
    return 0
  })
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
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [eurTry, setEurTry] = useState(0)
  const [usdTry, setUsdTry] = useState(0)

  async function load() {
    const [{ data }, { data: rt }] = await Promise.all([
      supabase.from('debt_records').select('*').eq('is_settled', false).order('due_date', { nullsFirst: false }),
      supabase.from('exchange_rates').select('eur_try, usd_try').order('date', { ascending: false }).limit(1),
    ])
    setDebts(data || [])
    if (rt?.[0]?.eur_try) setEurTry(rt[0].eur_try)
    if (rt?.[0]?.usd_try) setUsdTry(rt[0].usd_try)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toTry = (amount: number, currency: string) => {
    if (currency === 'EUR') return amount * eurTry
    if (currency === 'USD') return amount * usdTry
    return amount
  }

  const alacaklar = debts.filter(d => d.type === 'alacak')
  const verecekler = debts.filter(d => d.type === 'verecek')
  const totalAlacak = alacaklar.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const totalVerecek = verecekler.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const shown = sortDebts(tab === 'alacak' ? alacaklar : verecekler)

  function openAdd() { setEditId(null); setForm({ ...emptyForm, type: tab }); setShowForm(true) }
  function openEdit(d: DebtRecord) {
    setEditId(d.id)
    setForm({
      person_name: d.person_name, type: d.type, amount: String(d.amount), currency: d.currency,
      description: d.description || '', transaction_date: d.transaction_date || '',
      due_date: d.due_date || '', notes: d.notes || '',
      is_recurring: d.is_recurring || false,
      frequency: d.frequency || 'aylik',
      expected_day: String(d.expected_day || ''),
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
      person_name: form.person_name,
      type: form.type,
      amount: parseFloat(form.amount) || 0,
      currency: form.currency,
      description: form.description || null,
      transaction_date: form.transaction_date || new Date().toISOString().split('T')[0],
      due_date: form.is_recurring ? null : (form.due_date || null),
      notes: form.notes || null,
      is_settled: false,
      is_recurring: form.is_recurring || false,
      frequency: form.is_recurring ? form.frequency : null,
      expected_day: form.is_recurring ? (parseInt(form.expected_day) || null) : null,
      total_amount: form.is_recurring ? (parseFloat(form.total_amount) || null) : null,
      paid_amount: form.is_recurring ? (parseFloat(form.paid_amount) || 0) : null,
    }

    if (editId) {
      const { error } = await supabase.from('debt_records').update(payload).eq('id', editId)
      if (error) { alert('Hata: ' + error.message); setSaving(false); return }
      setDebts(prev => prev.map(d => d.id === editId ? { ...d, ...payload, id: editId } : d))
    } else {
      const { data, error } = await supabase.from('debt_records').insert(payload).select()
      if (error) { alert('Hata: ' + error.message); setSaving(false); return }
      if (data?.[0]) setDebts(prev => [...prev, data[0]])
    }

    setSaving(false)
    closeForm()
  }

  async function handleSettle(id: number) {
    const { error } = await supabase.from('debt_records').update({ is_settled: true }).eq('id', id)
    if (error) { alert('Hata: ' + error.message); return }
    setDebts(prev => prev.filter(d => d.id !== id))
    setExpandedId(null)
  }

  async function handleDelete(id: number) {
    const { error } = await supabase.from('debt_records').delete().eq('id', id)
    if (error) { alert('Hata: ' + error.message); return }
    setDebts(prev => prev.filter(d => d.id !== id))
    setDeleteConfirm(null)
    setExpandedId(null)
  }

  async function handlePartialPay() {
    if (!payModal || !payAmount) return
    setPaying(true)
    const amt = parseFloat(payAmount) || 0
    const newPaid = (payModal.paid_amount || 0) + amt
    const newRemaining = payModal.amount - amt
    const isSettled = newRemaining <= 0

    const { error } = await supabase.from('debt_records').update({
      amount: Math.max(0, newRemaining),
      paid_amount: newPaid,
      is_settled: isSettled,
    }).eq('id', payModal.id)
    if (error) { alert('Hata: ' + error.message); setPaying(false); return }

    if (isSettled) {
      setDebts(prev => prev.filter(d => d.id !== payModal.id))
    } else {
      setDebts(prev => prev.map(d => d.id === payModal.id ? { ...d, amount: Math.max(0, newRemaining), paid_amount: newPaid } : d))
    }
    setPaying(false); setPayModal(null); setPayAmount('')
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <div className="bg-blobs"><div className="bg-blob-3" /><div className="bg-blob-4" /></div>
      <BottomNav />
      <div className="app-main pb-24 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold mt-0.5">Alacak & Verecek</div>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 mx-4 mb-4">
          <button onClick={() => setTab('alacak')} className="flex-1 px-3 py-2.5 rounded-lg flex items-center justify-between"
            style={{
              background: tab === 'alacak' ? 'rgba(5,150,105,0.08)' : 'var(--bg3)',
              border: `1.5px solid ${tab === 'alacak' ? 'rgba(5,150,105,0.4)' : 'var(--border)'}`,
            }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]">↙</span>
              <span className="text-[12px] font-semibold" style={{ color: tab === 'alacak' ? '#059669' : 'var(--muted)' }}>Alacak</span>
            </div>
            <div className="text-right">
              <div className="mono text-[13px] font-bold amt-green">{fmt(totalAlacak)}</div>
              <div className="text-[9px]" style={{ color: 'var(--muted)' }}>{alacaklar.length} kayit</div>
            </div>
          </button>
          <button onClick={() => setTab('verecek')} className="flex-1 px-3 py-2.5 rounded-lg flex items-center justify-between"
            style={{
              background: tab === 'verecek' ? 'rgba(220,38,38,0.06)' : 'var(--bg3)',
              border: `1.5px solid ${tab === 'verecek' ? 'rgba(220,38,38,0.3)' : 'var(--border)'}`,
            }}>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px]">↗</span>
              <span className="text-[12px] font-semibold" style={{ color: tab === 'verecek' ? '#dc2626' : 'var(--muted)' }}>Verecek</span>
            </div>
            <div className="text-right">
              <div className="mono text-[13px] font-bold amt-red">{fmt(totalVerecek)}</div>
              <div className="text-[9px]" style={{ color: 'var(--muted)' }}>{verecekler.length} kayit</div>
            </div>
          </button>
        </div>

        {shown.length === 0 ? (
          <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Kayit bulunamadi.<br />
            <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>Kayit Ekle</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mx-4">
            {shown.map((d) => {
              const isOverdue = d.due_date ? new Date(d.due_date) < new Date() : false
              const dueSoon = d.due_date && !isOverdue ? daysUntilDue(d.due_date) <= 7 : false
              const overdueDays = isOverdue && d.due_date ? daysOverdue(d.due_date) : 0
              const color = d.type === 'alacak' ? '#059669' : '#dc2626'
              const isExpanded = expandedId === d.id
              const totalAmt = d.total_amount || ((d.paid_amount || 0) + d.amount)
              const paidAmt = d.paid_amount || 0
              const hasParts = d.is_recurring || paidAmt > 0
              const paidPct = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0

              let borderLeft = '3px solid var(--border)'
              if (isOverdue) borderLeft = '3px solid #dc2626'
              else if (dueSoon) borderLeft = '3px solid #f59e0b'

              return (
                <div key={d.id}>
                  {/* Compact row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    className="px-3 py-2.5 flex items-center gap-3 cursor-pointer"
                    style={{
                      background: 'var(--bg3)',
                      borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                      border: '1px solid var(--border)',
                      borderLeft,
                      borderBottom: isExpanded ? '1px solid var(--border)' : undefined,
                    }}>
                    {/* Icon */}
                    <div className="text-base flex-shrink-0" style={{ width: 24, textAlign: 'center' }}>
                      {d.is_recurring ? '🔄' : '👤'}
                    </div>

                    {/* Name + subtitle */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{d.person_name}</div>
                      <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                          style={{
                            background: d.type === 'alacak' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.06)',
                            color,
                          }}>
                          {d.type === 'alacak' ? 'Alacak' : 'Verecek'}
                        </span>
                        {d.is_recurring ? (
                          <span>{freqLabels[d.frequency || 'aylik']} {fmt(d.amount, d.currency)}</span>
                        ) : d.due_date ? (
                          <span>Vade: {new Date(d.due_date).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        ) : (
                          <span>Tek seferlik</span>
                        )}
                      </div>
                      {isOverdue && (
                        <div className="text-[10px] mt-0.5 font-medium" style={{ color: '#dc2626' }}>
                          ⚠️ {overdueDays} gun gecikmis
                        </div>
                      )}
                    </div>

                    {/* Amount + chevron */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div className="mono text-[13px] font-bold" style={{ color }}>{fmt(d.amount, d.currency)}</div>
                        {d.currency !== 'TRY' && (
                          <div className="mono text-[10px]" style={{ color: 'var(--muted)' }}>({fmt(toTry(d.amount, d.currency))})</div>
                        )}
                      </div>
                      <span className="text-[12px]" style={{ color: 'var(--muted)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-4 py-3" style={{
                      background: 'var(--bg3)',
                      borderRadius: '0 0 12px 12px',
                      border: '1px solid var(--border)',
                      borderTop: 'none',
                      borderLeft,
                    }}>
                      {/* Progress bar for recurring / partial paid */}
                      {hasParts && (
                        <div className="mb-3">
                          <div className="progress-wrap mb-1.5">
                            <div className="progress-bar" style={{ width: `${paidPct}%`, background: color }} />
                          </div>
                          <div className="flex justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
                            <span>Toplam: <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmt(totalAmt, d.currency)}</span></span>
                            <span>Odenen: <span className="amt-green font-semibold">{fmt(paidAmt, d.currency)}</span></span>
                            <span>Kalan: <span className="font-semibold" style={{ color }}>{fmt(d.amount, d.currency)}</span></span>
                          </div>
                        </div>
                      )}

                      {/* Detail rows */}
                      <div className="flex flex-col gap-1 mb-3">
                        {d.description && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: 'var(--muted)' }}>Aciklama</span>
                            <span className="text-right max-w-[60%] truncate">{d.description}</span>
                          </div>
                        )}
                        {d.transaction_date && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: 'var(--muted)' }}>Islem tarihi</span>
                            <span>{new Date(d.transaction_date).toLocaleDateString('tr-TR')}</span>
                          </div>
                        )}
                        {d.due_date && !d.is_recurring && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: 'var(--muted)' }}>Vade</span>
                            <span style={{ color: isOverdue ? '#dc2626' : dueSoon ? '#d97706' : 'var(--text)' }}>
                              {new Date(d.due_date).toLocaleDateString('tr-TR')}
                              {isOverdue && ` (${overdueDays} gun gecikmis)`}
                              {dueSoon && ` (${daysUntilDue(d.due_date!)} gun)`}
                            </span>
                          </div>
                        )}
                        {d.is_recurring && d.expected_day && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: 'var(--muted)' }}>Odeme gunu</span>
                            <span>Her ayin {d.expected_day}'i</span>
                          </div>
                        )}
                        {d.notes && (
                          <div className="flex justify-between text-[11px]">
                            <span style={{ color: 'var(--muted)' }}>Not</span>
                            <span style={{ color: 'var(--muted)' }}>{d.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button onClick={() => { setPayModal(d); setPayAmount('') }}
                          className="flex-1 py-2 rounded-lg text-[12px] font-semibold"
                          style={{ background: d.type === 'alacak' ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.06)', color, border: `1px solid ${d.type === 'alacak' ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)'}` }}>
                          {d.type === 'alacak' ? 'Tahsilat Al' : 'Odeme Yap'}
                        </button>
                        <button onClick={() => handleSettle(d.id)}
                          className="py-2 px-3 rounded-lg text-[12px] font-medium"
                          style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                          ✓ Tamami
                        </button>
                        <button onClick={() => openEdit(d)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
                          style={{ background: 'var(--bg4)' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm(d.id)}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
                          style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                      </div>
                    </div>
                  )}
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

        {/* Partial payment / Tahsilat modal */}
        {payModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-1">{payModal.type === 'alacak' ? 'Tahsilat Al' : 'Odeme Yap'}</div>
              <div className="text-[13px] mb-3" style={{ color: 'var(--muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{payModal.person_name}</span> — Kalan: {fmt(payModal.amount, payModal.currency)}
              </div>
              <div className="mb-4">
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>
                  {payModal.type === 'alacak' ? 'Tahsilat Tutari' : 'Odeme Tutari'}
                </label>
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
            <div className="card slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
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
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar (kalan)</label>
                  <input value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.is_recurring} onChange={e => set('is_recurring', e.target.checked)} className="w-4 h-4 rounded accent-[#0d9488]" />
                  <span style={{ color: 'var(--muted)' }}>Duzenli / Tekrar eden odeme</span>
                </label>

                {form.is_recurring ? (
                  <>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Siklik</label>
                        <select value={form.frequency} onChange={e => set('frequency', e.target.value)} className="input">
                          <option value="aylik">Aylik</option>
                          <option value="haftalik">Haftalik</option>
                          <option value="2haftada1">2 Haftada 1</option>
                          <option value="duzensiz">Duzensiz</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Ayin kacinda?</label>
                        <input value={form.expected_day} onChange={e => set('expected_day', e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Toplam tutar (opsiyonel)</label>
                        <input value={form.total_amount} onChange={e => set('total_amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Odenen tutar</label>
                        <input value={form.paid_amount} onChange={e => set('paid_amount', e.target.value)} placeholder="0" type="number" className="input mono" />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Vade Tarihi</label>
                    <input value={form.due_date} onChange={e => set('due_date', e.target.value)} type="date" className="input" />
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
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Not</label>
                    <input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Opsiyonel" className="input" />
                  </div>
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
