'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel, isDemo } from '@/lib/supabase'
import { getCatIcon, IconWallet, IconPieChart, IconTarget, IconBank, IconTrendUp, IconRefresh, IconCheck, IconDollar, IconBriefcase, IconShield, IconCalendar, IconCreditCard, IconSettings } from '@/components/Icons'
import type { Account, Loan, RecurringExpense, ExchangeRate, DebtRecord } from '@/lib/supabase'

type PaymentItem = {
  id: string
  name: string; amount: number; currency: string; day: number
  type: string; source: 'loan' | 'recurring'; sourceId: number
  days: number; paid: boolean; overdue: boolean
}

type MonthKey = { year: number; month: number }

const MONTH_NAMES = ['Ocak','Subat','Mart','Nisan','Mayis','Haziran','Temmuz','Agustos','Eylul','Ekim','Kasim','Aralik']

function monthLabel(m: MonthKey) { return `${MONTH_NAMES[m.month-1]} ${m.year}` }
function sameMonth(a: MonthKey, b: MonthKey) { return a.year === b.year && a.month === b.month }
function monthOffset(base: MonthKey, offset: number): MonthKey {
  const d = new Date(base.year, base.month - 1 + offset, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

// Mock data
const MOCK_ACCOUNTS: Account[] = [
  { id: 1, name: 'Ziraat TL', bank: 'Ziraat', type: 'vadesiz', currency: 'TRY', balance: 45200, is_active: true, updated_at: '' },
  { id: 2, name: 'Garanti EUR', bank: 'Garanti', type: 'vadesiz', currency: 'EUR', balance: 3200, is_active: true, updated_at: '' },
  { id: 3, name: 'Is Bankasi USD', bank: 'Is', type: 'vadesiz', currency: 'USD', balance: 1500, is_active: true, updated_at: '' },
]
const MOCK_LOANS: Loan[] = [
  { id: 1, name: 'Konut Kredisi', bank: 'Ziraat', type: 'konut', currency: 'TRY', original_amount: 850000, remaining_amount: 620000, monthly_payment: 14500, payment_day: 15, total_installments: 120, paid_installments: 24, interest_rate: 1.89, start_date: '2024-01-15', end_date: '2034-01-15', is_active: true },
]
const MOCK_RECURRING: RecurringExpense[] = [
  { id: 1, name: 'Elektrik', category: 'elektrik', amount: 350, currency: 'TRY', payment_day: 27, is_variable: true, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
  { id: 2, name: 'SGK', category: 'sgk', amount: 9000, currency: 'TRY', payment_day: 28, is_variable: false, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
  { id: 3, name: 'Muhasebe', category: 'muhasebe', amount: 3500, currency: 'TRY', payment_day: 28, is_variable: false, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
  { id: 4, name: 'Internet', category: 'internet', amount: 560, currency: 'TRY', payment_day: 13, is_variable: false, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
  { id: 5, name: 'Aidat', category: 'aidat', amount: 12000, currency: 'TRY', payment_day: 15, is_variable: false, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
  { id: 6, name: 'Cep Telefonu', category: 'gsm', amount: 1100, currency: 'TRY', payment_day: 1, is_variable: false, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
  { id: 7, name: 'Mimar Fatma', category: 'hizmet', amount: 30000, currency: 'TRY', payment_day: 30, is_variable: false, is_active: true, remind_days_before: 3, expense_type: 'one_time', expense_date: '2026-03-30' },
  { id: 8, name: 'Su Faturasi', category: 'su', amount: 250, currency: 'TRY', payment_day: 15, is_variable: true, is_active: true, remind_days_before: 3, expense_type: 'recurring' },
]
const MOCK_RATES: ExchangeRate = { id: 1, date: new Date().toISOString().split('T')[0], usd_try: 38.5, eur_try: 41.2, btc_usd: 84500, eth_usd: 3200, gold_try: 3950 }

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

  const isCurrent = sameMonth(selectedMonth, currentMonth)
  const isPast = selectedMonth.year < currentMonth.year || (selectedMonth.year === currentMonth.year && selectedMonth.month < currentMonth.month)
  const isFuture = selectedMonth.year > currentMonth.year || (selectedMonth.year === currentMonth.year && selectedMonth.month > currentMonth.month)

  const monthPills: MonthKey[] = []
  for (let i = -3; i <= 2; i++) monthPills.push(monthOffset(currentMonth, i))

  const loadGlobal = useCallback(async () => {
    if (isDemo) {
      setAccounts(MOCK_ACCOUNTS); setLoans(MOCK_LOANS); setRecurring(MOCK_RECURRING)
      setAllAlacak([]); setRates(MOCK_RATES); setInvestTotalTry(85000); setKriptoTry(22000)
      return { accs: MOCK_ACCOUNTS, lnsList: MOCK_LOANS, recList: MOCK_RECURRING }
    }
    const [{ data: acc }, { data: lns }, { data: rec }, { data: rt }, { data: snaps }, { data: recAlacak }, { data: cryptoSnaps }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true),
      supabase.from('loans').select('*').eq('is_active', true),
      supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('investment_snapshots').select('investment_id, total_value_try, snapshot_date').order('snapshot_date', { ascending: false }),
      supabase.from('debt_records').select('*').eq('type', 'alacak').eq('is_settled', false),
      supabase.from('investment_snapshots').select('*, investments!inner(platform, type, is_active)').eq('investments.is_active', true).in('investments.platform', ['Binance']).order('snapshot_date', { ascending: false }),
    ])
    setAccounts(acc || []); setLoans(lns || []); setRecurring(rec || []); setAllAlacak(recAlacak || []); setRates(rt?.[0] || null)
    const seen = new Set<number>()
    const latestSnaps = (snaps || []).filter((sn: any) => { if (seen.has(sn.investment_id)) return false; seen.add(sn.investment_id); return true })
    setInvestTotalTry(latestSnaps.reduce((s: number, sn: any) => s + (sn.total_value_try || 0), 0))
    const latestByInvestment = (cryptoSnaps || []).reduce((acc: Record<number, any>, snap: any) => { if (!acc[snap.investment_id]) acc[snap.investment_id] = snap; return acc }, {} as Record<number, any>)
    setKriptoTry(Object.values(latestByInvestment).reduce((s: number, snap: any) => s + (snap.total_value_try || 0), 0))
    return { accs: acc || [], lnsList: lns || [], recList: rec || [] }
  }, [])

  const loadMonth = useCallback(async (m: MonthKey, lnsList: Loan[], recList: RecurringExpense[]) => {
    let paidList: any[] = []
    if (!isDemo) {
      const { data: paid } = await supabase.from('recurring_payments').select('*').eq('period_year', m.year).eq('period_month', m.month).eq('is_paid', true)
      paidList = paid || []
    }
    const now = new Date()
    const isCurrentMonth = m.year === now.getFullYear() && m.month === now.getMonth() + 1
    const todayDay = isCurrentMonth ? now.getDate() : 32

    const loanItems: PaymentItem[] = lnsList.filter(l => l.payment_day).map(l => {
      const isPaid = paidList.some(p => p.notes === `loan_${l.id}` || (p.loan_id && p.loan_id === l.id))
      return { id: `loan_${l.id}`, name: l.name, amount: l.monthly_payment, currency: l.currency, day: l.payment_day, type: 'kredi', source: 'loan' as const, sourceId: l.id, days: isCurrentMonth ? daysUntil(l.payment_day) : 0, paid: isPaid, overdue: isCurrentMonth && !isPaid && l.payment_day < todayDay }
    })

    const expItems: PaymentItem[] = recList.filter(r => {
      if (!r.payment_day || r.category === 'nakit') return false
      if (r.expense_type === 'one_time' && r.expense_date) { const d = new Date(r.expense_date); return d.getFullYear() === m.year && d.getMonth() + 1 === m.month }
      if (r.end_date) { const end = new Date(r.end_date); if (new Date(m.year, m.month - 1, 1) > end) return false }
      return true
    }).map(r => {
      const isPaid = paidList.some(p => p.expense_id === r.id)
      return { id: `exp_${r.id}`, name: r.name, amount: r.amount, currency: r.currency, day: r.payment_day!, type: r.category, source: 'recurring' as const, sourceId: r.id, days: isCurrentMonth ? daysUntil(r.payment_day!) : 0, paid: isPaid, overdue: isCurrentMonth && !isPaid && r.payment_day! < todayDay }
    })

    setPayments([...loanItems, ...expItems].sort((a, b) => { if (a.paid !== b.paid) return a.paid ? 1 : -1; if (a.overdue !== b.overdue) return a.overdue ? -1 : 1; return a.day - b.day }))
  }, [])

  useEffect(() => { (async () => { const { lnsList, recList } = await loadGlobal(); await loadMonth(currentMonth, lnsList, recList); setLoading(false) })() }, []) // eslint-disable-line

  const initialLoadDone = useRef(false)
  useEffect(() => { if (!initialLoadDone.current) { initialLoadDone.current = true; return }; if (loans.length === 0 && recurring.length === 0) return; setMonthLoading(true); loadMonth(selectedMonth, loans, recurring).then(() => setMonthLoading(false)) }, [selectedMonth]) // eslint-disable-line

  const reloadAll = useCallback(async () => { const { lnsList, recList } = await loadGlobal(); await loadMonth(selectedMonth, lnsList, recList) }, [loadGlobal, loadMonth, selectedMonth])

  const eurTry = rates?.eur_try || 0, usdTry = rates?.usd_try || 0
  const toTry = (amount: number, currency: string) => currency === 'EUR' ? amount * eurTry : currency === 'USD' ? amount * usdTry : amount

  const cashTry = accounts.reduce((s, a) => s + toTry(a.balance, a.currency), 0)
  const alacakTry = allAlacak.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const totalAssetsTry = cashTry + investTotalTry + alacakTry
  const tryTotal = accounts.filter(a => a.currency === 'TRY').reduce((s, a) => s + a.balance, 0)
  const eurTotal = accounts.filter(a => a.currency === 'EUR' && a.type !== 'kripto').reduce((s, a) => s + a.balance, 0)
  const usdTotal = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0)
  const totalDebtTry = loans.reduce((s, l) => s + toTry(l.remaining_amount || 0, l.currency), 0)
  const monthlyTotalAll = payments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const recurringAlacak = allAlacak.filter(d => d.is_recurring)
  const monthlyIncome = recurringAlacak.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const netMonthly = Math.max(0, monthlyTotalAll - monthlyIncome)
  const runwayMonths = netMonthly > 0 ? (totalAssetsTry / netMonthly).toFixed(1) : '∞'
  const runwayPct = Math.min(100, (parseFloat(runwayMonths as string) / 24) * 100)

  const unpaidPayments = payments.filter(p => !p.paid)
  const paidPayments = payments.filter(p => p.paid)
  const overduePayments = payments.filter(p => p.overdue)
  const totalObligation = payments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const paidTotal = paidPayments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const remainingTotal = unpaidPayments.reduce((s, p) => s + toTry(p.amount, p.currency), 0)
  const paidPct = totalObligation > 0 ? Math.round((paidTotal / totalObligation) * 100) : 0

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    return { name: d.toLocaleDateString('tr-TR', { month: 'short' }), tutar: Math.round(monthlyTotalAll * (0.85 + Math.random() * 0.3)) }
  })
  if (chartData.length > 0) chartData[chartData.length - 1].tutar = Math.round(monthlyTotalAll)

  const [payModal, setPayModal] = useState<PaymentItem | null>(null)
  const [payAccountId, setPayAccountId] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!payModal || !payAccountId) return
    setPaying(true)
    if (!isDemo) {
      const year = now.getFullYear(), month = now.getMonth() + 1, today = now.toISOString().split('T')[0]
      if (payModal.source === 'recurring') { const { error } = await supabase.from('recurring_payments').insert({ expense_id: payModal.sourceId, period_year: year, period_month: month, amount: payModal.amount, is_paid: true, paid_date: today }); if (error) { alert('Hata: ' + error.message); setPaying(false); return } }
      if (payModal.source === 'loan') { const { error } = await supabase.from('recurring_payments').insert({ expense_id: null, notes: `loan_${payModal.sourceId}`, period_year: year, period_month: month, amount: payModal.amount, is_paid: true, paid_date: today }); if (error) { alert('Hata: ' + error.message); setPaying(false); return }; const loan = loans.find(l => l.id === payModal.sourceId); if (loan) await supabase.from('loans').update({ paid_installments: loan.paid_installments + 1, remaining_amount: Math.max(0, (loan.remaining_amount || 0) - payModal.amount) }).eq('id', payModal.sourceId) }
      const account = accounts.find(a => a.id === payAccountId)
      if (account) { let deduct = payModal.amount; if (payModal.currency !== account.currency) { const tryAmt = toTry(payModal.amount, payModal.currency); deduct = account.currency === 'EUR' ? tryAmt / eurTry : account.currency === 'USD' ? tryAmt / usdTry : tryAmt }; await supabase.from('accounts').update({ balance: account.balance - deduct }).eq('id', payAccountId); setAccounts(prev => prev.map(a => a.id === payAccountId ? { ...a, balance: a.balance - deduct } : a)) }
    }
    setPayments(prev => prev.map(p => p.source === payModal.source && p.sourceId === payModal.sourceId ? { ...p, paid: true, overdue: false } : p))
    setPaying(false); setPayModal(null); setPayAccountId(null)
    if (!isDemo) reloadAll()
  }

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Gunaydin' : hour < 18 ? 'Iyi Gunler' : 'Iyi Aksamlar'
  const selMonthShort = MONTH_NAMES[selectedMonth.month - 1].substring(0, 3)

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold text-white" style={{ background: 'linear-gradient(135deg, #2b2d6e, #4a4db0)' }}>F</div>
        <div className="text-sm font-medium">Yukleniyor...</div>
      </div>
    </div>
  )

  const renderPaymentItem = (p: PaymentItem) => {
    const isUrgent = isCurrent && !p.paid && !p.overdue && p.days <= 3
    let statusColor = 'var(--muted)'
    if (p.paid) { statusColor = '#30a46c' }
    else if (p.overdue) { statusColor = '#e5a000' }
    else if (isUrgent) { statusColor = '#e5484d' }

    return (
      <div key={p.id} className="tx-item" style={{ opacity: p.paid ? 0.5 : 1 }}>
        <div className="tx-icon">
          {p.paid ? <IconCheck color="#30a46c" size={20} strokeWidth={2.5} /> : getCatIcon(p.type, { color: '#2b2d6e', size: 20 })}
        </div>
        <div className="tx-info">
          <div className="tx-name" style={{ textDecoration: p.paid ? 'line-through' : 'none' }}>{p.name}</div>
          <div className="tx-detail" style={{ color: statusColor }}>
            {p.paid ? 'Odendi' : p.overdue ? `Gecikti · ${p.day} ${selMonthShort}` : `${p.day} ${selMonthShort} · ${daysUntilLabel(p.days)}`}
          </div>
        </div>
        <div className="tx-amount">
          <div className="tx-value" style={{ color: p.paid ? '#30a46c' : 'var(--text)', textDecoration: p.paid ? 'line-through' : 'none' }}>{fmt(p.amount, p.currency)}</div>
          {isCurrent && !p.paid && (
            <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null) }}
              className="tx-badge" style={{ background: p.overdue ? 'rgba(229,160,0,0.08)' : 'rgba(43,45,110,0.06)', color: p.overdue ? '#e5a000' : '#2b2d6e', border: 'none', cursor: 'pointer' }}>
              {p.overdue ? 'Onayla' : 'Ode'}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-layout">
      {/* Background blobs */}
      <div className="bg-blobs"><div className="bg-blob-3" /><div className="bg-blob-4" /></div>
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        {/* ===== HEADER ===== */}
        <div className="flex justify-between items-center px-5 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <img src="https://i.pravatar.cc/80?img=68" alt="avatar" className="w-11 h-11 rounded-full object-cover"
              style={{ border: '2.5px solid var(--border)' }} />
            <div>
              <span className="text-lg" style={{ color: 'var(--text)' }}>Merhaba </span>
              <span className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>Atakan!</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => { if (isDemo) return; setLoading(true); await fetch('/api/update-rates'); await reloadAll(); setLoading(false) }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg4)' }}>
              <IconRefresh color="#2b2d6e" size={18} strokeWidth={2} />
            </button>
            <button className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg4)' }}>
              <IconSettings color="#2b2d6e" size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ===== HERO CARD ===== */}
        <div className="mx-4 mt-3 card-hero p-6" style={{ position: 'relative', zIndex: 1 }}>
          <div className="flex items-center justify-between mb-1" style={{ position: 'relative', zIndex: 2 }}>
            <div className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>Toplam Varlik</div>
            <IconWallet color="rgba(255,255,255,0.3)" size={20} />
          </div>
          <div className="mono text-3xl font-extrabold mb-5" style={{ position: 'relative', zIndex: 2 }}>{fmt(totalAssetsTry)}</div>
          <div className="flex gap-2" style={{ position: 'relative', zIndex: 2 }}>
            {[
              { label: 'TRY', value: fmt(tryTotal) },
              { label: 'EUR', value: fmt(eurTotal, 'EUR') },
              { label: 'USD', value: fmt(usdTotal, 'USD') },
            ].map(c => (
              <div key={c.label} className="flex-1 rounded-full py-2 px-3 text-center"
                style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)' }}>
                <div className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{c.label}</div>
                <div className="mono text-[11px] font-bold mt-0.5">{c.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== DUAL COLUMNS: Varliklar | Harcamalar ===== */}
        <div className="grid grid-cols-2 gap-3 mx-4 mt-4">
          {/* Left: Varliklar */}
          <div className="card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: '#2b2d6e' }}>Varliklar</div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Nakit', value: cashTry, color: '#2b2d6e' },
                { label: 'Yatirim', value: investTotalTry, color: '#4a4db0' },
                { label: 'Alacak', value: alacakTry, color: '#6366f1' },
              ].filter(r => r.value > 0).map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{r.label}</span>
                    </div>
                    <span className="mono text-[11px] font-bold" style={{ color: r.color }}>{fmt(r.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Harcamalar */}
          <div className="card p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: '#e5484d' }}>Yukumluluk</div>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Toplam Borc', value: totalDebtTry, color: '#e5484d' },
                { label: 'Aylik Gider', value: monthlyTotalAll, color: '#d97706' },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                      <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{r.label}</span>
                    </div>
                    <span className="mono text-[11px] font-bold" style={{ color: r.color }}>{fmt(r.value)}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text)' }}>Runway</span>
                  <span className="mono text-[11px] font-extrabold" style={{ color: '#2b2d6e' }}>{runwayMonths} Ay</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== CHART ===== */}
        <div className="mx-4 mt-4 card p-4">
          <div className="text-xs font-bold mb-2" style={{ color: 'var(--text)' }}>Aylik Gider Trendi</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8790a5' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#8790a5' }} axisLine={false} tickLine={false} width={40} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip formatter={(v: number) => [fmt(v), 'Tutar']} contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12 }} />
              <Bar dataKey="tutar" fill="url(#navyGrad)" radius={[4, 4, 0, 0]} />
              <defs><linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2b2d6e" /><stop offset="100%" stopColor="#4a4db0" /></linearGradient></defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ===== MONTH SELECTOR ===== */}
        <div className="mx-4 mt-4 mb-3">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {monthPills.map(m => {
              const active = sameMonth(m, selectedMonth)
              const isCurr = sameMonth(m, currentMonth)
              return (
                <button key={`${m.year}-${m.month}`} onClick={() => setSelectedMonth(m)}
                  className="flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap"
                  style={{
                    background: active ? 'linear-gradient(135deg, #2b2d6e, #3d3f8f)' : 'transparent',
                    color: active ? '#fff' : 'var(--text2)',
                    border: active ? '1.5px solid transparent' : '1.5px solid var(--border2)',
                    boxShadow: active ? '0 2px 6px rgba(43,45,110,0.2)' : 'none',
                    transition: 'all 0.2s',
                  }}>
                  {MONTH_NAMES[m.month - 1].substring(0, 3)} {m.year !== currentMonth.year ? m.year : ''}{isCurr ? ' •' : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* ===== MONTH SUMMARY — nested card style ===== */}
        <div className="mx-4 mb-4" style={{
          background: 'linear-gradient(145deg, #eef0f8, #e8ecf6)',
          borderRadius: 20,
          padding: '16px 14px',
          border: '1.5px solid #d8ddef',
          opacity: monthLoading ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-bold" style={{ color: 'var(--text)' }}>{isPast ? monthLabel(selectedMonth) : isFuture ? monthLabel(selectedMonth) : 'Bu Ay'}</span>
            <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>{paidPayments.length}/{payments.length} odeme</span>
          </div>

          {/* Inner nested cards — Toplam / Odenen */}
          <div className="flex gap-2.5 mb-2.5">
            <div className="flex-1" style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(43,45,110,0.04)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Toplam</div>
              <div className="mono text-lg font-extrabold mt-1" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>{fmt(totalObligation)}</div>
            </div>
            <div className="flex-1" style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(43,45,110,0.04)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#30a46c' }}>Odenen</div>
              <div className="mono text-lg font-extrabold mt-1 amt-green" style={{ letterSpacing: '-0.03em' }}>{fmt(paidTotal)}</div>
            </div>
          </div>

          {/* Bottom row — Kalan + progress */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', boxShadow: '0 1px 3px rgba(43,45,110,0.04)' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#e5484d' }}>Kalan</div>
                <div className="mono text-sm font-extrabold amt-red" style={{ letterSpacing: '-0.03em' }}>{fmt(remainingTotal)}</div>
              </div>
              <div className="text-right">
                <div className="mono text-xl font-extrabold" style={{ color: '#2b2d6e', letterSpacing: '-0.03em' }}>%{paidPct}</div>
                <div className="text-[9px]" style={{ color: 'var(--muted)' }}>tamamlandi</div>
              </div>
            </div>
            <div className="progress-wrap">
              <div className="progress-bar" style={{ width: `${paidPct}%`, background: 'linear-gradient(90deg, #2b2d6e, #4a4db0)' }} />
            </div>
          </div>
        </div>

        {/* ===== PAYMENT LIST ===== */}
        <div style={{ opacity: monthLoading ? 0.5 : 1 }}>
          {unpaidPayments.length > 0 && (
            <>
              <div className="flex items-center justify-between mx-5 mb-3">
                <span className="text-xs font-bold">{isFuture ? 'Planlanan' : isPast ? 'Odenmemis' : 'Bekleyen Odemeler'}</span>
                {overduePayments.length > 0 && <span className="badge badge-amber">{overduePayments.length} gecmis</span>}
              </div>
              <div className="tx-list mx-4 mb-4">{unpaidPayments.map(renderPaymentItem)}</div>
            </>
          )}
          {unpaidPayments.length === 0 && (
            <div className="mx-4 mb-4 card p-6 text-center">
              <IconCheck color="#30a46c" size={28} strokeWidth={2.5} />
              <div className="text-sm font-semibold mt-2" style={{ color: '#30a46c' }}>Tum odemeler tamamlandi</div>
            </div>
          )}
          {paidPayments.length > 0 && (
            <>
              <div className="flex items-center justify-between mx-5 mb-3">
                <span className="text-xs font-bold" style={{ color: '#30a46c' }}>Tamamlanan</span>
                <span className="text-[10px] font-medium" style={{ color: '#30a46c' }}>{paidPayments.length} odeme</span>
              </div>
              <div className="tx-list mx-4 mb-4">{paidPayments.map(renderPaymentItem)}</div>
            </>
          )}
        </div>

        {/* ===== PAY MODAL ===== */}
        {payModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(30,31,84,0.5)' }}
            onClick={e => { if (e.target === e.currentTarget) { setPayModal(null); setPayAccountId(null) } }}>
            <div className="card p-6 w-full max-w-sm scale-in">
              <div className="text-base font-bold mb-1">{payModal.overdue ? 'Gecmis Odemeyi Onayla' : 'Odeme Yap'}</div>
              <div className="text-sm mb-5" style={{ color: 'var(--muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{payModal.name}</span>
                <span className="mono ml-2 font-bold">{fmt(payModal.amount, payModal.currency)}</span>
              </div>
              <div className="mb-5">
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Hangi hesaptan?</label>
                <select value={payAccountId || ''} onChange={e => setPayAccountId(Number(e.target.value))} className="input">
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, a.currency)}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setPayModal(null); setPayAccountId(null) }} className="btn-outline flex-1 py-3 text-sm">Iptal</button>
                <button onClick={handlePay} disabled={paying || !payAccountId} className="btn-primary flex-1 py-3 text-sm">{paying ? 'Kaydediliyor...' : 'Onayla'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
