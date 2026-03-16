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

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<InvestmentWithSnapshot[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
    load()
  }, [])

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

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>

  return (
    <div className="pb-24 page-enter">
      <div className="px-5 pt-5 pb-3">
        <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Modül</div>
        <div className="text-lg font-semibold mt-0.5">Yatırımlar</div>
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
          Henüz yatırım eklenmemiş.
        </div>
      ) : (
        <div className="mx-4 card-lg divide-y" style={{ borderColor: 'var(--border)' }}>
          {investments.map((inv, i) => {
            const color = typeColor[inv.type] || '#6b7280'
            const pnlPositive = (inv.pnl_pct || 0) >= 0
            return (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderColor: 'var(--border)', borderTopWidth: i === 0 ? 0 : 1 }}
              >
                <div className="text-lg w-8 text-center">{typeIcon[inv.type] || '📦'}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{inv.symbol || inv.name}</div>
                  <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
                    {inv.name} · {inv.quantity} {inv.type === 'altin' ? 'gr' : 'adet'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-sm font-medium" style={{ color }}>
                    {fmt(inv.total_value || 0, inv.currency)}
                  </div>
                  {inv.pnl_pct !== undefined && (
                    <div className={`text-[11px] mt-0.5 ${pnlPositive ? 'amt-green' : 'amt-red'}`}>
                      {pnlPositive ? '+' : ''}{inv.pnl_pct.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
