'use client'
import { useUser } from './AuthProvider'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (loading) return
    if (!user && pathname !== '/auth') {
      router.replace('/auth')
    }
    if (user && pathname === '/auth') {
      router.replace('/')
    }
  }, [user, loading, pathname, router])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #2b2d6e, #4a4db0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16 }}>F</div>
    </div>
  )

  if (!user && pathname !== '/auth') return null
  return <>{children}</>
}
