'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { supabase, isDemo, authHeaders } from '@/lib/supabase'
import { IconSettings, IconRefresh } from '@/components/Icons'
import { useAppLock } from '@/components/AppLock'
import { useUser } from '@/components/AuthProvider'

type Settings = {
  userName: string
  defaultCurrency: string
  remindDaysBefore: number
  overdueAlerts: boolean
  theme: 'light' | 'dark'
  language: string
}

const defaultSettings: Settings = {
  userName: 'Atakan',
  defaultCurrency: 'TRY',
  remindDaysBefore: 3,
  overdueAlerts: true,
  theme: 'light',
  language: 'tr',
}

function loadSettings(): Settings {
  if (typeof window === 'undefined') return defaultSettings
  try {
    const saved = localStorage.getItem('finans_settings')
    if (saved) return { ...defaultSettings, ...JSON.parse(saved) }
  } catch {}
  return defaultSettings
}

function saveSettings(s: Settings) {
  localStorage.setItem('finans_settings', JSON.stringify(s))
}

export default function SettingsPage() {
  const router = useRouter()
  const { user } = useUser()
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [rateUpdating, setRateUpdating] = useState(false)
  const [rateMsg, setRateMsg] = useState('')
  const [saved, setSaved] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  // Auth profile state
  const [profileName, setProfileName] = useState('')
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [pwResetMsg, setPwResetMsg] = useState('')

  // PIN yönetimi
  const { isPinSet, setPin, removePin } = useAppLock()
  const [pinModal, setPinModal] = useState<'set' | 'change' | 'remove' | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinOld, setPinOld] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [pinHasValue, setPinHasValue] = useState(false)

  // Push bildirimleri
  const [pushSupported, setPushSupported] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [isIosBrowser, setIsIosBrowser] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setPinHasValue(isPinSet())

    const supported = typeof window !== 'undefined'
      && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setPushSupported(supported)
    // iOS'ta push yalnizca ana ekrana eklenmis PWA'da calisir — ipucu gostermek icin tespit et
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
    setIsIosBrowser(isIos && !isStandalone)
    if (supported) {
      navigator.serviceWorker.getRegistration()
        .then(reg => reg?.pushManager.getSubscription())
        .then(sub => setPushEnabled(!!sub))
        .catch(() => {})
    }
  }, [])

  function urlBase64ToUint8Array(base64: string) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(b64)
    return Uint8Array.from(Array.from(raw).map(c => c.charCodeAt(0)))
  }

  async function enablePush() {
    setPushBusy(true); setPushMsg('')
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setPushMsg('Hata: NEXT_PUBLIC_VAPID_PUBLIC_KEY ayarlanmamış'); return }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushMsg('Bildirim izni verilmedi. Tarayıcı ayarlarından izin verin.'); return }
      // SW henüz kayıtlı değilse (ilk ziyaret / sayfa yüklenirken tıklama) kendimiz kaydet
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) {
        try {
          reg = await navigator.serviceWorker.register('/sw.js')
        } catch (regErr: any) {
          setPushMsg('Hata: Service worker kaydedilemedi (' + (regErr?.message || regErr) + '). Gizli pencerede push çalışmaz; normal pencerede deneyin.')
          return
        }
      }
      // Abonelik için SW'nin aktifleşmesi gerekir. İlk kurulumda tüm uygulama
      // önbelleğe alındığından yavaş bağlantıda süre uzayabilir — 25 sn bekle,
      // olmazsa teşhis için SW'nin hangi durumda takıldığını göster.
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 25000)),
      ])
      if (!ready) {
        const state = reg.installing ? 'kuruluyor' : reg.waiting ? 'bekliyor' : reg.active ? 'aktif' : 'kurulum başarısız'
        setPushMsg(`Hata: Service worker aktifleşmedi (durum: ${state}). Birkaç saniye bekleyip tekrar deneyin; olmazsa bu mesajı destek için not edin.`)
        return
      }
      const sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        await sub.unsubscribe().catch(() => {})
        setPushMsg('Hata: ' + (data.error || 'abonelik kaydedilemedi'))
        return
      }
      setPushEnabled(true)
      setPushMsg('✓ Push bildirimleri aktif — her sabah 08:00\'de ödeme özeti gelecek')
    } catch (e: any) {
      setPushMsg('Hata: ' + (e?.message || 'bilinmeyen'))
    } finally {
      setPushBusy(false)
    }
  }

  async function disablePush() {
    setPushBusy(true); setPushMsg('')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe()
      }
      setPushEnabled(false)
      setPushMsg('Push bildirimleri kapatıldı')
    } catch (e: any) {
      setPushMsg('Hata: ' + (e?.message || 'bilinmeyen'))
    } finally {
      setPushBusy(false)
    }
  }

  async function testPush() {
    setPushBusy(true); setPushMsg('')
    try {
      const res = await fetch('/api/push/test', { method: 'POST', headers: await authHeaders() })
      const data = await res.json().catch(() => ({}))
      setPushMsg(data.success ? `✓ Test bildirimi gönderildi (${data.sent}/${data.total} cihaz)` : 'Hata: ' + (data.error || 'gönderilemedi'))
    } catch {
      setPushMsg('Hata: bağlantı sorunu')
    } finally {
      setPushBusy(false)
    }
  }

  useEffect(() => {
    if (user) {
      setProfileName(user.user_metadata?.full_name || '')
      setProfileAvatarUrl(user.user_metadata?.avatar_url || '')
    }
  }, [user])

  async function handleProfileSave() {
    if (!user) return
    setProfileSaving(true); setProfileMsg('')
    const { error } = await supabase.auth.updateUser({
      data: { full_name: profileName, avatar_url: profileAvatarUrl },
    })
    setProfileSaving(false)
    setProfileMsg(error ? 'Hata: ' + error.message : 'Kaydedildi')
    if (!error) setTimeout(() => setProfileMsg(''), 2500)
  }

  async function handlePasswordReset() {
    if (!user?.email) return
    setPwResetMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    })
    setPwResetMsg(error ? 'Hata: ' + error.message : 'Şifre sıfırlama maili gönderildi')
    setTimeout(() => setPwResetMsg(''), 4000)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  function getInitials(nameStr: string, email: string) {
    if (nameStr) {
      const parts = nameStr.trim().split(' ')
      return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : nameStr.slice(0, 2).toUpperCase()
    }
    return email ? email[0].toUpperCase() : 'U'
  }

  function update(key: keyof Settings, value: any) {
    const next = { ...settings, [key]: value }
    setSettings(next)
    saveSettings(next)
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value)
      window.dispatchEvent(new Event('finans-theme-change'))
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePinSave() {
    if (!pinInput || pinInput.length < 4) { setPinMsg('En az 4 karakter olmalı'); return }
    if (pinInput !== pinConfirm) { setPinMsg('Şifreler eşleşmiyor'); return }
    await setPin(pinInput)
    setPinHasValue(true)
    setPinModal(null); setPinInput(''); setPinConfirm(''); setPinOld(''); setPinMsg('')
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function handlePinRemove() {
    removePin()
    setPinHasValue(false)
    setPinModal(null); setPinInput(''); setPinConfirm(''); setPinOld(''); setPinMsg('')
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  async function seedDemo() {
    if (!confirm('Mevcut tüm veriler silinip demo veriler yüklenecek. Emin misiniz?')) return
    setSeeding(true); setSeedMsg('')
    try {
      const res = await fetch('/api/seed-demo', { method: 'POST', headers: await authHeaders() })
      const data = await res.json()
      setSeedMsg(data.success ? '✓ Demo veriler yüklendi! Sayfa yenileniyor...' : 'Hata: ' + data.error)
      if (data.success) setTimeout(() => window.location.href = '/', 1500)
    } catch { setSeedMsg('Bağlantı hatası') }
    setSeeding(false)
  }

  async function updateRates() {
    setRateUpdating(true); setRateMsg('')
    try {
      const res = await fetch('/api/update-rates', { headers: await authHeaders() })
      const data = await res.json()
      setRateMsg(data.success ? 'Kurlar güncellendi!' : 'Hata: ' + (data.error || 'Bilinmeyen'))
    } catch { setRateMsg('Bağlantı hatası') }
    setRateUpdating(false)
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="text-[11px] font-bold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--muted)' }}>{title}</div>
      <div className="glass rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  )

  const Row = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex-1 min-w-0 mr-3">
        <div className="text-[13px] font-medium">{label}</div>
        {desc && <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{desc}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button onClick={() => onChange(!value)}
      className="relative"
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? 'linear-gradient(135deg, #2b2d6e, #4a4db0)' : 'var(--border2)',
        transition: 'background 0.2s',
      }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: value ? 23 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )

  return (
    <div className="app-layout">
      <div className="bg-blobs" />
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--glass-fill-soft)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2b2d6e" strokeWidth="2" strokeLinecap="round">
              <path d="M19 12H5" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <div className="text-[11px]" style={{ color: 'var(--muted)' }}>Finans</div>
            <div className="text-lg font-extrabold">Ayarlar</div>
          </div>
          {saved && (
            <div className="ml-auto text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(48,164,108,0.1)', color: '#30a46c' }}>
              Kaydedildi
            </div>
          )}
        </div>

        <div className="px-4">
          {/* Auth Profil */}
          {user && (
            <div className="mb-6">
              <div className="text-[11px] font-bold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--muted)' }}>Hesabım</div>
              <div className="glass-bold rounded-2xl overflow-hidden p-4">
                {/* Avatar + email row */}
                <div className="flex items-center gap-4 mb-4">
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt="avatar"
                        style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                    ) : (
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #2b2d6e, #4a4db0)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 20,
                      }}>
                        {getInitials(profileName, user.email || '')}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-bold truncate">{profileName || 'İsimsiz Kullanıcı'}</div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{user.email}</div>
                  </div>
                </div>

                {/* Name input */}
                <div className="mb-3">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block font-semibold" style={{ color: 'var(--muted)' }}>Ad Soyad</label>
                  <input value={profileName} onChange={e => setProfileName(e.target.value)}
                    placeholder="Adınız Soyadınız" className="input" />
                </div>

                {/* Email (read-only) */}
                <div className="mb-3">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block font-semibold" style={{ color: 'var(--muted)' }}>Email (değiştirilemez)</label>
                  <input value={user.email || ''} readOnly className="input"
                    style={{ opacity: 0.6, cursor: 'not-allowed' }} />
                </div>

                {/* Avatar URL */}
                <div className="mb-4">
                  <label className="text-[11px] uppercase tracking-wide mb-1 block font-semibold" style={{ color: 'var(--muted)' }}>Avatar URL</label>
                  <input value={profileAvatarUrl} onChange={e => setProfileAvatarUrl(e.target.value)}
                    placeholder="https://..." className="input" />
                </div>

                {/* Save button */}
                <button onClick={handleProfileSave} disabled={profileSaving} className="btn-primary w-full py-2.5 text-sm mb-3">
                  {profileSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                {profileMsg && (
                  <div className="text-[11px] font-medium text-center mb-3"
                    style={{ color: profileMsg.includes('Hata') ? '#e5484d' : '#30a46c' }}>
                    {profileMsg}
                  </div>
                )}

                {/* Password reset */}
                <button onClick={handlePasswordReset}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl mb-2"
                  style={{ background: 'var(--glass-fill-soft)', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                  Şifre Değiştir
                </button>
                {pwResetMsg && (
                  <div className="text-[11px] font-medium text-center mb-3"
                    style={{ color: pwResetMsg.includes('Hata') ? '#e5484d' : '#30a46c' }}>
                    {pwResetMsg}
                  </div>
                )}

                {/* Sign out */}
                <button onClick={handleSignOut}
                  className="w-full py-2.5 text-sm font-semibold rounded-xl"
                  style={{ background: 'rgba(220,38,38,0.08)', border: 'none', color: '#dc2626', cursor: 'pointer' }}>
                  Çıkış Yap
                </button>
              </div>
            </div>
          )}

          {/* Profil */}
          <Section title="Profil">
            <Row label="Kullanici Adi" desc="Dashboard'da görecek isim">
              <input value={settings.userName} onChange={e => update('userName', e.target.value)}
                className="text-[13px] font-medium text-right rounded-lg px-3 py-1.5"
                style={{ background: 'var(--glass-fill-soft)', border: 'none', width: 140, color: 'var(--text)' }} />
            </Row>
            <Row label="Varsayilan Para Birimi">
              <select value={settings.defaultCurrency} onChange={e => update('defaultCurrency', e.target.value)}
                className="text-[13px] font-medium rounded-lg px-3 py-1.5"
                style={{ background: 'var(--glass-fill-soft)', border: 'none', color: 'var(--text)' }}>
                <option value="TRY">₺ TRY</option>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </Row>
          </Section>

          {/* Bildirimler */}
          <Section title="Bildirimler">
            <Row label="Push Bildirimleri"
              desc={!pushSupported ? 'Bu tarayıcı desteklemiyor' : pushEnabled ? 'Aktif — her sabah ödeme özeti' : 'Ödeme hatırlatmaları için önerilir'}>
              <div className="flex items-center gap-2">
                {pushEnabled && (
                  <button onClick={testPush} disabled={pushBusy}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--glass-fill-soft)', color: 'var(--text)', border: 'none', cursor: 'pointer', opacity: pushBusy ? 0.5 : 1 }}>
                    Test
                  </button>
                )}
                {pushSupported && <Toggle value={pushEnabled} onChange={v => { if (!pushBusy) (v ? enablePush() : disablePush()) }} />}
              </div>
            </Row>
            {isIosBrowser && (
              <div className="px-4 py-2 text-[11px]" style={{ color: 'var(--muted)' }}>
                📱 iPhone&apos;da push için: Safari&apos;de <b>Paylaş → Ana Ekrana Ekle</b> ile kurun, sonra uygulama içinden açın (iOS 16.4+).
              </div>
            )}
            {pushMsg && (
              <div className="px-4 py-2 text-[11px] font-medium" style={{ color: pushMsg.startsWith('Hata') ? '#e5484d' : '#30a46c' }}>
                {pushMsg}
              </div>
            )}
            <Row label="Hatırlatma Zamani" desc="Ödeme gununen kac gün önce">
              <select value={settings.remindDaysBefore} onChange={e => update('remindDaysBefore', Number(e.target.value))}
                className="text-[13px] font-medium rounded-lg px-3 py-1.5"
                style={{ background: 'var(--glass-fill-soft)', border: 'none', color: 'var(--text)' }}>
                <option value={1}>1 gün önce</option>
                <option value={2}>2 gün önce</option>
                <option value={3}>3 gün önce</option>
                <option value={5}>5 gün önce</option>
                <option value={7}>7 gün önce</option>
              </select>
            </Row>
            <Row label="Geçmiş Ödeme Uyarıları" desc="Tarihi geçmiş ödemeler için uyarı göster">
              <Toggle value={settings.overdueAlerts} onChange={v => update('overdueAlerts', v)} />
            </Row>
          </Section>

          {/* Görünüm */}
          <Section title="Görünüm">
            <Row label="Tema" desc="Açık veya koyu mod">
              <div className="flex gap-1.5">
                {(['light', 'dark'] as const).map(t => (
                  <button key={t} onClick={() => update('theme', t)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                    style={{
                      background: settings.theme === t ? 'rgba(43,45,110,0.1)' : 'var(--bg4)',
                      color: settings.theme === t ? '#2b2d6e' : 'var(--muted)',
                      border: settings.theme === t ? '1px solid rgba(43,45,110,0.2)' : '1px solid transparent',
                    }}>
                    {t === 'light' ? 'Acik' : 'Koyu'}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Dil">
              <select value={settings.language} onChange={e => update('language', e.target.value)}
                className="text-[13px] font-medium rounded-lg px-3 py-1.5"
                style={{ background: 'var(--glass-fill-soft)', border: 'none', color: 'var(--text)' }}>
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </Row>
          </Section>

          {/* Güvenlik */}
          <Section title="Güvenlik">
            <Row label="Uygulama Şifresi"
              desc={pinHasValue ? 'Şifre aktif — uygulama kilitli' : 'Şifre yok — herkese açık'}>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: pinHasValue ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)',
                    color: pinHasValue ? '#059669' : '#dc2626',
                  }}>
                  {pinHasValue ? '🔒 Aktif' : '🔓 Açık'}
                </span>
                <button
                  onClick={() => { setPinModal(pinHasValue ? 'change' : 'set'); setPinMsg(''); setPinInput(''); setPinConfirm(''); setPinOld('') }}
                  className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--accent-light)', color: 'var(--primary)' }}>
                  {pinHasValue ? 'Değiştir' : 'Şifre Koy'}
                </button>
                {pinHasValue && (
                  <button onClick={() => setPinModal('remove')}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                    Kaldır
                  </button>
                )}
              </div>
            </Row>
          </Section>

          {/* Geliştirici / Demo */}
          <Section title="Geliştirici">
            <Row label="Demo Verilerini Yükle" desc="Tüm sayfaları test etmek için örnek veri seti">
              <button onClick={seedDemo} disabled={seeding}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366f1', border: 'none', cursor: 'pointer', opacity: seeding ? 0.5 : 1 }}>
                {seeding ? 'Yükleniyor...' : '🧪 Demo Yükle'}
              </button>
            </Row>
            {seedMsg && (
              <div className="px-4 py-2 text-[11px] font-medium" style={{ color: seedMsg.includes('Hata') ? '#e5484d' : '#30a46c' }}>
                {seedMsg}
              </div>
            )}
          </Section>

          {/* Veri */}
          <Section title="Veri">
            <Row label="Döviz Kurlarını Güncelle" desc="TCMB, CoinGecko, Yahoo Finance">
              <button onClick={updateRates} disabled={rateUpdating || isDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ background: 'var(--accent-light)', color: 'var(--primary)', border: 'none', cursor: 'pointer', opacity: rateUpdating ? 0.5 : 1 }}>
                <IconRefresh size={12} color="var(--primary)" strokeWidth={2.5} />
                {rateUpdating ? 'Güncelleniyor...' : 'Güncelle'}
              </button>
            </Row>
            {rateMsg && (
              <div className="px-4 py-2 text-[11px] font-medium" style={{ color: rateMsg.includes('Hata') || rateMsg.includes('hatasi') ? '#e5484d' : '#30a46c' }}>
                {rateMsg}
              </div>
            )}
            <Row label="Demo Modu" desc={isDemo ? 'Aktif — ornek verilerle calisiyorsunuz' : 'Pasif — gercek veritabani'}>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: isDemo ? 'rgba(229,160,0,0.1)' : 'rgba(48,164,108,0.1)', color: isDemo ? '#e5a000' : '#30a46c' }}>
                {isDemo ? 'Demo' : 'Canli'}
              </span>
            </Row>
          </Section>

          {/* Hakkinda */}
          <Section title="Hakkinda">
            <Row label="Versiyon">
              <span className="text-[13px] mono font-medium" style={{ color: 'var(--muted)' }}>1.0.0</span>
            </Row>
            <Row label="Gelistirici">
              <span className="text-[13px] font-medium" style={{ color: 'var(--muted)' }}>Finans Asistan</span>
            </Row>
            <Row label="Teknoloji">
              <span className="text-[11px] font-medium" style={{ color: 'var(--muted)' }}>Next.js + Supabase</span>
            </Row>
          </Section>
        </div>
      </div>

      {/* PIN Modal */}
      {pinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}>
          <div className="glass-bold p-5 w-full max-w-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(43,45,110,0.08)' }}>
                🔐
              </div>
              <div>
                <div className="text-sm font-bold">
                  {pinModal === 'set' ? 'Şifre Belirle' : pinModal === 'change' ? 'Şifre Değiştir' : 'Şifreyi Kaldır'}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                  {pinModal === 'remove' ? 'Emin misiniz?' : 'En az 4 karakter'}
                </div>
              </div>
            </div>

            {pinModal !== 'remove' ? (
              <div className="flex flex-col gap-3">
                {pinModal === 'change' && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Mevcut Şifre</label>
                    <input type="password" value={pinOld} onChange={e => setPinOld(e.target.value)}
                      placeholder="••••" className="input" autoComplete="current-password" />
                  </div>
                )}
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Yeni Şifre</label>
                  <input type="password" value={pinInput} onChange={e => { setPinInput(e.target.value); setPinMsg('') }}
                    placeholder="••••" className="input" autoComplete="new-password" />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wide mb-1 block" style={{ color: 'var(--muted)' }}>Şifre Tekrar</label>
                  <input type="password" value={pinConfirm} onChange={e => { setPinConfirm(e.target.value); setPinMsg('') }}
                    placeholder="••••" className="input" autoComplete="new-password" />
                </div>
                {pinMsg && <div className="text-[11px] font-medium" style={{ color: '#dc2626' }}>{pinMsg}</div>}
                <div className="flex gap-2 mt-1">
                  <button onClick={() => setPinModal(null)} className="btn-outline flex-1 py-2.5 text-sm">İptal</button>
                  <button onClick={handlePinSave} className="btn-primary flex-1 py-2.5 text-sm">Kaydet</button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="text-[13px] py-2 text-center rounded-lg" style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626' }}>
                  Şifre kaldırılırsa uygulama herkese açık olur
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPinModal(null)} className="btn-outline flex-1 py-2.5 text-sm">İptal</button>
                  <button onClick={handlePinRemove} className="btn-danger flex-1 py-2.5 text-sm">Kaldır</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
