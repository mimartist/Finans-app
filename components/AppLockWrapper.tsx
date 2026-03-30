'use client'
import AppLock from './AppLock'

export default function AppLockWrapper({ children }: { children: React.ReactNode }) {
  return <AppLock>{children}</AppLock>
}
