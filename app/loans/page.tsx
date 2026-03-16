'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { Loan, CreditCard, CreditCardStatement, ExchangeRate } from '@/lib/supabase'

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [statements, setStatements] = useState<CreditCardStatement[]>([])
  const [eurTry, setEurTry] = useState<number>(38)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const [{ data: lns }, { data: crd }, { data: stm }, { data: rates }] = await Promise.all([
        supabase.from('loans').select('*').eq('is_active', true).order('monthly_payment', { ascending: false }),
        supabase.from('credit_cards').select('*').eq('is_active', true),
        supabase.from('credit_card_statements').select('*')
          .eq('period_year', now.getFullYear())
          .eq('period_month', now.getMonth() + 1),
        supabase.from('exchange_rates').select('eur_try').order('date', { ascending: false }).limit(1),
      ])
      setLoans(lns || [])
      setCards(crd || [])
      setStatements(stm || [])
      if (rates?.[0]?.eur_try) setEurTry(rates[0].eur_try)
      setLoading(false)
    }
    load()
  }, [])

  const toTry = (loan: Loan, amount: number) =>
    loan.currency === 'EUR' ? amount * eurTry : amount

  const totalMonthly = loans.reduce((s, l) => s + toTry(l, l.monthly_payment), 0)
  const totalRemaining = loans.reduce((s, l) => s + toTry(l, l.remaining_amount || 0), 0)
  const totalKK = statements.reduce((s, st) => s + (st.total_amount || 0), 0)

  const progressPct = (loan: Loan) => {
    if (!loan.total_installments) return 0
    return Math.round((loan.paid_installments / loan.total_installments) * 100)
  }

  const barColor = (pct: number) => {
    if (pct >= 75) return 'linear-gradient(90deg, #4ade9a, #6c8fff)'
    if (pct >= 40) return 'linear-gradient(90deg, #f59e0b, #4ade9a)'
    return 'linear-gradient(90deg, #f87171, #f59e0b)'
  }

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>

  return (
    <div className="pb-24 page-enter">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Modül</div>
        <div className="text-lg font-semibold mt-0.5">Krediler & Kartlar</div>
      </div>

      {/* Özet */}
      <div className="flex gap-2 mx-4 mb-4">
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Kalan Borç</div>
          <div className="mono text-base font-medium amt-red">{fmt(totalRemaining)}</div>
          <div className="text-[10px] mt-1 amt-red">{loans.length} aktif kredi</div>
        </div>
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Aylık Ödeme</div>
          <div className="mono text-base font-medium amt-amber">{fmt(totalMonthly)}</div>
          <div className="text-[10px] mt-1 amt-amber">bu ay toplam</div>
        </div>
      </div>

      {loans.some(l => l.currency === 'EUR') && (
        <div className="mx-4 mb-3 text-[11px] text-right" style={{ color: 'var(--muted)' }}>
          EUR/TRY kuru: {eurTry.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      )}

      {/* Krediler */}
      <div className="px-5 pb-2 text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
        Aktif Krediler
      </div>

      {loans.length === 0 && (
        <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Henüz kredi eklenmemiş.<br />
          <span className="text-[12px]">Supabase → loans tablosundan ekleyebilirsin.</span>
        </div>
      )}

      <div className="flex flex-col gap-2 mx-4 mb-4">
        {loans.map((loan) => {
          const pct = progressPct(loan)
          const days = loan.payment_day ? daysUntil(loan.payment_day) : null
          return (
            <div key={loan.id} className="card p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="text-sm font-semibold">{loan.name}</div>
                  <div className="text-[11px] mt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                    {loan.bank} · {loan.type}
                    {loan.collateral && ` · ${loan.collateral}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="mono text-base font-medium amt-red">{fmt(loan.monthly_payment, loan.currency)}<span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}>/ay</span></div>
                  {loan.currency === 'EUR' && (
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>≈ {fmt(loan.monthly_payment * eurTry)}</div>
                  )}
                  {days !== null && (
                    <div className="text-[11px] mt-0.5" style={{ color: days <= 3 ? '#f87171' : 'var(--muted)' }}>
                      {daysUntilLabel(days)}
                    </div>
                  )}
                </div>
              </div>

              <div className="progress-wrap mb-2">
                <div className="progress-bar" style={{ width: `${pct}%`, background: barColor(pct) }} />
              </div>

              <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                <span>Kalan: <span className="amt-red font-medium">{fmt(loan.remaining_amount || 0, loan.currency)}</span>
                  {loan.currency === 'EUR' && <span style={{ color: 'var(--muted)' }}> ≈ {fmt((loan.remaining_amount || 0) * eurTry)}</span>}
                </span>
                {loan.total_installments > 0 && (
                  <span style={{ color: pct >= 75 ? '#4ade9a' : 'var(--muted)' }}>
                    {loan.paid_installments}/{loan.total_installments} taksit
                  </span>
                )}
                {loan.end_date && (
                  <span>Bitiş: {new Date(loan.end_date).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Kredi Kartları */}
      <div className="px-5 pb-2 text-[11px] uppercase tracking-widest font-semibold" style={{ color: 'var(--muted)' }}>
        Kredi Kartları
      </div>

      {totalKK > 0 && (
        <div className="mx-4 mb-2 card px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Bu Ay Toplam KK</div>
          <div className="mono text-base font-medium amt-amber">{fmt(totalKK)}</div>
        </div>
      )}

      <div className="flex flex-col gap-2 mx-4">
        {cards.map((card) => {
          const stmt = statements.find(s => s.card_id === card.id)
          const days = card.due_day ? daysUntil(card.due_day) : null
          return (
            <div key={card.id} className="card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.12)' }}>
                💳
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{card.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                  Ekstre: {card.statement_day}'i · Son ödeme: {card.due_day}'i
                </div>
              </div>
              <div className="text-right">
                {stmt ? (
                  <>
                    <div className="mono text-sm font-medium amt-amber">{fmt(stmt.total_amount)}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: days && days <= 3 ? '#f87171' : 'var(--muted)' }}>
                      {days !== null ? daysUntilLabel(days) : ''}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>ekstre girilmedi</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
