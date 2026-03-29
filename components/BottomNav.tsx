'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import QuickAdd from './QuickAdd'
import { IconHome, IconBank, IconCreditCard, IconCalendar, IconPlus, IconSettings } from './Icons'

const ACTIVE = '#ffffff'
const INACTIVE = 'rgba(255,255,255,0.35)'

const navItemsLeft = [
  { href: '/',         Icon: IconHome },
  { href: '/accounts', Icon: IconBank },
]
const navItemsRight = [
  { href: '/loans',     Icon: IconCreditCard },
  { href: '/recurring', Icon: IconCalendar },
]
const allNavItems = [
  { href: '/',         Icon: IconHome,       label: 'Ana' },
  { href: '/accounts', Icon: IconBank,       label: 'Hesaplar' },
  { href: '/loans',    Icon: IconCreditCard, label: 'Krediler' },
  { href: '/recurring',Icon: IconCalendar,   label: 'Giderler' },
]

function NavBtn({ href, Icon, active }: { href: string; Icon: any; active: boolean }) {
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
        transition: 'all 0.2s',
      }}>
        <Icon color={active ? ACTIVE : INACTIVE} size={21} strokeWidth={2.2} />
      </div>
    </Link>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const isAccountsActive = pathname === '/accounts' || pathname === '/investments' || pathname === '/debts'

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="app-sidebar">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold text-white"
              style={{ background: 'linear-gradient(135deg, #2b2d6e, #4a4db0)' }}>F</div>
            <div>
              <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>Finans</div>
              <div className="text-[10px]" style={{ color: 'var(--muted)' }}>Asistan</div>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-4">
          {allNavItems.map((item) => {
            const active = item.href === '/accounts' ? isAccountsActive : pathname === item.href
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: active ? 'rgba(43,45,110,0.06)' : 'transparent', color: active ? '#2b2d6e' : 'var(--muted)', textDecoration: 'none' }}>
                <item.Icon color={active ? '#2b2d6e' : '#b0b7c3'} size={20} strokeWidth={2.2} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <button onClick={() => setShowQuickAdd(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mt-4"
            style={{ background: 'linear-gradient(135deg, #2b2d6e, #3d3f8f)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(43,45,110,0.3)' }}>
            <IconPlus color="#fff" size={20} strokeWidth={2.5} />
            <span>Hizli Ekle</span>
          </button>
          <Link href="/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mt-auto"
            style={{ color: pathname === '/settings' ? '#2b2d6e' : 'var(--muted)', background: pathname === '/settings' ? 'rgba(43,45,110,0.06)' : 'transparent', textDecoration: 'none', marginTop: 'auto' }}>
            <IconSettings color={pathname === '/settings' ? '#2b2d6e' : '#b0b7c3'} size={20} strokeWidth={2.2} />
            <span>Ayarlar</span>
          </Link>
        </nav>
      </aside>

      {/* Mobile Bottom Nav — floating pill, 20px from bottom */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bottom-nav-mobile"
        style={{ display: 'flex', justifyContent: 'center', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)', paddingLeft: 30, paddingRight: 30 }}>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-evenly',
          borderRadius: 9999,
          background: 'linear-gradient(135deg, #1e1f54, #2b2d6e)',
          boxShadow: '0 8px 32px rgba(30,31,84,0.4)',
          padding: '6px 12px',
          gap: 0,
          width: '100%',
        }}>
          <NavBtn href="/" Icon={IconHome} active={pathname === '/'} />
          <NavBtn href="/accounts" Icon={IconBank} active={isAccountsActive} />

          {/* Center FAB — Siri glow */}
          <div style={{ position: 'relative', margin: '0 4px', flexShrink: 0 }}>
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              background: 'conic-gradient(from 0deg, #4a4db0, #818cf8, #c7d2fe, #818cf8, #4a4db0)',
              opacity: 0.55, filter: 'blur(4px)',
            }} />
            <button onClick={() => setShowQuickAdd(true)}
              style={{
                width: 50, height: 50, borderRadius: '50%',
                background: 'linear-gradient(135deg, #4a4db0, #6366f1)',
                border: '2px solid rgba(165,180,252,0.4)',
                cursor: 'pointer', position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <IconPlus color="#fff" size={22} strokeWidth={2.5} />
            </button>
          </div>

          <NavBtn href="/loans" Icon={IconCreditCard} active={pathname === '/loans'} />
          <NavBtn href="/recurring" Icon={IconCalendar} active={pathname === '/recurring'} />
        </div>
      </nav>

      {showQuickAdd && <QuickAdd onClose={() => setShowQuickAdd(false)} />}
    </>
  )
}
