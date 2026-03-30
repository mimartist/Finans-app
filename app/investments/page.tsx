'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { Investment, ExchangeRate } from '@/lib/supabase'

type InvestmentWithSnapshot = Investment & {
  latest_price?: number
  total_value?: number
  total_value_try?: number
  cost_basis?: number
  pnl?: number
  pnl_pct?: number
  snapshot_date?: string
}

const emptyForm = { name: '', type: 'hisse', symbol: '', quantity: '', avg_cost: '', currency: 'TRY', platform: '' }

function fmtPrice(amount: number, currency = 'TRY'): string {
  const prefix = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '₺'
  return prefix + amount.toLocaleString('tr-TR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
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
  const [updatingRates, setUpdatingRates] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Inline price update
  const [priceEditId, setPriceEditId] = useState<number | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [priceSaving, setPriceSaving] = useState(false)

  async function updateRates() {
    setUpdatingRates(true)
    await fetch('/api/update-rates')
    await load()
    setUpdatingRates(false)
  }

  async function load() {
    const [{ data: inv }, { data: snaps }, { data: rt }] = await Promise.all([
      supabase.from('investments').select('*').eq('is_active', true),
      supabase.from('investment_snapshots').select('*').order('snapshot_date', { ascending: false }),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
    ])

    const currentRates = rt?.[0] || null

    const enriched = (inv || []).map((i: Investment) => {
      const snap = (snaps || []).find((s: any) => s.investment_id === i.id)
      const costBasis = (i.avg_cost || 0) * (i.quantity || 0)
      const currentVal = snap?.total_value || costBasis
      const pnl = currentVal - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0

      // Calculate TRY value
      let totalValueTry = snap?.total_value_try
      if (!totalValueTry && currentRates) {
        if (i.currency === 'EUR') totalValueTry = currentVal * (currentRates.eur_try || 1)
        else if (i.currency === 'USD') totalValueTry = currentVal * (currentRates.usd_try || 1)
        else totalValueTry = currentVal
      }

      return {
        ...i,
        latest_price: snap?.price,
        total_value: currentVal,
        total_value_try: totalValueTry || currentVal,
        cost_basis: costBasis,
        pnl,
        pnl_pct: pnlPct,
        snapshot_date: snap?.snapshot_date,
      }
    })

    setInvestments(enriched)
    setRates(currentRates)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    load()
  }, [])

  // Portfolio totals
  const totalCostTry = investments.reduce((s, i) => {
    const cost = i.cost_basis || 0
    if (i.currency === 'EUR' && rates) return s + cost * rates.eur_try
    if (i.currency === 'USD' && rates) return s + cost * rates.usd_try
    return s + cost
  }, 0)
  const totalValueTry = investments.reduce((s, i) => s + (i.total_value_try || 0), 0)
  const totalPnl = totalValueTry - totalCostTry
  const totalPnlPct = totalCostTry > 0 ? (totalPnl / totalCostTry) * 100 : 0

  const typeIcon: Record<string, string> = { hisse: '📊', fon: '📁', altin: '🥇', doviz: '💱', kripto: '₿', diger: '📦' }

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(inv: InvestmentWithSnapshot) {
    setEditId(inv.id)
    setForm({ name: inv.name, type: inv.type, symbol: inv.symbol || '', quantity: String(inv.quantity || ''), avg_cost: String(inv.avg_cost || ''), currency: inv.currency, platform: inv.platform || '' })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyForm) }

  async function handleSave() {
    if (!form.name || !form.quantity) return
    setSaving(true)
    const payload = { name: form.name, type: form.type, symbol: form.symbol || null, quantity: parseFloat(form.quantity) || 0, avg_cost: parseFloat(form.avg_cost) || 0, currency: form.currency, platform: form.platform || null, is_active: true, ...(userId ? { user_id: userId } : {}) }
    if (editId) { await supabase.from('investments').update(payload).eq('id', editId) }
    else { await supabase.from('investments').insert(payload) }
    setSaving(false); closeForm(); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('investments').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null); await load()
  }

  async function handlePriceUpdate(inv: InvestmentWithSnapshot) {
    const newPrice = parseFloat(priceInput)
    if (!newPrice || newPrice <= 0) return
    setPriceSaving(true)

    const totalValue = inv.quantity * newPrice
    let totalValueTry = totalValue
    if (rates) {
      if (inv.currency === 'EUR') totalValueTry = totalValue * rates.eur_try
      else if (inv.currency === 'USD') totalValueTry = totalValue * rates.usd_try
    }

    const today = new Date().toISOString().split('T')[0]

    // Delete existing snapshot for today, then insert new
    await supabase.from('investment_snapshots').delete()
      .eq('investment_id', inv.id).eq('snapshot_date', today)

    await supabase.from('investment_snapshots').insert({
      investment_id: inv.id,
      snapshot_date: today,
      price: newPrice,
      total_value: Math.round(totalValue * 100) / 100,
      total_value_try: Math.round(totalValueTry * 100) / 100,
      ...(userId ? { user_id: userId } : {}),
    })

    setPriceSaving(false)
    setPriceEditId(null)
    setPriceInput('')
    await load()
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <div className="bg-blobs"><div className="bg-blob-3" /><div className="bg-blob-4" /></div>
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold mt-0.5">Yatirimlar</div>
          </div>
          <div className="flex gap-2">
            <button onClick={updateRates} disabled={updatingRates}
              className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
              style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: updatingRates ? 'var(--muted)' : 'var(--accent)' }}>
              {updatingRates ? '↻ ...' : '↻ Kurlari Guncelle'}
            </button>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="mx-4 mb-4 card-lg p-5">
          <div className="text-[12px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Portfoy</div>
          <div className="mono text-3xl font-bold amt-blue">{fmt(totalValueTry)}</div>
          {rates && (
            <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
              € {Math.round(totalValueTry / rates.eur_try).toLocaleString('tr-TR')} · $ {Math.round(totalValueTry / rates.usd_try).toLocaleString('tr-TR')}
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex justify-between text-[12px]">
              <span style={{ color: 'var(--muted)' }}>Toplam Maliyet</span>
              <span className="mono font-semibold">{fmt(totalCostTry)}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span style={{ color: 'var(--muted)' }}>Guncel Deger</span>
              <span className="mono font-semibold amt-blue">{fmt(totalValueTry)}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span style={{ color: 'var(--muted)' }}>Toplam K/Z</span>
              <span className="mono font-semibold flex items-center gap-1" style={{ color: totalPnl >= 0 ? '#059669' : '#dc2626' }}>
                {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                <span className="text-[10px]">({totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%)</span>
                <span>{totalPnl > 0 ? '↑' : totalPnl < 0 ? '↓' : ''}</span>
              </span>
            </div>
          </div>
        </div>

        {rates && (
          <>
            <div className="px-5 mb-2"><div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>Doviz Kurlari</div></div>
            <div className="flex gap-2 mx-4 mb-4">
              {[{ label: 'USD/TRY', val: rates.usd_try, icon: '🇺🇸' }, { label: 'EUR/TRY', val: rates.eur_try, icon: '🇪🇺' }, { label: 'ALTIN/gr', val: rates.gold_try, icon: '🥇' }].map(r => (
                <div key={r.label} className="flex-1 card p-3">
                  <div className="text-base mb-1">{r.icon}</div>
                  <div className="mono text-sm font-semibold">{r.val ? fmt(r.val) : '—'}</div>
                  <div className="text-[10px] mt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{r.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="px-5 mb-2"><div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>Pozisyonlar</div></div>

        {investments.length === 0 ? (
          <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Henuz yatirim eklenmemis.<br />
            <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>Yatirim Ekle</button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mx-4">
            {investments.map((inv) => {
              const costBasis = inv.cost_basis || 0
              const currentVal = inv.total_value || 0
              const pnl = inv.pnl || 0
              const pnlPct = inv.pnl_pct || 0
              const isProfit = pnl > 0
              const isLoss = pnl < 0
              const pnlColor = isProfit ? '#059669' : isLoss ? '#dc2626' : 'var(--muted)'
              const unitLabel = inv.type === 'altin' ? 'gr' : 'adet'
              const canUpdatePrice = ['hisse', 'fon', 'altin'].includes(inv.type)
              const isEditingPrice = priceEditId === inv.id
              const isExpanded = expandedId === inv.id

              return (
                <div key={inv.id}>
                  {/* Compact row */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                    className="px-3 py-2.5 flex items-center gap-3 cursor-pointer"
                    style={{
                      background: 'var(--bg3)',
                      borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${pnlColor}`,
                      borderBottom: isExpanded ? '1px solid var(--border)' : undefined,
                    }}>
                    <div className="text-base flex-shrink-0" style={{ width: 24, textAlign: 'center' }}>{typeIcon[inv.type] || '📦'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{inv.symbol || inv.name}</div>
                      <div className="text-[10px] mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                        <span>{inv.type} · {inv.platform || '—'}</span>
                        <span>·</span>
                        <span>{inv.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} {unitLabel}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <div className="mono text-[13px] font-bold amt-blue">{fmt(currentVal, inv.currency)}</div>
                        <div className="mono text-[10px] font-medium flex items-center justify-end gap-0.5" style={{ color: pnlColor }}>
                          {isProfit ? '+' : ''}{pnlPct.toFixed(1)}% {isProfit ? '↑' : isLoss ? '↓' : ''}
                        </div>
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
                      borderLeft: `3px solid ${pnlColor}`,
                    }}>
                      {/* Price rows */}
                      <div className="flex flex-col gap-1.5 text-[12px] mb-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--muted)' }}>Maliyet fiyati</span>
                          <span className="mono font-medium">{fmtPrice(inv.avg_cost || 0, inv.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span style={{ color: 'var(--muted)' }}>Guncel fiyat</span>
                          <div className="flex items-center gap-2">
                            {isEditingPrice ? (
                              <div className="flex items-center gap-1">
                                <input
                                  value={priceInput}
                                  onChange={e => setPriceInput(e.target.value)}
                                  type="number"
                                  step="any"
                                  className="input mono text-right"
                                  style={{ width: 100, padding: '2px 6px', fontSize: 12 }}
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                  onKeyDown={e => { if (e.key === 'Enter') handlePriceUpdate(inv); if (e.key === 'Escape') { setPriceEditId(null); setPriceInput('') } }}
                                />
                                <button onClick={(e) => { e.stopPropagation(); handlePriceUpdate(inv) }} disabled={priceSaving}
                                  className="text-[10px] font-semibold px-2 py-1 rounded"
                                  style={{ background: 'rgba(13,148,136,0.1)', color: '#0d9488' }}>
                                  {priceSaving ? '...' : '✓'}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setPriceEditId(null); setPriceInput('') }}
                                  className="text-[10px] px-1.5 py-1 rounded"
                                  style={{ background: 'var(--bg4)', color: 'var(--muted)' }}>✕</button>
                              </div>
                            ) : (
                              <>
                                <span className="mono font-medium" style={{ color: inv.latest_price ? 'var(--text)' : 'var(--muted)' }}>
                                  {inv.latest_price ? fmtPrice(inv.latest_price, inv.currency) : '—'}
                                </span>
                                {canUpdatePrice && (
                                  <button onClick={(e) => { e.stopPropagation(); setPriceEditId(inv.id); setPriceInput(inv.latest_price ? String(inv.latest_price) : '') }}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded"
                                    style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.2)' }}>
                                    Guncelle
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {inv.snapshot_date && (
                          <div className="text-[10px] text-right" style={{ color: 'var(--muted)' }}>
                            Son guncelleme: {new Date(inv.snapshot_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      {/* Totals */}
                      <div className="flex flex-col gap-1.5 text-[12px] mb-3">
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--muted)' }}>Maliyet</span>
                          <span className="mono font-semibold">{fmt(costBasis, inv.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--muted)' }}>Guncel</span>
                          <span className="mono font-semibold amt-blue">{fmt(currentVal, inv.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span style={{ color: 'var(--muted)' }}>K/Z</span>
                          <span className="mono font-semibold flex items-center gap-1" style={{ color: pnlColor }}>
                            {isProfit ? '+' : ''}{fmt(pnl, inv.currency)}
                            <span className="text-[10px]">({isProfit ? '+' : ''}{pnlPct.toFixed(1)}%)</span>
                            <span>{isProfit ? '↑' : isLoss ? '↓' : ''}</span>
                          </span>
                        </div>
                        {inv.currency !== 'TRY' && inv.total_value_try && (
                          <div className="flex justify-between text-[11px] mt-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                            <span style={{ color: 'var(--muted)' }}>TRY Deger</span>
                            <span className="mono font-semibold">{fmt(inv.total_value_try)}</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(inv) }}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs"
                          style={{ background: 'var(--bg4)' }}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(inv.id) }}
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

        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Yatirimi Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu yatirimi silmek istediginize emin misiniz?</div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1 py-2.5 text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editId ? 'Yatirimi Duzenle' : 'Yeni Yatirim'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Yatirim Adi</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Orn: BIST Hisse" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
                      <option value="hisse">Hisse</option><option value="fon">Fon</option><option value="altin">Altin</option>
                      <option value="doviz">Doviz</option><option value="kripto">Kripto</option><option value="diger">Diger</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Sembol</label>
                    <input value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="Orn: THYAO" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Miktar</label>
                    <input value={form.quantity} onChange={e => set('quantity', e.target.value)} placeholder="0" type="number" step="any" className="input mono" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Ort. Maliyet</label>
                    <input value={form.avg_cost} onChange={e => set('avg_cost', e.target.value)} placeholder="0" type="number" step="any" className="input mono" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Platform</label>
                    <input value={form.platform} onChange={e => set('platform', e.target.value)} placeholder="Orn: Midas" className="input" />
                  </div>
                </div>
              </div>
              <button onClick={handleSave} disabled={saving || !form.name || !form.quantity}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
