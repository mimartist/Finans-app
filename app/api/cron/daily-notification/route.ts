import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendPushToAll } from '@/lib/push'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Payment = {
  name: string
  amount: number
  currency: string
  day: number
  daysFromToday: number
}

const fmt = (n: number, cur = 'TRY') => {
  const symbols: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$' }
  const sym = symbols[cur] || cur + ' '
  return `${sym}${Math.round(n).toLocaleString('tr-TR')}`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function GET(request: Request) {
  // CRON_SECRET ayarliysa dogru Bearer token zorunlu (Vercel Cron bunu otomatik gonderir).
  // Ayarli degilse yalnizca Vercel Cron user-agent'ina izin ver (gecici geri uyumluluk).
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (!request.headers.get('user-agent')?.includes('vercel-cron')) {
    return NextResponse.json({ error: 'Unauthorized (CRON_SECRET ayarlayin)' }, { status: 401 })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  const telegramConfigured = Boolean(botToken && chatId)
  const pushConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  if (!telegramConfigured && !pushConfigured) {
    return NextResponse.json({ error: 'Ne Telegram ne de Web Push (VAPID) yapılandırılmış' }, { status: 500 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Turkey is UTC+3 (no DST observed since 2016)
  const nowUtc = new Date()
  const tr = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000)
  const year = tr.getUTCFullYear()
  const month = tr.getUTCMonth() + 1 // 1-12
  const todayDay = tr.getUTCDate()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  // Fetch active recurring expenses, loans, credit cards, paid records for this month
  const [
    { data: recurring },
    { data: loans },
    { data: cards },
    { data: paidRecords },
    { data: statements },
  ] = await Promise.all([
    supabase.from('recurring_expenses').select('*').eq('is_active', true),
    supabase.from('loans').select('*').eq('is_active', true),
    supabase.from('credit_cards').select('*').eq('is_active', true),
    supabase.from('recurring_payments').select('expense_id,loan_id,notes').eq('period_year', year).eq('period_month', month).eq('is_paid', true),
    supabase.from('credit_card_statements').select('card_id,total_amount,is_paid').eq('period_year', year).eq('period_month', month),
  ])

  const paid = paidRecords || []
  const paidExpenseIds = new Set(paid.map((p: any) => p.expense_id).filter(Boolean))
  const isLoanPaid = (id: number) => paid.some((p: any) => p.loan_id === id || p.notes === `loan_${id}`)
  const isCardPaid = (id: number) => paid.some((p: any) => p.notes === `cc_${id}`)

  const overdue: Payment[] = []
  const today: Payment[] = []
  const upcoming: Payment[] = []

  const add = (p: Payment) => {
    if (p.daysFromToday < 0) overdue.push(p)
    else if (p.daysFromToday === 0) today.push(p)
    else if (p.daysFromToday <= 3) upcoming.push(p)
  }

  // Odeme gunu ay sonundan buyukse ayin son gunune cek (31 -> 30/28)
  const clampDay = (day: number) => Math.min(day, daysInMonth)

  // Bu ay odenmisse ay sonunda yaklasan gelecek-ay taksitini de hatirlat
  const addMonthly = (name: string, amount: number, currency: string, day: number, paidThisMonth: boolean) => {
    const diff = clampDay(day) - todayDay
    if (!paidThisMonth) {
      add({ name, amount, currency, day, daysFromToday: diff })
    } else {
      const nextDiff = day + daysInMonth - todayDay
      if (nextDiff <= 3) add({ name, amount, currency, day, daysFromToday: nextDiff })
    }
  }

  // Recurring expenses (exclude non-recurring / one_time for daily reminders)
  for (const r of (recurring || [])) {
    if (!r.payment_day && r.expense_type !== 'one_time') continue
    if (r.expense_type === 'one_time') {
      if (paidExpenseIds.has(r.id)) continue
      if (r.expense_date) {
        const d = new Date(r.expense_date)
        const diffDays = Math.round((d.getTime() - new Date(`${year}-${String(month).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`).getTime()) / 86400000)
        if (diffDays >= -30 && diffDays <= 7) {
          add({ name: r.name, amount: r.amount, currency: r.currency, day: d.getDate(), daysFromToday: diffDays })
        }
      }
      continue
    }
    addMonthly(r.name, r.amount, r.currency, r.payment_day, paidExpenseIds.has(r.id))
  }

  // Loans
  for (const l of (loans || [])) {
    if (!l.payment_day) continue
    addMonthly(l.name, l.monthly_payment, l.currency, l.payment_day, isLoanPaid(l.id))
  }

  // Credit cards (only with statements that aren't paid)
  for (const c of (cards || [])) {
    const stmt = (statements || []).find((s: any) => s.card_id === c.id)
    if (!stmt || stmt.is_paid || !stmt.total_amount || isCardPaid(c.id)) continue
    const dueDay = c.due_day || 10
    add({ name: `${c.name} (KK)`, amount: stmt.total_amount, currency: c.currency || 'TRY', day: dueDay, daysFromToday: clampDay(dueDay) - todayDay })
  }

  const totalCount = overdue.length + today.length + upcoming.length
  if (totalCount === 0) {
    // Don't spam if nothing due
    return NextResponse.json({ sent: false, reason: 'No payments due' })
  }

  overdue.sort((a, b) => a.daysFromToday - b.daysFromToday)
  upcoming.sort((a, b) => a.daysFromToday - b.daysFromToday)

  // ── Telegram mesaji (HTML) ────────────────────────────────────────────────
  const line = (p: Payment) => `• ${escapeHtml(p.name)} — <b>${fmt(p.amount, p.currency)}</b>`
  const parts: string[] = []
  const dateStr = tr.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' })
  parts.push(`🌅 <b>Günaydın!</b>  <i>${dateStr}</i>`)

  if (overdue.length) {
    parts.push('')
    parts.push(`⚠️ <b>Gecikmiş (${overdue.length})</b>`)
    overdue.forEach(p => parts.push(line(p) + `  <i>${Math.abs(p.daysFromToday)} gün geçti</i>`))
  }
  if (today.length) {
    parts.push('')
    parts.push(`📅 <b>Bugün (${today.length})</b>`)
    today.forEach(p => parts.push(line(p)))
  }
  if (upcoming.length) {
    parts.push('')
    parts.push(`🔜 <b>Yaklaşan (3 gün)</b>`)
    upcoming.forEach(p => parts.push(line(p) + `  <i>${p.daysFromToday} gün sonra</i>`))
  }

  // Totals (TRY only for simplicity)
  const totalTry = [...overdue, ...today].filter(p => p.currency === 'TRY').reduce((s, p) => s + p.amount, 0)
  if (totalTry > 0) {
    parts.push('')
    parts.push(`<b>Bugüne kadar toplam:</b> ${fmt(totalTry)}`)
  }

  const text = parts.join('\n')

  // ── Web Push mesaji (duz metin, kisa) ─────────────────────────────────────
  const pushTitleBits: string[] = []
  if (overdue.length) pushTitleBits.push(`${overdue.length} gecikmiş`)
  if (today.length) pushTitleBits.push(`${today.length} bugün`)
  if (upcoming.length) pushTitleBits.push(`${upcoming.length} yaklaşan`)
  const pushLines = [...overdue, ...today, ...upcoming]
    .slice(0, 5)
    .map(p => {
      const when = p.daysFromToday < 0 ? `${Math.abs(p.daysFromToday)} gün gecikti` : p.daysFromToday === 0 ? 'bugün' : `${p.daysFromToday} gün sonra`
      return `${p.name}: ${fmt(p.amount, p.currency)} (${when})`
    })
  if (totalCount > 5) pushLines.push(`… ve ${totalCount - 5} ödeme daha`)

  const results: Record<string, any> = {
    counts: { overdue: overdue.length, today: today.length, upcoming: upcoming.length },
  }

  // ── Kanallara gonder ──────────────────────────────────────────────────────
  if (telegramConfigured) {
    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      })
      const tgJson = await tgRes.json()
      results.telegram = tgJson.ok ? 'sent' : tgJson
      if (!tgJson.ok) console.error('Telegram send failed:', tgJson)
    } catch (err: any) {
      results.telegram = { error: err?.message }
      console.error('Telegram send failed:', err)
    }
  }

  if (pushConfigured) {
    results.push = await sendPushToAll({
      title: `💰 Ödeme hatırlatması: ${pushTitleBits.join(', ')}`,
      body: pushLines.join('\n'),
      url: '/',
      tag: 'finans-daily',
    })
  }

  const anySent = results.telegram === 'sent' || (results.push?.sent ?? 0) > 0
  return NextResponse.json({ sent: anySent, ...results })
}
