'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import QuickAdd from './QuickAdd'

const ACTIVE = '#0d9488'
const INACTIVE = '#9ca3af'

function NavIcon({ name, color }: { name: string; color: string }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'home':
      return <svg {...p}><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" /><polyline points="9 21 9 14 15 14 15 21" /></svg>
    case 'bank':
      return <svg {...p}><path d="M3 21h18" /><path d="M3 10h18" /><path d="M12 3l9 7H3l9-7z" /><path d="M5 10v8" /><path d="M9 10v8" /><path d="M15 10v8" /><path d="M19 10v8" /></svg>
    case 'credit-card':
      return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
    case 'calendar':
      return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
    case 'handshake':
      return <svg {...p}><path d="M12 5l-4 4h3v6H8l4 4 4-4h-3V9h3l-4-4z" /><path d="M5 12H2" /><path d="M22 12h-3" /></svg>
    case 'trending-up':
      return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
    default:
      return null
  }
}

const navItemsLeft = [
  { href: '/',            icon: 'home',        label: 'Ana' },
  { href: '/accounts',    icon: 'bank',        label: 'Hesaplar' },
  { href: '/loans',       icon: 'credit-card', label: 'Krediler' },
]

const navItemsRight = [
  { href: '/recurring',   icon: 'calendar',    label: 'Giderler' },
  { href: '/debts',       icon: 'handshake',   label: 'Alacak' },
  { href: '/investments', icon: 'trending-up',  label: 'Yatirim' },
]

const allNavItems = [...navItemsLeft, ...navItemsRight]

export default function BottomNav() {
  const pathname = usePathname()
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="app-sidebar">
        <div className="px-5 mb-6">
          <div className="text-base font-bold" style={{ color: 'var(--accent)' }}>Finans</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Asistan</div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {allNavItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  background: active ? 'var(--accent-light)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--muted)',
                  textDecoration: 'none',
                }}
              >
                <NavIcon name={item.icon} color={active ? ACTIVE : INACTIVE} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mt-2"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Hizli Ekle</span>
          </button>
        </nav>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bottom-nav-mobile"
        style={{
          background: 'var(--bg2)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -1px 4px rgba(0,0,0,0.04)',
          minHeight: 72,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-end pt-3 pb-3">
          {/* Left nav items */}
          {navItemsLeft.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-1"
                style={{ textDecoration: 'none' }}
              >
                <NavIcon name={item.icon} color={active ? ACTIVE : INACTIVE} />
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? ACTIVE : INACTIVE }}>
                  {item.label}
                </span>
              </Link>
            )
          })}

          {/* Center FAB button */}
          <div className="flex-1 flex justify-center" style={{ marginTop: -18 }}>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center justify-center"
              style={{
                width: 52, height: 52,
                borderRadius: '50%',
                background: 'var(--accent)',
                border: '3px solid var(--bg2)',
                boxShadow: '0 2px 12px rgba(13,148,136,0.35)',
                cursor: 'pointer',
              }}
            >
              <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Right nav items */}
          {navItemsRight.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-1"
                style={{ textDecoration: 'none' }}
              >
                <NavIcon name={item.icon} color={active ? ACTIVE : INACTIVE} />
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? ACTIVE : INACTIVE }}>
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Quick Add Modal */}
      {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
    </>
  )
}
