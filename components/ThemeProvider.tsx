'use client'
import { useEffect } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function applyTheme() {
      try {
        const settings = JSON.parse(localStorage.getItem('finans_settings') || '{}')
        const theme = settings.theme || 'light'
        document.documentElement.setAttribute('data-theme', theme)
      } catch {
        document.documentElement.setAttribute('data-theme', 'light')
      }
    }
    applyTheme()
    // settings değişince güncelle
    window.addEventListener('finans-theme-change', applyTheme)
    return () => window.removeEventListener('finans-theme-change', applyTheme)
  }, [])

  return <>{children}</>
}
