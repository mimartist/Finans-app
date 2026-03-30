import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')

    // ── 1. HESAPLAR ──────────────────────────────────────────
    await supabase.from('accounts').delete().neq('id', 0)
    const { data: accs } = await supabase.from('accounts').insert([
      { name: 'Vadesiz TRY', bank: 'Garanti BBVA', type: 'vadesiz', currency: 'TRY', balance: 47850, is_active: true },
      { name: 'Vadesiz EUR', bank: 'Garanti BBVA', type: 'vadesiz', currency: 'EUR', balance: 3200, is_active: true },
      { name: 'Maaş Hesabı', bank: 'Yapı Kredi', type: 'vadesiz', currency: 'TRY', balance: 28400, is_active: true },
      { name: 'Birikim', bank: 'Ziraat Bankası', type: 'vadeli', currency: 'TRY', balance: 120000, is_active: true },
    ]).select()

    // ── 2. KREDİ KARTLARI ─────────────────────────────────────
    await supabase.from('credit_cards').delete().neq('id', 0)
    await supabase.from('credit_cards').insert([
      { name: 'Bonus', bank: 'Garanti BBVA', credit_limit: 50000, currency: 'TRY', statement_day: 20, payment_day: 8, is_active: true },
      { name: 'World', bank: 'Yapı Kredi', credit_limit: 30000, currency: 'TRY', statement_day: 15, payment_day: 3, is_active: true },
    ])

    // ── 3. KREDİLER ──────────────────────────────────────────
    await supabase.from('loans').delete().neq('id', 0)
    await supabase.from('loans').insert([
      {
        name: 'İhtiyaç Kredisi', bank: 'Garanti BBVA', type: 'tuketici', currency: 'TRY',
        original_amount: 100000, remaining_amount: 67500, monthly_payment: 4850,
        payment_day: 15, interest_rate: 4.89, total_installments: 24, paid_installments: 7,
        start_date: `${y - 1}-06-15`, end_date: `${y + 1}-06-15`, is_active: true,
      },
      {
        name: 'Araç Kredisi', bank: 'Yapı Kredi', type: 'tasit', currency: 'TRY',
        original_amount: 800000, remaining_amount: 620000, monthly_payment: 18200,
        payment_day: 5, interest_rate: 3.99, total_installments: 48, paid_installments: 10,
        start_date: `${y - 1}-09-05`, end_date: `${y + 3}-09-05`, is_active: true,
      },
    ])

    // ── 4. DÜZENLİ GİDERLER ──────────────────────────────────
    await supabase.from('recurring_expenses').delete().neq('id', 0)
    await supabase.from('recurring_expenses').insert([
      { name: 'Netflix', category: 'Eğlence', amount: 299, currency: 'TRY', frequency: 'aylik', expense_day: 3, is_active: true },
      { name: 'Spotify', category: 'Eğlence', amount: 79, currency: 'TRY', frequency: 'aylik', expense_day: 3, is_active: true },
      { name: 'Kira', category: 'Konut', amount: 22000, currency: 'TRY', frequency: 'aylik', expense_day: 1, is_active: true },
      { name: 'İnternet (Türknet)', category: 'Faturalar', amount: 850, currency: 'TRY', frequency: 'aylik', expense_day: 10, is_active: true },
      { name: 'Doğalgaz', category: 'Faturalar', amount: 1200, currency: 'TRY', frequency: 'aylik', expense_day: 20, is_active: true },
      { name: 'Elektrik', category: 'Faturalar', amount: 950, currency: 'TRY', frequency: 'aylik', expense_day: 25, is_active: true },
      { name: 'ChatGPT Plus', category: 'Yazılım', amount: 20, currency: 'USD', frequency: 'aylik', expense_day: 12, is_active: true },
    ])

    // ── 5. ALACAK / VERECEK ───────────────────────────────────
    await supabase.from('debt_records').delete().neq('id', 0)
    await supabase.from('debt_records').insert([
      { person_name: 'Ahmet Yılmaz', type: 'alacak', amount: 5000, currency: 'TRY', description: 'Ödünç para', transaction_date: `${y}-01-15`, due_date: `${y}-04-30`, is_settled: false },
      { person_name: 'Asil Sitesi 3D Proje', type: 'alacak', amount: 300000, currency: 'TRY', description: 'Proje bedeli', transaction_date: `${y}-02-01`, due_date: `${y}-05-31`, is_settled: false },
      { person_name: 'Mimosso Maaş', type: 'alacak', amount: 1000, currency: 'EUR', description: 'Aylık maaş', transaction_date: `${y}-${m}-01`, is_settled: false, is_recurring: true, frequency: 'aylik', expected_day: 1 },
      { person_name: 'Mehmet Demir', type: 'verecek', amount: 2500, currency: 'TRY', description: 'Borç', transaction_date: `${y}-03-10`, due_date: `${y}-05-10`, is_settled: false },
    ])

    // ── 6. YATIRIMLAR ─────────────────────────────────────────
    await supabase.from('investments').delete().neq('id', 0)
    const { data: invs } = await supabase.from('investments').insert([
      { name: 'Altın', symbol: 'XAU', type: 'altin', quantity: 15, purchase_price: 2800, currency: 'TRY', platform: 'Garanti BBVA', purchase_date: `${y - 1}-01-10`, is_active: true },
      { name: 'BIST100 Endeks Fonu', symbol: 'BNKFON', type: 'fon', quantity: 5000, purchase_price: 4.2, currency: 'TRY', platform: 'Yapı Kredi', purchase_date: `${y - 1}-06-01`, is_active: true },
      { name: 'Bitcoin', symbol: 'BTC', type: 'kripto', quantity: 0.05, purchase_price: 1800000, currency: 'TRY', platform: 'BtcTurk', purchase_date: `${y - 1}-09-15`, is_active: true },
    ]).select()

    // ── 7. KREDİ KARTI EKSTRELERİ ────────────────────────────
    const { data: cards } = await supabase.from('credit_cards').select('id, name').limit(2)
    if (cards && cards.length > 0) {
      for (const card of cards) {
        await supabase.from('credit_card_statements').insert({
          card_id: card.id,
          statement_month: `${y}-${m}-01`,
          total_amount: card.name === 'Bonus' ? 8750 : 4320,
          minimum_payment: card.name === 'Bonus' ? 875 : 432,
          due_date: `${y}-${m}-${card.name === 'Bonus' ? '08' : '03'}`,
          is_paid: false,
        })
      }
    }

    // ── 8. DÖNEM GİDERLERİ (Bu ay) ───────────────────────────
    await supabase.from('debt_records').update({}).eq('id', -1) // noop

    return NextResponse.json({ success: true, message: 'Demo veriler yüklendi!' })
  } catch (err: any) {
    console.error('Seed error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
