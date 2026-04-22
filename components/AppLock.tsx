'use client'
import { useState, useEffect, useRef } from 'react'

const HASH_KEY = 'finans_pin_hash'
const SESSION_KEY = 'finans_unlocked'

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function useAppLock() {
  const isClient = typeof window !== 'undefined'

  function isPinSet(): boolean {
    if (!isClient) return false
    return !!localStorage.getItem(HASH_KEY)
  }

  async function setPin(pin: string): Promise<void> {
    const hash = await sha256(pin)
    localStorage.setItem(HASH_KEY, hash)
    sessionStorage.setItem(SESSION_KEY, '1')
  }

  function removePin(): void {
    localStorage.removeItem(HASH_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  }

  return { isPinSet, setPin, removePin }
}

export default function AppLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const pinHash = localStorage.getItem(HASH_KEY)
    const unlocked = sessionStorage.getItem(SESSION_KEY)
    if (pinHash && !unlocked) {
      setLocked(true)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [])

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault()
    if (!input || checking) return
    setChecking(true)
    const hash = await sha256(input)
    const stored = localStorage.getItem(HASH_KEY)
    if (hash === stored) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setLocked(false)
      setError('')
    } else {
      setError('Hatalı şifre')
      setShake(true)
      setInput('')
      setTimeout(() => { setShake(false); inputRef.current?.focus() }, 500)
    }
    setChecking(false)
  }

  if (!locked) return <>{children}</>

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--wallpaper)', minHeight: '100dvh' }}>

      {/* Logo / Icon */}
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8 shadow-xl"
        style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>

      <div className="text-xl font-extrabold mb-1">Finans Asistan</div>
      <div className="text-sm mb-8" style={{ color: 'var(--muted)' }}>Devam etmek için şifrenizi girin</div>

      <form onSubmit={handleUnlock} className="w-full max-w-xs flex flex-col gap-3">
        <div className={`transition-all ${shake ? 'animate-shake' : ''}`}
          style={{ animation: shake ? 'shake 0.4s ease' : undefined }}>
          <input
            ref={inputRef}
            type="password"
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            placeholder="Şifre"
            className="input text-center text-lg tracking-widest"
            style={{ letterSpacing: '0.2em' }}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="text-center text-[12px] font-medium py-2 rounded-lg"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={!input || checking}
          className="btn-primary py-3 text-sm font-semibold">
          {checking ? 'Kontrol ediliyor...' : 'Kilidi Aç'}
        </button>
      </form>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
