'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/',            icon: '◉',  label: 'Dashboard'  },
  { href: '/loans',       icon: '🏦', label: 'Krediler'   },
  { href: '/recurring',   icon: '📅', label: 'Giderler'   },
  { href: '/debts',       icon: '🤝', label: 'Alacak'     },
  { href: '/investments', icon: '📈', label: 'Yatırım'    },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 safe-bottom"
      style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)' }}
    >
      <div className="flex">
        {navItems.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center gap-1 pt-3 pb-2"
              style={{ opacity: active ? 1 : 0.4, textDecoration: 'none' }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span
                className="text-[10px] font-medium tracking-wide"
                style={{ color: active ? '#6c8fff' : 'var(--text)' }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
