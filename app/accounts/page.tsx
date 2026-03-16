'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { Account, ExchangeRate } from '@/lib/supabase'

const emptyForm = { name: '', bank: '', type: 'vadesiz', currency: 'TRY', balance: '' }

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function load() {
    const [{ data: acc }, { data: rt }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true).order('bank'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
    ])
    setAccounts(acc || [])
    setRates(rt?.[0] || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const eurTry = rates?.eur_try || 0
  const usdTry = rates?.usd_try || 0
  const toTry = (a: Account) => {
    if (a.currency === 'EUR') return a.balance * eurTry
    if (a.currency === 'USD') return a.balance * usdTry
    return a.balance
  }
  const totalTry = accounts.reduce((s, a) => s + toTry(a), 0)

  const grouped = accounts.reduce<Record<string, Account[]>>((g, a) => {
    const key = a.bank || 'Diger'
    ;(g[key] = g[key] || []).push(a)
    return g
  }, {})

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(a: Account) {
    setEditId(a.id)
    setForm({ name: a.name, bank: a.bank, type: a.type, currency: a.currency, balance: String(a.balance) })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name || !form.bank || !form.balance) return
    setSaving(true)
    const payload = { name: form.name, bank: form.bank, type: form.type, currency: form.currency, balance: parseFloat(form.balance), is_active: true }
    if (editId) { await supabase.from('accounts').update(payload).eq('id', editId) }
    else { await supabase.from('accounts').insert(payload) }
    setSaving(false); closeForm(); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('accounts').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null); await load()
  }

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <BottomNav />
      <div className="app-main pb-24 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>Modul</div>
            <div className="text-xl font-bold mt-0.5">Hesaplar</div>
          </div>
          <button onClick={openAdd} className="btn-primary px-4 py-2 text-sm">+ Ekle</button>
        </div>

        <div className="mx-4 mb-4 card-lg p-5">
          <div className="text-[12px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Varlik (TRY)</div>
          <div className="mono text-2xl font-bold amt-blue">{fmt(totalTry)}</div>
          {rates && (
            <div className="text-[11px] mt-2 flex gap-3" style={{ color: 'var(--muted)' }}>
              <span>EUR/TRY: {eurTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span>USD/TRY: {usdTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {Object.entries(grouped).map(([bank, accs]) => {
          const bankTotal = accs.reduce((s, a) => s + toTry(a), 0)
          return (
            <div key={bank} className="mb-4">
              <div className="px-5 pb-2 flex justify-between items-center">
                <div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>{bank}</div>
                <div className="text-[12px] mono font-semibold amt-blue">{fmt(bankTotal)}</div>
              </div>
              <div className="flex flex-col gap-2 mx-4">
                {accs.map(a => (
                  <div key={a.id} className="card px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background: 'var(--bg4)' }}>
                      {a.currency === 'TRY' ? '🇹🇷' : a.currency === 'EUR' ? '🇪🇺' : a.currency === 'USD' ? '🇺🇸' : '💰'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        {a.type}{a.currency !== 'TRY' && ` · ≈ ${fmt(toTry(a))}`}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div className="mono text-sm font-semibold amt-blue">{fmt(a.balance, a.currency)}</div>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(a)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--bg4)' }}>✏️</button>
                        <button onClick={() => setDeleteConfirm(a.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {accounts.length === 0 && (
          <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Henuz hesap eklenmemis.<br />
            <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>+ Hesap Ekle</button>
          </div>
        )}

        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Hesabi Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu hesabi silmek istediginize emin misiniz?</div>
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
                <div className="text-sm font-semibold">{editId ? 'Hesabi Duzenle' : 'Yeni Hesap'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hesap Adi</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: Vadesiz TL" className="input" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Banka</label>
                  <input value={form.bank} onChange={e => set('bank', e.target.value)} placeholder="Orn: Ziraat" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
                      <option value="vadesiz">Vadesiz</option><option value="vadeli">Vadeli</option>
                      <option value="yatirim">Yatirim</option><option value="nakit">Nakit</option>
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
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Bakiye</label>
                  <input value={form.balance} onChange={e => set('balance', e.target.value)} placeholder="0" type="number" step="0.01" className="input mono" />
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.name || !form.bank || !form.balance}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
