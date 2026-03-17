'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { Account, Loan, RecurringExpense, ExchangeRate, DebtRecord } from '@/lib/supabase'

type PaymentItem = {
  id: string
  name: string; amount: number; currency: string; day: number
  type: string; source: 'loan' | 'recurring'; sourceId: number
  days: number; paid: boolean; overdue: boolean
}

type MonthKey = { year: number; month: number }

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

function monthLabel(m: MonthKey) {
  return `${MONTH_NAMES[m.month - 1]} ${m.year}`
}

function sameMonth(a: MonthKey, b: MonthKey) {
  return a.year === b.year && a.month === b.month
}

function monthOffset(base: MonthKey, offset: number): MonthKey {
  const d = new Date(base.year, base.month - 1 + offset, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export default function Dashboard() {
  const now = new Date()
  const currentMonth: MonthKey = { year: now.getFullYear(), month: now.getMonth() + 1 }

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [investTotalTry, setInvestTotalTry] = useState(0)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [allAlacak, setAllAlacak] = useState<DebtRecord[]>([])
  const [kriptoTry, setKriptoTry] = useState(0)

  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(currentMonth)
  const [monthLoading, setMonthLoading] = useState(false)
  const pillsRef = useRef<HTMLDivElement>(null)

  const isCurrent = sameMonth(selectedMonth, currentMonth)
  const isPast = selectedMonth.year < currentMonth.year || (selectedMonth.year === currentMonth.year && selectedMonth.month < currentMonth.month)
  const isFuture = selectedMonth.year > currentMonth.year || (selectedMonth.year === currentMonth.year && selectedMonth.month > currentMonth.month)

  // Generate month pills: 3 past + current + 2 future
  const monthPills: MonthKey[] = []
  for (let i = -3; i <= 2; i++) {
    monthPills.push(monthOffset(currentMonth, i))
  }

  // Load global data (accounts, rates, investments, loans, recurring, alacak)
  const loadGlobal = useCallback(async () => {
    const [{ data: acc }, { data: lns }, { data: rec }, { data: rt }, { data: snaps }, { data: recAlacak }, { data: cryptoSnaps }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true),
      supabase.from('loans').select('*').eq('is_active', true),
      supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('investment_snapshots').select('investment_id, total_value_try, snapshot_date').order('snapshot_date', { ascending: false }),
      supabase.from('debt_records').select('*').eq('type', 'alacak').eq('is_settled', false),
      supabase.from('investment_snapshots')
        .select('*, investments!inner(platform, type, is_active)')
        .eq('investments.is_active', true)
        .in('investments.platform', ['Binance'])
        .order('snapshot_date', { ascending: false }),
    ])

    setAccounts(acc || [])
    setLoans(lns || [])
    setRecurring(rec || [])
    setAllAlacak(recAlacak || [])
    setRates(rt?.[0] || null)

    const seen = new Set<number>()
    const latestSnaps = (snaps || []).filter((sn: any) => {
      if (seen.has(sn.investment_id)) return false
      seen.add(sn.investment_id)
      return true
    })
    setInvestTotalTry(latestSnaps.reduce((s: number, sn: any) => s + (sn.total_value_try || 0), 0))

    const latestByInvestment = (cryptoSnaps || []).reduce((acc: Record<number, any>, snap: any) => {
      if (!acc[snap.investment_id]) acc[snap.investment_id] = snap
      return acc
    }, {} as Record<number, any>)
    setKriptoTry(Object.values(latestByInvestment).reduce((s: number, snap: any) => s + (snap.total_value_try || 0), 0))

    return { accs: acc || [], lnsList: lns || [], recList: rec || [] }
  }, [])

  // Load month-specific data (paid items) and build payment list
  const loadMonth = useCallback(async (m: MonthKey, lnsList: Loan[], recList: RecurringExpense[]) => {
    const { data: paid } = await supabase
      .from('recurring_payments').select('*')
      .eq('period_year', m.year).eq('period_month', m.month)
      .eq('is_paid', true)

    const paidList = paid || []
    const now = new Date()
    const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth() + 1
    const todayDay = isCurrentMonth ? now.getDate() : 32 // 32 means all days passed for past months

    const loanItems: PaymentItem[] = lnsList
      .filter(l => l.payment_day)
      .map(l => {
        const isPaid = paidList.some(p =>
          p.notes === `loan_${l.id}` || (p.loan_id && p.loan_id === l.id)
        )
        const isOverdue = isCurrentMonth && !isPaid && l.payment_day < todayDay
        return {
          id: `loan_${l.id}`, name: l.name, amount: l.monthly_payment, currency: l.currency,
          day: l.payment_day, type: 'kredi', source: 'loan' as const, sourceId: l.id,
          days: isCurrentMonth ? daysUntil(l.payment_day) : 0, paid: isPaid, overdue: isOverdue,
        }
      })

    const expItems: PaymentItem[] = recList
      .filter(r => r.payment_day && r.category !== 'nakit')
      .map(r => {
        const isPaid = paidList.some(p => p.expense_id === r.id)
        const isOverdue = isCurrentMonth && !isPaid && r.payment_day! < todayDay
        return {
          id: `exp_${r.id}`, name: r.name, amount: r.amount, currency: r.currency,
          day: r.payment_day!, type: r.category, source: 'recurring' as const, sourceId: r.id,
          days: isCurrentMonth ? daysUntil(r.payment_day!) : 0, paid: isPaid, overdue: isOverdue,
        }
      })

    const all = [...loanItems, ...expItems].sort((a, b) => {
      if (a.paid !== b.paid) return a.paid ? 1 : -1
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return a.day - b.day
    })

    setPayments(all)
  }, [])

  // Initial load
  useEffect(() => {
    (async () => {
      const { lnsList, recList } = await loadGlobal()
      await loadMonth(currentMonth, lnsList, recList)
      setLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // When selectedMonth changes (after initial load)
  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      return
    }
    if (loans.length === 0 && recurring.length === 0) return
    setMonthLoading(true)
    loadMonth(selectedMonth, loans, recurring).then(() => setMonthLoading(false))
  }, [selectedMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload everything (for rate refresh, payment actions)
  const reloadAll = useCallback(async () => {
    const { lnsList, recList } = await loadGlobal()
    await loadMonth(selectedMonth, lnsList, recList)
  }, [loadGlobal, loadMonth, selectedMonth])

  const eurTry = rates?.eur_try || 0
  const usdTry = rates?.usd_try || 0
  const ratesToday = rates?.date === new Date().toISOString().split('T')[0]

  const toTry = (amount: number, currency: string) => {
    if (currency === 'EUR') return amount * eurTry
    if (currency === 'USD') return amount * usdTry
    return amount
  }

  const cashTry = accounts.reduce((sum, a) => sum + toTry(a.balance, a.currency), 0)
  const alacakTry = allAlacak.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const totalAssetsTry = cashTry + investTotalTry + alacakTry

  const tryTotal = accounts.filter(a => a.currency === 'TRY').reduce((s, a) => s + a.balance, 0)
  const eurTotal = accounts.filter(a => a.currency === 'EUR' && a.type !== 'kripto').reduce((s, a) => s + a.balance, 0)
  const usdTotal = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0)
  const kriptoAccounts = accounts.filter(a => a.type === 'kripto')

  const totalDebtTry = loans.reduce((sum, l) => sum + toTry(l.remaining_amount || 0, l.currency), 0)
  const monthlyTotalAll = payments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const recurringAlacak = allAlacak.filter(d => d.is_recurring)
  const monthlyIncome = recurringAlacak.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const netMonthlyObligation = Math.max(0, monthlyTotalAll - monthlyIncome)
  const runwayMonths = netMonthlyObligation > 0 ? (totalAssetsTry / netMonthlyObligation).toFixed(1) : '∞'
  const runwayPct = Math.min(100, (parseFloat(runwayMonths as string) / 24) * 100)

  // Month summary
  const unpaidPayments = payments.filter(p => !p.paid)
  const paidPayments = payments.filter(p => p.paid)
  const overduePayments = payments.filter(p => p.overdue)
  const totalObligationTry = payments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const paidTotalTry = paidPayments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const remainingTotalTry = unpaidPayments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const paidPct = totalObligationTry > 0 ? Math.round((paidTotalTry / totalObligationTry) * 100) : 0

  // Bar chart
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return { name: d.toLocaleDateString('tr-TR', { month: 'short' }), tutar: Math.round(monthlyTotalAll * (0.85 + Math.random() * 0.3)) }
  })
  if (chartData.length > 0) chartData[chartData.length - 1].tutar = Math.round(monthlyTotalAll)

  // Payment modal
  const [payModal, setPayModal] = useState<PaymentItem | null>(null)
  const [payAccountId, setPayAccountId] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!payModal || !payAccountId) return
    setPaying(true)
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const today = now.toISOString().split('T')[0]
    const paidDate = today

    if (payModal.source === 'recurring') {
      const { error } = await supabase.from('recurring_payments').insert({
        expense_id: payModal.sourceId,
        period_year: year, period_month: month,
        amount: payModal.amount, is_paid: true, paid_date: paidDate,
      })
      if (error) { alert('Hata: ' + error.message); setPaying(false); return }
    }

    if (payModal.source === 'loan') {
      const { error } = await supabase.from('recurring_payments').insert({
        expense_id: null,
        notes: `loan_${payModal.sourceId}`,
        period_year: year, period_month: month,
        amount: payModal.amount, is_paid: true, paid_date: paidDate,
      })
      if (error) { alert('Hata: ' + error.message); setPaying(false); return }

      const loan = loans.find(l => l.id === payModal.sourceId)
      if (loan) {
        await supabase.from('loans').update({
          paid_installments: loan.paid_installments + 1,
          remaining_amount: Math.max(0, (loan.remaining_amount || 0) - payModal.amount),
        }).eq('id', payModal.sourceId)
      }
    }

    const account = accounts.find(a => a.id === payAccountId)
    if (account) {
      let deductAmount = payModal.amount
      if (payModal.currency !== account.currency) {
        const amountTry = toTry(payModal.amount, payModal.currency)
        if (account.currency === 'EUR') deductAmount = amountTry / eurTry
        else if (account.currency === 'USD') deductAmount = amountTry / usdTry
        else deductAmount = amountTry
      }
      await supabase.from('accounts').update({ balance: account.balance - deductAmount }).eq('id', payAccountId)
      setAccounts(prev => prev.map(a => a.id === payAccountId ? { ...a, balance: a.balance - deductAmount } : a))
    }

    setPayments(prev => prev.map(p =>
      p.source === payModal.source && p.sourceId === payModal.sourceId
        ? { ...p, paid: true, overdue: false }
        : p
    ))

    setPaying(false)
    setPayModal(null)
    setPayAccountId(null)
    reloadAll()
  }

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Gunaydin' : hour < 18 ? 'Iyi gunler' : 'Iyi aksamlar'
  const selMonthShort = MONTH_NAMES[selectedMonth.month - 1].substring(0, 3)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
        <div className="text-sm">Yukleniyor...</div>
      </div>
    )
  }

  const renderPaymentItem = (p: PaymentItem) => {
    const isUrgent = isCurrent && !p.paid && !p.overdue && p.days <= 3
    let leftBorder = 'var(--accent)'
    let badgeBg = 'var(--bg4)'
    let badgeColor = 'var(--muted)'
    if (p.paid) { leftBorder = '#4ade9a'; badgeBg = 'rgba(74,222,154,0.08)'; badgeColor = '#059669' }
    else if (p.overdue) { leftBorder = '#f59e0b'; badgeBg = 'rgba(245,158,11,0.08)'; badgeColor = '#d97706' }
    else if (isUrgent) { leftBorder = '#dc2626'; badgeBg = 'rgba(220,38,38,0.08)'; badgeColor = '#dc2626' }
    else if (isFuture) { leftBorder = '#3b82f6'; badgeBg = 'rgba(59,130,246,0.06)'; badgeColor = '#3b82f6' }

    return (
      <div key={p.id}
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: p.paid ? 'rgba(74,222,154,0.03)' : 'var(--bg3)',
          borderRadius: 12, boxShadow: 'var(--shadow)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${leftBorder}`,
        }}>
        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0" style={{ background: badgeBg }}>
          {p.paid ? (
            <div className="text-lg" style={{ color: '#4ade9a' }}>✓</div>
          ) : (
            <>
              <div className="text-[11px] font-bold leading-none" style={{ color: badgeColor }}>{p.day}</div>
              <div className="text-[7px] font-semibold uppercase leading-none mt-0.5" style={{ color: 'var(--muted)' }}>{selMonthShort}</div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{
            color: p.paid ? 'var(--muted)' : 'var(--text)',
            textDecoration: p.paid ? 'line-through' : 'none',
          }}>{p.name}</div>
          <div className="text-[11px] mt-0.5" style={{
            color: p.paid ? '#059669' : p.overdue ? '#d97706' : isUrgent ? '#dc2626' : isFuture ? '#3b82f6' : 'var(--muted)',
          }}>
            {p.paid ? 'Odendi' : p.overdue ? 'Gecmis - Odendi?' : isFuture ? 'Planlanan' : isPast && !p.paid ? 'Odenmedi' : daysUntilLabel(p.days)}
          </div>
        </div>

        <div className="text-right flex items-center gap-2">
          <div>
            <div className="mono text-sm font-semibold" style={{
              color: p.paid ? '#4ade9a' : 'var(--text)',
              textDecoration: p.paid ? 'line-through' : 'none',
            }}>
              {fmt(p.amount, p.currency)}
              {isCurrent && !p.paid && p.currency === 'EUR' && <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}> ({fmt(p.amount * eurTry)})</span>}
            </div>
          </div>
          {p.paid ? (
            <span className="px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(74,222,154,0.1)', color: '#059669' }}>
              Odendi
            </span>
          ) : isCurrent && p.overdue ? (
            <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null) }}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }}>
              Onayla
            </button>
          ) : isCurrent ? (
            <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null) }}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
              style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
              Yapildi
            </button>
          ) : isPast ? (
            <span className="px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(245,158,11,0.06)', color: '#d97706' }}>
              Odenmedi
            </span>
          ) : (
            <span className="px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(59,130,246,0.06)', color: '#3b82f6' }}>
              Planlanan
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      <BottomNav />
      <div className="app-main pb-24 page-enter">
        {/* Header */}
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>{greeting}</div>
            <div className="text-xl font-bold mt-0.5" style={{ color: 'var(--text)' }}>Atakan Bey</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => {
              setLoading(true)
              await fetch('/api/update-rates')
              await reloadAll()
              setLoading(false)
            }} className="w-9 h-9 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'var(--bg4)', border: '1px solid var(--border)' }}
              title="Kurlari Guncelle">↻</button>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: '#0d9488' }}>AK</div>
          </div>
        </div>

        {/* Rate warning */}
        {!ratesToday && (
          <div className="mx-4 mb-3 px-4 py-2.5 rounded-lg flex items-center gap-2 text-[12px]"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#d97706' }}>
            <span>Doviz kuru guncel degil</span>
            <button onClick={async () => { setLoading(true); await fetch('/api/update-rates'); await reloadAll(); setLoading(false) }}
              className="ml-auto font-semibold underline">Guncelle</button>
          </div>
        )}

        {/* Month Selector */}
        <div className="mx-4 mb-4">
          <div ref={pillsRef} className="flex gap-2 overflow-x-auto no-scrollbar py-1" style={{ scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedMonth(monthOffset(monthPills[0], -1))}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium"
              style={{ background: 'var(--bg4)', color: 'var(--muted)' }}>
              ‹
            </button>
            {monthPills.map(m => {
              const active = sameMonth(m, selectedMonth)
              const isCurr = sameMonth(m, currentMonth)
              return (
                <button
                  key={`${m.year}-${m.month}`}
                  onClick={() => setSelectedMonth(m)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap"
                  style={{
                    background: active ? '#0d9488' : 'var(--bg4)',
                    color: active ? '#fff' : 'var(--muted)',
                    border: active ? 'none' : '1px solid var(--border)',
                  }}>
                  {MONTH_NAMES[m.month - 1].substring(0, 3)} {m.year !== currentMonth.year ? m.year : ''}
                  {isCurr && !active ? ' ●' : isCurr && active ? ' ●' : ''}
                </button>
              )
            })}
            <button
              onClick={() => setSelectedMonth(monthOffset(monthPills[monthPills.length - 1], 1))}
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium"
              style={{ background: 'var(--bg4)', color: 'var(--muted)' }}>
              ›
            </button>
          </div>
        </div>

        {/* Month context banner */}
        {isPast && (
          <div className="mx-4 mb-3 px-4 py-2.5 rounded-lg flex items-center gap-2 text-[12px]"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#d97706' }}>
            <span>Gecmis Ay — {monthLabel(selectedMonth)}</span>
            <span className="ml-auto mono font-semibold">Bu ay toplam odenen: {fmt(paidTotalTry)}</span>
          </div>
        )}
        {isFuture && (
          <div className="mx-4 mb-3 px-4 py-2.5 rounded-lg flex items-center gap-2 text-[12px]"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>
            <span>Planlanan — {monthLabel(selectedMonth)}</span>
            <span className="ml-auto mono font-semibold">Tahmini toplam: {fmt(totalObligationTry)}</span>
          </div>
        )}

        {/* Summary Grid — always current data */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mx-4 mb-4">
          <div className="card-lg p-5 md:col-span-2">
            <div className="text-[12px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Varlik</div>
            <div className="mono text-3xl font-bold" style={{ color: 'var(--text)' }}>{fmt(totalAssetsTry)}</div>
            <div className="flex flex-col gap-1 mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
              <div className="flex justify-between">
                <span>Nakit</span>
                <span className="mono font-semibold amt-blue">{fmt(cashTry)}</span>
              </div>
              {investTotalTry > 0 && (
                <div className="flex justify-between">
                  <span>Yatirimlar</span>
                  <span className="mono font-semibold amt-blue">{fmt(investTotalTry)}</span>
                </div>
              )}
              {alacakTry > 0 && (
                <div className="flex justify-between">
                  <span>Alacaklar <span className="text-[10px]">(beklenen)</span></span>
                  <span className="mono font-semibold amt-green">{fmt(alacakTry)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Borc</span>
                <span className="mono font-semibold amt-red">-{fmt(totalDebtTry)}</span>
              </div>
              <div className="flex justify-between pt-1 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>TOPLAM</span>
                <span className="mono font-bold" style={{ color: 'var(--text)' }}>{fmt(totalAssetsTry)}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              {[
                { key: 'TRY', icon: '🇹🇷', value: fmt(tryTotal), label: 'Toplam TL', total: tryTotal },
                { key: 'EUR', icon: '🇪🇺', value: fmt(eurTotal, 'EUR'), label: 'Toplam EUR', total: eurTotal },
                { key: 'USD', icon: '🇺🇸', value: fmt(usdTotal, 'USD'), label: 'Toplam USD', total: usdTotal },
                { key: 'KRP', icon: '₿', value: kriptoTry > 0 ? fmt(kriptoTry) : '—', label: 'KRİPTO', total: kriptoTry },
              ].map(p => (
                <div key={p.key} className="flex-1 rounded-lg p-2.5" style={{ background: 'var(--bg4)', opacity: p.total === 0 ? 0.4 : 1 }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{p.icon}</div>
                  <div className="mono text-sm font-semibold amt-blue">{p.value}</div>
                  <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--muted)' }}>{p.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="text-[12px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Runway</div>
            <div className="mono text-2xl font-bold amt-blue">{runwayMonths} <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Ay</span></div>
            <div className="progress-wrap mt-3 mb-2">
              <div className="progress-bar" style={{ width: `${runwayPct}%`, background: runwayPct > 50 ? '#059669' : runwayPct > 25 ? '#d97706' : '#dc2626' }} />
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
              <span>0</span><span>24 ay</span>
            </div>
            <div className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>
              {monthlyIncome > 0 ? 'Varliklar / (giderler - gelirler)' : 'Tum varliklarinla kac ay idare edebilirsin'}
            </div>
          </div>
        </div>

        {/* Expense Chart */}
        <div className="mx-4 mb-4 card p-4">
          <div className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text)' }}>Aylik Gider Trendi</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={50}
                tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number) => [fmt(v), 'Tutar']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="tutar" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Month Summary Card */}
        <div className="mx-4 mb-4 card p-4" style={{ opacity: monthLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          <div className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text)' }}>
            {isPast ? `${monthLabel(selectedMonth)} Ozet` : isFuture ? `${monthLabel(selectedMonth)} Planlanan` : 'Bu Ay Ozet'}
          </div>
          <div className="flex justify-between text-[12px] mb-2">
            <span style={{ color: 'var(--muted)' }}>{isFuture ? 'Tahmini yukumluluk' : 'Toplam yukumluluk'}</span>
            <span className="mono font-semibold">{fmt(totalObligationTry)}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-2">
            <span style={{ color: 'var(--muted)' }}>Odenen</span>
            <span className="mono font-semibold amt-green">{fmt(paidTotalTry)}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-3">
            <span style={{ color: 'var(--muted)' }}>{isFuture ? 'Planlanmis' : 'Kalan'}</span>
            <span className="mono font-semibold amt-red">{fmt(remainingTotalTry)}</span>
          </div>
          <div className="progress-wrap mb-1">
            <div className="progress-bar" style={{ width: `${paidPct}%`, background: '#059669' }} />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
            <span>%{paidPct} tamamlandi</span>
            <span>{paidPayments.length}/{payments.length} odeme {isFuture ? 'planlanmis' : 'tamamlandi'}</span>
          </div>
        </div>

        {/* Payment Lists */}
        <div style={{ opacity: monthLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          {/* Bekleyen / Planlanan Odemeler */}
          <div className="px-5 mb-2">
            <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: isFuture ? '#3b82f6' : 'var(--muted)' }}>
              {isFuture ? 'Planlanan Odemeler' : isPast ? 'Odenmemis' : 'Bekleyen Odemeler'}
              {isCurrent && overduePayments.length > 0 && <span style={{ color: '#d97706' }}> · {overduePayments.length} gecmis</span>}
            </div>
          </div>
          {unpaidPayments.length === 0 ? (
            <div className="mx-4 card p-4 text-center text-sm" style={{ color: isPast ? '#d97706' : '#059669' }}>
              {isPast ? 'Tum odemeler tamamlanmis' : isFuture ? 'Henuz odeme yok' : 'Tum odemeler tamamlandi bu ay'}
            </div>
          ) : (
            <div className="flex flex-col gap-2 mx-4">
              {unpaidPayments.map(p => renderPaymentItem(p))}
            </div>
          )}

          {/* Tamamlanan Odemeler */}
          {paidPayments.length > 0 && (
            <>
              <div className="px-5 mt-4 mb-2 flex items-center gap-2">
                <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#059669' }}>Tamamlanan Odemeler</div>
                <div className="flex-1 h-px" style={{ background: 'rgba(74,222,154,0.3)' }} />
                <div className="text-[10px] font-medium" style={{ color: '#059669' }}>{paidPayments.length} odeme</div>
              </div>
              <div className="flex flex-col gap-2 mx-4">
                {paidPayments.map(p => renderPaymentItem(p))}
              </div>
            </>
          )}

          {/* Bekleyen Gelirler (Recurring Alacak) — only show for current month */}
          {isCurrent && recurringAlacak.length > 0 && (
            <>
              <div className="px-5 mt-4 mb-2 flex items-center gap-2">
                <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: '#0d9488' }}>Bekleyen Gelirler</div>
                <div className="flex-1 h-px" style={{ background: 'rgba(13,148,136,0.2)' }} />
                <div className="text-[10px] font-medium" style={{ color: '#0d9488' }}>+{fmt(monthlyIncome)}/ay</div>
              </div>
              <div className="flex flex-col gap-2 mx-4">
                {recurringAlacak.map(d => (
                  <div key={d.id} className="px-4 py-3 flex items-center gap-3"
                    style={{ background: 'var(--bg3)', borderRadius: 12, boxShadow: 'var(--shadow)', border: '1px solid var(--border)', borderLeft: '3px solid #0d9488' }}>
                    <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0" style={{ background: 'rgba(13,148,136,0.08)' }}>
                      {d.expected_day ? (
                        <>
                          <div className="text-[11px] font-bold leading-none" style={{ color: '#0d9488' }}>{d.expected_day}</div>
                          <div className="text-[7px] font-semibold uppercase leading-none mt-0.5" style={{ color: 'var(--muted)' }}>{selMonthShort}</div>
                        </>
                      ) : (
                        <div className="text-base">🔄</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.person_name}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                        {d.frequency === 'aylik' ? 'Aylik' : d.frequency === 'haftalik' ? 'Haftalik' : d.frequency === '2haftada1' ? '2 Haftada 1' : 'Duzenli'} gelir
                      </div>
                    </div>
                    <div className="mono text-sm font-semibold amt-green">+{fmt(d.amount, d.currency)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Pay confirmation modal */}
        {payModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-1">
                {payModal.overdue ? 'Gecmis Odemeyi Onayla' : 'Odeme Yap'}
              </div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{payModal.name}</span> — {fmt(payModal.amount, payModal.currency)}
                {payModal.currency === 'EUR' && <span> ({fmt(payModal.amount * eurTry)})</span>}
                {payModal.overdue && <div className="text-[11px] mt-1" style={{ color: '#d97706' }}>Bu odemenin vadesi gecmis (ayin {payModal.day}'i)</div>}
              </div>
              <div className="mb-4">
                <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hangi hesaptan?</label>
                <select value={payAccountId || ''} onChange={e => setPayAccountId(Number(e.target.value))} className="input">
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, a.currency)}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setPayModal(null); setPayAccountId(null) }} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={handlePay} disabled={paying || !payAccountId} className="btn-primary flex-1 py-2.5 text-sm">
                  {paying ? 'Kaydediliyor...' : 'Onayla'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
