import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { serverSupabase } from '@/lib/push'

export const dynamic = 'force-dynamic'

// Tarayicinin PushManager aboneligini kaydeder
export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  const sub = body?.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: 'Geçersiz abonelik verisi' }, { status: 400 })
  }

  const supabase = serverSupabase()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      user_agent: request.headers.get('user-agent'),
      user_id: user.id,
    },
    { onConflict: 'endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Aboneligi siler (bildirimler kapatildiginda)
export async function DELETE(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 }) }
  if (!body?.endpoint) return NextResponse.json({ error: 'endpoint gerekli' }, { status: 400 })

  const supabase = serverSupabase()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', body.endpoint)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
