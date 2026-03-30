'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(errorMessage(error.message)); setLoading(false); return }
        router.push('/')
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        })
        if (error) { setError(errorMessage(error.message)); setLoading(false); return }
        setSuccess('Email adresinizi doğrulayın. Gelen kutunuzu kontrol edin.')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        })
        if (error) { setError(errorMessage(error.message)); setLoading(false); return }
        setSuccess('Şifre sıfırlama emaili gönderildi. Gelen kutunuzu kontrol edin.')
      }
    } catch {
      setError('Beklenmeyen bir hata oluştu')
    }

    setLoading(false)
  }

  function errorMessage(msg: string): string {
    if (msg.includes('Invalid login credentials')) return 'Email veya şifre hatalı'
    if (msg.includes('Email not confirmed')) return 'Lütfen emailinizi doğrulayın'
    if (msg.includes('User already registered')) return 'Bu email adresi zaten kayıtlı'
    if (msg.includes('Password should be at least')) return 'Şifre en az 6 karakter olmalı'
    if (msg.includes('Unable to validate email')) return 'Geçersiz email adresi'
    return msg
  }

  function switchMode(newMode: Mode) {
    setMode(newMode)
    setError(null)
    setSuccess(null)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #1a1c4e 0%, #2b2d6e 40%, #3d3f8f 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #4a4db0, #7c7fe0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 28,
            boxShadow: '0 8px 32px rgba(74,77,176,0.4)',
            marginBottom: 16,
          }}>F</div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Finans Asistan</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 4 }}>
            {mode === 'login' ? 'Hesabınıza giriş yapın' : mode === 'signup' ? 'Yeni hesap oluşturun' : 'Şifrenizi sıfırlayın'}
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.12)',
          padding: 28,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}>
          {/* Mode Tabs (login / signup only) */}
          {mode !== 'reset' && (
            <div style={{
              display: 'flex',
              background: 'rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: 4,
              marginBottom: 24,
            }}>
              {(['login', 'signup'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 9, border: 'none',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: mode === m ? 'rgba(255,255,255,0.15)' : 'transparent',
                    color: mode === m ? '#fff' : 'rgba(255,255,255,0.5)',
                    boxShadow: mode === m ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  {m === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Name field - signup only */}
            {mode === 'signup' && (
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Ad Soyad</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Adınız Soyadınız"
                  required
                  autoComplete="name"
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                required
                autoComplete="email"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Password - not on reset */}
            {mode !== 'reset' && (
              <div>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Şifre</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(229,72,77,0.15)', border: '1px solid rgba(229,72,77,0.3)',
                color: '#ff8589', fontSize: 13, fontWeight: 500,
              }}>{error}</div>
            )}

            {/* Success */}
            {success && (
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(48,164,108,0.15)', border: '1px solid rgba(48,164,108,0.3)',
                color: '#4ade80', fontSize: 13, fontWeight: 500,
              }}>{success}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '13px 0', borderRadius: 12, border: 'none',
                background: loading ? 'rgba(255,255,255,0.15)' : 'linear-gradient(135deg, #4a4db0, #6366f1)',
                color: '#fff', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, boxShadow: loading ? 'none' : '0 4px 16px rgba(99,102,241,0.4)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Lütfen bekleyin...' : mode === 'login' ? 'Giriş Yap' : mode === 'signup' ? 'Hesap Oluştur' : 'Sıfırlama Emaili Gönder'}
            </button>
          </form>

          {/* Forgot password link */}
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => switchMode('reset')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Şifremi Unuttum
              </button>
            </div>
          )}

          {/* Back to login from reset */}
          {mode === 'reset' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => switchMode('login')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Giriş sayfasına dön
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
