'use client'
import { useState, useRef, useEffect } from 'react'
import { IconBell } from './Icons'
import { fmt } from '@/lib/supabase'

type Payment = {
  id: string
  name: string
  amount: number
  currency: string
  day: number
  days: number
  paid: boolean
  overdue: boolean
}

type Props = {
  payments: Payment[]
}

// Kapatılan bildirimler içinde bulunulan ay için hatırlanır; ay değişince
// liste kendiliğinden sıfırlanır (yeni ayın ödemeleri yeniden bildirilir).
const STORE_KEY = 'finans_notif_dismissed_v1'
const periodKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}`
}

export default function NotificationBell({ payments }: Props) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved?.period === periodKey() && Array.isArray(saved.ids)) setDismissed(saved.ids)
      else localStorage.removeItem(STORE_KEY)
    } catch { /* bozuk kayıt — yok say */ }
  }, [])

  const persist = (ids: string[]) => {
    setDismissed(ids)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ period: periodKey(), ids }))
    } catch { /* kota dolu olabilir — kapatma yine de bu oturumda geçerli */ }
  }

  const dismiss = (id: string) => persist([...dismissed, id])
  const dismissAll = (ids: string[]) => persist([...dismissed, ...ids])
  const restoreAll = () => {
    setDismissed([])
    try { localStorage.removeItem(STORE_KEY) } catch { /* yok say */ }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const visible = payments.filter(p => !p.paid && !dismissed.includes(p.id))
  const overdue = visible.filter(p => p.overdue)
  const urgent = visible.filter(p => !p.overdue && p.days <= 3)
  const upcoming = visible.filter(p => !p.overdue && p.days > 3 && p.days <= 7)
  const notifications = [...overdue, ...urgent, ...upcoming]
  const badgeCount = overdue.length + urgent.length
  const hasDismissed = dismissed.length > 0

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg4)', position: 'relative' }}>
        <IconBell color="var(--primary)" size={18} strokeWidth={2} />
        {badgeCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            width: 18, height: 18, borderRadius: '50%',
            background: '#e5484d', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg)',
          }}>{badgeCount}</span>
        )}
      </button>

      {open && (
        <div className="scale-in" style={{
          position: 'absolute', top: 48, right: 0,
          width: 320, maxHeight: 400, overflowY: 'auto',
          background: 'var(--bg2)', borderRadius: 16,
          boxShadow: '0 8px 32px rgba(30,31,84,0.15)',
          border: '1px solid var(--border)',
          zIndex: 100,
        }}>
          <div className="p-4 pb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-bold">Bildirimler</div>
            {notifications.length > 0 && (
              <button onClick={() => dismissAll(notifications.map(n => n.id))}
                className="text-[11px] font-semibold"
                style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Tümünü temizle
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <div className="text-[12px] px-4 pb-4 text-center" style={{ color: 'var(--muted)' }}>
              Bekleyen bildirim yok
            </div>
          )}

          {notifications.map(n => {
            let color = '#6366f1' // upcoming
            let bg = 'rgba(99,102,241,0.06)'
            let label = `${n.days} gün sonra`
            if (n.overdue) { color = '#e5484d'; bg = 'rgba(229,72,77,0.06)'; label = 'Gecikti!' }
            else if (n.days <= 3) { color = '#e5a000'; bg = 'rgba(229,160,0,0.06)'; label = n.days === 0 ? 'Bugün!' : n.days === 1 ? 'Yarın!' : `${n.days} gun` }

            return (
              <div key={n.id} className="mx-3 mb-2 px-3 py-2.5 rounded-xl flex items-center gap-3"
                style={{ background: bg }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: color, flexShrink: 0,
                }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{n.name}</div>
                  <div className="text-[11px]" style={{ color }}>{label}</div>
                </div>
                <div className="mono text-[13px] font-semibold flex-shrink-0" style={{ color }}>
                  {fmt(n.amount, n.currency)}
                </div>
                {/* Bildirimi kapat — ödeme kaydına dokunmaz, yalnızca gizler */}
                <button onClick={() => dismiss(n.id)} aria-label={`${n.name} bildirimini kapat`}
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 22, height: 22, borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round">
                    <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </div>
            )
          })}

          {(notifications.length > 0 || hasDismissed) && (
            <div className="px-4 pb-3 pt-1">
              <div className="text-[10px] text-center" style={{ color: 'var(--muted)' }}>
                {overdue.length > 0 && <span style={{ color: '#e5484d' }}>{overdue.length} gecmis</span>}
                {overdue.length > 0 && urgent.length > 0 && ' · '}
                {urgent.length > 0 && <span style={{ color: '#e5a000' }}>{urgent.length} acil</span>}
                {(overdue.length > 0 || urgent.length > 0) && upcoming.length > 0 && ' · '}
                {upcoming.length > 0 && <span style={{ color: '#6366f1' }}>{upcoming.length} yaklasan</span>}
              </div>
              {hasDismissed && (
                <button onClick={restoreAll}
                  className="text-[10px] w-full text-center mt-1.5"
                  style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {dismissed.length} kapatılanı geri getir
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
