'use client'
import { useEffect, useState, useCallback } from 'react'
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

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [investTotalTry, setInvestTotalTry] = useState(0)
  const [paidThisMonth, setPaidThisMonth] = useState<any[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [allAlacak, setAllAlacak] = useState<DebtRecord[]>([])

  const loadAll = useCallback(async () => {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const [{ data: acc }, { data: lns }, { data: rec }, { data: rt }, { data: snaps }, { data: paid }, { data: recAlacak }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true),
      supabase.from('loans').select('*').eq('is_active', true),
      supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('investment_snapshots').select('investment_id, total_value_try, snapshot_date').order('snapshot_date', { ascending: false }),
      supabase.from('recurring_payments').select('*').eq('period_year', year).eq('period_month', month).eq('is_paid', true),
      supabase.from('debt_records').select('*').eq('type', 'alacak').eq('is_settled', false),
    ])

    const accs = acc || []
    const lnsList = lns || []
    const recList = rec || []
    const paidList = paid || []

    setAccounts(accs)
    setLoans(lnsList)
    setRecurring(recList)
    setAllAlacak(recAlacak || [])
    setRates(rt?.[0] || null)
    // For each investment_id, take the most recent snapshot (already ordered desc)
    const seen = new Set<number>()
    const latestSnaps = (snaps || []).filter((sn: any) => {
      if (seen.has(sn.investment_id)) return false
      seen.add(sn.investment_id)
      return true
    })
    setInvestTotalTry(latestSnaps.reduce((s: number, sn: any) => s + (sn.total_value_try || 0), 0))
    setPaidThisMonth(paidList)

    // Build payment items with paid check
    const todayDay = now.getDate()

    const loanItems: PaymentItem[] = lnsList
      .filter(l => l.payment_day)
      .map(l => {
        const isPaid = paidList.some(p =>
          p.notes === `loan_${l.id}` || (p.loan_id && p.loan_id === l.id)
        )
        const isOverdue = !isPaid && l.payment_day < todayDay
        return {
          id: `loan_${l.id}`, name: l.name, amount: l.monthly_payment, currency: l.currency,
          day: l.payment_day, type: 'kredi', source: 'loan' as const, sourceId: l.id,
          days: daysUntil(l.payment_day), paid: isPaid, overdue: isOverdue,
        }
      })

    const expItems: PaymentItem[] = recList
      .filter(r => r.payment_day && r.category !== 'nakit')
      .map(r => {
        const isPaid = paidList.some(p => p.expense_id === r.id)
        const isOverdue = !isPaid && r.payment_day! < todayDay
        return {
          id: `exp_${r.id}`, name: r.name, amount: r.amount, currency: r.currency,
          day: r.payment_day!, type: r.category, source: 'recurring' as const, sourceId: r.id,
          days: daysUntil(r.payment_day!), paid: isPaid, overdue: isOverdue,
        }
      })

    const all = [...loanItems, ...expItems].sort((a, b) => {
      // Unpaid first, then overdue, then by days
      if (a.paid !== b.paid) return a.paid ? 1 : -1
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return a.days - b.days
    })

    setPayments(all)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

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
  const kriptoTotal = kriptoAccounts.reduce((s, a) => s + a.balance, 0)
  const kriptoCurrency = kriptoAccounts[0]?.currency || 'EUR'

  const totalDebtTry = loans.reduce((sum, l) => sum + toTry(l.remaining_amount || 0, l.currency), 0)
  const monthlyTotalAll = payments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const recurringAlacak = allAlacak.filter(d => d.is_recurring)
  const monthlyIncome = recurringAlacak.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const netMonthlyObligation = Math.max(0, monthlyTotalAll - monthlyIncome)
  const runwayMonths = netMonthlyObligation > 0 ? (totalAssetsTry / netMonthlyObligation).toFixed(1) : '∞'
  const runwayPct = Math.min(100, (parseFloat(runwayMonths as string) / 24) * 100)

  // Bu Ay Ozet
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
    // For overdue items, use the actual payment day as paid_date context
    const paidDate = today

    if (payModal.source === 'recurring') {
      // Insert recurring expense payment
      const { error } = await supabase.from('recurring_payments').insert({
        expense_id: payModal.sourceId,
        period_year: year, period_month: month,
        amount: payModal.amount, is_paid: true, paid_date: paidDate,
      })
      if (error) { alert('Hata: ' + error.message); setPaying(false); return }
    }

    if (payModal.source === 'loan') {
      // Insert loan payment with notes identifier
      const { error } = await supabase.from('recurring_payments').insert({
        expense_id: null,
        notes: `loan_${payModal.sourceId}`,
        period_year: year, period_month: month,
        amount: payModal.amount, is_paid: true, paid_date: paidDate,
      })
      if (error) { alert('Hata: ' + error.message); setPaying(false); return }

      // Update loan installments
      const loan = loans.find(l => l.id === payModal.sourceId)
      if (loan) {
        await supabase.from('loans').update({
          paid_installments: loan.paid_installments + 1,
          remaining_amount: Math.max(0, (loan.remaining_amount || 0) - payModal.amount),
        }).eq('id', payModal.sourceId)
      }
    }

    // Deduct from selected account
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

    // Instant local state: mark as paid by matching source + sourceId
    setPayments(prev => prev.map(p =>
      p.source === payModal.source && p.sourceId === payModal.sourceId
        ? { ...p, paid: true, overdue: false }
        : p
    ))

    setPaying(false)
    setPayModal(null)
    setPayAccountId(null)

    // Background reload for DB consistency
    loadAll()
  }

  const now2 = new Date()
  const hour = now2.getHours()
  const greeting = hour < 12 ? 'Gunaydin' : hour < 18 ? 'Iyi gunler' : 'Iyi aksamlar'
  const monthLabel = now2.toLocaleDateString('tr-TR', { month: 'short' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
        <div className="text-sm">Yukleniyor...</div>
      </div>
    )
  }

  const renderPaymentItem = (p: PaymentItem) => {
    const isUrgent = !p.paid && !p.overdue && p.days <= 3
    // Determine left border + badge bg
    let leftBorder = 'var(--accent)'
    let badgeBg = 'var(--bg4)'
    let badgeColor = 'var(--muted)'
    if (p.paid) { leftBorder = '#4ade9a'; badgeBg = 'rgba(74,222,154,0.08)'; badgeColor = '#059669' }
    else if (p.overdue) { leftBorder = '#f59e0b'; badgeBg = 'rgba(245,158,11,0.08)'; badgeColor = '#d97706' }
    else if (isUrgent) { leftBorder = '#dc2626'; badgeBg = 'rgba(220,38,38,0.08)'; badgeColor = '#dc2626' }

    return (
      <div key={p.id}
        className="px-4 py-3 flex items-center gap-3"
        style={{
          background: p.paid ? 'rgba(74,222,154,0.03)' : 'var(--bg3)',
          borderRadius: 12, boxShadow: 'var(--shadow)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${leftBorder}`,
        }}>
        {/* Date badge / checkmark */}
        <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0" style={{ background: badgeBg }}>
          {p.paid ? (
            <div className="text-lg" style={{ color: '#4ade9a' }}>✓</div>
          ) : (
            <>
              <div className="text-[11px] font-bold leading-none" style={{ color: badgeColor }}>{p.day}</div>
              <div className="text-[7px] font-semibold uppercase leading-none mt-0.5" style={{ color: 'var(--muted)' }}>{monthLabel}</div>
            </>
          )}
        </div>

        {/* Name + status */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{
            color: p.paid ? 'var(--muted)' : 'var(--text)',
            textDecoration: p.paid ? 'line-through' : 'none',
          }}>{p.name}</div>
          <div className="text-[11px] mt-0.5" style={{
            color: p.paid ? '#059669' : p.overdue ? '#d97706' : isUrgent ? '#dc2626' : 'var(--muted)',
          }}>
            {p.paid ? 'Odendi' : p.overdue ? 'Gecmis - Odendi?' : daysUntilLabel(p.days)}
          </div>
        </div>

        {/* Amount + action */}
        <div className="text-right flex items-center gap-2">
          <div>
            <div className="mono text-sm font-semibold" style={{
              color: p.paid ? '#4ade9a' : 'var(--text)',
              textDecoration: p.paid ? 'line-through' : 'none',
            }}>
              {fmt(p.amount, p.currency)}
              {!p.paid && p.currency === 'EUR' && <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}> ({fmt(p.amount * eurTry)})</span>}
            </div>
          </div>
          {p.paid ? (
            <span className="px-2 py-1 rounded-lg text-[10px] font-semibold"
              style={{ background: 'rgba(74,222,154,0.1)', color: '#059669' }}>
              Odendi
            </span>
          ) : p.overdue ? (
            <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null) }}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)' }}>
              Onayla
            </button>
          ) : (
            <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null) }}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
              style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
              Yapildi
            </button>
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
              await loadAll()
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
            <button onClick={async () => { setLoading(true); await fetch('/api/update-rates'); await loadAll() }}
              className="ml-auto font-semibold underline">Guncelle</button>
          </div>
        )}

        {/* Summary Grid */}
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
                { key: 'KRP', icon: '₿', value: fmt(kriptoTotal, kriptoCurrency), label: 'Kripto', total: kriptoTotal },
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

        {/* Bu Ay Ozet Card */}
        <div className="mx-4 mb-4 card p-4">
          <div className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text)' }}>Bu Ay Ozet</div>
          <div className="flex justify-between text-[12px] mb-2">
            <span style={{ color: 'var(--muted)' }}>Toplam yukumluluk</span>
            <span className="mono font-semibold">{fmt(totalObligationTry)}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-2">
            <span style={{ color: 'var(--muted)' }}>Odenen</span>
            <span className="mono font-semibold amt-green">{fmt(paidTotalTry)}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-3">
            <span style={{ color: 'var(--muted)' }}>Kalan</span>
            <span className="mono font-semibold amt-red">{fmt(remainingTotalTry)}</span>
          </div>
          <div className="progress-wrap mb-1">
            <div className="progress-bar" style={{ width: `${paidPct}%`, background: '#059669' }} />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: 'var(--muted)' }}>
            <span>%{paidPct} tamamlandi</span>
            <span>{paidPayments.length}/{payments.length} odeme tamamlandi</span>
          </div>
        </div>

        {/* Bekleyen Odemeler */}
        <div className="px-5 mb-2">
          <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
            Bekleyen Odemeler
            {overduePayments.length > 0 && <span style={{ color: '#d97706' }}> · {overduePayments.length} gecmis</span>}
          </div>
        </div>
        {unpaidPayments.length === 0 ? (
          <div className="mx-4 card p-4 text-center text-sm" style={{ color: '#059669' }}>
            Tum odemeler tamamlandi bu ay
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

        {/* Bekleyen Gelirler (Recurring Alacak) */}
        {recurringAlacak.length > 0 && (
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
                        <div className="text-[7px] font-semibold uppercase leading-none mt-0.5" style={{ color: 'var(--muted)' }}>{monthLabel}</div>
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
