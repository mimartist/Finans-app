'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel, isDemo } from '@/lib/supabase'
import { getCatIcon, IconWallet, IconPieChart, IconTarget, IconBank, IconTrendUp, IconRefresh, IconCheck, IconDollar, IconBriefcase, IconShield, IconCalendar, IconCreditCard, IconSettings, IconCash } from '@/components/Icons'
import NotificationBell from '@/components/NotificationBell'
import type { Account, Loan, RecurringExpense, ExchangeRate, DebtRecord, CreditCard } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
  const now = new Date()
  const currentMonth: MonthKey = { year: now.getFullYear(), month: now.getMonth() + 1 }

  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [investTotalTry, setInvestTotalTry] = useState(0)
  const [hisseTry, setHisseTry] = useState(0)
  const [fonTry, setFonTry] = useState(0)
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [allAlacak, setAllAlacak] = useState<DebtRecord[]>([])
  const [kriptoTry, setKriptoTry] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(currentMonth)
  const [monthLoading, setMonthLoading] = useState(false)
  const [heroExpanded, setHeroExpanded] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<{ name: string; avatarUrl: string } | null>(null)

  const isCurrent = sameMonth(selectedMonth, currentMonth)
  const isPast = selectedMonth.year < currentMonth.year || (selectedMonth.year === currentMonth.year && selectedMonth.month < currentMonth.month)
  const isFuture = selectedMonth.year > currentMonth.year || (selectedMonth.year === currentMonth.year && selectedMonth.month > currentMonth.month)

  const monthPills: MonthKey[] = []
  for (let i = -3; i <= 2; i++) monthPills.push(monthOffset(currentMonth, i))

  const loadGlobal = useCallback(async () => {
    if (isDemo) {
      setAccounts(MOCK_ACCOUNTS); setLoans(MOCK_LOANS); setRecurring(MOCK_RECURRING)
      setAllAlacak([]); setRates(MOCK_RATES); setInvestTotalTry(85000); setHisseTry(52000); setFonTry(33000); setKriptoTry(22000)
      return { accs: MOCK_ACCOUNTS, lnsList: MOCK_LOANS, recList: MOCK_RECURRING }
    }
    const [{ data: acc }, { data: lns }, { data: rec }, { data: rt }, { data: snaps }, { data: recAlacak }, { data: cryptoSnaps }, { data: crds }, { data: invs }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true),
      supabase.from('loans').select('*').eq('is_active', true),
      supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('investment_snapshots').select('investment_id, total_value_try, snapshot_date').order('snapshot_date', { ascending: false }),
      supabase.from('debt_records').select('*').eq('type', 'alacak').eq('is_settled', false),
      supabase.from('investment_snapshots').select('*, investments!inner(platform, type, is_active)').eq('investments.is_active', true).in('investments.platform', ['Binance']).order('snapshot_date', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('is_active', true),
      supabase.from('investments').select('*').eq('is_active', true),
    ])
    const ratesData = rt?.[0] || null
    setAccounts(acc || []); setLoans(lns || []); setRecurring(rec || []); setAllAlacak(recAlacak || []); setRates(ratesData); setCreditCards(crds || [])
    const seen = new Set<number>()
    const latestSnaps = (snaps || []).filter((sn: any) => { if (seen.has(sn.investment_id)) return false; seen.add(sn.investment_id); return true })
    const snapMap = new Map<number, number>()
    latestSnaps.forEach((sn: any) => snapMap.set(sn.investment_id, sn.total_value_try || 0))
    setInvestTotalTry(latestSnaps.reduce((s: number, sn: any) => s + (sn.total_value_try || 0), 0))
    const latestByInvestment = (cryptoSnaps || []).reduce((acc: Record<number, any>, snap: any) => { if (!acc[snap.investment_id]) acc[snap.investment_id] = snap; return acc }, {} as Record<number, any>)
    setKriptoTry(Object.values(latestByInvestment).reduce((s: number, snap: any) => s + (snap.total_value_try || 0), 0))
    // Calculate investment values by type from investments table directly
    const _toTry = (amount: number, currency: string) => currency === 'EUR' ? amount * (ratesData?.eur_try || 0) : currency === 'USD' ? amount * (ratesData?.usd_try || 0) : amount
    let _hisse = 0, _fon = 0, _kripto = 0
    ;(invs || []).forEach((inv: any) => {
      const snapVal = snapMap.get(inv.id)
      const val = snapVal || _toTry(inv.quantity * inv.avg_cost, inv.currency)
      if (inv.type === 'hisse') _hisse += val
      else if (inv.type === 'fon') _fon += val
      else if (inv.type === 'kripto') _kripto += val
    })
    setHisseTry(_hisse); setFonTry(_fon)
    if (_kripto > 0) setKriptoTry(_kripto)
    return { accs: acc || [], lnsList: lns || [], recList: rec || [] }
  }, [])

  const loadMonth = useCallback(async (m: MonthKey, lnsList: Loan[], recList: RecurringExpense[]) => {
    let paidList: any[] = []
    let ccStatements: any[] = []
    let ccCards: any[] = []
    if (!isDemo) {
      const [{ data: paid }, { data: stmts }, { data: crds }] = await Promise.all([
        supabase.from('recurring_payments').select('*').eq('period_year', m.year).eq('period_month', m.month).eq('is_paid', true),
        supabase.from('credit_card_statements').select('*').eq('period_year', m.year).eq('period_month', m.month),
        supabase.from('credit_cards').select('*').eq('is_active', true),
      ])
      paidList = paid || []
      ccStatements = stmts || []
      ccCards = crds || []
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

    // Credit card statements: only show if payment falls in the selected month
    // If due_day already passed this month → payment is next month, so don't show in current month
    const ccItems: PaymentItem[] = ccStatements.filter(s => (s.total_amount || 0) > 0).map(s => {
      const card = ccCards.find((c: any) => c.id === s.card_id)
      const dueDay = card?.due_day || 10
      // Check if due_day falls in selected month or rolls to next month
      const today = new Date()
      const selDate = new Date(m.year, m.month - 1, 1)
      const isSelCurrent = m.year === today.getFullYear() && m.month === today.getMonth() + 1
      // For current month: if due_day >= today → this month. If due_day < today → next month (don't show)
      // For other months: show if statement period+1 matches selected month
      let showInMonth = false
      let paymentMonth = m.month
      let paymentYear = m.year
      if (isSelCurrent) {
        if (dueDay >= today.getDate()) {
          showInMonth = true // due_day hasn't passed yet → payment is this month
        }
        // If due_day < today → payment rolled to next month, show in next month view
      } else {
        // For non-current month views: show if statement's payment would fall in this month
        // Statement period is m, payment could be same or next month
        // Check if this is the "next month" for a statement where due_day < statement close
        const prevMonth = m.month === 1 ? 12 : m.month - 1
        const prevYear = m.month === 1 ? m.year - 1 : m.year
        // Show if we have a statement from previous month whose due_day < that month's current day
        showInMonth = true // For future months, show the CC items
      }
      if (!showInMonth) return null
      const days = isSelCurrent ? daysUntil(dueDay) : 0
      const isPaid = s.is_paid || false
      return {
        id: `cc_${s.id}`, name: card?.name || 'Kredi Karti', amount: s.total_amount || 0,
        currency: 'TRY', day: dueDay, type: 'kredi_karti',
        source: 'recurring' as const, sourceId: s.id,
        days,
        paid: isPaid, overdue: false,
      }
    }).filter(Boolean) as PaymentItem[]

    // Sort: unpaid loans first (by day), then unpaid expenses/cc (by day), then paid items (by day)
    const typeOrder = (p: PaymentItem) => p.paid ? 2 : p.source === 'loan' ? 0 : 1
    setPayments([...loanItems, ...expItems, ...ccItems].sort((a, b) => {
      const ta = typeOrder(a), tb = typeOrder(b)
      if (ta !== tb) return ta - tb
      return a.day - b.day
    }))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
      if (session?.user) {
        setAuthUser({
          name: session.user.user_metadata?.full_name || '',
          avatarUrl: session.user.user_metadata?.avatar_url || '',
        })
      }
    })
    ;(async () => { const { lnsList, recList } = await loadGlobal(); await loadMonth(currentMonth, lnsList, recList); setLoading(false) })()
  }, []) // eslint-disable-line

  const initialLoadDone = useRef(false)
  useEffect(() => { if (!initialLoadDone.current) { initialLoadDone.current = true; return }; if (loans.length === 0 && recurring.length === 0) return; setMonthLoading(true); loadMonth(selectedMonth, loans, recurring).then(() => setMonthLoading(false)) }, [selectedMonth]) // eslint-disable-line

  const reloadAll = useCallback(async () => { const { lnsList, recList } = await loadGlobal(); await loadMonth(selectedMonth, lnsList, recList) }, [loadGlobal, loadMonth, selectedMonth])

  const eurTry = rates?.eur_try || 0, usdTry = rates?.usd_try || 0
  const toTry = (amount: number, currency: string) => currency === 'EUR' ? amount * eurTry : currency === 'USD' ? amount * usdTry : amount

  const cashTry = accounts.reduce((s, a) => s + toTry(a.balance, a.currency), 0)
  const alacakTry = allAlacak.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
  const allInvestTry = hisseTry + fonTry + kriptoTry
  const totalAssetsTry = cashTry + (allInvestTry > 0 ? allInvestTry : investTotalTry) + alacakTry
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
  const [payMethod, setPayMethod] = useState<'hesap' | 'kredi_karti' | 'nakit'>('hesap')
  const [payCardId, setPayCardId] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)

  async function handlePay() {
    if (!payModal) return
    if (payMethod === 'hesap' && !payAccountId) return
    if (payMethod === 'kredi_karti' && !payCardId) return
    setPaying(true)
    if (!isDemo) {
      const year = now.getFullYear(), month = now.getMonth() + 1, today = now.toISOString().split('T')[0]
      const paymentNotes = payMethod === 'nakit' ? 'nakit' : payMethod === 'kredi_karti' ? `kk_${payCardId}` : undefined
      if (payModal.source === 'recurring') { const { error } = await supabase.from('recurring_payments').insert({ expense_id: payModal.sourceId, period_year: year, period_month: month, amount: payModal.amount, is_paid: true, paid_date: today, ...(paymentNotes ? { notes: paymentNotes } : {}), ...(userId ? { user_id: userId } : {}) }); if (error) { alert('Hata: ' + error.message); setPaying(false); return } }
      if (payModal.source === 'loan') { const { error } = await supabase.from('recurring_payments').insert({ expense_id: null, notes: paymentNotes || `loan_${payModal.sourceId}`, period_year: year, period_month: month, amount: payModal.amount, is_paid: true, paid_date: today, ...(userId ? { user_id: userId } : {}) }); if (error) { alert('Hata: ' + error.message); setPaying(false); return }; const loan = loans.find(l => l.id === payModal.sourceId); if (loan) await supabase.from('loans').update({ paid_installments: loan.paid_installments + 1, remaining_amount: Math.max(0, (loan.remaining_amount || 0) - payModal.amount) }).eq('id', payModal.sourceId) }

      if (payMethod === 'hesap' && payAccountId) {
        const account = accounts.find(a => a.id === payAccountId)
        if (account) { let deduct = payModal.amount; if (payModal.currency !== account.currency) { const tryAmt = toTry(payModal.amount, payModal.currency); deduct = account.currency === 'EUR' ? tryAmt / eurTry : account.currency === 'USD' ? tryAmt / usdTry : tryAmt }; await supabase.from('accounts').update({ balance: account.balance - deduct }).eq('id', payAccountId); setAccounts(prev => prev.map(a => a.id === payAccountId ? { ...a, balance: a.balance - deduct } : a)) }
      } else if (payMethod === 'kredi_karti' && payCardId) {
        // Add as credit card transaction
        const stmtMonth = month, stmtYear = year
        const { data: existingStmt } = await supabase.from('credit_card_statements').select('*').eq('card_id', payCardId).eq('period_year', stmtYear).eq('period_month', stmtMonth)
        if (existingStmt && existingStmt.length > 0) {
          await supabase.from('credit_card_transactions').insert({ card_id: payCardId, statement_id: existingStmt[0].id, transaction_date: today, description: payModal.name, category: payModal.type, amount: payModal.amount, currency: payModal.currency, ...(userId ? { user_id: userId } : {}) })
          await supabase.from('credit_card_statements').update({ total_amount: (existingStmt[0].total_amount || 0) + payModal.amount }).eq('id', existingStmt[0].id)
        } else {
          const { data: newStmt } = await supabase.from('credit_card_statements').insert({ card_id: payCardId, period_year: stmtYear, period_month: stmtMonth, total_amount: payModal.amount, minimum_payment: 0, is_paid: false, ...(userId ? { user_id: userId } : {}) }).select().single()
          if (newStmt) await supabase.from('credit_card_transactions').insert({ card_id: payCardId, statement_id: newStmt.id, transaction_date: today, description: payModal.name, category: payModal.type, amount: payModal.amount, currency: payModal.currency, ...(userId ? { user_id: userId } : {}) })
        }
      }
      // nakit: no account deduction, just record the payment
    }
    setPayments(prev => prev.map(p => p.source === payModal.source && p.sourceId === payModal.sourceId ? { ...p, paid: true, overdue: false } : p))
    setPaying(false); setPayModal(null); setPayAccountId(null); setPayMethod('hesap'); setPayCardId(null)
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

    const isLoan = p.source === 'loan'
    const isCC = p.type === 'kredi_karti'
    const isHighlight = isLoan || isCC

    return (
      <div key={p.id} className="tx-item" style={{
        opacity: p.paid ? 0.5 : 1,
        ...(isHighlight && !p.paid ? {
          border: `1.5px solid ${isLoan ? 'rgba(229,72,77,0.25)' : 'rgba(43,45,110,0.2)'}`,
          borderRadius: 14,
          padding: '12px 14px',
          margin: '4px 0',
          background: isLoan ? 'rgba(229,72,77,0.03)' : 'rgba(43,45,110,0.02)',
        } : {}),
      }}>
        <div className="tx-icon">
          {p.paid ? <IconCheck color="#30a46c" size={20} strokeWidth={2.5} /> : getCatIcon(p.type, { color: isLoan ? '#e5484d' : 'var(--primary)', size: 20 })}
        </div>
        <div className="tx-info">
          <div className="tx-name" style={{ textDecoration: p.paid ? 'line-through' : 'none', fontWeight: isHighlight ? 700 : undefined }}>{p.name}</div>
          <div className="tx-detail" style={{ color: statusColor }}>
            {p.paid ? 'Odendi' : (() => {
              if (p.type === 'kredi_karti') {
                const payDate = new Date(); payDate.setDate(payDate.getDate() + p.days)
                const payMonthStr = payDate.toLocaleDateString('tr-TR', { month: 'short' })
                const dateStr = `${p.day} ${payMonthStr}`
                return p.overdue ? `Gecikti · ${dateStr}` : `${dateStr} · ${daysUntilLabel(p.days)}`
              }
              return p.overdue ? `Gecikti · ${p.day} ${selMonthShort}` : `${p.day} ${selMonthShort} · ${daysUntilLabel(p.days)}`
            })()}
          </div>
        </div>
        <div className="tx-amount">
          <div className="tx-value" style={{ color: p.paid ? '#30a46c' : isLoan ? '#e5484d' : 'var(--text)', textDecoration: p.paid ? 'line-through' : 'none', fontWeight: isHighlight ? 700 : undefined }}>{fmt(p.amount, p.currency)}</div>
          {isCurrent && !p.paid && (
            <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null); setPayMethod('hesap'); setPayCardId(creditCards[0]?.id || null) }}
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
            {authUser?.avatarUrl ? (
              <img src={authUser.avatarUrl} alt="avatar" className="w-11 h-11 rounded-full object-cover"
                style={{ border: '2.5px solid var(--border)' }} />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-extrabold text-white flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #2b2d6e, #4a4db0)', border: '2.5px solid var(--border)' }}>
                {authUser?.name ? authUser.name.charAt(0).toUpperCase() : 'F'}
              </div>
            )}
            <div>
              <span className="text-lg" style={{ color: 'var(--text)' }}>Merhaba </span>
              <span className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>{authUser?.name ? authUser.name.split(' ')[0] : 'Atakan'}!</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => { if (isDemo) return; setLoading(true); await fetch('/api/update-rates'); await reloadAll(); setLoading(false) }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg4)' }}>
              <IconRefresh color="var(--primary)" size={18} strokeWidth={2} />
            </button>
            <NotificationBell payments={payments} />
            <button onClick={() => router.push('/settings')} className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg4)' }}>
              <IconSettings color="var(--primary)" size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* ===== HERO CARD ===== */}
        <div className="mx-4 mt-3 card-hero p-6" style={{ position: 'relative', zIndex: 1, cursor: 'pointer', transition: 'all 0.3s ease' }}
          onClick={() => setHeroExpanded(e => !e)}>
          <div className="flex items-center justify-between mb-1" style={{ position: 'relative', zIndex: 2 }}>
            <div className="text-[11px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>Toplam Varlik</div>
            <IconWallet color="rgba(255,255,255,0.3)" size={20} />
          </div>
          <div className="mono text-3xl font-extrabold mb-1" style={{ position: 'relative', zIndex: 2 }}>{fmt(totalAssetsTry)}</div>
          <div className="text-[10px] mb-4" style={{ position: 'relative', zIndex: 2, color: 'rgba(255,255,255,0.4)' }}>
            {heroExpanded ? 'Gizlemek icin dokun ↑' : 'Detaylar icin dokun ↓'}
          </div>
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

          {/* Expanded detail section */}
          <div style={{
            position: 'relative', zIndex: 2,
            maxHeight: heroExpanded ? 300 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.35s ease, opacity 0.3s ease, margin 0.3s ease',
            opacity: heroExpanded ? 1 : 0,
            marginTop: heroExpanded ? 20 : 0,
          }}>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
              <div className="text-[9px] font-medium uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>Varlik Dagilimi</div>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Nakit', value: cashTry, icon: '🏦' },
                  { label: 'Hisse', value: hisseTry, icon: '📊' },
                  { label: 'Kripto', value: kriptoTry, icon: '₿' },
                  { label: 'Fon', value: fonTry, icon: '📈' },
                  { label: 'Alacak', value: alacakTry, icon: '💰' },
                ].filter(r => r.value > 0).map(r => {
                  const pct = totalAssetsTry > 0 ? Math.round((r.value / totalAssetsTry) * 100) : 0
                  return (
                    <div key={r.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px]">{r.icon}</span>
                          <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{r.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="mono text-[11px] font-bold">{fmt(r.value)}</span>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>%{pct}</span>
                        </div>
                      </div>
                      <div className="w-full rounded-full" style={{ height: 3, background: 'rgba(255,255,255,0.1)' }}>
                        <div className="rounded-full" style={{ height: 3, width: `${pct}%`, background: 'rgba(255,255,255,0.5)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 14, paddingTop: 12 }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>Toplam Borc</span>
                  <span className="mono text-[11px] font-bold" style={{ color: '#ff8a8a' }}>{fmt(totalDebtTry)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>Net Varlik</span>
                  <span className="mono text-[13px] font-extrabold" style={{ color: totalAssetsTry - totalDebtTry >= 0 ? '#86efac' : '#ff8a8a' }}>
                    {fmt(totalAssetsTry - totalDebtTry)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== VARLIK DAGILIMI ===== */}
        {(() => {
          const assetSlices = [
            { label: 'Nakit', value: cashTry, color: '#2b2d6e' },
            { label: 'Hisse', value: hisseTry, color: '#4a4db0' },
            { label: 'Kripto', value: kriptoTry, color: '#8b5cf6' },
            { label: 'Fon', value: fonTry, color: '#6366f1' },
            { label: 'Alacak', value: alacakTry, color: '#059669' },
          ].filter(r => r.value > 0)
          const total = assetSlices.reduce((s, r) => s + r.value, 0)
          return (
            <div className="mx-4 mt-4 card p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--primary)' }}>Varlik Dagilimi</div>
              <div className="flex items-center gap-4">
                <div style={{ width: 110, height: 110, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={assetSlices} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} startAngle={90} endAngle={-270}>
                        {assetSlices.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  {assetSlices.map(r => {
                    const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
                    return (
                      <div key={r.label}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                            <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{r.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="mono text-[11px] font-bold" style={{ color: r.color }}>{fmt(r.value)}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded-full" style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>%{pct}</span>
                          </div>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'var(--bg2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ===== YUKUMLULUK ===== */}
        <div className="mx-4 mt-3 card p-4">
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
                <span className="mono text-[11px] font-extrabold" style={{ color: 'var(--primary)' }}>{runwayMonths} Ay</span>
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
          background: 'var(--bg3)',
          borderRadius: 20,
          padding: '16px 14px',
          border: '1.5px solid var(--border)',
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
            <div className="flex-1" style={{ background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-xs)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Toplam</div>
              <div className="mono text-lg font-extrabold mt-1" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>{fmt(totalObligation)}</div>
            </div>
            <div className="flex-1" style={{ background: 'var(--bg2)', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-xs)' }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#30a46c' }}>Odenen</div>
              <div className="mono text-lg font-extrabold mt-1 amt-green" style={{ letterSpacing: '-0.03em' }}>{fmt(paidTotal)}</div>
            </div>
          </div>

          {/* Bottom row — Kalan + progress */}
          <div style={{ background: 'var(--bg2)', borderRadius: 14, padding: '12px 16px', boxShadow: 'var(--shadow-xs)' }}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#e5484d' }}>Kalan</div>
                <div className="mono text-sm font-extrabold amt-red" style={{ letterSpacing: '-0.03em' }}>{fmt(remainingTotal)}</div>
              </div>
              <div className="text-right">
                <div className="mono text-xl font-extrabold" style={{ color: 'var(--primary)', letterSpacing: '-0.03em' }}>%{paidPct}</div>
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
            onClick={e => { if (e.target === e.currentTarget) { setPayModal(null); setPayAccountId(null); setPayMethod('hesap'); setPayCardId(null) } }}>
            <div className="card p-6 w-full max-w-sm scale-in">
              <div className="text-base font-bold mb-1">{payModal.overdue ? 'Gecmis Odemeyi Onayla' : 'Odeme Yap'}</div>
              <div className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--text)' }}>{payModal.name}</span>
                <span className="mono ml-2 font-bold">{fmt(payModal.amount, payModal.currency)}</span>
              </div>

              {/* Payment method tabs */}
              <div className="flex gap-1.5 mb-4 p-1 rounded-xl" style={{ background: 'var(--bg4)' }}>
                {([['hesap', 'Hesaptan', IconBank], ['kredi_karti', 'Kredi Karti', IconCreditCard], ['nakit', 'Nakit', IconCash]] as const).map(([val, label, Icon]) => (
                  <button key={val} onClick={() => setPayMethod(val)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all"
                    style={{
                      background: payMethod === val ? 'var(--bg2)' : 'transparent',
                      boxShadow: payMethod === val ? 'var(--shadow)' : 'none',
                      color: payMethod === val ? 'var(--primary)' : 'var(--muted)',
                    }}>
                    <Icon size={14} color={payMethod === val ? 'var(--primary)' : undefined} strokeWidth={2} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Payment source selection */}
              {payMethod === 'hesap' && (
                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Hangi hesaptan?</label>
                  <select value={payAccountId || ''} onChange={e => setPayAccountId(Number(e.target.value))} className="input">
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} — {fmt(a.balance, a.currency)}</option>)}
                  </select>
                </div>
              )}
              {payMethod === 'kredi_karti' && (
                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-medium" style={{ color: 'var(--muted)' }}>Hangi kart?</label>
                  <select value={payCardId || ''} onChange={e => setPayCardId(Number(e.target.value))} className="input">
                    <option value="">Kart secin...</option>
                    {creditCards.map(c => <option key={c.id} value={c.id}>{c.name} ({c.bank})</option>)}
                  </select>
                </div>
              )}
              {payMethod === 'nakit' && (
                <div className="mb-4 p-3 rounded-xl text-[12px]" style={{ background: 'rgba(99,102,241,0.06)', color: '#6366f1' }}>
                  Nakit odeme olarak kaydedilecek. Hesap bakiyesinden dusulmez.
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setPayModal(null); setPayAccountId(null); setPayMethod('hesap'); setPayCardId(null) }} className="btn-outline flex-1 py-3 text-sm">Iptal</button>
                <button onClick={handlePay}
                  disabled={paying || (payMethod === 'hesap' && !payAccountId) || (payMethod === 'kredi_karti' && !payCardId)}
                  className="btn-primary flex-1 py-3 text-sm">{paying ? 'Kaydediliyor...' : 'Onayla'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
