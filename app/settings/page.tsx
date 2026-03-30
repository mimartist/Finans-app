'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { supabase, isDemo } from '@/lib/supabase'
import { IconSettings, IconRefresh } from '@/components/Icons'
import { useAppLock } from '@/components/AppLock'

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
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [rateUpdating, setRateUpdating] = useState(false)
  const [rateMsg, setRateMsg] = useState('')
  const [saved, setSaved] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')

  // PIN yönetimi
  const { isPinSet, setPin, removePin } = useAppLock()
  const [pinModal, setPinModal] = useState<'set' | 'change' | 'remove' | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [pinOld, setPinOld] = useState('')
  const [pinMsg, setPinMsg] = useState('')
  const [pinHasValue, setPinHasValue] = useState(false)

  useEffect(() => {
    setSettings(loadSettings())
    setPinHasValue(isPinSet())
  }, [])

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
      const res = await fetch('/api/seed-demo', { method: 'POST' })
      const data = await res.json()
      setSeedMsg(data.success ? '✓ Demo veriler yüklendi! Sayfa yenileniyor...' : 'Hata: ' + data.error)
      if (data.success) setTimeout(() => window.location.href = '/', 1500)
    } catch { setSeedMsg('Bağlantı hatası') }
    setSeeding(false)
  }

  async function updateRates() {
    setRateUpdating(true); setRateMsg('')
    try {
      const res = await fetch('/api/update-rates')
      const data = await res.json()
      setRateMsg(data.success ? 'Kurlar guncellendi!' : 'Hata: ' + (data.error || 'Bilinmeyen'))
    } catch { setRateMsg('Baglanti hatasi') }
    setRateUpdating(false)
  }

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <div className="text-[11px] font-bold uppercase tracking-wider mb-3 px-1" style={{ color: 'var(--muted)' }}>{title}</div>
      <div className="card rounded-2xl overflow-hidden">
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
      <div className="bg-blobs"><div className="bg-blob-3" /><div className="bg-blob-4" /></div>
      <BottomNav />
      <div className="app-main pb-32 page-enter">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--bg4)' }}>
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
          {/* Profil */}
          <Section title="Profil">
            <Row label="Kullanici Adi" desc="Dashboard'da gorunecek isim">
              <input value={settings.userName} onChange={e => update('userName', e.target.value)}
                className="text-[13px] font-medium text-right rounded-lg px-3 py-1.5"
                style={{ background: 'var(--bg4)', border: 'none', width: 140, color: 'var(--text)' }} />
            </Row>
            <Row label="Varsayilan Para Birimi">
              <select value={settings.defaultCurrency} onChange={e => update('defaultCurrency', e.target.value)}
                className="text-[13px] font-medium rounded-lg px-3 py-1.5"
                style={{ background: 'var(--bg4)', border: 'none', color: 'var(--text)' }}>
                <option value="TRY">₺ TRY</option>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </Row>
          </Section>

          {/* Bildirimler */}
          <Section title="Bildirimler">
            <Row label="Hatirlatma Zamani" desc="Odeme gununen kac gun once">
              <select value={settings.remindDaysBefore} onChange={e => update('remindDaysBefore', Number(e.target.value))}
                className="text-[13px] font-medium rounded-lg px-3 py-1.5"
                style={{ background: 'var(--bg4)', border: 'none', color: 'var(--text)' }}>
                <option value={1}>1 gun once</option>
                <option value={2}>2 gun once</option>
                <option value={3}>3 gun once</option>
                <option value={5}>5 gun once</option>
                <option value={7}>7 gun once</option>
              </select>
            </Row>
            <Row label="Gecmis Odeme Uyarilari" desc="Tarihi gecmis odemeler icin uyari goster">
              <Toggle value={settings.overdueAlerts} onChange={v => update('overdueAlerts', v)} />
            </Row>
          </Section>

          {/* Gorunum */}
          <Section title="Gorunum">
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
                style={{ background: 'var(--bg4)', border: 'none', color: 'var(--text)' }}>
                <option value="tr">Turkce</option>
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
                  style={{ background: 'rgba(43,45,110,0.08)', color: '#2b2d6e' }}>
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
            <Row label="Doviz Kurlarini Guncelle" desc="TCMB, CoinGecko, Yahoo Finance">
              <button onClick={updateRates} disabled={rateUpdating || isDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(43,45,110,0.08)', color: '#2b2d6e', border: 'none', cursor: 'pointer', opacity: rateUpdating ? 0.5 : 1 }}>
                <IconRefresh size={12} color="#2b2d6e" strokeWidth={2.5} />
                {rateUpdating ? 'Guncelleniyor...' : 'Guncelle'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="card p-5 w-full max-w-sm">
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
