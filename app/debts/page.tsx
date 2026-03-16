'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt } from '@/lib/supabase'
import type { DebtRecord } from '@/lib/supabase'

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'alacak' | 'verecek'>('alacak')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('debt_records')
        .select('*')
        .eq('is_settled', false)
        .order('due_date', { nullsFirst: false })
      setDebts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const alacaklar = debts.filter(d => d.type === 'alacak')
  const verecekler = debts.filter(d => d.type === 'verecek')
  const totalAlacak = alacaklar.reduce((s, d) => s + d.amount, 0)
  const totalVerecek = verecekler.reduce((s, d) => s + d.amount, 0)
  const shown = tab === 'alacak' ? alacaklar : verecekler

  const isOverdue = (due?: string) => {
    if (!due) return false
    return new Date(due) < new Date()
  }

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>

  return (
    <div className="pb-24 page-enter">
      <div className="px-5 pt-5 pb-3">
        <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Modül</div>
        <div className="text-lg font-semibold mt-0.5">Alacak & Verecek</div>
      </div>

      {/* Özet */}
      <div className="flex gap-2 mx-4 mb-4">
        <div
          className="flex-1 card p-3 cursor-pointer"
          style={{ borderColor: tab === 'alacak' ? 'rgba(74,222,154,0.4)' : 'var(--border)' }}
          onClick={() => setTab('alacak')}
        >
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Alacak</div>
          <div className="mono text-base font-medium amt-green">{fmt(totalAlacak)}</div>
          <div className="text-[10px] mt-1 amt-green">{alacaklar.length} kişi</div>
        </div>
        <div
          className="flex-1 card p-3 cursor-pointer"
          style={{ borderColor: tab === 'verecek' ? 'rgba(248,113,113,0.4)' : 'var(--border)' }}
          onClick={() => setTab('verecek')}
        >
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Verecek</div>
          <div className="mono text-base font-medium amt-red">{fmt(totalVerecek)}</div>
          <div className="text-[10px] mt-1 amt-red">{verecekler.length} kişi</div>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-2 mx-4 mb-4">
        {(['alacak', 'verecek'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{
              background: tab === t ? (t === 'alacak' ? 'rgba(74,222,154,0.15)' : 'rgba(248,113,113,0.15)') : 'var(--bg3)',
              border: `1px solid ${tab === t ? (t === 'alacak' ? 'rgba(74,222,154,0.3)' : 'rgba(248,113,113,0.3)') : 'var(--border)'}`,
              color: tab === t ? (t === 'alacak' ? '#4ade9a' : '#f87171') : 'var(--muted)',
            }}
          >
            {t === 'alacak' ? '↙ Alacaklarım' : '↗ Vereceklerim'}
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="mx-4 card p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
          Kayıt bulunamadı.
        </div>
      ) : (
        <div className="flex flex-col gap-2 mx-4">
          {shown.map((d) => {
            const overdue = isOverdue(d.due_date)
            const color = d.type === 'alacak' ? '#4ade9a' : '#f87171'
            return (
              <div key={d.id} className="card p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-sm font-semibold">{d.person_name}</div>
                    {d.description && (
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{d.description}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="mono text-base font-medium" style={{ color }}>{fmt(d.amount, d.currency)}</div>
                    <div className={`badge mt-1 ${d.type === 'alacak' ? 'badge-green' : 'badge-red'}`}>
                      {d.type}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  {d.transaction_date && (
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--muted)' }}>Tarih</span>
                      <span>{new Date(d.transaction_date).toLocaleDateString('tr-TR')}</span>
                    </div>
                  )}
                  {d.due_date && (
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--muted)' }}>Vade</span>
                      <span style={{ color: overdue ? '#f87171' : 'var(--text)' }}>
                        {new Date(d.due_date).toLocaleDateString('tr-TR')}
                        {overdue && ' ⚠️ Gecikmiş'}
                      </span>
                    </div>
                  )}
                  {d.notes && (
                    <div className="flex justify-between text-[11px]">
                      <span style={{ color: 'var(--muted)' }}>Not</span>
                      <span style={{ color: 'var(--muted)' }}>{d.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </div>
  )
}
