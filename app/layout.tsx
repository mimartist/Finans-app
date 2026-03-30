import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import AppLockWrapper from '@/components/AppLockWrapper'
import ThemeProvider from '@/components/ThemeProvider'
import OnboardingWrapper from '@/components/OnboardingWrapper'
import { AuthProvider } from '@/components/AuthProvider'
import AuthGuard from '@/components/AuthGuard'

export const metadata: Metadata = {
  title: 'Finans Asistan',
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
