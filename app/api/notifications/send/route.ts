import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// @ts-ignore
import webpush from 'web-push'

const VAPID_PUBLIC_KEY = 'BCb9Kme4S6nPPJNAsV-so2V2NdeCC6KwahVPOiuak18YiHvmKi-K1tKFeY0Mn2GNioj3UNsSAIaOUHFXdot9BN4'
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'GY7PCwoQVsq7PzjJk5sw_dxrTOxm_ifiBZ38MFAF798'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function formatAmount(n: number, cur = 'TRY'): string {
  const s = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(n))
  return cur === 'TRY' ? `${s} ₺` : cur === 'EUR' ? `€${s}` : `$${s}`
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getSupabase()
    if (!supabase) return NextResponse.json({ error: 'DB not configured' }, { status: 503 })

    webpush.setVapidDetails('mailto:finans@asistan.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const now = new Date()
    const today = now.getDate()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    const [{ data: loans }, { data: recurring }, { data: subscriptions }, { data: paidList }] = await Promise.all([
      supabase.from('loans').select('*').eq('is_active', true),
      supabase.from('recurring_expenses').select('*').eq('is_active', true),
      supabase.from('push_subscriptions').select('*'),
      supabase.from('recurring_payments').select('*').eq('period_year', currentYear).eq('period_month', currentMonth).eq('is_paid', true),
    ])

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscribers', sent: 0 })
    }

    const paidIds = new Set((paidList || []).map(p => p.expense_id ? `exp_${p.expense_id}` : p.notes))

    const reminders: { title: string; body: string; tag: string }[] = []

    for (const loan of (loans || [])) {
      if (!loan.payment_day) continue
      const daysUntil = loan.payment_day - today
      const loanTag = `loan_${loan.id}`
      if (paidIds.has(loanTag)) continue

      if (daysUntil === 3) {
        reminders.push({
          title: '🏦 Kredi Taksiti Yaklaşıyor',
          body: `${loan.name} — ${formatAmount(loan.monthly_payment, loan.currency)} · 3 gün sonra`,
          tag: loanTag,
        })
      } else if (daysUntil === 1) {
        reminders.push({
          title: '⚠️ Yarın Kredi Taksiti',
          body: `${loan.name} — ${formatAmount(loan.monthly_payment, loan.currency)} · Yarın son gün!`,
          tag: loanTag,
        })
      } else if (daysUntil === 0) {
        reminders.push({
          title: '🔴 Bugün Kredi Taksiti!',
          body: `${loan.name} — ${formatAmount(loan.monthly_payment, loan.currency)} · Bugün ödeme günü`,
          tag: loanTag,
        })
      } else if (daysUntil < 0) {
        reminders.push({
          title: '❗ Gecikmiş Taksit',
          body: `${loan.name} — ${formatAmount(loan.monthly_payment, loan.currency)} · ${Math.abs(daysUntil)} gün gecikti`,
          tag: loanTag,
        })
      }
    }

    for (const exp of (recurring || [])) {
      if (!exp.payment_day) continue
      if (exp.expense_type === 'one_time' && exp.expense_date) {
        const d = new Date(exp.expense_date)
        if (d.getFullYear() !== currentYear || d.getMonth() + 1 !== currentMonth) continue
      }
      const daysUntil = exp.payment_day - today
      const expTag = `exp_${exp.id}`
      if (paidIds.has(expTag)) continue

      const remindDays = exp.remind_days_before || 3

      if (daysUntil === remindDays) {
        reminders.push({
          title: '📅 Fatura Hatırlatması',
          body: `${exp.name} — ${formatAmount(exp.amount, exp.currency)} · ${remindDays} gün sonra`,
          tag: expTag,
        })
      } else if (daysUntil === 1) {
        reminders.push({
          title: '⚠️ Yarın Ödeme Var',
          body: `${exp.name} — ${formatAmount(exp.amount, exp.currency)} · Yarın son gün!`,
          tag: expTag,
        })
      } else if (daysUntil === 0) {
        reminders.push({
          title: '🔴 Bugün Ödeme Günü!',
          body: `${exp.name} — ${formatAmount(exp.amount, exp.currency)} · Bugün ödenmeli`,
          tag: expTag,
        })
      } else if (daysUntil < 0 && daysUntil >= -3) {
        reminders.push({
          title: '❗ Gecikmiş Ödeme',
          body: `${exp.name} — ${formatAmount(exp.amount, exp.currency)} · ${Math.abs(daysUntil)} gün gecikti`,
          tag: expTag,
        })
      }
    }

    let sentCount = 0
    const failedEndpoints: string[] = []

    for (const reminder of reminders) {
      const payload = JSON.stringify({
        title: reminder.title,
        body: reminder.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: reminder.tag,
        data: { url: '/' },
      })

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
          sentCount++
        } catch (err: any) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            failedEndpoints.push(sub.endpoint)
          }
        }
      }
    }

    if (failedEndpoints.length > 0) {
      for (const ep of failedEndpoints) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', ep)
      }
    }

    return NextResponse.json({
      sent: sentCount,
      reminders: reminders.length,
      subscribers: subscriptions.length,
      cleaned: failedEndpoints.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
