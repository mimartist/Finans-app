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

export default function NotificationBell({ payments }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const overdue = payments.filter(p => !p.paid && p.overdue)
  const urgent = payments.filter(p => !p.paid && !p.overdue && p.days <= 3)
  const upcoming = payments.filter(p => !p.paid && !p.overdue && p.days > 3 && p.days <= 7)
  const notifications = [...overdue, ...urgent, ...upcoming]
  const badgeCount = overdue.length + urgent.length

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
          <div className="p-4 pb-2">
            <div className="text-sm font-bold">Bildirimler</div>
            {notifications.length === 0 && (
              <div className="text-[12px] py-4 text-center" style={{ color: 'var(--muted)' }}>
                Bekleyen bildirim yok
              </div>
            )}
          </div>

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
              </div>
            )
          })}

          {notifications.length > 0 && (
            <div className="px-4 pb-3 pt-1">
              <div className="text-[10px] text-center" style={{ color: 'var(--muted)' }}>
                {overdue.length > 0 && <span style={{ color: '#e5484d' }}>{overdue.length} gecmis</span>}
                {overdue.length > 0 && urgent.length > 0 && ' · '}
                {urgent.length > 0 && <span style={{ color: '#e5a000' }}>{urgent.length} acil</span>}
                {(overdue.length > 0 || urgent.length > 0) && upcoming.length > 0 && ' · '}
                {upcoming.length > 0 && <span style={{ color: '#6366f1' }}>{upcoming.length} yaklasan</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
