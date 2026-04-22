'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, isDemo } from '@/lib/supabase'
import type { Account, ExchangeRate, DebtRecord, Investment } from '@/lib/supabase'
import { IconWallet, IconTrendUp, IconArrowsExchange, IconPlus } from '@/components/Icons'

type Tab = 'hesaplar' | 'yatirimlar' | 'alacak'

type InvestmentWithSnapshot = Investment & {
  latest_price?: number
  total_value?: number
  total_value_try?: number
  cost_basis?: number
  pnl?: number
  pnl_pct?: number
  snapshot_date?: string
}

const emptyInvForm = { name: '', type: 'hisse', symbol: '', quantity: '', avg_cost: '', currency: 'TRY', platform: '', current_price: '' }
const emptyDebtForm = { person_name: '', type: 'alacak' as 'alacak' | 'verecek', amount: '', currency: 'TRY', description: '', due_date: '' }
const emptyAccForm = { name: '', bank: '', type: 'vadesiz', currency: 'TRY', balance: '' }

// Mock data
const MOCK_ACCOUNTS: Account[] = [
  { id: 1, name: 'Ziraat TL', bank: 'Ziraat', type: 'vadesiz', currency: 'TRY', balance: 45200, is_active: true, updated_at: '' },
  { id: 2, name: 'Garanti EUR', bank: 'Garanti', type: 'vadesiz', currency: 'EUR', balance: 3200, is_active: true, updated_at: '' },
  { id: 3, name: 'Is Bankasi USD', bank: 'Is Bankasi', type: 'vadesiz', currency: 'USD', balance: 1500, is_active: true, updated_at: '' },
  { id: 4, name: 'Vakifbank Vadeli', bank: 'Vakifbank', type: 'vadeli', currency: 'TRY', balance: 120000, is_active: true, updated_at: '' },
]
const MOCK_INVESTMENTS: InvestmentWithSnapshot[] = [
  { id: 1, name: 'BIST Hisse', type: 'hisse', symbol: 'BIST', quantity: 100, avg_cost: 488, currency: 'TRY', platform: 'Midas', is_active: true, total_value: 52000, cost_basis: 48800, pnl: 3200, pnl_pct: 6.5 },
  { id: 2, name: 'Bitcoin', type: 'kripto', symbol: 'BTC', quantity: 0.1, avg_cost: 73000, currency: 'USD', platform: 'Binance', is_active: true, total_value: 8500, cost_basis: 7300, pnl: 1200, pnl_pct: 16.4 },
  { id: 3, name: 'Altin', type: 'altin', symbol: 'XAU', quantity: 10, avg_cost: 3380, currency: 'TRY', platform: 'Ziraat', is_active: true, total_value: 33000, cost_basis: 33800, pnl: -800, pnl_pct: -2.4 },
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
  const [investments, setInvestments] = useState<InvestmentWithSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set())
  const [userId, setUserId] = useState<string | null>(null)

  // Investment edit/delete state
  const [editInv, setEditInv] = useState<InvestmentWithSnapshot | null>(null)
  const [invForm, setInvForm] = useState(emptyInvForm)
  const [invSaving, setInvSaving] = useState(false)
  const [invDeleteConfirm, setInvDeleteConfirm] = useState(false)

  // Debt edit/delete state
  const [editDebt, setEditDebt] = useState<DebtRecord | null>(null)
  const [debtForm, setDebtForm] = useState(emptyDebtForm)
  const [debtSaving, setDebtSaving] = useState(false)
  const [debtDeleteConfirm, setDebtDeleteConfirm] = useState(false)

  // Tahsilat modal state
  const [collectModal, setCollectModal] = useState<DebtRecord | null>(null)
  const [collectAmount, setCollectAmount] = useState('')
  const [collectAccountId, setCollectAccountId] = useState<number | ''>('')
  const [collecting, setCollecting] = useState(false)

  // Account edit state
  const [editAcc, setEditAcc] = useState<Account | null>(null)
  const [showAccForm, setShowAccForm] = useState(false)
  const [accForm, setAccForm] = useState(emptyAccForm)
  const [accSaving, setAccSaving] = useState(false)
  const [accDeleteConfirm, setAccDeleteConfirm] = useState(false)

  async function loadData() {
    if (isDemo) {
      setAccounts(MOCK_ACCOUNTS)
      setRates(MOCK_RATES)
      setDebts(MOCK_DEBTS)
      setInvestments(MOCK_INVESTMENTS)
      setLoading(false)
      return
    }
    const [{ data: acc }, { data: rt }, { data: dbt }, { data: inv }, { data: snaps }] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true).order('bank'),
      supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      supabase.from('debt_records').select('*').eq('is_settled', false),
      supabase.from('investments').select('*').eq('is_active', true),
      supabase.from('investment_snapshots').select('*').order('snapshot_date', { ascending: false }),
    ])
    const currentRates = rt?.[0] || null
    setAccounts(acc || [])
    setRates(currentRates)
    setDebts(dbt || [])

    // Enrich investments with snapshot data
    const enriched = (inv || []).map((i: Investment) => {
      const snap = (snaps || []).find((s: any) => s.investment_id === i.id)
      const costBasis = (i.avg_cost || 0) * (i.quantity || 0)
      const currentVal = snap?.total_value || costBasis
      const pnl = currentVal - costBasis
      const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
      let totalValueTry = snap?.total_value_try
      if (!totalValueTry && currentRates) {
        if (i.currency === 'EUR') totalValueTry = currentVal * (currentRates.eur_try || 1)
        else if (i.currency === 'USD') totalValueTry = currentVal * (currentRates.usd_try || 1)
        else totalValueTry = currentVal
      }
      return { ...i, latest_price: snap?.price, total_value: currentVal, total_value_try: totalValueTry || currentVal, cost_basis: costBasis, pnl, pnl_pct: pnlPct, snapshot_date: snap?.snapshot_date }
    })
    setInvestments(enriched)

    // Expand all banks by default
    const banks = new Set((acc || []).map((a: Account) => a.bank))
    setExpandedBanks(banks)
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null)
    })
    loadData()
  }, [])

  // Account CRUD
  function openAccAdd() { setEditAcc(null); setAccForm(emptyAccForm); setShowAccForm(true); setAccDeleteConfirm(false) }
  function openAccEdit(acc: Account) {
    setEditAcc(acc)
    setAccForm({ name: acc.name, bank: acc.bank, type: acc.type, currency: acc.currency, balance: String(acc.balance) })
    setShowAccForm(true); setAccDeleteConfirm(false)
  }
  function closeAccForm() { setShowAccForm(false); setEditAcc(null); setAccForm(emptyAccForm); setAccDeleteConfirm(false) }
  async function handleAccSave() {
    if (!accForm.name || !accForm.bank) return
    setAccSaving(true)
    const payload = { name: accForm.name, bank: accForm.bank, type: accForm.type, currency: accForm.currency, balance: parseFloat(accForm.balance) || 0, is_active: true, ...(userId ? { user_id: userId } : {}) }
    if (!isDemo) {
      if (editAcc) { await supabase.from('accounts').update(payload).eq('id', editAcc.id) }
      else { await supabase.from('accounts').insert(payload) }
    }
    setAccSaving(false); closeAccForm(); await loadData()
  }
  async function handleAccDelete() {
    if (!editAcc) return
    setAccSaving(true)
    if (!isDemo) await supabase.from('accounts').update({ is_active: false }).eq('id', editAcc.id)
    setAccSaving(false); closeAccForm(); await loadData()
  }
  const setAcc = (k: string, v: string) => setAccForm(f => ({ ...f, [k]: v }))

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

  // Investment edit handlers
  function openInvEdit(inv: InvestmentWithSnapshot) {
    setEditInv(inv)
    const currentPrice = inv.latest_price || (inv.total_value && inv.quantity ? inv.total_value / inv.quantity : 0)
    setInvForm({ name: inv.name, type: inv.type, symbol: inv.symbol || '', quantity: String(inv.quantity || ''), avg_cost: String(inv.avg_cost || ''), currency: inv.currency, platform: inv.platform || '', current_price: currentPrice ? String(currentPrice) : '' })
    setInvDeleteConfirm(false)
  }
  function closeInvEdit() { setEditInv(null); setInvForm(emptyInvForm); setInvDeleteConfirm(false) }

  async function handleInvSave() {
    if (!editInv || !invForm.name || !invForm.quantity) return
    if (isDemo) { closeInvEdit(); return }
    setInvSaving(true)
    const qty = parseFloat(invForm.quantity) || 0
    const avgCost = parseFloat(invForm.avg_cost) || 0
    const currentPrice = parseFloat(invForm.current_price) || 0
    const payload = { name: invForm.name, type: invForm.type, symbol: invForm.symbol || null, quantity: qty, avg_cost: avgCost, currency: invForm.currency, platform: invForm.platform || null, is_active: true }
    await supabase.from('investments').update(payload).eq('id', editInv.id)
    // Update or insert snapshot with current price
    if (currentPrice > 0) {
      const totalValue = currentPrice * qty
      const today = new Date().toISOString().split('T')[0]
      const totalValueTry = invForm.currency === 'EUR' ? totalValue * eurTry : invForm.currency === 'USD' ? totalValue * usdTry : totalValue
      // Upsert: delete old snapshot for this investment, insert new one
      await supabase.from('investment_snapshots').delete().eq('investment_id', editInv.id)
      await supabase.from('investment_snapshots').insert({
        investment_id: editInv.id, snapshot_date: today, price: currentPrice,
        total_value: totalValue, total_value_try: totalValueTry,
        ...(userId ? { user_id: userId } : {}),
      })
    }
    setInvSaving(false); closeInvEdit(); await loadData()
  }

  async function handleInvDelete() {
    if (!editInv) return
    if (isDemo) { closeInvEdit(); return }
    await supabase.from('investments').update({ is_active: false }).eq('id', editInv.id)
    closeInvEdit(); await loadData()
  }

  // Debt edit handlers
  function openDebtEdit(d: DebtRecord) {
    setEditDebt(d)
    setDebtForm({ person_name: d.person_name, type: d.type, amount: String(d.amount), currency: d.currency, description: d.description || '', due_date: d.due_date || '' })
    setDebtDeleteConfirm(false)
  }
  function closeDebtEdit() { setEditDebt(null); setDebtForm(emptyDebtForm); setDebtDeleteConfirm(false) }

  async function handleDebtSave() {
    if (!editDebt || !debtForm.person_name || !debtForm.amount) return
    if (isDemo) { closeDebtEdit(); return }
    setDebtSaving(true)
    const payload = { person_name: debtForm.person_name, type: debtForm.type, amount: parseFloat(debtForm.amount) || 0, currency: debtForm.currency, description: debtForm.description || null, due_date: debtForm.due_date || null }
    await supabase.from('debt_records').update(payload).eq('id', editDebt.id)
    setDebtSaving(false); closeDebtEdit(); await loadData()
  }

  async function handleDebtDelete() {
    if (!editDebt) return
    if (isDemo) { closeDebtEdit(); return }
    await supabase.from('debt_records').delete().eq('id', editDebt.id)
    closeDebtEdit(); await loadData()
  }

  const setInv = (k: string, v: string) => setInvForm(f => ({ ...f, [k]: v }))
  const setDbt = (k: string, v: string) => setDebtForm(f => ({ ...f, [k]: v }))

  async function handleCollect() {
    if (!collectModal || !collectAmount) return
    setCollecting(true)
    const amt = parseFloat(collectAmount) || 0
    const newPaid = (collectModal.paid_amount || 0) + amt
    const newRemaining = collectModal.amount - amt
    const isSettled = newRemaining <= 0

    const { error } = await supabase.from('debt_records').update({
      amount: Math.max(0, newRemaining),
      paid_amount: newPaid,
      is_settled: isSettled,
    }).eq('id', collectModal.id)
    if (error) { alert('Hata: ' + error.message); setCollecting(false); return }

    // Hesap bakiyesini güncelle
    if (collectAccountId) {
      const acc = accounts.find(a => a.id === collectAccountId)
      if (acc) {
        const newBalance = collectModal.type === 'alacak' ? acc.balance + amt : acc.balance - amt
        await supabase.from('accounts').update({ balance: Math.max(0, newBalance) }).eq('id', collectAccountId)
      }
    }

    setCollecting(false)
    setCollectModal(null); setCollectAmount(''); setCollectAccountId('')
    await loadData()
  }

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: 'hesaplar', label: 'Hesaplar', Icon: IconWallet },
    { key: 'yatirimlar', label: 'Yatirimlar', Icon: IconTrendUp },
    { key: 'alacak', label: 'Alacak/Borc', Icon: IconArrowsExchange },
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
                          <div key={a.id} onClick={() => openAccEdit(a)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:brightness-95 transition-all"
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

            {/* Add account button */}
            <button onClick={openAccAdd}
              className="w-full mt-3 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: 'var(--accent-light)', color: 'var(--primary)', border: '1.5px dashed var(--border2)' }}>
              <IconPlus size={16} color="var(--primary)" strokeWidth={2.5} />
              Yeni Hesap Ekle
            </button>
          </>
        )}

        {/* Account Form Modal */}
        {showAccForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) closeAccForm() }}>
            <div className="glass-bold slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">{editAcc ? 'Hesabi Duzenle' : 'Yeni Hesap'}</div>
                <button onClick={closeAccForm} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hesap Adi</label>
                  <input value={accForm.name} onChange={e => setAcc('name', e.target.value)} placeholder="Orn: Ziraat TL" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Banka</label>
                    <input value={accForm.bank} onChange={e => setAcc('bank', e.target.value)} placeholder="Orn: Ziraat" className="input" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={accForm.type} onChange={e => setAcc('type', e.target.value)} className="input">
                      <option value="vadesiz">Vadesiz</option><option value="vadeli">Vadeli</option><option value="yatirim">Yatirim</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Bakiye</label>
                    <input value={accForm.balance} onChange={e => setAcc('balance', e.target.value)} type="number" placeholder="0" className="input mono" />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={accForm.currency} onChange={e => setAcc('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={handleAccSave} disabled={accSaving || !accForm.name || !accForm.bank}
                className="btn-primary w-full mt-4 py-3">{accSaving ? 'Kaydediliyor...' : editAcc ? 'Guncelle' : 'Ekle'}</button>
              {editAcc && !accDeleteConfirm && (
                <button onClick={() => setAccDeleteConfirm(true)} className="w-full mt-2 py-2.5 text-sm font-medium" style={{ color: '#e5484d', background: 'transparent', border: 'none', cursor: 'pointer' }}>Hesabi Sil</button>
              )}
              {accDeleteConfirm && (
                <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(229,72,77,0.06)' }}>
                  <div className="text-[12px] mb-2 font-medium" style={{ color: '#e5484d' }}>Bu hesabi silmek istediginize emin misiniz?</div>
                  <div className="flex gap-2">
                    <button onClick={() => setAccDeleteConfirm(false)} className="btn-outline flex-1 py-2 text-xs">Iptal</button>
                    <button onClick={handleAccDelete} className="btn-danger flex-1 py-2 text-xs">Sil</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== TAB: YATIRIMLAR ===== */}
        {tab === 'yatirimlar' && (() => {
          const totalPortfoy = investments.reduce((s, i) => s + (i.total_value_try || toTry(i.total_value || 0, i.currency)), 0)
          const totalCost = investments.reduce((s, i) => s + toTry(i.cost_basis || 0, i.currency), 0)
          const totalPnl = totalPortfoy - totalCost
          const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0
          const winners = investments.filter(i => (i.pnl || 0) >= 0).length
          const losers = investments.filter(i => (i.pnl || 0) < 0).length
          return (
          <>
            <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
              <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Toplam Portfoy</div>
              <div className="mono text-2xl font-extrabold mt-1" style={{ position: 'relative', zIndex: 2 }}>
                {fmt(totalPortfoy)}
              </div>
              {/* P&L Summary */}
              <div className="flex gap-2 mt-4" style={{ position: 'relative', zIndex: 2 }}>
                <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)' }}>
                  <div className="text-[9px] font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>MALİYET</div>
                  <div className="mono text-[11px] font-bold mt-0.5">{fmt(totalCost)}</div>
                </div>
                <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                  style={{ border: `1px solid ${totalPnl >= 0 ? 'rgba(134,239,172,0.25)' : 'rgba(255,138,138,0.25)'}`, background: totalPnl >= 0 ? 'rgba(134,239,172,0.08)' : 'rgba(255,138,138,0.08)' }}>
                  <div className="text-[9px] font-medium" style={{ color: totalPnl >= 0 ? 'rgba(134,239,172,0.7)' : 'rgba(255,138,138,0.7)' }}>
                    {totalPnl >= 0 ? 'KAR' : 'ZARAR'}
                  </div>
                  <div className="mono text-[11px] font-bold mt-0.5" style={{ color: totalPnl >= 0 ? '#86efac' : '#ff8a8a' }}>
                    {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                  </div>
                </div>
                <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                  style={{ border: `1px solid ${totalPnl >= 0 ? 'rgba(134,239,172,0.25)' : 'rgba(255,138,138,0.25)'}`, background: totalPnl >= 0 ? 'rgba(134,239,172,0.08)' : 'rgba(255,138,138,0.08)' }}>
                  <div className="text-[9px] font-medium" style={{ color: totalPnl >= 0 ? 'rgba(134,239,172,0.7)' : 'rgba(255,138,138,0.7)' }}>
                    GETIRI
                  </div>
                  <div className="mono text-[11px] font-bold mt-0.5" style={{ color: totalPnl >= 0 ? '#86efac' : '#ff8a8a' }}>
                    {totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="text-[10px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)', position: 'relative', zIndex: 2 }}>
                {investments.length} yatirim · {winners} karda · {losers} zararda
              </div>
            </div>

            <div className="flex flex-col gap-2 mx-4">
              {investments.map(inv => {
                const pnl = inv.pnl || 0
                const pnlPct = inv.pnl_pct || 0
                const currentVal = inv.total_value || 0
                return (
                  <div key={inv.id} className="tx-item" style={{ cursor: 'pointer' }} onClick={() => openInvEdit(inv)}>
                    <div className="tx-icon" style={{ background: pnl >= 0 ? 'rgba(48,164,108,0.06)' : 'rgba(229,72,77,0.06)' }}>
                      <IconTrendUp color={pnl >= 0 ? '#30a46c' : '#e5484d'} size={18} />
                    </div>
                    <div className="tx-info">
                      <div className="tx-name">{inv.name}</div>
                      <div className="tx-detail">{inv.platform || '—'} · {inv.type}</div>
                    </div>
                    <div className="tx-amount">
                      <div className="tx-value">{fmt(currentVal, inv.currency)}</div>
                      <div className="tx-badge" style={{ background: pnl >= 0 ? 'rgba(48,164,108,0.08)' : 'rgba(229,72,77,0.08)', color: pnl >= 0 ? '#30a46c' : '#e5484d' }}>
                        {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ); })()}

        {/* ===== TAB: ALACAK / BORC ===== */}
        {tab === 'alacak' && (() => {
          const totalAlacak = alacaklar.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
          const totalVerecek = verecekler.reduce((s, d) => s + toTry(d.amount, d.currency), 0)
          const netBalance = totalAlacak - totalVerecek
          const overdueAlacak = alacaklar.filter(d => d.due_date && new Date(d.due_date) < new Date()).length
          const upcomingAlacak = alacaklar.filter(d => d.due_date && new Date(d.due_date) >= new Date()).length
          return (
          <>
            {/* Hero card */}
            <div className="mx-4 mb-4 card-hero p-5" style={{ position: 'relative', zIndex: 1 }}>
              <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 2 }}>Net Bakiye</div>
              <div className="mono text-2xl font-extrabold mt-1" style={{ position: 'relative', zIndex: 2, color: netBalance >= 0 ? '#86efac' : '#ff8a8a' }}>
                {netBalance >= 0 ? '+' : ''}{fmt(netBalance)}
              </div>
              <div className="flex gap-2 mt-4" style={{ position: 'relative', zIndex: 2 }}>
                <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                  style={{ border: '1px solid rgba(134,239,172,0.25)', background: 'rgba(134,239,172,0.08)' }}>
                  <div className="text-[9px] font-medium" style={{ color: 'rgba(134,239,172,0.7)' }}>ALACAK</div>
                  <div className="mono text-[12px] font-bold mt-0.5" style={{ color: '#86efac' }}>{fmt(totalAlacak)}</div>
                  <div className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{alacaklar.length} kisi</div>
                </div>
                <div className="flex-1 rounded-2xl py-2.5 px-3 text-center"
                  style={{ border: '1px solid rgba(255,138,138,0.25)', background: 'rgba(255,138,138,0.08)' }}>
                  <div className="text-[9px] font-medium" style={{ color: 'rgba(255,138,138,0.7)' }}>BORC</div>
                  <div className="mono text-[12px] font-bold mt-0.5" style={{ color: '#ff8a8a' }}>{fmt(totalVerecek)}</div>
                  <div className="text-[8px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{verecekler.length} kisi</div>
                </div>
              </div>
              {(overdueAlacak > 0 || upcomingAlacak > 0) && (
                <div className="text-[10px] mt-3 text-center" style={{ color: 'rgba(255,255,255,0.35)', position: 'relative', zIndex: 2 }}>
                  {overdueAlacak > 0 && <span style={{ color: 'rgba(255,138,138,0.7)' }}>{overdueAlacak} gecikmiş</span>}
                  {overdueAlacak > 0 && upcomingAlacak > 0 && ' · '}
                  {upcomingAlacak > 0 && <span>{upcomingAlacak} yaklaşan</span>}
                </div>
              )}
            </div>

            {/* Alacaklar */}
            {alacaklar.length > 0 && (
              <>
                <div className="mx-5 mb-2 text-xs font-bold" style={{ color: '#30a46c' }}>Alacaklar</div>
                <div className="flex flex-col gap-2 mx-4 mb-4">
                  {alacaklar.map(d => {
                    const paidAmt = d.paid_amount || 0
                    const totalAmt = d.total_amount || (paidAmt + d.amount)
                    const paidPct = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0
                    return (
                      <div key={d.id} className="tx-item" style={{ cursor: 'pointer' }}>
                        <div className="tx-icon" style={{ background: 'rgba(48,164,108,0.06)' }} onClick={() => openDebtEdit(d)}>
                          <span className="text-sm font-bold" style={{ color: '#30a46c' }}>{d.person_name.charAt(0)}</span>
                        </div>
                        <div className="tx-info" onClick={() => openDebtEdit(d)}>
                          <div className="tx-name">{d.person_name}</div>
                          <div className="tx-detail">
                            {d.description || 'Alacak'}{d.is_recurring ? ' · Düzenli' : ''}
                            {paidAmt > 0 && <span style={{ color: '#f97316', marginLeft: 4 }}>· %{paidPct} tahsil</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="tx-amount" onClick={() => openDebtEdit(d)}>
                            <div className="tx-value amt-green">+{fmt(d.amount, d.currency)}</div>
                            {d.due_date && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{new Date(d.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); setCollectModal(d); setCollectAmount(String(d.amount)); setCollectAccountId('') }}
                            className="flex-shrink-0 rounded-lg text-[10px] font-bold"
                            style={{ padding: '5px 9px', background: '#059669', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>
                            💰 Tahsil
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Verecekler */}
            {verecekler.length > 0 && (
              <>
                <div className="mx-5 mb-2 text-xs font-bold" style={{ color: '#e5484d' }}>Borclar</div>
                <div className="flex flex-col gap-2 mx-4 mb-4">
                  {verecekler.map(d => (
                    <div key={d.id} className="tx-item" style={{ cursor: 'pointer' }}>
                      <div className="tx-icon" style={{ background: 'rgba(229,72,77,0.06)' }} onClick={() => openDebtEdit(d)}>
                        <span className="text-sm font-bold" style={{ color: '#e5484d' }}>{d.person_name.charAt(0)}</span>
                      </div>
                      <div className="tx-info" onClick={() => openDebtEdit(d)}>
                        <div className="tx-name">{d.person_name}</div>
                        <div className="tx-detail">{d.description || 'Verecek'}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="tx-amount" onClick={() => openDebtEdit(d)}>
                          <div className="tx-value amt-red">-{fmt(d.amount, d.currency)}</div>
                          {d.due_date && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{new Date(d.due_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</div>}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setCollectModal(d); setCollectAmount(String(d.amount)); setCollectAccountId('') }}
                          className="flex-shrink-0 rounded-lg text-[10px] font-bold"
                          style={{ padding: '5px 9px', background: '#dc2626', color: '#fff', border: 'none', whiteSpace: 'nowrap' }}>
                          💸 Öde
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ); })()}
        {/* ===== INVESTMENT EDIT MODAL ===== */}
        {editInv && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }} onClick={closeInvEdit}>
            <div className="glass-bold slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">Yatirimi Duzenle</div>
                <button onClick={closeInvEdit} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Yatirim Adi</label>
                  <input value={invForm.name} onChange={e => setInv('name', e.target.value)} className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={invForm.type} onChange={e => setInv('type', e.target.value)} className="input">
                      <option value="hisse">Hisse</option><option value="fon">Fon</option><option value="altin">Altin</option>
                      <option value="doviz">Doviz</option><option value="kripto">Kripto</option><option value="diger">Diger</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Sembol</label>
                    <input value={invForm.symbol} onChange={e => setInv('symbol', e.target.value)} className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Miktar</label>
                    <input value={invForm.quantity} onChange={e => setInv('quantity', e.target.value)} type="number" step="any" className="input mono" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Ort. Maliyet</label>
                    <input value={invForm.avg_cost} onChange={e => setInv('avg_cost', e.target.value)} type="number" step="any" className="input mono" />
                  </div>
                </div>
                {/* Current price */}
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Guncel Fiyat (Birim)</label>
                  <input value={invForm.current_price} onChange={e => setInv('current_price', e.target.value)} type="number" step="any" className="input mono"
                    placeholder={editInv?.latest_price ? `Son: ${editInv.latest_price}` : 'Guncel fiyati girin'} />
                </div>

                {/* Live P&L calculation card */}
                {(() => {
                  const qty = parseFloat(invForm.quantity) || 0
                  const avgCost = parseFloat(invForm.avg_cost) || 0
                  const curPrice = parseFloat(invForm.current_price) || 0
                  const costBasis = qty * avgCost
                  const currentValue = curPrice > 0 ? qty * curPrice : 0
                  const pnl = currentValue - costBasis
                  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
                  if (qty <= 0 || avgCost <= 0) return null
                  return (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg4)', border: '1px solid var(--border)' }}>
                      <div className="text-[9px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted)' }}>Canli Hesaplama</div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span style={{ color: 'var(--muted)' }}>Maliyet</span>
                        <span className="mono font-bold">{fmt(costBasis, invForm.currency)}</span>
                      </div>
                      {curPrice > 0 && (
                        <>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span style={{ color: 'var(--muted)' }}>Guncel Deger</span>
                            <span className="mono font-bold">{fmt(currentValue, invForm.currency)}</span>
                          </div>
                          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6 }} className="flex justify-between text-[11px]">
                            <span className="font-semibold" style={{ color: pnl >= 0 ? '#30a46c' : '#e5484d' }}>
                              {pnl >= 0 ? 'Kar' : 'Zarar'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="mono font-bold" style={{ color: pnl >= 0 ? '#30a46c' : '#e5484d' }}>
                                {pnl >= 0 ? '+' : ''}{fmt(pnl, invForm.currency)}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: pnl >= 0 ? 'rgba(48,164,108,0.1)' : 'rgba(229,72,77,0.1)', color: pnl >= 0 ? '#30a46c' : '#e5484d' }}>
                                {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={invForm.currency} onChange={e => setInv('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Platform</label>
                    <input value={invForm.platform} onChange={e => setInv('platform', e.target.value)} className="input" />
                  </div>
                </div>

                {editInv?.snapshot_date && (
                  <div className="text-[10px] text-right" style={{ color: 'var(--muted)' }}>
                    Son guncelleme: {new Date(editInv.snapshot_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
              <button onClick={handleInvSave} disabled={invSaving || !invForm.name || !invForm.quantity}
                className="btn-primary w-full mt-4 py-3">{invSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              {!invDeleteConfirm ? (
                <button onClick={() => setInvDeleteConfirm(true)}
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: 'none' }}
                  className="w-full mt-2 py-3 rounded-xl text-sm font-semibold">Sil</button>
              ) : (
                <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
                  <div className="text-[12px] font-medium mb-2 text-center" style={{ color: '#dc2626' }}>Bu yatirimi silmek istediginize emin misiniz?</div>
                  <div className="flex gap-2">
                    <button onClick={() => setInvDeleteConfirm(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--bg4)', color: 'var(--text)' }}>Iptal</button>
                    <button onClick={handleInvDelete} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: '#dc2626', color: '#fff' }}>Evet, Sil</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== DEBT EDIT MODAL ===== */}
        {/* ===== TAHSİLAT MODAL ===== */}
        {collectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}>
            <div className="glass-bold p-5 w-full max-w-sm rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: collectModal.type === 'alacak' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)' }}>
                  {collectModal.type === 'alacak' ? '💰' : '💸'}
                </div>
                <div>
                  <div className="text-sm font-bold">{collectModal.type === 'alacak' ? 'Tahsilat Al' : 'Ödeme Yap'}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{collectModal.person_name}</div>
                </div>
              </div>

              {/* Kalan tutar */}
              <div className="rounded-lg px-3 py-2 mb-4 flex justify-between items-center"
                style={{ background: 'var(--bg4)', border: '1px solid var(--border)' }}>
                <span className="text-[11px]" style={{ color: 'var(--muted)' }}>Kalan tutar</span>
                <span className="mono font-bold text-[14px]" style={{ color: collectModal.type === 'alacak' ? '#059669' : '#dc2626' }}>
                  {fmt(collectModal.amount, collectModal.currency)}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>
                    {collectModal.type === 'alacak' ? 'Tahsilat Tutarı' : 'Ödeme Tutarı'}
                  </label>
                  <div className="flex gap-2">
                    <input value={collectAmount} onChange={e => setCollectAmount(e.target.value)}
                      placeholder="0" type="number" className="input mono flex-1" />
                    <button onClick={() => setCollectAmount(String(collectModal.amount))}
                      className="px-3 rounded-lg text-[11px] font-semibold flex-shrink-0"
                      style={{ background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                      Tamamı
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>
                    {collectModal.type === 'alacak' ? 'Hangi Hesaba Geçti?' : 'Hangi Hesaptan Ödendi?'}
                  </label>
                  <select value={collectAccountId}
                    onChange={e => setCollectAccountId(e.target.value ? Number(e.target.value) : '')}
                    className="input">
                    <option value="">— Hesap seçme (sadece kaydet) —</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.bank}) — {fmt(a.balance, a.currency)}</option>
                    ))}
                  </select>
                  {collectAccountId && (
                    <div className="mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                      {collectModal.type === 'alacak'
                        ? `✓ Bakiye +${fmt(parseFloat(collectAmount) || 0)} artacak`
                        : `✓ Bakiye -${fmt(parseFloat(collectAmount) || 0)} azalacak`}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={() => { setCollectModal(null); setCollectAmount(''); setCollectAccountId('') }}
                  className="btn-outline flex-1 py-2.5 text-sm">İptal</button>
                <button onClick={handleCollect}
                  disabled={collecting || !collectAmount || parseFloat(collectAmount) <= 0}
                  className="btn-primary flex-1 py-2.5 text-sm">
                  {collecting ? 'Kaydediliyor...' : 'Onayla'}
                </button>
              </div>
            </div>
          </div>
        )}

        {editDebt && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }} onClick={closeDebtEdit}>
            <div className="glass-bold slide-up w-full max-w-lg rounded-t-3xl p-5" style={{ maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div className="flex justify-center mb-3"><div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border2)' }} /></div>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold">Kaydi Duzenle</div>
                <button onClick={closeDebtEdit} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg4)' }}>✕</button>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kisi Adi</label>
                  <input value={debtForm.person_name} onChange={e => setDbt('person_name', e.target.value)} className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tur</label>
                    <select value={debtForm.type} onChange={e => setDbt('type', e.target.value)} className="input">
                      <option value="alacak">Alacak</option><option value="verecek">Verecek</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Doviz</label>
                    <select value={debtForm.currency} onChange={e => setDbt('currency', e.target.value)} className="input">
                      <option value="TRY">TRY</option><option value="EUR">EUR</option><option value="USD">USD</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                  <input value={debtForm.amount} onChange={e => setDbt('amount', e.target.value)} type="number" step="any" className="input mono" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Aciklama</label>
                  <input value={debtForm.description} onChange={e => setDbt('description', e.target.value)} className="input" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Vade Tarihi</label>
                  <input value={debtForm.due_date} onChange={e => setDbt('due_date', e.target.value)} type="date" className="input" />
                </div>
              </div>
              <button onClick={handleDebtSave} disabled={debtSaving || !debtForm.person_name || !debtForm.amount}
                className="btn-primary w-full mt-4 py-3">{debtSaving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              {!debtDeleteConfirm ? (
                <button onClick={() => setDebtDeleteConfirm(true)}
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: 'none' }}
                  className="w-full mt-2 py-3 rounded-xl text-sm font-semibold">Sil</button>
              ) : (
                <div className="mt-2 p-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)' }}>
                  <div className="text-[12px] font-medium mb-2 text-center" style={{ color: '#dc2626' }}>Bu kaydi silmek istediginize emin misiniz?</div>
                  <div className="flex gap-2">
                    <button onClick={() => setDebtDeleteConfirm(false)} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: 'var(--bg4)', color: 'var(--text)' }}>Iptal</button>
                    <button onClick={handleDebtDelete} className="flex-1 py-2 rounded-lg text-sm font-semibold" style={{ background: '#dc2626', color: '#fff' }}>Evet, Sil</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
