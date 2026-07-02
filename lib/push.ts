import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

// VAPID anahtarlari ayarli degilse null doner (push devre disi demektir)
export function getWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:bildirim@finans-asistan.app',
    publicKey,
    privateKey
  )
  return webpush
}

export function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// Kayitli tum tarayici aboneliklerine push gonderir.
// Artik gecersiz olan abonelikleri (404/410) tablodan temizler.
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; total: number; error?: string }> {
  const wp = getWebPush()
  if (!wp) return { sent: 0, total: 0, error: 'VAPID anahtarlari ayarlanmamis' }

  const supabase = serverSupabase()
  const { data: subs, error } = await supabase.from('push_subscriptions').select('id,endpoint,p256dh,auth')
  if (error) return { sent: 0, total: 0, error: error.message }
  if (!subs || subs.length === 0) return { sent: 0, total: 0 }

  let sent = 0
  const expired: number[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await wp.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        )
        sent++
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) expired.push(s.id)
        else console.error('Push send failed:', err?.statusCode, err?.body || err?.message)
      }
    })
  )
  if (expired.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }
  return { sent, total: subs.length }
}
