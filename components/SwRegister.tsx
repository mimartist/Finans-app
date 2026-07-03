'use client'
import { useEffect } from 'react'

// Service worker'ı uygulama açılışında kaydeder (push bildirimleri için)
export default function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])
  return null
}
