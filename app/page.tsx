'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { Account, Loan, RecurringExpense, ExchangeRate } from '@/lib/supabase'

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [recurring, setRecurring] = useState<RecurringExpense[]>([])
  const [rates, setRates] = useState<ExchangeRate | null>(null)
  const [loading, setLoading] = useState(true)
  const [investTotalTry, setInvestTotalTry] = useState(0)
  const [paidExpenseIds, setPaidExpenseIds] = useState<Set<number>>(new Set())
  const [paidLoanIds, setPaidLoanIds] = useState<Set<number>>(new Set())

  async function loadAll() {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    const [{ data: acc }, { data: lns }, { data: rec }, { data: rt }, { data: snaps }, { data: paid }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true),
      supabase.from('loans').select('*').eq('is_active', true),
      supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('investment_snapshots').select('total_value_try').eq('snapshot_date', todayStr),
      supabase.from('recurring_payments').select('expense_id, loan_id').eq('period_year', year).eq('period_month', month).eq('is_paid', true),
    ])
    setAccounts(acc || [])
    setLoans(lns || [])
    setRecurring(rec || [])
    setRates(rt?.[0] || null)
    setInvestTotalTry((snaps || []).reduce((s: number, sn: any) => s + (sn.total_value_try || 0), 0))

    const paidExp = new Set<number>()
    const paidLn = new Set<number>()
    ;(paid || []).forEach((p: any) => {
      if (p.expense_id) paidExp.add(p.expense_id)
      if (p.loan_id) paidLn.add(p.loan_id)
    })
    setPaidExpenseIds(paidExp)
    setPaidLoanIds(paidLn)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const eurTry = rates?.eur_try || 38
  const usdTry = rates?.usd_try || 35

  // All accounts converted to TRY (TL + EUR + USD + kripto EUR)
  const cashTry = accounts.reduce((sum, a) => {
    if (a.currency === 'TRY') return sum + a.balance
    if (a.currency === 'EUR') return sum + a.balance * eurTry
    if (a.currency === 'USD') return sum + a.balance * usdTry
    return sum
  }, 0)

  const totalAssetsTry = cashTry + investTotalTry

  // Grouped totals for pills
  const tryTotal = accounts.filter(a => a.currency === 'TRY').reduce((s, a) => s + a.balance, 0)
  const eurTotal = accounts.filter(a => a.currency === 'EUR' && a.type !== 'kripto').reduce((s, a) => s + a.balance, 0)
  const usdTotal = accounts.filter(a => a.currency === 'USD').reduce((s, a) => s + a.balance, 0)
  const kriptoAccounts = accounts.filter(a => a.type === 'kripto')
  const kriptoTotal = kriptoAccounts.reduce((s, a) => s + a.balance, 0)
  const kriptoCurrency = kriptoAccounts[0]?.currency || 'EUR'

  const toTry = (amount: number, currency: string) => {
    if (currency === 'EUR') return amount * eurTry
    if (currency === 'USD') return amount * usdTry
    return amount
  }

  const totalDebtTry = loans.reduce((sum, l) => sum + toTry(l.remaining_amount || 0, l.currency), 0)
  const monthlyFixed = recurring.reduce((sum, r) => sum + toTry(r.amount, r.currency), 0)
  const monthlyLoans = loans.reduce((sum, l) => sum + toTry(l.monthly_payment, l.currency), 0)
  const monthlyTotal = monthlyFixed + monthlyLoans
  const runwayMonths = monthlyTotal > 0 ? (totalAssetsTry / monthlyTotal).toFixed(1) : '∞'
  const runwayPct = Math.min(100, (parseFloat(runwayMonths as string) / 24) * 100)

  // Bar chart
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    return { name: d.toLocaleDateString('tr-TR', { month: 'short' }), tutar: Math.round(monthlyTotal * (0.85 + Math.random() * 0.3)) }
  })
  if (chartData.length > 0) chartData[chartData.length - 1].tutar = Math.round(monthlyTotal)

  // Build upcoming payments, filtering out already-paid items
  const upcomingLoans = loans
    .filter(l => l.payment_day && !paidLoanIds.has(l.id))
    .map(l => ({ name: l.name, amount: l.monthly_payment, currency: l.currency, day: l.payment_day, type: 'kredi' as const, expenseId: null as number | null, loanId: l.id }))

  const upcomingRecurring = recurring
    .filter(r => r.payment_day && r.category !== 'nakit' && !paidExpenseIds.has(r.id))
    .map(r => ({ name: r.name, amount: r.amount, currency: r.currency, day: r.payment_day!, type: r.category as string, expenseId: r.id, loanId: null as number | null }))

  const allPayments = [...upcomingLoans, ...upcomingRecurring]
    .map(p => ({ ...p, days: daysUntil(p.day) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 8)

  // Payment modal
  type PaymentItem = (typeof allPayments)[number]
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

    // 1) Insert payment record for recurring expense
    if (payModal.expenseId) {
      await supabase.from('recurring_payments').insert({
        expense_id: payModal.expenseId,
        period_year: year,
        period_month: month,
        amount: payModal.amount,
        is_paid: true,
        paid_date: today,
      })
    }

    // 2) Insert payment record for loan
    if (payModal.loanId) {
      await supabase.from('recurring_payments').insert({
        loan_id: payModal.loanId,
        period_year: year,
        period_month: month,
        amount: payModal.amount,
        is_paid: true,
        paid_date: today,
      })

      // Update loan: increment paid_installments, decrease remaining
      const loan = loans.find(l => l.id === payModal.loanId)
      if (loan) {
        await supabase.from('loans').update({
          paid_installments: loan.paid_installments + 1,
          remaining_amount: Math.max(0, (loan.remaining_amount || 0) - payModal.amount),
        }).eq('id', payModal.loanId)
      }
    }

    // 3) Deduct from selected account
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
    }

    setPaying(false)
    setPayModal(null)
    setPayAccountId(null)

    // 4) Refresh all data (paid items will be filtered out)
    setLoading(true)
    await loadAll()
  }

  const now2 = new Date()
  const hour = now2.getHours()
  const greeting = hour < 12 ? 'Gunaydin' : hour < 18 ? 'Iyi gunler' : 'Iyi aksamlar'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>
        <div className="text-sm">Yukleniyor...</div>
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

        {/* Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mx-4 mb-4">
          {/* Net Worth */}
          <div className="card-lg p-5 md:col-span-2">
            <div className="text-[12px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Varlik</div>
            <div className="mono text-3xl font-bold" style={{ color: 'var(--text)' }}>{fmt(totalAssetsTry)}</div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
              Toplam Varlik (yatirimlar dahil)
            </div>
            <div className="flex gap-4 mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
              <span>Nakit: <span className="amt-blue font-semibold">{fmt(cashTry)}</span></span>
              {investTotalTry > 0 && <span>Yatirim: <span className="amt-blue font-semibold">{fmt(investTotalTry)}</span></span>}
              <span>Borc: <span className="amt-red font-semibold">{fmt(totalDebtTry)}</span></span>
            </div>
            {/* Currency pills */}
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

          {/* Runway */}
          <div className="card p-4">
            <div className="text-[12px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Runway</div>
            <div className="mono text-2xl font-bold amt-blue">{runwayMonths} <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>Ay</span></div>
            <div className="progress-wrap mt-3 mb-2">
              <div className="progress-bar" style={{ width: `${runwayPct}%`, background: runwayPct > 50 ? '#059669' : runwayPct > 25 ? '#d97706' : '#dc2626' }} />
            </div>
            <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
              <span>0</span>
              <span>24 ay</span>
            </div>
            <div className="text-[10px] mt-2" style={{ color: 'var(--muted)' }}>Tum varliklarinla kac ay idare edebilirsin</div>
          </div>
        </div>

        {/* Monthly Summary */}
        <div className="grid grid-cols-3 gap-3 mx-4 mb-4">
          <div className="card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Kredi Odeme</div>
            <div className="mono text-base font-bold amt-red">{fmt(monthlyLoans)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{loans.length} kredi</div>
          </div>
          <div className="card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Duzenli Gider</div>
            <div className="mono text-base font-bold amt-amber">{fmt(monthlyFixed)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{recurring.length} kalem</div>
          </div>
          <div className="card p-3">
            <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>Toplam</div>
            <div className="mono text-base font-bold amt-blue">{fmt(monthlyTotal)}</div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>aylik sabit</div>
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

        {/* Upcoming Bills */}
        <div className="px-5 mb-2 flex justify-between items-center">
          <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted)' }}>Yaklasan Odemeler</div>
          {(paidExpenseIds.size > 0 || paidLoanIds.size > 0) && (
            <div className="text-[10px] font-medium" style={{ color: '#059669' }}>
              {paidExpenseIds.size + paidLoanIds.size} odeme yapildi bu ay
            </div>
          )}
        </div>
        {allPayments.length === 0 ? (
          <div className="mx-4 card p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
            Tum odemeler yapildi bu ay
          </div>
        ) : (
          <div className="flex flex-col gap-2 mx-4">
            {allPayments.map((p, i) => {
              const isUrgent = p.days <= 3
              return (
                <div key={i} className="card-accent px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0"
                    style={{ background: isUrgent ? 'rgba(220,38,38,0.08)' : 'var(--bg4)' }}>
                    <div className="text-[10px] font-bold" style={{ color: isUrgent ? '#dc2626' : 'var(--muted)' }}>
                      {p.day}
                    </div>
                    <div className="text-[8px] uppercase" style={{ color: 'var(--muted)' }}>
                      {new Date().toLocaleDateString('tr-TR', { month: 'short' })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{p.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: isUrgent ? '#dc2626' : 'var(--muted)' }}>
                      {daysUntilLabel(p.days)}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="mono text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        {fmt(p.amount, p.currency)}
                        {p.currency === 'EUR' && <span className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}> ({fmt(p.amount * eurTry)})</span>}
                      </div>
                    </div>
                    <button onClick={() => { setPayModal(p); setPayAccountId(accounts[0]?.id || null) }}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0"
                      style={{ background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }}>
                      Yapildi
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pay confirmation modal */}
        {payModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-1">Odeme Yap</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>
                <span className="font-medium" style={{ color: 'var(--text)' }}>{payModal.name}</span> — {fmt(payModal.amount, payModal.currency)}
                {payModal.currency === 'EUR' && <span> ({fmt(payModal.amount * eurTry)})</span>}
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
