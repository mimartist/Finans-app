'use client'
import { useState } from 'react'
import { supabase, fmt } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, CATEGORY_GROUPS } from '@/lib/categories'
import type { ExtractedTransaction } from '@/lib/ocr-utils'

type ReviewItem = ExtractedTransaction & { selected: boolean; key: string }

type Props = {
  cardId: number
  transactions: ExtractedTransaction[]
  onClose: () => void
  onSaved: () => void
}

export default function OcrReview({ cardId, transactions, onClose, onSaved }: Props) {
  const [items, setItems] = useState<ReviewItem[]>(
    transactions.map((tx, i) => ({ ...tx, selected: true, key: `ocr-${i}` }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = items.filter(i => i.selected)
  const total = selected.reduce((s, i) => s + i.amount, 0)

  function update(key: string, field: string, value: any) {
    setItems(prev => prev.map(item =>
      item.key === key ? { ...item, [field]: value } : item
    ))
  }

  function remove(key: string) {
    setItems(prev => prev.filter(item => item.key !== key))
  }

  function toggleAll() {
    const allSelected = items.every(i => i.selected)
    setItems(prev => prev.map(i => ({ ...i, selected: !allSelected })))
  }

  async function handleSave() {
    if (selected.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      // Find or create statement
      const { data: existingStmts } = await supabase
        .from('credit_card_statements')
        .select('*')
        .eq('card_id', cardId)
        .eq('period_year', year)
        .eq('period_month', month)

      let stmtId: number | null = null
      let currentTotal = 0

      if (existingStmts && existingStmts.length > 0) {
        stmtId = existingStmts[0].id
        currentTotal = existingStmts[0].total_amount || 0
      } else {
        const { data: newStmt } = await supabase
          .from('credit_card_statements')
          .insert({
            card_id: cardId,
            period_year: year,
            period_month: month,
            total_amount: 0,
            minimum_payment: 0,
            is_paid: false,
          })
          .select()
          .single()
        if (newStmt) {
          stmtId = newStmt.id
        }
      }

      // Insert all selected transactions
      const payload = selected.map(tx => ({
        card_id: cardId,
        statement_id: stmtId,
        transaction_date: tx.transaction_date,
        description: tx.description,
        category: tx.category,
        amount: tx.amount,
        currency: tx.currency,
      }))

      const { error: insertErr } = await supabase
        .from('credit_card_transactions')
        .insert(payload)

      if (insertErr) {
        setError(`Kaydetme hatasi: ${insertErr.message}`)
        setSaving(false)
        return
      }

      // Update statement total
      if (stmtId) {
        await supabase
          .from('credit_card_statements')
          .update({ total_amount: currentTotal + total })
          .eq('id', stmtId)
      }

      setSaving(false)
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Bilinmeyen hata')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg rounded-t-3xl p-5 slide-up" style={{ background: 'var(--bg2)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Handle bar */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border2)' }} />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold">Ekstre Tarama Sonuclari</div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(13,148,136,0.1)', color: '#0d9488' }}>
              {items.length} islem
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg4)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Select all toggle */}
        <div className="flex items-center justify-between mb-3 px-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={items.length > 0 && items.every(i => i.selected)}
              onChange={toggleAll} className="w-4 h-4 rounded" style={{ accentColor: '#0d9488' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Tumunu sec</span>
          </label>
          <div className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>
            {selected.length}/{items.length} secili
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex flex-col gap-2 mb-4">
          {items.map(item => (
            <div key={item.key} className="rounded-xl p-3" style={{
              background: item.selected ? 'var(--bg4)' : 'transparent',
              border: `1px solid ${item.selected ? 'var(--border2)' : 'var(--border)'}`,
              opacity: item.selected ? 1 : 0.5,
            }}>
              <div className="flex items-center gap-2 mb-2">
                <input type="checkbox" checked={item.selected}
                  onChange={e => update(item.key, 'selected', e.target.checked)}
                  className="w-4 h-4 rounded flex-shrink-0" style={{ accentColor: '#0d9488' }} />
                <input value={item.description}
                  onChange={e => update(item.key, 'description', e.target.value)}
                  className="input flex-1 text-[13px] font-medium" style={{ padding: '6px 8px' }} />
                <button onClick={() => remove(item.key)}
                  className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[10px]"
                  style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626' }}>
                  ✕
                </button>
              </div>
              <div className="flex gap-2 pl-6">
                <input type="date" value={item.transaction_date}
                  onChange={e => update(item.key, 'transaction_date', e.target.value)}
                  className="input text-[11px]" style={{ padding: '4px 6px', width: 130 }} />
                <select value={item.category}
                  onChange={e => update(item.key, 'category', e.target.value)}
                  className="input text-[11px] flex-1" style={{ padding: '4px 6px' }}>
                  {CATEGORY_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {EXPENSE_CATEGORIES.filter(c => c.group === group).map(c => (
                        <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input type="number" value={item.amount}
                  onChange={e => update(item.key, 'amount', parseFloat(e.target.value) || 0)}
                  className="input text-[11px] mono text-right" style={{ padding: '4px 6px', width: 90 }} />
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-[13px]" style={{ color: 'var(--muted)' }}>
            Islem bulunamadi
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-3 p-3 rounded-xl text-xs font-medium" style={{ background: 'rgba(229,72,77,0.06)', color: '#e5484d' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            Toplam: <span className="font-semibold mono" style={{ color: 'var(--text)' }}>{fmt(total)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="btn-outline flex-1 py-3 text-sm">
            Iptal
          </button>
          <button onClick={handleSave}
            disabled={saving || selected.length === 0}
            className="btn-primary flex-1 py-3 text-sm font-bold"
            style={{ opacity: saving || selected.length === 0 ? 0.5 : 1 }}>
            {saving ? 'Kaydediliyor...' : `${selected.length} Islemi Kaydet`}
          </button>
        </div>
      </div>
    </div>
  )
}
