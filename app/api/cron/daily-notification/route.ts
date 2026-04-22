import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
  // Vercel Cron sends this header; manual runs should provide CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron')
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) {
    return NextResponse.json({ error: 'Telegram env vars not configured' }, { status: 500 })
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

  // Fetch active recurring expenses, loans, credit cards, paid records for this month
  const [
    { data: recurring },
    { data: loans },
    { data: cards },
    { data: paidExpenses },
    { data: paidStatements },
  ] = await Promise.all([
    supabase.from('recurring_expenses').select('*').eq('is_active', true),
    supabase.from('loans').select('*').eq('is_active', true),
    supabase.from('credit_cards').select('*').eq('is_active', true),
    supabase.from('recurring_payments').select('expense_id').eq('period_year', year).eq('period_month', month).eq('is_paid', true),
    supabase.from('credit_card_statements').select('card_id,total_amount,is_paid').eq('period_year', year).eq('period_month', month),
  ])

  const paidExpenseIds = new Set((paidExpenses || []).map((p: any) => p.expense_id))

  const overdue: Payment[] = []
  const today: Payment[] = []
  const upcoming: Payment[] = []

  const add = (p: Payment) => {
    if (p.daysFromToday < 0) overdue.push(p)
    else if (p.daysFromToday === 0) today.push(p)
    else if (p.daysFromToday <= 3) upcoming.push(p)
  }

  // Recurring expenses (exclude non-recurring / one_time for daily reminders)
  for (const r of (recurring || [])) {
    if (!r.payment_day || paidExpenseIds.has(r.id)) continue
    if (r.expense_type === 'one_time') {
      if (r.expense_date) {
        const d = new Date(r.expense_date)
        const diffDays = Math.round((d.getTime() - new Date(`${year}-${String(month).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`).getTime()) / 86400000)
        if (diffDays >= -30 && diffDays <= 7) {
          add({ name: r.name, amount: r.amount, currency: r.currency, day: d.getDate(), daysFromToday: diffDays })
        }
      }
      continue
    }
    add({ name: r.name, amount: r.amount, currency: r.currency, day: r.payment_day, daysFromToday: r.payment_day - todayDay })
  }

  // Loans
  for (const l of (loans || [])) {
    if (!l.payment_day) continue
    add({ name: l.name, amount: l.monthly_payment, currency: l.currency, day: l.payment_day, daysFromToday: l.payment_day - todayDay })
  }

  // Credit cards (only with statements that aren't paid)
  for (const c of (cards || [])) {
    const stmt = (paidStatements || []).find((s: any) => s.card_id === c.id)
    if (!stmt || stmt.is_paid || !stmt.total_amount) continue
    const dueDay = c.due_day || 10
    add({ name: `${c.name} (KK)`, amount: stmt.total_amount, currency: c.currency || 'TRY', day: dueDay, daysFromToday: dueDay - todayDay })
  }

  const totalCount = overdue.length + today.length + upcoming.length
  if (totalCount === 0) {
    // Don't spam if nothing due
    return NextResponse.json({ sent: false, reason: 'No payments due' })
  }

  // Format message
  const line = (p: Payment) => `• ${escapeHtml(p.name)} — <b>${fmt(p.amount, p.currency)}</b>`
  const parts: string[] = []
  const dateStr = tr.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' })
  parts.push(`🌅 <b>Günaydın!</b>  <i>${dateStr}</i>`)

  if (overdue.length) {
    parts.push('')
    parts.push(`⚠️ <b>Gecikmiş (${overdue.length})</b>`)
    overdue.sort((a, b) => a.daysFromToday - b.daysFromToday).forEach(p => parts.push(line(p) + `  <i>${Math.abs(p.daysFromToday)} gün geçti</i>`))
  }
  if (today.length) {
    parts.push('')
    parts.push(`📅 <b>Bugün (${today.length})</b>`)
    today.forEach(p => parts.push(line(p)))
  }
  if (upcoming.length) {
    parts.push('')
    parts.push(`🔜 <b>Yaklaşan (3 gün)</b>`)
    upcoming.sort((a, b) => a.daysFromToday - b.daysFromToday).forEach(p => parts.push(line(p) + `  <i>${p.daysFromToday} gün sonra</i>`))
  }

  // Totals (TRY only for simplicity)
  const totalTry = [...overdue, ...today].filter(p => p.currency === 'TRY').reduce((s, p) => s + p.amount, 0)
  if (totalTry > 0) {
    parts.push('')
    parts.push(`<b>Bugüne kadar toplam:</b> ${fmt(totalTry)}`)
  }

  const text = parts.join('\n')

  // Send to Telegram
  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
  const tgRes = await fetch(telegramUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  const tgJson = await tgRes.json()
  if (!tgJson.ok) {
    console.error('Telegram send failed:', tgJson)
    return NextResponse.json({ sent: false, error: tgJson }, { status: 500 })
  }

  return NextResponse.json({
    sent: true,
    counts: { overdue: overdue.length, today: today.length, upcoming: upcoming.length },
  })
}
