import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/api-auth'
import { sendPushToAll } from '@/lib/push'

export const dynamic = 'force-dynamic'

// Kayitli cihazlara test bildirimi gonderir
export async function POST(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const result = await sendPushToAll({
    title: '🔔 Test Bildirimi',
    body: 'Push bildirimleri çalışıyor! Ödeme hatırlatmaları her sabah bu şekilde gelecek.',
    url: '/',
    tag: 'finans-test',
  })
  if (result.error) return NextResponse.json({ success: false, ...result }, { status: 500 })
  return NextResponse.json({ success: true, ...result })
}
