'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/',            icon: '◉',  label: 'Ana'       },
  { href: '/accounts',    icon: '🏦', label: 'Hesaplar'  },
  { href: '/loans',       icon: '💳', label: 'Krediler'  },
  { href: '/recurring',   icon: '📅', label: 'Giderler'  },
  { href: '/debts',       icon: '🤝', label: 'Alacak'    },
  { href: '/investments', icon: '📈', label: 'Yatirim'   },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="app-sidebar">
        <div className="px-5 mb-6">
          <div className="text-base font-bold" style={{ color: 'var(--accent)' }}>Finans</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>Asistan</div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map((item) => {
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
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 safe-bottom bottom-nav-mobile"
        style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', boxShadow: '0 -1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="flex">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2"
                style={{ textDecoration: 'none' }}
              >
                <span style={{ fontSize: 17, opacity: active ? 1 : 0.4 }}>{item.icon}</span>
                <span
                  className="text-[9px] font-medium tracking-wide"
                  style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
