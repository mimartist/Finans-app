'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { Loan, CreditCard, CreditCardStatement, CreditCardTransaction, ExchangeRate } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, CATEGORY_GROUPS } from '@/lib/categories'
import OcrUpload from '@/components/OcrUpload'

const emptyLoan = {
  name: '', bank: '', type: 'ihtiyac', currency: 'TRY', original_amount: '',
  remaining_amount: '', monthly_payment: '', payment_day: '', total_installments: '',
  paid_installments: '', interest_rate: '', start_date: '', end_date: '', collateral: '', notes: '',
}

const emptyTx = {
  transaction_date: new Date().toISOString().split('T')[0],
  description: '', category: '', amount: '', currency: 'TRY',
}

const emptyCard = {
  name: '', bank: '', credit_limit: '', currency: 'TRY', due_day: '', statement_day: '', current_spending: '',
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [cards, setCards] = useState<CreditCard[]>([])
  const [statements, setStatements] = useState<CreditCardStatement[]>([])
  const [transactions, setTransactions] = useState<CreditCardTransaction[]>([])
  const [eurTry, setEurTry] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyLoan)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [paidLoans, setPaidLoans] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // Credit card form state
  const [showCardForm, setShowCardForm] = useState(false)
  const [editCardId, setEditCardId] = useState<number | null>(null)
  const [cardForm, setCardForm] = useState(emptyCard)
  const [cardSaving, setCardSaving] = useState(false)
  const [cardDeleteConfirm, setCardDeleteConfirm] = useState<number | null>(null)

  // Credit card transaction state
  const [txFormCardId, setTxFormCardId] = useState<number | null>(null)
  const [txForm, setTxForm] = useState(emptyTx)
  const [txSaving, setTxSaving] = useState(false)
  const [txEditId, setTxEditId] = useState<number | null>(null)
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set())
  const [txDeleteConfirm, setTxDeleteConfirm] = useState<number | null>(null)

  async function load() {
    const now = new Date()
    const [{ data: lns }, { data: crd }, { data: stm }, { data: rates }, { data: txs }, { data: paidThisMonth }] = await Promise.all([
      supabase.from('loans').select('*').eq('is_active', true).order('monthly_payment', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('is_active', true),
      supabase.from('credit_card_statements').select('*').eq('period_year', now.getFullYear()).eq('period_month', now.getMonth() + 1),
      supabase.from('exchange_rates').select('eur_try').order('date', { ascending: false }).limit(1),
      supabase.from('credit_card_transactions').select('*').order('transaction_date', { ascending: false }),
      supabase.from('recurring_payments').select('*').eq('period_year', now.getFullYear()).eq('period_month', now.getMonth() + 1).eq('is_paid', true),
    ])
    setLoans(lns || []); setCards(crd || []); setStatements(stm || []); setTransactions(txs || [])
    setPaidLoans(paidThisMonth || [])
    if (rates?.[0]?.eur_try) setEurTry(rates[0].eur_try)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    load()
  }, [])

  const toTry = (loan: Loan, amount: number) => loan.currency === 'EUR' ? amount * eurTry : amount
  const totalMonthly = loans.reduce((s, l) => s + toTry(l, l.monthly_payment), 0)
  const totalRemaining = loans.reduce((s, l) => s + toTry(l, l.remaining_amount || 0), 0)
  const totalKK = statements.reduce((s, st) => s + (st.total_amount || 0), 0)

  const progressPct = (loan: Loan) => {
    if (!loan.total_installments) return 0
    return Math.round((loan.paid_installments / loan.total_installments) * 100)
  }

  function openAdd() { setEditId(null); setForm(emptyLoan); setShowForm(true) }
  function openEdit(l: Loan) {
    setEditId(l.id)
    setForm({
      name: l.name, bank: l.bank, type: l.type, currency: l.currency,
      original_amount: String(l.original_amount || ''), remaining_amount: String(l.remaining_amount || ''),
      monthly_payment: String(l.monthly_payment || ''), payment_day: String(l.payment_day || ''),
      total_installments: String(l.total_installments || ''), paid_installments: String(l.paid_installments || ''),
      interest_rate: String(l.interest_rate || ''), start_date: l.start_date || '', end_date: l.end_date || '',
      collateral: l.collateral || '', notes: l.notes || '',
    })
    setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditId(null); setForm(emptyLoan) }

  async function handleSave() {
    if (!form.name || !form.bank || !form.monthly_payment) return
    setSaving(true)
    const payload = {
      name: form.name, bank: form.bank, type: form.type, currency: form.currency,
      original_amount: parseFloat(form.original_amount) || 0, remaining_amount: parseFloat(form.remaining_amount) || 0,
      monthly_payment: parseFloat(form.monthly_payment) || 0, payment_day: parseInt(form.payment_day) || null,
      total_installments: parseInt(form.total_installments) || 0, paid_installments: parseInt(form.paid_installments) || 0,
      interest_rate: parseFloat(form.interest_rate) || 0, start_date: form.start_date || null, end_date: form.end_date || null,
      collateral: form.collateral || null, notes: form.notes || null, is_active: true,
      ...(userId ? { user_id: userId } : {}),
    }
    if (editId) { await supabase.from('loans').update(payload).eq('id', editId) }
    else { await supabase.from('loans').insert(payload) }
    setSaving(false); closeForm(); await load()
  }

  async function handleDelete(id: number) {
    await supabase.from('loans').update({ is_active: false }).eq('id', id)
    setDeleteConfirm(null); await load()
  }

  function openCardAdd() { setEditCardId(null); setCardForm(emptyCard); setShowCardForm(true) }
  function openCardEdit(card: CreditCard) {
    setEditCardId(card.id)
    const stmt = statements.find(s => s.card_id === card.id)
    setCardForm({
      name: card.name, bank: card.bank,
      credit_limit: String((card as any).credit_limit || (card as any).limit_amount || ''),
      currency: (card as any).currency || 'TRY',
      due_day: String(card.due_day || ''),
      statement_day: String(card.statement_day || ''),
      current_spending: stmt ? String(stmt.total_amount || '') : '',
    })
    setShowCardForm(true)
  }
  function closeCardForm() { setShowCardForm(false); setEditCardId(null); setCardForm(emptyCard) }

  async function handleCardSave() {
    if (!cardForm.name || !cardForm.bank) return
    setCardSaving(true)
    const dueDay = parseInt(cardForm.due_day) || 1
    const payload = {
      name: cardForm.name, bank: cardForm.bank,
      credit_limit: parseFloat(cardForm.credit_limit) || 0,
      currency: cardForm.currency,
      due_day: dueDay,
      statement_day: parseInt(cardForm.statement_day) || Math.max(1, dueDay - 10),
      is_active: true,
      ...(userId ? { user_id: userId } : {}),
    }
    let cardId = editCardId
    if (editCardId) { await supabase.from('credit_cards').update(payload).eq('id', editCardId) }
    else {
      const { data: newCard } = await supabase.from('credit_cards').insert(payload).select().single()
      if (newCard) cardId = newCard.id
    }

    const spending = parseFloat(cardForm.current_spending)
    if (cardId && !isNaN(spending) && spending >= 0) {
      const now = new Date()
      const year = now.getFullYear(), month = now.getMonth() + 1
      const existingStmt = statements.find(s => s.card_id === cardId)
      if (existingStmt) {
        await supabase.from('credit_card_statements').update({ total_amount: spending }).eq('id', existingStmt.id)
      } else {
        await supabase.from('credit_card_statements').insert({
          card_id: cardId, period_year: year, period_month: month,
          total_amount: spending, minimum_payment: 0, is_paid: false,
          ...(userId ? { user_id: userId } : {}),
        })
      }
    }

    setCardSaving(false); closeCardForm(); await load()
  }

  async function handleCardDelete(id: number) {
    await supabase.from('credit_cards').update({ is_active: false }).eq('id', id)
    setCardDeleteConfirm(null); await load()
  }

  // Credit card transaction handlers
  function openTxForm(cardId: number) {
    setTxFormCardId(cardId); setTxEditId(null)
    setTxForm({ ...emptyTx, transaction_date: new Date().toISOString().split('T')[0] })
  }
  function openTxEdit(tx: CreditCardTransaction) {
    setTxFormCardId(tx.card_id); setTxEditId(tx.id)
    setTxForm({
      transaction_date: tx.transaction_date,
      description: tx.description,
      category: tx.category,
      amount: String(tx.amount),
      currency: tx.currency,
    })
  }
  function closeTxForm() { setTxFormCardId(null); setTxEditId(null); setTxForm(emptyTx) }

  async function handleTxSave() {
    if (!txFormCardId || !txForm.description || !txForm.amount) return
    setTxSaving(true)
    const now = new Date()
    const amount = parseFloat(txForm.amount) || 0

    // Find or create statement for current month
    let stmt = statements.find(s => s.card_id === txFormCardId)

    const txPayload = {
      card_id: txFormCardId,
      statement_id: stmt?.id || null,
      transaction_date: txForm.transaction_date,
      description: txForm.description,
      category: txForm.category,
      amount,
      currency: txForm.currency,
      ...(userId ? { user_id: userId } : {}),
    }

    if (txEditId) {
      // Get old amount to adjust statement
      const oldTx = transactions.find(t => t.id === txEditId)
      await supabase.from('credit_card_transactions').update(txPayload).eq('id', txEditId)
      // Adjust statement total
      if (stmt && oldTx) {
        const diff = amount - oldTx.amount
        await supabase.from('credit_card_statements').update({
          total_amount: (stmt.total_amount || 0) + diff,
        }).eq('id', stmt.id)
      }
    } else {
      await supabase.from('credit_card_transactions').insert(txPayload)
      // Update statement total
      if (stmt) {
        await supabase.from('credit_card_statements').update({
          total_amount: (stmt.total_amount || 0) + amount,
        }).eq('id', stmt.id)
      } else {
        // Create statement if none exists
        await supabase.from('credit_card_statements').insert({
          card_id: txFormCardId,
          period_year: now.getFullYear(),
          period_month: now.getMonth() + 1,
          total_amount: amount,
          minimum_payment: 0,
          is_paid: false,
          ...(userId ? { user_id: userId } : {}),
        })
      }
    }

    setTxSaving(false); closeTxForm(); await load()
  }

  async function handleTxDelete(txId: number) {
    const tx = transactions.find(t => t.id === txId)
    if (tx) {
      await supabase.from('credit_card_transactions').delete().eq('id', txId)
      // Adjust statement
      const stmt = statements.find(s => s.card_id === tx.card_id)
      if (stmt) {
        await supabase.from('credit_card_statements').update({
          total_amount: Math.max(0, (stmt.total_amount || 0) - tx.amount),
        }).eq('id', stmt.id)
      }
    }
    setTxDeleteConfirm(null); await load()
  }

  function toggleExpand(cardId: number) {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId)
      return next
    })
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setTx = (k: string, v: string) => setTxForm(f => ({ ...f, [k]: v }))
  const inp = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>{label}</label>
      <input value={(form as any)[key]} onChange={e => set(key, e.target.value)} placeholder={placeholder} type={type} className="input" />
    </div>
  )

  const catLabel = (val: string) => EXPENSE_CATEGORIES.find(c => c.value === val)

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>

  return (
    <div className="app-layout">
      <div className="bg-blobs"><div className="bg-blob-3" /><div className="bg-blob-4" /></div>
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        <div className="flex justify-between items-center px-5 pt-5 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold mt-0.5">Krediler & Kartlar</div>
          </div>
          <div className="flex gap-2">
            <button onClick={openCardAdd}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}>
              + Kart
            </button>
            <button onClick={openAdd}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-xl"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              + Kredi
            </button>
          </div>
        </div>

        {/* Hero Card */}
        <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
          <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Toplam Kalan Borc</div>
          <div className="mono text-2xl font-extrabold mt-1" style={{ position: 'relative', zIndex: 2, color: '#ff8a8a' }}>{fmt(totalRemaining)}</div>
          <div className="flex gap-2 mt-4" style={{ position: 'relative', zIndex: 2 }}>
            <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
              style={{ border: '1px solid rgba(255,138,138,0.25)', background: 'rgba(255,138,138,0.08)' }}>
              <div className="text-[9px] font-medium" style={{ color: 'rgba(255,138,138,0.7)' }}>AYLIK ODEME</div>
              <div className="mono text-[12px] font-bold mt-0.5" style={{ color: '#ff8a8a' }}>{fmt(totalMonthly)}</div>
            </div>
            <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
              style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>KREDİ KARTI</div>
              <div className="mono text-[12px] font-bold mt-0.5">{fmt(totalKK)}</div>
            </div>
            {loans.length > 0 && (() => {
              const totalOriginal = loans.reduce((s, l) => s + toTry(l, l.original_amount || 0), 0)
              const totalPaid = totalOriginal - totalRemaining
              const paidPct = totalOriginal > 0 ? Math.round((totalPaid / totalOriginal) * 100) : 0
              return (
                <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                  style={{ border: '1px solid rgba(134,239,172,0.25)', background: 'rgba(134,239,172,0.08)' }}>
                  <div className="text-[9px] font-medium" style={{ color: 'rgba(134,239,172,0.7)' }}>ODENEN</div>
                  <div className="mono text-[12px] font-bold mt-0.5" style={{ color: '#86efac' }}>%{paidPct}</div>
                </div>
              )
            })()}
          </div>
          <div className="text-[10px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)', position: 'relative', zIndex: 2 }}>
            {loans.length} kredi · {cards.length} kart{loans.some(l => l.currency === 'EUR') ? ` · EUR/TRY ${eurTry.toFixed(2)}` : ''}
          </div>
        </div>

        {loans.length === 0 && (
          <div className="mx-4 card p-6 text-center text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Henuz kredi eklenmemis.<br />
            <button onClick={openAdd} className="mt-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>Kredi Ekle</button>
          </div>
        )}

        {(() => {
          const unpaidLoans = loans.filter(l => !paidLoans.some(p => p.notes === `loan_${l.id}` || (p.loan_id && p.loan_id === l.id)))
          const paidLoansList = loans.filter(l => paidLoans.some(p => p.notes === `loan_${l.id}` || (p.loan_id && p.loan_id === l.id)))

          const renderLoanCard = (loan: Loan, isPaid: boolean) => {
            const pct = progressPct(loan)
            const days = loan.payment_day ? daysUntil(loan.payment_day) : null
            return (
              <div key={loan.id} className="card p-4" style={{ borderLeft: isPaid ? '3px solid #4ade9a' : undefined }}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{loan.name}</div>
                    <div className="text-[11px] mt-0.5 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                      {loan.bank} · {loan.type}{loan.collateral && ` · ${loan.collateral}`}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <div className={isPaid ? 'mono text-base font-bold' : 'mono text-base font-bold amt-red'} style={isPaid ? { color: '#4ade9a' } : undefined}>
                        {fmt(loan.monthly_payment, loan.currency)}
                        {loan.currency === 'EUR' && <span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}> ({fmt(loan.monthly_payment * eurTry)})</span>}
                        <span className="text-[11px] font-normal" style={{ color: 'var(--muted)' }}>/ay</span>
                      </div>
                      {isPaid ? (
                        <div className="text-[11px] mt-0.5 font-semibold" style={{ color: '#059669' }}>✓ Bu ay odendi</div>
                      ) : days !== null ? (
                        <div className="text-[11px] mt-0.5" style={{ color: days <= 3 ? '#dc2626' : 'var(--muted)' }}>{daysUntilLabel(days)}</div>
                      ) : null}
                    </div>
                    <div className="flex gap-1 ml-1">
                      <button onClick={() => openEdit(loan)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--bg4)' }}>✏️</button>
                      <button onClick={() => setDeleteConfirm(loan.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                    </div>
                  </div>
                </div>
                <div className="progress-wrap mb-2">
                  <div className="progress-bar" style={{ width: `${pct}%`, background: pct >= 75 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626' }} />
                </div>
                <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                  <span>Kalan: <span className="amt-red font-semibold">{fmt(loan.remaining_amount || 0, loan.currency)}</span>
                    {loan.currency === 'EUR' && <span> ({fmt((loan.remaining_amount || 0) * eurTry)})</span>}
                  </span>
                  {loan.total_installments > 0 && (
                    <span style={{ color: pct >= 75 ? '#059669' : 'var(--muted)' }}>{loan.paid_installments}/{loan.total_installments} taksit</span>
                  )}
                  {loan.end_date && (
                    <span>Bitis: {new Date(loan.end_date).toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' })}</span>
                  )}
                </div>
                {loan.paid_installments > 0 && (
                  <div className="text-[10px] mt-1.5" style={{ color: 'var(--muted)' }}>
                    Toplam Odenen: <span className="amt-green font-semibold">{fmt(loan.paid_installments * loan.monthly_payment, loan.currency)}</span>
                    {loan.currency === 'EUR' && <span> ({fmt(loan.paid_installments * loan.monthly_payment * eurTry)})</span>}
                    <span> · {loan.paid_installments} taksit</span>
                  </div>
                )}
              </div>
            )
          }

          return (
            <>
              {unpaidLoans.length > 0 && (
                <>
                  <div className="px-5 mb-2"><div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>Bekleyen Krediler</div></div>
                  <div className="flex flex-col gap-2 mx-4 mb-4">
                    {unpaidLoans.map(l => renderLoanCard(l, false))}
                  </div>
                </>
              )}
              {paidLoansList.length > 0 && (
                <>
                  <div className="px-5 mb-2 flex items-center gap-2">
                    <div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: '#059669' }}>Odenen Krediler</div>
                    <div className="flex-1 h-px" style={{ background: 'rgba(74,222,154,0.3)' }} />
                    <div className="text-[10px] font-medium" style={{ color: '#059669' }}>{paidLoansList.length} odeme</div>
                  </div>
                  <div className="flex flex-col gap-2 mx-4 mb-4">
                    {paidLoansList.map(l => renderLoanCard(l, true))}
                  </div>
                </>
              )}
            </>
          )
        })()}

        <div className="px-5 mb-2"><div className="text-[12px] uppercase tracking-wide font-semibold" style={{ color: 'var(--muted)' }}>Kredi Kartlari</div></div>

        {totalKK > 0 && (
          <div className="mx-4 mb-2 card px-4 py-3 flex items-center justify-between">
            <div className="text-sm font-semibold">Bu Ay Toplam KK</div>
            <div className="mono text-base font-bold amt-amber">{fmt(totalKK)}</div>
          </div>
        )}

        <div className="flex flex-col gap-2 mx-4">
          {cards.map((card) => {
            const stmt = statements.find(s => s.card_id === card.id)
            const days = card.due_day ? daysUntil(card.due_day) : null
            const cardTxs = transactions.filter(t => t.card_id === card.id).slice(0, 5)
            const isExpanded = expandedCards.has(card.id)
            const isCardPaid = stmt?.is_paid === true
            return (
              <div key={card.id} className="card" style={isCardPaid ? { borderLeft: '3px solid #4ade9a' } : undefined}>
                <div className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isCardPaid ? 'rgba(74,222,154,0.08)' : 'var(--accent-light)' }}>
                    {isCardPaid ? (
                      <span className="text-lg" style={{ color: '#4ade9a' }}>✓</span>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{card.name}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Ekstre: {card.statement_day}'i · Son odeme: {card.due_day}'i</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      {stmt ? (
                        <>
                          <div className={isCardPaid ? 'mono text-sm font-semibold' : 'mono text-sm font-semibold amt-amber'} style={isCardPaid ? { color: '#4ade9a' } : undefined}>{fmt(stmt.total_amount)}</div>
                          {isCardPaid ? (
                            <div className="text-[11px] mt-0.5 font-semibold" style={{ color: '#059669' }}>✓ Odendi</div>
                          ) : (
                            <div className="text-[11px] mt-0.5" style={{ color: days && days <= 3 ? '#dc2626' : 'var(--muted)' }}>{days !== null ? daysUntilLabel(days) : ''}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-[11px]" style={{ color: 'var(--muted)' }}>ekstre girilmedi</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openCardEdit(card)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--bg4)' }}>✏️</button>
                      <button onClick={() => setCardDeleteConfirm(card.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  <button onClick={() => openTxForm(card.id)}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(13,148,136,0.08)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.2)' }}>
                    + Harcama Ekle
                  </button>
                  <OcrUpload cardId={card.id} onComplete={load} />
                  {cardTxs.length > 0 && (
                    <button onClick={() => toggleExpand(card.id)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg"
                      style={{ background: 'var(--bg4)', color: 'var(--muted)' }}>
                      {isExpanded ? 'Gizle' : `Son ${cardTxs.length} islem`}
                    </button>
                  )}
                </div>

                {/* Collapsible transactions */}
                {isExpanded && cardTxs.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {cardTxs.map(tx => {
                      const cat = catLabel(tx.category)
                      return (
                        <div key={tx.id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                          <div className="text-[13px] flex-shrink-0" style={{ width: 24, textAlign: 'center' }}>{cat?.icon || '📦'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium truncate">{tx.description}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>
                              {new Date(tx.transaction_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                              {cat && <span> · {cat.label}</span>}
                            </div>
                          </div>
                          <div className="mono text-[13px] font-semibold amt-red flex-shrink-0">{fmt(tx.amount, tx.currency)}</div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openTxEdit(tx)} className="w-6 h-6 rounded flex items-center justify-center text-[10px]" style={{ background: 'var(--bg4)' }}>✏️</button>
                            <button onClick={() => setTxDeleteConfirm(tx.id)} className="w-6 h-6 rounded flex items-center justify-center text-[10px]" style={{ background: 'rgba(220,38,38,0.06)' }}>🗑️</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Delete Loan Confirm */}
        {deleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Krediyi Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu krediyi silmek istediginize emin misiniz?</div>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1 py-2.5 text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Transaction Confirm */}
        {txDeleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Harcamayi Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu harcamayi silmek istediginize emin misiniz?</div>
              <div className="flex gap-2">
                <button onClick={() => setTxDeleteConfirm(null)} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={() => handleTxDelete(txDeleteConfirm)} className="btn-danger flex-1 py-2.5 text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}

        {/* Loan Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editId ? 'Krediyi Duzenle' : 'Yeni Kredi'}</div>
                <button onClick={closeForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                {inp('Kredi Adi', 'name', 'text', 'Orn: Mercedes Kredi')}
                <div className="flex gap-3">
                  {inp('Banka', 'bank', 'text', 'Orn: Garanti')}
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={form.type} onChange={e => set('type', e.target.value)} className="input">
                      <option value="ihtiyac">Ihtiyac</option><option value="tasit">Tasit</option>
                      <option value="konut">Konut</option><option value="ticari">Ticari</option><option value="diger">Diger</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                  {inp('Faiz %', 'interest_rate', 'number', '0')}
                </div>
                <div className="flex gap-3">{inp('Orijinal Tutar', 'original_amount', 'number', '0')}{inp('Kalan Tutar', 'remaining_amount', 'number', '0')}</div>
                <div className="flex gap-3">{inp('Aylik Odeme', 'monthly_payment', 'number', '0')}{inp('Odeme Gunu', 'payment_day', 'number', '1-31')}</div>
                <div className="flex gap-3">{inp('Toplam Taksit', 'total_installments', 'number', '0')}{inp('Odenen Taksit', 'paid_installments', 'number', '0')}</div>
                <div className="flex gap-3">{inp('Baslangic', 'start_date', 'date')}{inp('Bitis', 'end_date', 'date')}</div>
                {inp('Teminat', 'collateral', 'text', 'Orn: Arac rehni')}
                {inp('Notlar', 'notes', 'text')}
              </div>
              <button onClick={handleSave} disabled={saving || !form.name || !form.bank || !form.monthly_payment}
                className="btn-primary w-full mt-4 py-3">{saving ? 'Kaydediliyor...' : editId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}

        {/* Transaction Form Modal */}
        {txFormCardId !== null && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{txEditId ? 'Harcamayi Duzenle' : 'Yeni Harcama'}</div>
                <button onClick={closeTxForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tarih</label>
                  <input value={txForm.transaction_date} onChange={e => setTx('transaction_date', e.target.value)} type="date" className="input" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Aciklama</label>
                  <input value={txForm.description} onChange={e => setTx('description', e.target.value)} placeholder="Orn: Migros alisveris" className="input" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kategori</label>
                  <select value={txForm.category} onChange={e => setTx('category', e.target.value)} className="input">
                    <option value="">Secin...</option>
                    {CATEGORY_GROUPS.map(group => (
                      <optgroup key={group} label={group}>
                        {EXPENSE_CATEGORIES.filter(c => c.group === group).map(c => (
                          <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                    <input value={txForm.amount} onChange={e => setTx('amount', e.target.value)} type="number" placeholder="0" className="input" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Para Birimi</label>
                    <select value={txForm.currency} onChange={e => setTx('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={handleTxSave} disabled={txSaving || !txForm.description || !txForm.amount}
                className="btn-primary w-full mt-4 py-3">{txSaving ? 'Kaydediliyor...' : txEditId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}
        {/* Card Form Modal */}
        {showCardForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editCardId ? 'Karti Duzenle' : 'Yeni Kredi Karti'}</div>
                <button onClick={closeCardForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kart Adi</label>
                    <input value={cardForm.name} onChange={e => setCardForm(f => ({ ...f, name: e.target.value }))} placeholder="Orn: Bonus, Miles" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Banka</label>
                    <input value={cardForm.bank} onChange={e => setCardForm(f => ({ ...f, bank: e.target.value }))} placeholder="Orn: Garanti" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Limit</label>
                    <input value={cardForm.credit_limit} onChange={e => setCardForm(f => ({ ...f, credit_limit: e.target.value }))} type="number" placeholder="0" className="input mono" />
                  </div>
                  <div className="w-28">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={cardForm.currency} onChange={e => setCardForm(f => ({ ...f, currency: e.target.value }))} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Son Odeme Gunu</label>
                    <input value={cardForm.due_day} onChange={e => setCardForm(f => ({ ...f, due_day: e.target.value }))} type="number" placeholder="1-31" min="1" max="31" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Ekstre Gunu</label>
                    <input value={cardForm.statement_day} onChange={e => setCardForm(f => ({ ...f, statement_day: e.target.value }))} type="number" placeholder="1-31" min="1" max="31" className="input" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: '#d97706' }}>Bu Ay Harcama Tutari</label>
                  <input value={cardForm.current_spending} onChange={e => setCardForm(f => ({ ...f, current_spending: e.target.value }))} type="number" placeholder="Toplam ekstre tutari" className="input mono" style={{ borderColor: 'rgba(217,119,6,0.3)' }} />
                  <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>Bu ayin toplam kredi karti borcunu girin. Dashboard'da gorunur.</div>
                </div>
              </div>
              <button onClick={handleCardSave} disabled={cardSaving || !cardForm.name || !cardForm.bank}
                className="btn-primary w-full mt-4 py-3">{cardSaving ? 'Kaydediliyor...' : editCardId ? 'Guncelle' : 'Ekle'}</button>
            </div>
          </div>
        )}

        {/* Delete Card Confirm */}
        {cardDeleteConfirm !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <div className="card p-5 w-full max-w-sm">
              <div className="text-sm font-semibold mb-2">Karti Sil</div>
              <div className="text-[13px] mb-4" style={{ color: 'var(--muted)' }}>Bu karti silmek istediginize emin misiniz?</div>
              <div className="flex gap-2">
                <button onClick={() => setCardDeleteConfirm(null)} className="btn-outline flex-1 py-2.5 text-sm">Iptal</button>
                <button onClick={() => handleCardDelete(cardDeleteConfirm)} className="btn-danger flex-1 py-2.5 text-sm">Sil</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
