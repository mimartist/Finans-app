'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, isDemo } from '@/lib/supabase'

type Mode = 'login' | 'signup' | 'reset'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')

  // Giriş yapıldıysa (OAuth veya email) dashboard'a yönlendir
  useEffect(() => {
    if (isDemo) { router.replace('/'); return }
    // Mevcut session kontrolü
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
    })
    // OAuth callback veya giriş olayını dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        router.replace('/')
      }
    })
    return () => subscription.unsubscribe()
  }, [])
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

  async function handleGoogleSignIn() {
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth`,
      },
    })
    if (error) { setError(errorMessage(error.message)); setLoading(false) }
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
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 2 }}>v2.1.0</div>
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

          {/* Google ile giriş */}
          {mode !== 'reset' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 16px' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontWeight: 500 }}>veya</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              </div>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.18)',
                  background: 'rgba(255,255,255,0.95)', color: '#1f1f1f',
                  fontWeight: 600, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ile {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            </>
          )}

          {/* Forgot password link */}
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => switchMode('reset')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
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
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
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
