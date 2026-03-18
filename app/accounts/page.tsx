'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, isDemo } from '@/lib/supabase'
import type { Account, ExchangeRate, DebtRecord } from '@/lib/supabase'
import { IconWallet, IconTrendUp, IconArrowsExchange, IconPlus } from '@/components/Icons'

type Tab = 'hesaplar' | 'yatirimlar' | 'alacak'

// Mock data
const MOCK_ACCOUNTS: Account[] = [
  { id: 1, name: 'Ziraat TL', bank: 'Ziraat', type: 'vadesiz', currency: 'TRY', balance: 45200, is_active: true, updated_at: '' },
  { id: 2, name: 'Garanti EUR', bank: 'Garanti', type: 'vadesiz', currency: 'EUR', balance: 3200, is_active: true, updated_at: '' },
  { id: 3, name: 'Is Bankasi USD', bank: 'Is Bankasi', type: 'vadesiz', currency: 'USD', balance: 1500, is_active: true, updated_at: '' },
  { id: 4, name: 'Vakifbank Vadeli', bank: 'Vakifbank', type: 'vadeli', currency: 'TRY', balance: 120000, is_active: true, updated_at: '' },
]
const MOCK_INVESTMENTS = [
  { id: 1, name: 'BİST Hisse', type: 'hisse', platform: 'Midas', currency: 'TRY', value: 52000, pnl: 3200, pnlPct: 6.5 },
  { id: 2, name: 'Bitcoin', type: 'kripto', platform: 'Binance', currency: 'USD', value: 8500, pnl: 1200, pnlPct: 16.4 },
  { id: 3, name: 'Altin', type: 'altin', platform: 'Ziraat', currency: 'TRY', value: 33000, pnl: -800, pnlPct: -2.4 },
]
const MOCK_DEBTS: DebtRecord[] = [
  { id: 1, person_name: 'Ahmet Yilmaz', type: 'alacak', amount: 15000, currency: 'TRY', description: 'Ofis kirasi', transaction_date: '2026-01-15', due_date: '2026-03-30', is_settled: false, is_recurring: true, frequency: 'aylik', expected_day: 15 },
  { id: 2, person_name: 'Mehmet Demir', type: 'alacak', amount: 5000, currency: 'TRY', description: 'Proje odemesi', transaction_date: '2026-02-20', is_settled: false },
  { id: 3, person_name: 'Kargo Firması', type: 'verecek', amount: 2400, currency: 'TRY', description: 'Kargo borcu', transaction_date: '2026-03-01', due_date: '2026-04-01', is_settled: false },
]
const MOCK_RATES: ExchangeRate = { id: 1, date: new Date().toISOString().split('T')[0], usd_try: 38.5, eur_try: 41.2, btc_usd: 84500, eth_usd: 3200, gold_try: 3950 }

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>('hesaplar')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemo) {
      setAccounts(MOCK_ACCOUNTS)
      setRates(MOCK_RATES)
      setDebts(MOCK_DEBTS)
      setLoading(false)
      return
    }
    (async () => {
      const [{ data: acc }, { data: rt }, { data: dbt }] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_active', true).order('bank'),
        supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
        supabase.from('debt_records').select('*').eq('is_settled', false),
      ])
      setAccounts(acc || [])
      setRates(rt?.[0] || null)
      setDebts(dbt || [])
      setLoading(false)
    })()
  }, [])

  const eurTry = rates?.eur_try || 0
  const usdTry = rates?.usd_try || 0
  const toTry = (amount: number, currency: string) => currency === 'EUR' ? amount * eurTry : currency === 'USD' ? amount * usdTry : amount
  const totalBalance = accounts.reduce((s, a) => s + toTry(a.balance, a.currency), 0)
  const alacaklar = debts.filter(d => d.type === 'alacak')
  const verecekler = debts.filter(d => d.type === 'verecek')

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: 'hesaplar', label: 'Hesaplar', Icon: IconWallet },
    { key: 'yatirimlar', label: 'Yatirimlar', Icon: IconTrendUp },
    { key: 'alacak', label: 'Alacak / Verecek', Icon: IconArrowsExchange },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
      <div className="text-sm font-medium">Yukleniyor...</div>
    </div>
  )

  return (
    <div className="app-layout">
      <BottomNav />
      <div className="app-main pb-24 page-enter">
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-6 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Hesaplar</div>
          </div>
        </div>

        {/* Tab Selector — pill style */}
        <div className="mx-4 mb-4">
          <div className="flex gap-2 p-1 rounded-full" style={{ background: 'var(--bg4)' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: tab === t.key ? 'linear-gradient(135deg, #2b2d6e, #3d3f8f)' : 'transparent',
                  color: tab === t.key ? '#fff' : 'var(--muted)',
                  boxShadow: tab === t.key ? '0 2px 8px rgba(43,45,110,0.25)' : 'none',
                }}>
                <t.Icon color={tab === t.key ? '#fff' : 'var(--muted)'} size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== TAB: HESAPLAR ===== */}
        {tab === 'hesaplar' && (
          <>
            {/* Total */}
            <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
              <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Toplam Bakiye</div>
              <div className="mono text-2xl font-extrabold mt-1" style={{ position: 'relative', zIndex: 2 }}>{fmt(totalBalance)}</div>
              <div className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>{accounts.length} aktif hesap</div>
            </div>

            {/* Account list */}
            <div className="flex flex-col gap-2 mx-4">
              {accounts.map(a => (
                <div key={a.id} className="tx-item">
                  <div className="tx-icon" style={{ background: a.currency === 'TRY' ? 'rgba(43,45,110,0.06)' : a.currency === 'EUR' ? 'rgba(99,102,241,0.06)' : 'rgba(48,164,108,0.06)' }}>
                    <IconWallet color={a.currency === 'TRY' ? '#2b2d6e' : a.currency === 'EUR' ? '#6366f1' : '#30a46c'} size={18} />
                  </div>
                  <div className="tx-info">
                    <div className="tx-name">{a.name}</div>
                    <div className="tx-detail">{a.bank} · {a.type === 'vadeli' ? 'Vadeli' : 'Vadesiz'}</div>
                  </div>
                  <div className="tx-amount">
                    <div className="tx-value" style={{ color: '#2b2d6e' }}>{fmt(a.balance, a.currency)}</div>
                    {a.currency !== 'TRY' && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{fmt(toTry(a.balance, a.currency))}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== TAB: YATIRIMLAR ===== */}
        {tab === 'yatirimlar' && (
          <>
            <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
              <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Toplam Portfoy</div>
              <div className="mono text-2xl font-extrabold mt-1" style={{ position: 'relative', zIndex: 2 }}>
                {fmt(MOCK_INVESTMENTS.reduce((s, i) => s + (i.currency === 'USD' ? i.value * usdTry : i.value), 0))}
              </div>
            </div>

            <div className="flex flex-col gap-2 mx-4">
              {MOCK_INVESTMENTS.map(inv => (
                <div key={inv.id} className="tx-item">
                  <div className="tx-icon" style={{ background: inv.pnl >= 0 ? 'rgba(48,164,108,0.06)' : 'rgba(229,72,77,0.06)' }}>
                    <IconTrendUp color={inv.pnl >= 0 ? '#30a46c' : '#e5484d'} size={18} />
                  </div>
                  <div className="tx-info">
                    <div className="tx-name">{inv.name}</div>
                    <div className="tx-detail">{inv.platform} · {inv.type}</div>
                  </div>
                  <div className="tx-amount">
                    <div className="tx-value" style={{ color: '#2b2d6e' }}>{fmt(inv.value, inv.currency)}</div>
                    <div className="tx-badge" style={{ background: inv.pnl >= 0 ? 'rgba(48,164,108,0.08)' : 'rgba(229,72,77,0.08)', color: inv.pnl >= 0 ? '#30a46c' : '#e5484d' }}>
                      {inv.pnl >= 0 ? '+' : ''}{inv.pnlPct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== TAB: ALACAK / VERECEK ===== */}
        {tab === 'alacak' && (
          <>
            {/* Summary pills */}
            <div className="flex gap-2 mx-4 mb-4">
              <div className="flex-1 rounded-full py-2.5 px-3 text-center" style={{ border: '1.5px solid rgba(48,164,108,0.3)' }}>
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#30a46c' }}>Alacak</div>
                <div className="mono text-[11px] font-bold mt-0.5" style={{ color: '#30a46c' }}>{fmt(alacaklar.reduce((s, d) => s + d.amount, 0))}</div>
              </div>
              <div className="flex-1 rounded-full py-2.5 px-3 text-center" style={{ border: '1.5px solid rgba(229,72,77,0.3)' }}>
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#e5484d' }}>Verecek</div>
                <div className="mono text-[11px] font-bold mt-0.5" style={{ color: '#e5484d' }}>{fmt(verecekler.reduce((s, d) => s + d.amount, 0))}</div>
              </div>
            </div>

            {/* Alacaklar */}
            {alacaklar.length > 0 && (
              <>
                <div className="mx-5 mb-2 text-xs font-bold" style={{ color: '#30a46c' }}>Alacaklar</div>
                <div className="flex flex-col gap-2 mx-4 mb-4">
                  {alacaklar.map(d => (
                    <div key={d.id} className="tx-item">
                      <div className="tx-icon" style={{ background: 'rgba(48,164,108,0.06)' }}>
                        <span className="text-sm font-bold" style={{ color: '#30a46c' }}>{d.person_name.charAt(0)}</span>
                      </div>
                      <div className="tx-info">
                        <div className="tx-name">{d.person_name}</div>
                        <div className="tx-detail">{d.description || 'Alacak'}{d.is_recurring ? ' · Duzenli' : ''}</div>
                      </div>
                      <div className="tx-amount">
                        <div className="tx-value amt-green">+{fmt(d.amount, d.currency)}</div>
                        {d.due_date && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{new Date(d.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Verecekler */}
            {verecekler.length > 0 && (
              <>
                <div className="mx-5 mb-2 text-xs font-bold" style={{ color: '#e5484d' }}>Verecekler</div>
                <div className="flex flex-col gap-2 mx-4 mb-4">
                  {verecekler.map(d => (
                    <div key={d.id} className="tx-item">
                      <div className="tx-icon" style={{ background: 'rgba(229,72,77,0.06)' }}>
                        <span className="text-sm font-bold" style={{ color: '#e5484d' }}>{d.person_name.charAt(0)}</span>
                      </div>
                      <div className="tx-info">
                        <div className="tx-name">{d.person_name}</div>
                        <div className="tx-detail">{d.description || 'Verecek'}</div>
                      </div>
                      <div className="tx-amount">
                        <div className="tx-value amt-red">-{fmt(d.amount, d.currency)}</div>
                        {d.due_date && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{new Date(d.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
