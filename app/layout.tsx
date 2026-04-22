import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import AppLockWrapper from '@/components/AppLockWrapper'
import ThemeProvider from '@/components/ThemeProvider'
import OnboardingWrapper from '@/components/OnboardingWrapper'
import { AuthProvider } from '@/components/AuthProvider'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'Finans v2.1',
  description: 'Kisisel finans ve varlik takip asistani',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Finans',
  },
}

export const viewport: Viewport = {
  themeColor: '#f8f9fa',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="safe-top">
        {/* DEPLOY TEST MARKER — atakan doğrulamak istedi, işin bitince siliyoruz */}
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #ff00aa 0%, #ff7700 100%)',
          color: '#fff', textAlign: 'center', padding: '6px 10px',
          fontSize: 13, fontWeight: 800, letterSpacing: '0.04em',
          fontFamily: 'system-ui, sans-serif',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}>
          🚀 DEPLOY TEST · 2026-04-22 17:14 UTC · BUILD #A1
        </div>
        <ThemeProvider>
          <AuthProvider>
            <AuthGuard>
              <AppLockWrapper>
                <OnboardingWrapper>{children}</OnboardingWrapper>
              </AppLockWrapper>
            </AuthGuard>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
