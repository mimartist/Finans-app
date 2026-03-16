'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { Account, Loan, RecurringExpense, ExchangeRate } from '@/lib/supabase'

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: acc }, { data: lns }, { data: rec }, { data: rt }] = await Promise.all([
        supabase.from('accounts').select('*').eq('is_active', true),
        supabase.from('loans').select('*').eq('is_active', true),
        supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
        supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      ])
      setAccounts(acc || [])
      setLoans(lns || [])
      setRecurring(rec || [])
      setRates(rt?.[0] || null)
      setLoading(false)
    }
    load()
  }, [])

  // Hesaplamalar
  const eurTry = rates?.eur_try || 38
  const usdTry = rates?.usd_try || 35

  const cashTry = accounts.reduce((sum, a) => {
    if (a.currency === 'TRY') return sum + a.balance
    if (a.currency === 'EUR') return sum + a.balance * eurTry
    if (a.currency === 'USD') return sum + a.balance * usdTry
    return sum
  }, 0)

  const totalDebtTry = loans.reduce((sum, l) => sum + (l.remaining_amount || 0), 0)

  const monthlyFixed = recurring.reduce((sum, r) => sum + r.amount, 0)
  const monthlyLoans = loans.reduce((sum, l) => sum + l.monthly_payment, 0)
  const monthlyTotal = monthlyFixed + monthlyLoans

  const runwayMonths = monthlyTotal > 0 ? (cashTry / monthlyTotal).toFixed(1) : '∞'
  const runwayPct = Math.min(100, (parseFloat(runwayMonths as string) / 12) * 100)

  // Yaklaşan ödemeler (7 gün içindeki)
  const upcomingLoans = loans
    .filter(l => l.payment_day)
    .map(l => ({ name: l.name, amount: l.monthly_payment, day: l.payment_day, color: '#f87171', icon: '🏦' }))

  const upcomingRecurring = recurring
    .filter(r => r.payment_day && r.category !== 'nakit')
    .map(r => ({
      name: r.name,
      amount: r.amount,
      day: r.payment_day!,
      color: r.category === 'kredi' ? '#6c8fff' : r.category === 'personel' ? '#a78bfa' : '#f59e0b',
      icon: r.category === 'fatura' ? '📄' : r.category === 'aidat' ? '🏢' : r.category === 'personel' ? '👤' : '💳'
    }))

  const allPayments = [...upcomingLoans, ...upcomingRecurring]
    .map(p => ({ ...p, days: daysUntil(p.day) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 5)

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
        <div className="text-center">
          <div className="text-3xl mb-3">⏳</div>
          <div className="text-sm">Yükleniyor...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-24 page-enter">
      {/* Header */}
      <div className="flex justify-between items-center px-5 pt-5 pb-3">
        <div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{greeting}</div>
          <div className="text-lg font-semibold mt-0.5">Atakan Bey 👋</div>
        </div>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #6c8fff, #a78bfa)' }}
        >
          AK
        </div>
      </div>

      {/* AI Bar */}
      <div className="mx-4 mb-3 card px-4 py-3 flex items-center gap-3 cursor-pointer"
        style={{ borderColor: 'rgba(108,143,255,0.2)' }}>
        <div className="w-2 h-2 rounded-full bg-accent-blue pulse" style={{ background: '#6c8fff' }} />
        <span className="text-sm" style={{ color: 'var(--muted)' }}>Asistana bir şey sor...</span>
        <span className="ml-auto text-base opacity-40">⌨</span>
      </div>

      {/* Net Worth */}
      <div className="mx-4 mb-3 card-lg p-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-5" style={{ background: '#6c8fff' }} />
        <div className="text-[11px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
          Toplam Nakit Varlık
        </div>
        <div className="mono text-3xl font-medium">{fmt(cashTry)}</div>
        <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          Toplam borç: <span className="amt-red">{fmt(totalDebtTry)}</span>
        </div>

        {/* Currency pills */}
        <div className="flex gap-2 mt-4">
          {accounts.slice(0, 4).map((a) => (
            <div key={a.id} className="flex-1 rounded-xl p-2.5" style={{ background: 'var(--bg4)', border: '1px solid var(--border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
                {a.currency === 'TRY' ? '🇹🇷' : a.currency === 'EUR' ? '🇩🇪' : a.currency === 'USD' ? '🇺🇸' : '₿'}
              </div>
              <div className="mono text-sm font-medium amt-blue">{fmt(a.balance, a.currency)}</div>
              <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--muted)' }}>
                {a.bank || a.name}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Runway */}
      <div className="mx-4 mb-3 card px-4 py-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-semibold">💰 Sürdürülebilirlik (Runway)</div>
          <div className="badge badge-blue">{runwayMonths} Ay</div>
        </div>
        <div className="progress-wrap mb-2">
          <div
            className="progress-bar"
            style={{
              width: `${runwayPct}%`,
              background: 'linear-gradient(90deg, #4ade9a, #6c8fff)',
            }}
          />
        </div>
        <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
          <span>0 ay</span>
          <span className="amt-green font-semibold">Mevcut: {runwayMonths} ay</span>
          <span>12 ay</span>
        </div>
      </div>

      {/* Bu Ay Özet */}
      <div className="px-5 pt-1 pb-2 text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
        Bu Ay Özet
      </div>
      <div className="flex gap-2 mx-4 mb-3">
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Kredi Ödeme</div>
          <div className="mono text-base font-medium amt-red">{fmt(monthlyLoans)}</div>
          <div className="text-[10px] mt-1 amt-red">{loans.length} kredi</div>
        </div>
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Düzenli Gider</div>
          <div className="mono text-base font-medium amt-amber">{fmt(monthlyFixed)}</div>
          <div className="text-[10px] mt-1 amt-amber">{recurring.length} kalem</div>
        </div>
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Toplam</div>
          <div className="mono text-base font-medium amt-blue">{fmt(monthlyTotal)}</div>
          <div className="text-[10px] mt-1 amt-blue">aylık sabit</div>
        </div>
      </div>

      {/* Yaklaşan Ödemeler */}
      <div className="px-5 pt-1 pb-2 text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
        Yaklaşan Ödemeler
      </div>
      <div className="flex flex-col gap-2 mx-4">
        {allPayments.map((p, i) => (
          <div key={i} className="card px-4 py-3 flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{ background: p.color + '18' }}
            >
              {p.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-[11px] mt-0.5" style={{ color: p.days <= 3 ? '#f87171' : 'var(--muted)' }}>
                {daysUntilLabel(p.days)}
              </div>
            </div>
            <div className="text-right">
              <div className="mono text-sm font-medium" style={{ color: p.color }}>{fmt(p.amount)}</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>ayın {p.day}'i</div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
