'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import { IconBriefcase, IconCheck } from '@/components/Icons'

type Project = {
  id: number
  name: string
  client?: string
  contract_amount?: number
  vat_rate: number
  collected: number
  status: string
  start_date?: string
  end_date?: string
  notes?: string
}

type Row = { date?: string; label: string; amount: number; kind: 'gelir' | 'gider'; done: boolean }

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [rates, setRates] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<number | null>(null)

  useEffect(() => {
    (async () => {
      const [pr, db, ex, py, rt] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('debt_records').select('*'),
        supabase.from('recurring_expenses').select('*').eq('is_active', true),
        supabase.from('recurring_payments').select('*').eq('is_paid', true),
        supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
      ])
      setProjects(pr.data || []); setDebts(db.data || [])
      setExpenses(ex.data || []); setPayments(py.data || [])
      setRates(rt.data?.[0] || null)
      setLoading(false)
    })()
  }, [])

  const eur = rates?.eur_try || 1, usd = rates?.usd_try || 1
  const toTry = (a: number, c: string) => c === 'EUR' ? a * eur : c === 'USD' ? a * usd : a

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yukleniyor...</div>
  )

  return (
    <div className="app-layout">
      <div className="bg-blobs" />
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        <div className="flex justify-between items-center px-5 pt-6 pb-4">
          <div>
            <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-xl font-extrabold" style={{ color: 'var(--text)' }}>Projeler</div>
          </div>
        </div>

        {projects.length === 0 && (
          <div className="glass mx-4 p-6 text-center text-[13px]" style={{ color: 'var(--muted)' }}>
            Henüz proje yok. Proje tablosu kurulduktan sonra alacak ve giderler
            projelere bağlanabilir.
          </div>
        )}

        {projects.map(p => {
          const vat = 1 + (p.vat_rate || 0) / 100
          const contractExcl = p.contract_amount || 0
          const contractIncl = contractExcl * vat

          const myDebts = debts.filter(d => d.project_id === p.id && !d.is_settled)
          const kalanAlacak = myDebts.reduce((s, d) => s + toTry(d.amount, d.currency), 0)

          const myExp = expenses.filter(e => e.project_id === p.id)
          const paidFor = (expId: number) =>
            payments.filter(x => x.expense_id === expId).reduce((s, x) => s + (x.amount || 0), 0)

          const maliyetToplam = myExp.reduce((s, e) => s + toTry(e.amount, e.currency), 0)
          const maliyetOdenen = myExp.reduce((s, e) => s + Math.min(paidFor(e.id), e.amount), 0)
          const maliyetBekleyen = Math.max(0, maliyetToplam - maliyetOdenen)
          // Muhasebe kârı için maliyetlerden KDV ayrıştırılır (maaşta KDV yok)
          const maliyetHaric = myExp.reduce((s, e) =>
            s + toTry(e.amount, e.currency) / (1 + (e.vat_rate || 0) / 100), 0)

          const kar = contractExcl - maliyetHaric
          const marj = contractExcl > 0 ? (kar / contractExcl) * 100 : 0
          const tahsilPct = contractIncl > 0 ? Math.min(100, (p.collected / contractIncl) * 100) : 0
          const nakitDurum = p.collected - maliyetOdenen

          const rows: Row[] = [
            ...(p.collected > 0
              ? [{ date: p.start_date, label: 'Tahsil edilen (peşin)', amount: p.collected, kind: 'gelir' as const, done: true }]
              : []),
            ...myDebts.map(d => ({
              date: d.due_date, label: d.description || d.person_name,
              amount: toTry(d.amount, d.currency), kind: 'gelir' as const, done: false,
            })),
            ...myExp.map(e => {
              const odenen = paidFor(e.id)
              return {
                date: e.expense_date,
                label: e.name.replace(/^İnfosec [^—]*— /, ''),
                amount: -toTry(e.amount, e.currency),
                kind: 'gider' as const,
                done: odenen >= e.amount - 0.01,
              }
            }),
          ].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))

          let running = 0
          const isOpen = open === p.id

          return (
            <div key={p.id} className="glass mx-4 mb-3 overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : p.id)}
                className="w-full text-left p-4"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <div className="flex items-start gap-3">
                  <div className="tx-icon" style={{ flexShrink: 0 }}>
                    <IconBriefcase color="var(--primary)" size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>{p.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {p.client}{p.end_date ? ` · bitiş ${new Date(p.end_date).toLocaleDateString('tr-TR')}` : ''}
                    </div>
                  </div>
                  <div className="text-right" style={{ flexShrink: 0 }}>
                    <div className="mono text-[13px] font-bold" style={{ color: kar >= 0 ? '#30a46c' : '#e5484d' }}>
                      {kar >= 0 ? '+' : ''}{fmt(Math.round(kar))}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--muted)' }}>kâr · %{marj.toFixed(1)}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--muted)' }}>
                    <span>Tahsil edilen {fmt(Math.round(p.collected))}</span>
                    <span>Sözleşme {fmt(Math.round(contractIncl))}</span>
                  </div>
                  <div className="progress-wrap">
                    <div className="progress-bar" style={{ width: `${tahsilPct}%`, background: 'linear-gradient(90deg, #2b2d6e, #4a4db0)' }} />
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--bg4)' }}>
                    {[
                      ['Sözleşme (KDV hariç)', fmt(Math.round(contractExcl)), 'var(--text)'],
                      ['Tahsil edilen (dahil)', fmt(Math.round(p.collected)), '#30a46c'],
                      ['Kalan alacak', fmt(Math.round(kalanAlacak)), '#e5a000'],
                      ['Maliyet — ödenen', fmt(Math.round(maliyetOdenen)), '#e5484d'],
                      ['Maliyet — bekleyen', fmt(Math.round(maliyetBekleyen)), 'var(--muted)'],
                      ['Nakit durum', fmt(Math.round(nakitDurum)), nakitDurum >= 0 ? '#30a46c' : '#e5484d'],
                    ].map(([label, val, color]) => (
                      <div key={label} className="flex justify-between py-0.5">
                        <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</span>
                        <span className="mono text-[12px] font-semibold" style={{ color }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] uppercase tracking-wide font-semibold mb-1.5" style={{ color: 'var(--muted)' }}>
                    Nakit akışı
                  </div>
                  {rows.map((r, i) => {
                    running += r.amount
                    return (
                      <div key={i} className="flex items-center gap-2 py-1.5"
                        style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none', opacity: r.done ? 1 : 0.65 }}>
                        <div style={{ width: 14, flexShrink: 0 }}>
                          {r.done && <IconCheck color="#30a46c" size={12} strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] truncate" style={{ color: 'var(--text)' }}>{r.label}</div>
                          <div className="text-[9px]" style={{ color: 'var(--muted)' }}>
                            {r.date ? new Date(r.date).toLocaleDateString('tr-TR') : 'tarihsiz'}
                            {!r.done && ' · bekliyor'}
                          </div>
                        </div>
                        <div className="text-right" style={{ flexShrink: 0 }}>
                          <div className="mono text-[11px] font-semibold" style={{ color: r.amount >= 0 ? '#30a46c' : '#e5484d' }}>
                            {r.amount >= 0 ? '+' : ''}{fmt(Math.round(r.amount))}
                          </div>
                          <div className="mono text-[9px]" style={{ color: 'var(--muted)' }}>{fmt(Math.round(running))}</div>
                        </div>
                      </div>
                    )
                  })}

                  <div className="text-[9px] mt-2" style={{ color: 'var(--muted)' }}>
                    Kâr KDV hariç hesaplanır: sözleşme bedelinden, maliyetlerin KDV'si
                    ayrıştırılmış hâli düşülür. Nakit durum ise tahsil edilenden fiilen
                    ödenen maliyetin çıkarılmasıyla bulunur — ikisi farklı sorulara cevap verir.
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
