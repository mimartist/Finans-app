'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { Loan, CreditCard, CreditCardStatement, ExchangeRate } from '@/lib/supabase'

const emptyLoan = {
  name: '', bank: '', type: 'ihtiyac', currency: 'TRY', original_amount: '',
  remaining_amount: '', monthly_payment: '', payment_day: '', total_installments: '',
  paid_installments: '', interest_rate: '', start_date: '', end_date: '', collateral: '', notes: '',
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [statements, setStatements] = useState<CreditCardStatement[]>([])
  const [eurTry, setEurTry] = useState<number>(38)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyLoan)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function load() {
    const now = new Date()
    const [{ data: lns }, { data: crd }, { data: stm }, { data: rates }] = await Promise.all([
      supabase.from('loans').select('*').eq('is_active', true).order('monthly_payment', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('is_active', true),
      supabase.from('credit_card_statements').select('*').eq('period_year', now.getFullYear()).eq('period_month', now.getMonth() + 1),
      supabase.from('exchange_rates').select('eur_try').order('date', { ascending: false }).limit(1),
    ])
    setLoans(lns || []); setCards(crd || []); setStatements(stm || [])
    if (rates?.[0]?.eur_try) setEurTry(rates[0].eur_try)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toTry = (loan: Loan, amount: number) => loan.currency === 'EUR' ? amount * eurTry : amount
  const totalMonthly = loans.reduce((s, l) => s + toTry(l, l.monthly_payment), 0)
  const totalRemaining = loans.reduce((s, l) => s + toTry(l, l.remaining_amount || 0), 0)
  const totalKK = statements.reduce((s, st) => s + (st.total_amount || 0), 0)

  const progressPct = (loan: Loan) => {
    if (!loan.total_installments) return 0
    return Math.round((loan.paid_installments / loan.total_installments) * 100)
  }

  function openAdd() { setEditId(null); setForm(emptyLoan); setShowForm(true) }
  function openEdit(l: Loan) {
    setEditId(l.id)
    setForm({
      name: l.name, bank: l.bank, type: l.type, currency: l.currency,
      original_amount: String(l.original_amount || ''), remaining_amount: String(l.remaining_amount || ''),
      monthly_payment: String(l.monthly_payment || ''), payment_day: String(l.payment_day || ''),
      total_installments: String(l.total_installments || ''), paid_installments: String(l.paid_installments || ''),
      interest_rate: String(l.interest_rate || ''), start_date: l.start_date || '', end_date: l.end_date || '',
      collateral: l.collateral || '', notes: l.notes || '',
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyLoan) }

  async function handleSave() {
    if (!form.name || !form.bank || !form.monthly_payment) return
    setSaving(true)
    const payload = {
      name: form.name, bank: form.bank, type: form.type, currency: form.currency,
      original_amount: parseFloat(form.original_amount) || 0, remaining_amount: parseFloat(form.remaining_amount) || 0,
      monthly_payment: parseFloat(form.monthly_payment) || 0, payment_day: parseInt(form.payment_day) || null,
      total_installments: parseInt(form.total_installments) || 0, paid_installments: parseInt(form.paid_installments) || 0,
      interest_rate: parseFloat(form.interest_rate) || 0, start_date: form.start_date || null, end_date: form.end_date || null,
      collateral: form.collateral || null, notes: form.notes || null, is_active: true,
    }
    if (editId) { await supabase.from('loans').update(payload).eq('id', editId) }
    else { await supabase.from('loans').insert(payload) }
    setSaving(false); closeForm(); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('loans').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null); await load()
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const inp = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>{label}</label>
      <input value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} type={type} className="input" />
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <BottomNav />
      <div className="app-main pb-24 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>Modul</div>
            <div className="text-xl font-bold mt-0.5">Krediler & Kartlar</div>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">+ Ekle</button>
        </div>

        <div className="flex gap-3 mx-4 mb-4">
          <div className="flex-1 card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Kalan Borc</div>
            <div className="mono text-base font-bold amt-red">{fmt(totalRemaining)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{loans.length} aktif kredi</div>
          </div>
          <div className="flex-1 card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Aylik Odeme</div>
            <div className="mono text-base font-bold amt-amber">{fmt(totalMonthly)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>bu ay toplam</div>
          </div>
        </div>

        {loans.some(l => l.currency === 'EUR') && (
          <div className="mx-4 mb-3 text-[11px] text-right" style={{ color: 'var(--muted)' }}>
            EUR/TRY kuru: {eurTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}

        <div className="px-5 mb-2"><div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>Aktif Krediler</div></div>

        {loans.length === 0 && (
          <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Henuz kredi eklenmemis.<br />
            <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>+ Kredi Ekle</button>
          </div>
        )}

        <div className="flex flex-col gap-2 mx-4 mb-4">
          {loans.map((loan) => {
            const pct = progressPct(loan)
            const days = loan.payment_day ? daysUntil(loan.payment_day) : null
            return (
              <div key={loan.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{loan.name}</div>
                    <div className="text-[11px] mt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                      {loan.bank} · {loan.type}{loan.collateral && ` · ${loan.collateral}`}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className="mono text-base font-bold amt-red">
                        {fmt(loan.monthly_payment, loan.currency)}
                        {loan.currency === 'EUR' && <span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}> ({fmt(loan.monthly_payment * eurTry)})</span>}
                        <span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}>/ay</span>
                      </div>
                      {days !== null && (
                        <div className="text-[11px] mt-0.5" style={{ color: days <= 3 ? '#dc2626' : 'var(--muted)' }}>{daysUntilLabel(days)}</div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-1">
                      <button onClick={() => openEdit(loan)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--bg4)' }}>✏️</button>
                      <button onClick={() => setDeleteConfirm(loan.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                    </div>
                  </div>
                </div>
                <div className="progress-wrap mb-2">
                  <div className="progress-bar" style={{ width: `${pct}%`, background: pct >= 75 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626' }} />
                </div>
                <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                  <span>Kalan: <span className="amt-red font-semibold">{fmt(loan.remaining_amount || 0, loan.currency)}</span>
                    {loan.currency === 'EUR' && <span> ({fmt((loan.remaining_amount || 0) * eurTry)})</span>}
                  </span>
                  {loan.total_installments > 0 && (
                    <span style={{ color: pct >= 75 ? '#059669' : 'var(--muted)' }}>{loan.paid_installments}/{loan.total_installments} taksit</span>
                  )}
                  {loan.end_date && (
                    <span>Bitis: {new Date(loan.end_date).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="px-5 mb-2"><div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>Kredi Kartlari</div></div>

        {totalKK > 0 && (
          <div className="mx-4 mb-2 card px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Bu Ay Toplam KK</div>
            <div className="mono text-base font-bold amt-amber">{fmt(totalKK)}</div>
          </div>
        )}

        <div className="flex flex-col gap-2 mx-4">
          {cards.map((card) => {
            const stmt = statements.find(s => s.card_id === card.id)
            const days = card.due_day ? daysUntil(card.due_day) : null
            return (
              <div key={card.id} className="card px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'var(--accent-light)' }}>💳</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{card.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Ekstre: {card.statement_day}'i · Son odeme: {card.due_day}'i</div>
                </div>
                <div className="text-right">
                  {stmt ? (
                    <>
                      <div className="mono text-sm font-semibold amt-amber">{fmt(stmt.total_amount)}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: days && days <= 3 ? '#dc2626' : 'var(--muted)' }}>{days !== null ? daysUntilLabel(days) : ''}</div>
                    </>
                  ) : (
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>ekstre girilmedi</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Krediyi Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu krediyi silmek istediginize emin misiniz?</div>
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
                <div className="text-sm font-semibold">{editId ? 'Krediyi Duzenle' : 'Yeni Kredi'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                {inp('Kredi Adi', 'name', 'text', 'Orn: Mercedes Kredi')}
                <div className="flex gap-3">
                  {inp('Banka', 'bank', 'text', 'Orn: Garanti')}
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
                      <option value="ihtiyac">Ihtiyac</option><option value="tasit">Tasit</option>
                      <option value="konut">Konut</option><option value="ticari">Ticari</option><option value="diger">Diger</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                  {inp('Faiz %', 'interest_rate', 'number', '0')}
                </div>
                <div className="flex gap-3">{inp('Orijinal Tutar', 'original_amount', 'number', '0')}{inp('Kalan Tutar', 'remaining_amount', 'number', '0')}</div>
                <div className="flex gap-3">{inp('Aylik Odeme', 'monthly_payment', 'number', '0')}{inp('Odeme Gunu', 'payment_day', 'number', '1-31')}</div>
                <div className="flex gap-3">{inp('Toplam Taksit', 'total_installments', 'number', '0')}{inp('Odenen Taksit', 'paid_installments', 'number', '0')}</div>
                <div className="flex gap-3">{inp('Baslangic', 'start_date', 'date')}{inp('Bitis', 'end_date', 'date')}</div>
                {inp('Teminat', 'collateral', 'text', 'Orn: Arac rehni')}
                {inp('Notlar', 'notes', 'text')}
              </div>
              <button onClick={handleSave} disabled={saving || !form.name || !form.bank || !form.monthly_payment}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
