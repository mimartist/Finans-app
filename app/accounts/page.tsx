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

// Bank brand colors & domains for favicon
const BANK_META: Record<string, { bg: string; text: string; domain: string }> = {
  'Denizbank': { bg: 'rgba(0,83,159,0.06)', text: '#00539f', domain: 'denizbank.com' },
  'Garanti BBVA': { bg: 'rgba(0,130,66,0.06)', text: '#008242', domain: 'garantibbva.com.tr' },
  'Halkbank': { bg: 'rgba(0,73,144,0.06)', text: '#004990', domain: 'halkbank.com.tr' },
  'N26': { bg: 'rgba(72,209,204,0.06)', text: '#36a3a0', domain: 'n26.com' },
  'Sparkasse': { bg: 'rgba(255,0,0,0.06)', text: '#cc0000', domain: 'sparkasse.de' },
  'Ziraat': { bg: 'rgba(0,123,62,0.06)', text: '#007b3e', domain: 'ziraatbank.com.tr' },
  'Vakifbank': { bg: 'rgba(0,51,153,0.06)', text: '#003399', domain: 'vakifbank.com.tr' },
  'Is Bankasi': { bg: 'rgba(0,56,147,0.06)', text: '#003893', domain: 'isbank.com.tr' },
}
const getBankMeta = (bank: string) => BANK_META[bank] || { bg: 'rgba(43,45,110,0.06)', text: '#2b2d6e', domain: '' }
const getBankLogo = (bank: string) => {
  const meta = getBankMeta(bank)
  if (meta.domain) return `https://www.google.com/s2/favicons?domain=${meta.domain}&sz=64`
  return ''
}

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>('hesaplar')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())

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
      // Expand all banks by default
      const banks = new Set((acc || []).map((a: Account) => a.bank))
      setExpandedBanks(banks)
      setLoading(false)
    })()
  }, [])

  const eurTry = rates?.eur_try || 0
  const usdTry = rates?.usd_try || 0
  const toTry = (amount: number, currency: string) => currency === 'EUR' ? amount * eurTry : currency === 'USD' ? amount * usdTry : amount
  const totalBalance = accounts.reduce((s, a) => s + toTry(a.balance, a.currency), 0)
  const tryTotal = accounts.filter(a => a.currency === 'TRY').reduce((s, a) => s + a.balance, 0)
  const eurTotal = accounts.filter(a => a.currency === 'EUR').reduce((s, a) => s + a.balance, 0)
  const usdTotal = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0)
  const alacaklar = debts.filter(d => d.type === 'alacak')
  const verecekler = debts.filter(d => d.type === 'verecek')

  // Group accounts by bank
  const bankGroups = accounts.reduce((groups, acc) => {
    const bank = acc.bank || 'Diger'
    if (!groups[bank]) groups[bank] = []
    groups[bank].push(acc)
    return groups
  }, {} as Record<string, Account[]>)

  const bankTotals = Object.entries(bankGroups).map(([bank, accs]) => ({
    bank,
    accounts: accs,
    total: accs.reduce((s, a) => s + toTry(a.balance, a.currency), 0),
  })).sort((a, b) => b.total - a.total)

  const toggleBank = (bank: string) => {
    setExpandedBanks(prev => {
      const next = new Set(prev)
      if (next.has(bank)) next.delete(bank)
      else next.add(bank)
      return next
    })
  }

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: 'hesaplar', label: 'Hesaplar', Icon: IconWallet },
    { key: 'yatirimlar', label: 'Yatirimlar', Icon: IconTrendUp },
    { key: 'alacak', label: 'Alacak/Verecek', Icon: IconArrowsExchange },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
      <div className="text-sm font-medium">Yukleniyor...</div>
    </div>
  )

  return (
    <div className="app-layout">
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-6 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Hesaplar</div>
          </div>
        </div>

        {/* Tab Selector — single card with 3 tabs */}
        <div className="mx-4 mb-4">
          <div className="flex p-1 rounded-2xl" style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', boxShadow: 'var(--shadow)' }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{
                  background: tab === t.key ? 'linear-gradient(135deg, #2b2d6e, #3d3f8f)' : 'transparent',
                  color: tab === t.key ? '#fff' : 'var(--muted)',
                  boxShadow: tab === t.key ? '0 2px 8px rgba(43,45,110,0.25)' : 'none',
                }}>
                <t.Icon color={tab === t.key ? '#fff' : 'var(--muted)'} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ===== TAB: HESAPLAR ===== */}
        {tab === 'hesaplar' && (
          <>
            {/* Hero card with currency breakdown */}
            <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
              <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Toplam Bakiye</div>
              <div className="mono text-2xl font-extrabold mt-1 mb-4" style={{ position: 'relative', zIndex: 2 }}>{fmt(totalBalance)}</div>
              <div className="flex gap-2" style={{ position: 'relative', zIndex: 2 }}>
                {[
                  { label: 'TRY', value: fmt(tryTotal), sub: '' },
                  { label: 'EUR', value: fmt(eurTotal, 'EUR'), sub: eurTotal > 0 ? fmt(eurTotal * eurTry) : '' },
                  { label: 'USD', value: fmt(usdTotal, 'USD'), sub: usdTotal > 0 ? fmt(usdTotal * usdTry) : '' },
                ].map(c => (
                  <div key={c.label} className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                    style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
                    <div className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>{c.label}</div>
                    <div className="mono text-[11px] font-bold mt-0.5">{c.value}</div>
                    {c.sub && <div className="mono text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{c.sub}</div>}
                  </div>
                ))}
              </div>
              <div className="text-[10px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)', position: 'relative', zIndex: 2 }}>
                {accounts.length} hesap · {Object.keys(bankGroups).length} banka
              </div>
            </div>

            {/* Bank grouped accounts */}
            <div className="flex flex-col gap-3 mx-4">
              {bankTotals.map(({ bank, accounts: bankAccounts, total }) => {
                const colors = getBankMeta(bank)
                const logo = getBankLogo(bank)
                const isExpanded = expandedBanks.has(bank)
                return (
                  <div key={bank} className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid var(--border)', background: 'var(--bg2)', boxShadow: 'var(--shadow)' }}>
                    {/* Bank header — clickable */}
                    <button onClick={() => toggleBank(bank)}
                      className="w-full flex items-center gap-3 px-4 py-3.5"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                        style={{ background: colors.bg }}>
                        {logo ? (
                          <img src={logo} alt={bank} className="w-6 h-6 object-contain" style={{ borderRadius: 4 }} />
                        ) : (
                          <IconWallet color={colors.text} size={18} />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{bank}</div>
                        <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{bankAccounts.length} hesap</div>
                      </div>
                      <div className="text-right">
                        <div className="mono text-[13px] font-bold" style={{ color: colors.text }}>{fmt(total)}</div>
                      </div>
                      <div className="ml-1 text-[11px] transition-transform" style={{ color: 'var(--muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
                    </button>

                    {/* Account items inside bank */}
                    <div style={{
                      maxHeight: isExpanded ? bankAccounts.length * 70 + 16 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease',
                    }}>
                      <div className="px-3 pb-3 flex flex-col gap-1.5">
                        {bankAccounts.map(a => (
                          <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: 'rgba(43,45,110,0.03)' }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: a.currency === 'EUR' ? 'rgba(99,102,241,0.08)' : a.currency === 'USD' ? 'rgba(48,164,108,0.08)' : 'rgba(43,45,110,0.08)' }}>
                              <span className="text-[10px] font-bold" style={{ color: a.currency === 'EUR' ? '#6366f1' : a.currency === 'USD' ? '#30a46c' : '#2b2d6e' }}>
                                {a.currency === 'EUR' ? '€' : a.currency === 'USD' ? '$' : '₺'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12px] font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</div>
                              <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{a.type === 'vadeli' ? 'Vadeli' : 'Vadesiz'}</div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="mono text-[12px] font-bold" style={{ color: 'var(--text)' }}>{fmt(a.balance, a.currency)}</div>
                              {a.currency !== 'TRY' && a.balance > 0 && (
                                <div className="mono text-[9px]" style={{ color: 'var(--muted)' }}>{fmt(toTry(a.balance, a.currency))}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
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
              <div className="flex-1 rounded-2xl py-3 px-3 text-center" style={{ border: '1.5px solid rgba(48,164,108,0.2)', background: 'rgba(48,164,108,0.03)' }}>
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#30a46c' }}>Alacak</div>
                <div className="mono text-sm font-bold mt-0.5" style={{ color: '#30a46c' }}>{fmt(alacaklar.reduce((s, d) => s + toTry(d.amount, d.currency), 0))}</div>
              </div>
              <div className="flex-1 rounded-2xl py-3 px-3 text-center" style={{ border: '1.5px solid rgba(229,72,77,0.2)', background: 'rgba(229,72,77,0.03)' }}>
                <div className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: '#e5484d' }}>Verecek</div>
                <div className="mono text-sm font-bold mt-0.5" style={{ color: '#e5484d' }}>{fmt(verecekler.reduce((s, d) => s + toTry(d.amount, d.currency), 0))}</div>
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
