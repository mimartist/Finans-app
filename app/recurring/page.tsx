'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import { supabase, fmt, daysUntil, daysUntilLabel } from '@/lib/supabase'
import type { RecurringExpense } from '@/lib/supabase'

const catIcon: Record<string, string> = {
  fatura: '📄', aidat: '🏢', personel: '👤',
  sirket: '🏭', vergi: '📋', kredi: '🏦',
  sigorta: '🛡', nakit: '💵', diger: '📦',
}
const catColor: Record<string, string> = {
  fatura: '#6c8fff', aidat: '#f59e0b', personel: '#a78bfa',
  sirket: '#4ade9a', vergi: '#f87171', kredi: '#f87171',
  sigorta: '#4ade9a', nakit: '#6b7280', diger: '#6b7280',
}

export default function RecurringPage() {
  const [expenses, setExpenses] = useState<RecurringExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('tümü')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('is_active', true)
        .order('payment_day', { nullsFirst: false })
      setExpenses(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const categories = ['tümü', ...Array.from(new Set(expenses.map(e => e.category)))]
  const filtered = filter === 'tümü' ? expenses : expenses.filter(e => e.category === filter)
  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0)

  if (loading) return <div className="flex items-center justify-center h-screen" style={{ color: 'var(--muted)' }}>Yükleniyor...</div>

  return (
    <div className="pb-24 page-enter">
      <div className="px-5 pt-5 pb-3">
        <div className="text-[11px] uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Modül</div>
        <div className="text-lg font-semibold mt-0.5">Düzenli Giderler</div>
      </div>

      {/* Özet */}
      <div className="flex gap-2 mx-4 mb-4">
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Toplam Aylık</div>
          <div className="mono text-base font-medium amt-red">{fmt(totalAll)}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{expenses.length} kalem</div>
        </div>
        <div className="flex-1 card p-3">
          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Seçili Filtre</div>
          <div className="mono text-base font-medium amt-blue">{fmt(total)}</div>
          <div className="text-[10px] mt-1" style={{ color: 'var(--muted)' }}>{filter}</div>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 px-4 mb-4 overflow-x-auto pb-1">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12px] font-medium capitalize"
            style={{
              background: filter === cat ? '#6c8fff22' : 'var(--bg3)',
              border: `1px solid ${filter === cat ? '#6c8fff60' : 'var(--border)'}`,
              color: filter === cat ? '#6c8fff' : 'var(--muted)',
            }}
          >
            {catIcon[cat] || ''} {cat}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2 mx-4">
        {filtered.map((exp) => {
          const days = exp.payment_day ? daysUntil(exp.payment_day) : null
          const color = catColor[exp.category] || '#6b7280'
          return (
            <div key={exp.id} className="card px-4 py-3 flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: color + '18' }}
              >
                {catIcon[exp.category] || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{exp.name}</div>
                <div className="text-[11px] mt-0.5 capitalize" style={{ color: 'var(--muted)' }}>
                  {exp.category}{exp.subcategory ? ` · ${exp.subcategory}` : ''}
                  {days !== null ? ` · ${daysUntilLabel(days)}` : ''}
                </div>
              </div>
              <div className="text-right">
                <div className="mono text-sm font-medium" style={{ color }}>{fmt(exp.amount, exp.currency)}</div>
                {exp.payment_day && (
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>ayın {exp.payment_day}'i</div>
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
