'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { Investment, ExchangeRate } from '@/lib/supabase'

type InvestmentWithSnapshot = Investment & {
  latest_price?: number
  total_value?: number
  total_value_try?: number
  pnl_pct?: number
}

const emptyForm = {
  name: '', type: 'hisse', symbol: '', quantity: '', avg_cost: '', currency: 'TRY', platform: '',
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<InvestmentWithSnapshot[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  async function load() {
    const today = new Date().toISOString().split('T')[0]
    const [{ data: inv }, { data: snaps }, { data: rt }] = await Promise.all([
      supabase.from('investments').select('*').eq('is_active', true),
      supabase.from('investment_snapshots').select('*').eq('snapshot_date', today),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
    ])

    const enriched = (inv || []).map((i: Investment) => {
      const snap = (snaps || []).find((s: any) => s.investment_id === i.id)
      const costBasis = (i.avg_cost || 0) * (i.quantity || 0)
      const currentVal = snap?.total_value || costBasis
      const pnl = costBasis > 0 ? ((currentVal - costBasis) / costBasis) * 100 : 0
      return {
        ...i,
        latest_price: snap?.price,
        total_value: snap?.total_value || costBasis,
        total_value_try: snap?.total_value_try,
        pnl_pct: pnl,
      }
    })

    setInvestments(enriched)
    setRates(rt?.[0] || null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalTry = investments.reduce((s, i) => {
    const val = i.total_value_try || i.total_value || 0
    return s + val
  }, 0)

  const typeIcon: Record<string, string> = {
    hisse: '📊', fon: '📁', altin: '🥇', doviz: '💱', kripto: '₿', diger: '📦'
  }
  const typeColor: Record<string, string> = {
    hisse: '#6c8fff', fon: '#a78bfa', altin: '#f59e0b', doviz: '#4ade9a', kripto: '#f59e0b', diger: '#6b7280'
  }

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }

  function openEdit(inv: InvestmentWithSnapshot) {
    setEditId(inv.id)
    setForm({
      name: inv.name, type: inv.type, symbol: inv.symbol || '',
      quantity: String(inv.quantity || ''), avg_cost: String(inv.avg_cost || ''),
      currency: inv.currency, platform: inv.platform || '',
    })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name || !form.quantity) return
    setSaving(true)
    const payload = {
      name: form.name, type: form.type, symbol: form.symbol || null,
      quantity: parseFloat(form.quantity) || 0, avg_cost: parseFloat(form.avg_cost) || 0,
      currency: form.currency, platform: form.platform || null, is_active: true,
    }
    if (editId) {
      await supabase.from('investments').update(payload).eq('id', editId)
    } else {
      await supabase.from('investments').insert(payload)
    }
    setSaving(false)
    closeForm()
    await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('investments').update({ is_active: false }).eq('id', id)
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
          <div className="text-lg font-semibold mt-0.5">Yatırımlar</div>
        </div>
        <button onClick={openAdd} className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: 'rgba(108,143,255,0.15)', color: '#6c8fff' }}>+</button>
      </div>

      {/* Özet */}
      <div className="mx-4 mb-4 card-lg p-5">
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Toplam Portföy</div>
        <div className="mono text-3xl font-medium amt-blue">{fmt(totalTry)}</div>
        {rates && (
          <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            € {Math.round(totalTry / rates.eur_try).toLocaleString('tr-TR')} · $ {Math.round(totalTry / rates.usd_try).toLocaleString('tr-TR')}
          </div>
        )}
      </div>

      {/* Döviz Kurları */}
      {rates && (
        <>
          <div className="px-5 pb-2 text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
            Döviz Kurları
          </div>
          <div className="flex gap-2 mx-4 mb-4">
            {[
              { label: 'USD/TRY', val: rates.usd_try, icon: '🇺🇸' },
              { label: 'EUR/TRY', val: rates.eur_try, icon: '🇪🇺' },
              { label: 'ALTIN/gr', val: rates.gold_try, icon: '🥇' },
            ].map(r => (
              <div key={r.label} className="flex-1 card p-3">
                <div className="text-base mb-1">{r.icon}</div>
                <div className="mono text-sm font-medium">{r.val ? fmt(r.val) : '—'}</div>
                <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{r.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pozisyonlar */}
      <div className="px-5 pb-2 text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
        Pozisyonlar
      </div>

      {investments.length === 0 ? (
        <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Henüz yatırım eklenmemiş.<br />
          <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: '#6c8fff' }}>+ Yatirim Ekle</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 mx-4">
          {investments.map((inv) => {
            const color = typeColor[inv.type] || '#6b7280'
            const pnlPositive = (inv.pnl_pct || 0) >= 0
            return (
              <div key={inv.id} className="card px-4 py-3 flex items-center gap-3">
                <div className="text-lg w-8 text-center">{typeIcon[inv.type] || '📦'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{inv.symbol || inv.name}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                    {inv.name} · {inv.quantity} {inv.type === 'altin' ? 'gr' : 'adet'}
                    {inv.platform && ` · ${inv.platform}`}
                  </div>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <div className="mono text-sm font-medium" style={{ color }}>
                      {fmt(inv.total_value || 0, inv.currency)}
                    </div>
                    {inv.pnl_pct !== undefined && (
                      <div className={`text-[11px] mt-0.5 ${pnlPositive ? 'amt-green' : 'amt-red'}`}>
                        {pnlPositive ? '+' : ''}{inv.pnl_pct.toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(inv)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: 'var(--bg4)' }}>✏️</button>
                    <button onClick={() => setDeleteConfirm(inv.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
                      style={{ background: 'rgba(248,113,113,0.12)' }}>🗑️</button>
                  </div>
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
            <div className="text-sm font-semibold mb-2">Yatirimi Sil</div>
            <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu yatirimi silmek istediginize emin misiniz?</div>
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
              <div className="text-sm font-semibold">{editId ? 'Yatirimi Duzenle' : 'Yeni Yatirim'}</div>
              <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Yatirim Adi</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: BIST Hisse"
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                  <select value={form.type} onChange={e => set('type', e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <option value="hisse">Hisse</option>
                    <option value="fon">Fon</option>
                    <option value="altin">Altin</option>
                    <option value="doviz">Doviz</option>
                    <option value="kripto">Kripto</option>
                    <option value="diger">Diger</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Sembol</label>
                  <input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="Orn: THYAO"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Miktar</label>
                  <input value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" type="number" step="any"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mono"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Ort. Maliyet</label>
                  <input value={form.avg_cost} onChange={e => set('avg_cost', e.target.value)} placeholder="0" type="number" step="any"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none mono"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
              </div>
              <div className="flex gap-3">
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
                <div className="flex-1">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Platform</label>
                  <input value={form.platform} onChange={e => set('platform', e.target.value)} placeholder="Orn: Midas"
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                </div>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving || !form.name || !form.quantity}
              className="w-full mt-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #6c8fff, #a78bfa)', color: '#fff',
                opacity: saving || !form.name || !form.quantity ? 0.4 : 1 }}>
              {saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
