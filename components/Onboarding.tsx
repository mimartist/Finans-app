'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const DONE_KEY = 'finans_onboarding_done'

type Step = 'welcome' | 'account' | 'creditcard' | 'loan' | 'debt' | 'done'

const STEPS: Step[] = ['welcome', 'account', 'creditcard', 'loan', 'debt', 'done']
const STEP_LABELS = ['Hoş Geldin', 'Hesap', 'Kredi Kartı', 'Kredi', 'Alacak/Borç', 'Hazır']

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {STEPS.slice(0, -1).map((_, i) => (
        <div key={i} className="flex-1 h-1 rounded-full transition-all"
          style={{ background: i <= current ? 'linear-gradient(90deg,#2b2d6e,#4a4db0)' : 'var(--border2)' }} />
      ))}
    </div>
  )
}

export default function Onboarding({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [step, setStep] = useState<Step>('welcome')
  const [saving, setSaving] = useState(false)

  // Kullanıcı adı
  const [userName, setUserName] = useState('Atakan')

  // Hesap formu
  const [accBank, setAccBank] = useState('')
  const [accName, setAccName] = useState('')
  const [accBalance, setAccBalance] = useState('')
  const [accCurrency, setAccCurrency] = useState('TRY')

  // Kredi kartı formu
  const [ccBank, setCcBank] = useState('')
  const [ccName, setCcName] = useState('')
  const [ccLimit, setCcLimit] = useState('')
  const [ccDueDay, setCcDueDay] = useState('')

  // Kredi/loan formu
  const [loanBank, setLoanBank] = useState('')
  const [loanName, setLoanName] = useState('')
  const [loanRemaining, setLoanRemaining] = useState('')
  const [loanMonthly, setLoanMonthly] = useState('')
  const [loanDay, setLoanDay] = useState('')

  // Alacak/Borç formu
  const [debtPerson, setDebtPerson] = useState('')
  const [debtType, setDebtType] = useState<'alacak' | 'verecek'>('alacak')
  const [debtAmount, setDebtAmount] = useState('')
  const [debtCurrency, setDebtCurrency] = useState('TRY')

  useEffect(() => {
    setMounted(true)
    if (!localStorage.getItem(DONE_KEY)) {
      setShow(true)
    }
  }, [])

  function finish() {
    localStorage.setItem(DONE_KEY, '1')
    // Settings'e ismi kaydet
    try {
      const s = JSON.parse(localStorage.getItem('finans_settings') || '{}')
      localStorage.setItem('finans_settings', JSON.stringify({ ...s, userName }))
    } catch {}
    setShow(false)
  }

  async function handleAccountSave() {
    if (!accBank || !accName) { next(); return }
    setSaving(true)
    await supabase.from('accounts').insert({
      name: accName, bank: accBank, type: 'vadesiz',
      currency: accCurrency, balance: parseFloat(accBalance) || 0, is_active: true,
    })
    setSaving(false)
    next()
  }

  async function handleCcSave() {
    if (!ccBank || !ccName) { next(); return }
    setSaving(true)
    await supabase.from('credit_cards').insert({
      name: ccName, bank: ccBank, credit_limit: parseFloat(ccLimit) || 0,
      currency: 'TRY', payment_day: parseInt(ccDueDay) || 1,
      statement_day: Math.max(1, (parseInt(ccDueDay) || 1) - 10),
      is_active: true,
    })
    setSaving(false)
    next()
  }

  async function handleLoanSave() {
    if (!loanBank || !loanName) { next(); return }
    setSaving(true)
    await supabase.from('loans').insert({
      name: loanName, bank: loanBank, type: 'tuketici',
      currency: 'TRY',
      original_amount: parseFloat(loanRemaining) || 0,
      remaining_amount: parseFloat(loanRemaining) || 0,
      monthly_payment: parseFloat(loanMonthly) || 0,
      payment_day: parseInt(loanDay) || 1,
      interest_rate: 0, total_installments: 0, paid_installments: 0,
      start_date: new Date().toISOString().split('T')[0],
      is_active: true,
    })
    setSaving(false)
    next()
  }

  async function handleDebtSave() {
    if (!debtPerson || !debtAmount) { next(); return }
    setSaving(true)
    await supabase.from('debt_records').insert({
      person_name: debtPerson, type: debtType,
      amount: parseFloat(debtAmount) || 0, currency: debtCurrency,
      transaction_date: new Date().toISOString().split('T')[0],
      is_settled: false,
    })
    setSaving(false)
    next()
  }

  const stepIdx = STEPS.indexOf(step)
  function next() { setStep(STEPS[stepIdx + 1]) }
  function back() { setStep(STEPS[stepIdx - 1]) }

  if (!mounted || !show) return <>{children}</>

  return (
    <>
      <div className="fixed inset-0 flex items-center justify-center px-5"
        style={{ background: 'var(--bg)', minHeight: '100dvh', zIndex: 9998 }}>

        <div className="w-full max-w-md">

          {/* ── WELCOME ── */}
          {step === 'welcome' && (
            <div className="text-center">
              <div className="w-24 h-24 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-xl"
                style={{ background: 'linear-gradient(135deg,#1e1f54,#4a4db0)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h1 className="text-2xl font-extrabold mb-2">Finans Asistan'a<br/>Hoş Geldiniz 👋</h1>
              <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
                Kişisel finans takibinizi birkaç adımda kuruyoruz.<br/>Atlamak istediğiniz adımları geçebilirsiniz.
              </p>
              <div className="mb-6 text-left">
                <label className="text-[11px] uppercase tracking-wide mb-1.5 block font-semibold" style={{ color: 'var(--muted)' }}>Adınız</label>
                <input value={userName} onChange={e => setUserName(e.target.value)}
                  placeholder="Adınızı girin" className="input text-center text-base font-semibold" />
              </div>
              <button onClick={next} disabled={!userName}
                className="btn-primary w-full py-3.5 text-base font-bold">
                Kuruluma Başla →
              </button>
            </div>
          )}

          {/* ── BANKA HESABI ── */}
          {step === 'account' && (
            <div>
              <ProgressBar current={0} />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(43,45,110,0.08)' }}>🏦</div>
                <div>
                  <div className="font-bold text-base">Banka Hesabı</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Mevcut bakiyenizi girin</div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Banka Adı</label>
                    <input value={accBank} onChange={e => setAccBank(e.target.value)} placeholder="Örn: Garanti, Yapı Kredi" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Hesap Adı</label>
                    <input value={accName} onChange={e => setAccName(e.target.value)} placeholder="Örn: Vadesiz TRY" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Mevcut Bakiye</label>
                    <input value={accBalance} onChange={e => setAccBalance(e.target.value)} placeholder="0" type="number" className="input mono" />
                  </div>
                  <div className="w-28">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Döviz</label>
                    <select value={accCurrency} onChange={e => setAccCurrency(e.target.value)} className="input">
                      <option>TRY</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={next} className="btn-outline flex-1 py-3 text-sm">Atla</button>
                <button onClick={handleAccountSave} disabled={saving || !accBank || !accName}
                  className="btn-primary flex-1 py-3 text-sm font-semibold">
                  {saving ? 'Kaydediliyor…' : 'Kaydet ve Devam →'}
                </button>
              </div>
            </div>
          )}

          {/* ── KREDİ KARTI ── */}
          {step === 'creditcard' && (
            <div>
              <ProgressBar current={1} />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(99,102,241,0.08)' }}>💳</div>
                <div>
                  <div className="font-bold text-base">Kredi Kartı</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Kartınızı ekleyin (opsiyonel)</div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Banka</label>
                    <input value={ccBank} onChange={e => setCcBank(e.target.value)} placeholder="Örn: Garanti" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kart Adı</label>
                    <input value={ccName} onChange={e => setCcName(e.target.value)} placeholder="Örn: Bonus" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kart Limiti (₺)</label>
                    <input value={ccLimit} onChange={e => setCcLimit(e.target.value)} placeholder="0" type="number" className="input mono" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Son Ödeme Günü</label>
                    <input value={ccDueDay} onChange={e => setCcDueDay(e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={back} className="btn-outline py-3 px-4 text-sm">←</button>
                <button onClick={next} className="btn-outline flex-1 py-3 text-sm">Atla</button>
                <button onClick={handleCcSave} disabled={saving || !ccBank || !ccName}
                  className="btn-primary flex-1 py-3 text-sm font-semibold">
                  {saving ? 'Kaydediliyor…' : 'Kaydet →'}
                </button>
              </div>
            </div>
          )}

          {/* ── KREDİ / LOAN ── */}
          {step === 'loan' && (
            <div>
              <ProgressBar current={2} />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(220,38,38,0.07)' }}>🏛️</div>
                <div>
                  <div className="font-bold text-base">Kredi / Borç</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Banka kredisi, taşıt, konut (opsiyonel)</div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Banka</label>
                    <input value={loanBank} onChange={e => setLoanBank(e.target.value)} placeholder="Örn: Ziraat" className="input" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kredi Adı</label>
                    <input value={loanName} onChange={e => setLoanName(e.target.value)} placeholder="Örn: İhtiyaç Kredisi" className="input" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kalan Borç (₺)</label>
                    <input value={loanRemaining} onChange={e => setLoanRemaining(e.target.value)} placeholder="0" type="number" className="input mono" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Aylık Taksit (₺)</label>
                    <input value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} placeholder="0" type="number" className="input mono" />
                  </div>
                </div>
                <div className="w-1/2">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Ödeme Günü</label>
                  <input value={loanDay} onChange={e => setLoanDay(e.target.value)} placeholder="1-31" type="number" min="1" max="31" className="input" />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={back} className="btn-outline py-3 px-4 text-sm">←</button>
                <button onClick={next} className="btn-outline flex-1 py-3 text-sm">Atla</button>
                <button onClick={handleLoanSave} disabled={saving || !loanBank || !loanName}
                  className="btn-primary flex-1 py-3 text-sm font-semibold">
                  {saving ? 'Kaydediliyor…' : 'Kaydet →'}
                </button>
              </div>
            </div>
          )}

          {/* ── ALACAK / BORÇ ── */}
          {step === 'debt' && (
            <div>
              <ProgressBar current={3} />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: 'rgba(5,150,105,0.08)' }}>🤝</div>
                <div>
                  <div className="font-bold text-base">Alacak / Verecek</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Birinden alacağınız veya vereceğiniz para (opsiyonel)</div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tür</label>
                  <div className="flex gap-2">
                    {(['alacak', 'verecek'] as const).map(t => (
                      <button key={t} onClick={() => setDebtType(t)}
                        className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                        style={{
                          background: debtType === t ? (t === 'alacak' ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)') : 'var(--bg4)',
                          color: debtType === t ? (t === 'alacak' ? '#059669' : '#dc2626') : 'var(--muted)',
                          border: `1.5px solid ${debtType === t ? (t === 'alacak' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.25)') : 'var(--border)'}`,
                        }}>
                        {t === 'alacak' ? '↙ Alacak' : '↗ Verecek'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Kişi Adı</label>
                  <input value={debtPerson} onChange={e => setDebtPerson(e.target.value)} placeholder="Örn: Ahmet" className="input" />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Tutar</label>
                    <input value={debtAmount} onChange={e => setDebtAmount(e.target.value)} placeholder="0" type="number" className="input mono" />
                  </div>
                  <div className="w-28">
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Döviz</label>
                    <select value={debtCurrency} onChange={e => setDebtCurrency(e.target.value)} className="input">
                      <option>TRY</option><option>EUR</option><option>USD</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={back} className="btn-outline py-3 px-4 text-sm">←</button>
                <button onClick={next} className="btn-outline flex-1 py-3 text-sm">Atla</button>
                <button onClick={handleDebtSave} disabled={saving || !debtPerson || !debtAmount}
                  className="btn-primary flex-1 py-3 text-sm font-semibold">
                  {saving ? 'Kaydediliyor…' : 'Kaydet →'}
                </button>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-extrabold mb-2">Her şey hazır!</h2>
              <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
                Finans Asistan kurulumu tamamlandı.<br/>
                İstediğiniz zaman daha fazla veri ekleyebilirsiniz.
              </p>
              <div className="card p-4 mb-6 text-left">
                <div className="text-[11px] font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted)' }}>İpuçları</div>
                <div className="flex flex-col gap-2.5">
                  {[
                    ['💰', 'Hızlı Ekle (+) ile gelir/gider ekle'],
                    ['📷', 'Fiş fotoğrafı çekerek otomatik kayıt yap'],
                    ['🔔', 'Bildirim ikonu yaklaşan ödemeleri gösterir'],
                    ['⚙️', 'Ayarlar > Güvenlik ile şifre koy'],
                  ].map(([icon, text]) => (
                    <div key={text} className="flex items-center gap-2.5 text-[12px]">
                      <span className="text-base">{icon}</span>
                      <span style={{ color: 'var(--muted)' }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={finish} className="btn-primary w-full py-3.5 text-base font-bold">
                Uygulamaya Geç →
              </button>
            </div>
          )}
        </div>
      </div>
      {children}
    </>
  )
}
