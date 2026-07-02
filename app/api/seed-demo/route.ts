import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // Güvenlik: tüm verileri silip demo veri yükler — yalnızca giriş yapmış kullanıcı çalıştırabilir.
  // Sorgular kullanıcının JWT'siyle çalışır, RLS uygulanır.
  const ctx = await getAuthContext(req)
  if (!ctx) {
    return NextResponse.json({ success: false, error: 'Yetkisiz. Giriş yapmanız gerekiyor.' }, { status: 401 })
  }
  const { supabase, user } = ctx
  const uid = { user_id: user.id }

  // Hata olursa sessizce devam etmek yerine bildir
  const run = async <T,>(label: string, p: PromiseLike<{ error: any; data?: T | null }>): Promise<T | undefined> => {
    const { error, data } = await p
    if (error) throw new Error(`${label}: ${error.message}`)
    return data ?? undefined
  }

  try {
    const today = new Date()
    const y = today.getFullYear()
    const m = today.getMonth() + 1
    const mm = String(m).padStart(2, '0')

    // ── 0. TEMİZLE (child → parent sırası) ──────────────────
    await run('temizle: kk işlemleri', supabase.from('credit_card_transactions').delete().neq('id', 0))
    await run('temizle: kk ekstreleri', supabase.from('credit_card_statements').delete().neq('id', 0))
    await run('temizle: ödeme kayıtları', supabase.from('recurring_payments').delete().neq('id', 0))
    await run('temizle: yatırım geçmişi', supabase.from('investment_snapshots').delete().neq('id', 0))
    await run('temizle: alacak/verecek', supabase.from('debt_records').delete().neq('id', 0))
    await run('temizle: giderler', supabase.from('recurring_expenses').delete().neq('id', 0))
    await run('temizle: krediler', supabase.from('loans').delete().neq('id', 0))
    await run('temizle: kartlar', supabase.from('credit_cards').delete().neq('id', 0))
    await run('temizle: yatırımlar', supabase.from('investments').delete().neq('id', 0))
    await run('temizle: hesaplar', supabase.from('accounts').delete().neq('id', 0))

    // ── 1. HESAPLAR ──────────────────────────────────────────
    await run('hesaplar', supabase.from('accounts').insert([
      { name: 'Vadesiz TRY', bank: 'Garanti BBVA', type: 'vadesiz', currency: 'TRY', balance: 47850, is_active: true, ...uid },
      { name: 'Vadesiz EUR', bank: 'Garanti BBVA', type: 'vadesiz', currency: 'EUR', balance: 3200, is_active: true, ...uid },
      { name: 'Maaş Hesabı', bank: 'Yapı Kredi', type: 'vadesiz', currency: 'TRY', balance: 28400, is_active: true, ...uid },
      { name: 'Birikim', bank: 'Ziraat Bankası', type: 'vadeli', currency: 'TRY', balance: 120000, is_active: true, ...uid },
    ]))

    // ── 2. KREDİ KARTLARI (uygulamanın kullandığı kolonlar: credit_limit, due_day, statement_day) ──
    await run('kartlar', supabase.from('credit_cards').insert([
      { name: 'Bonus', bank: 'Garanti BBVA', credit_limit: 50000, currency: 'TRY', statement_day: 20, due_day: 8, is_active: true, ...uid },
      { name: 'World', bank: 'Yapı Kredi', credit_limit: 30000, currency: 'TRY', statement_day: 15, due_day: 3, is_active: true, ...uid },
    ]))

    // ── 3. KREDİLER ──────────────────────────────────────────
    await run('krediler', supabase.from('loans').insert([
      {
        name: 'İhtiyaç Kredisi', bank: 'Garanti BBVA', type: 'tuketici', currency: 'TRY',
        original_amount: 100000, remaining_amount: 67500, monthly_payment: 4850,
        payment_day: 15, interest_rate: 4.89, total_installments: 24, paid_installments: 7,
        start_date: `${y - 1}-06-15`, end_date: `${y + 1}-06-15`, is_active: true, ...uid,
      },
      {
        name: 'Araç Kredisi', bank: 'Yapı Kredi', type: 'tasit', currency: 'TRY',
        original_amount: 800000, remaining_amount: 620000, monthly_payment: 18200,
        payment_day: 5, interest_rate: 3.99, total_installments: 48, paid_installments: 10,
        start_date: `${y - 1}-09-05`, end_date: `${y + 3}-09-05`, is_active: true, ...uid,
      },
    ]))

    // ── 4. DÜZENLİ GİDERLER (kolonlar: payment_day, expense_type) ───────────
    await run('giderler', supabase.from('recurring_expenses').insert([
      { name: 'Netflix', category: 'eglence', amount: 299, currency: 'TRY', payment_day: 3, expense_type: 'recurring', is_variable: false, is_active: true, ...uid },
      { name: 'Spotify', category: 'eglence', amount: 79, currency: 'TRY', payment_day: 3, expense_type: 'recurring', is_variable: false, is_active: true, ...uid },
      { name: 'Kira', category: 'konut', amount: 22000, currency: 'TRY', payment_day: 1, expense_type: 'recurring', is_variable: false, is_active: true, ...uid },
      { name: 'İnternet (Türknet)', category: 'fatura', amount: 850, currency: 'TRY', payment_day: 10, expense_type: 'recurring', is_variable: false, is_active: true, ...uid },
      { name: 'Doğalgaz', category: 'fatura', amount: 1200, currency: 'TRY', payment_day: 20, expense_type: 'recurring', is_variable: true, is_active: true, ...uid },
      { name: 'Elektrik', category: 'fatura', amount: 950, currency: 'TRY', payment_day: 25, expense_type: 'recurring', is_variable: true, is_active: true, ...uid },
      { name: 'ChatGPT Plus', category: 'yazilim', amount: 20, currency: 'USD', payment_day: 12, expense_type: 'recurring', is_variable: false, is_active: true, ...uid },
    ]))

    // ── 5. ALACAK / VERECEK ───────────────────────────────────
    await run('alacak/verecek', supabase.from('debt_records').insert([
      { person_name: 'Ahmet Yılmaz', type: 'alacak', amount: 5000, currency: 'TRY', description: 'Ödünç para', transaction_date: `${y}-01-15`, due_date: `${y}-04-30`, is_settled: false, ...uid },
      { person_name: 'Asil Sitesi 3D Proje', type: 'alacak', amount: 300000, currency: 'TRY', description: 'Proje bedeli', transaction_date: `${y}-02-01`, due_date: `${y}-05-31`, is_settled: false, ...uid },
      { person_name: 'Mimosso Maaş', type: 'alacak', amount: 1000, currency: 'EUR', description: 'Aylık maaş', transaction_date: `${y}-${mm}-01`, is_settled: false, is_recurring: true, frequency: 'aylik', expected_day: 1, ...uid },
      { person_name: 'Mehmet Demir', type: 'verecek', amount: 2500, currency: 'TRY', description: 'Borç', transaction_date: `${y}-03-10`, due_date: `${y}-05-10`, is_settled: false, ...uid },
    ]))

    // ── 6. YATIRIMLAR (kolon: avg_cost) ───────────────────────
    await run('yatırımlar', supabase.from('investments').insert([
      { name: 'Altın', symbol: 'XAU', type: 'altin', quantity: 15, avg_cost: 2800, currency: 'TRY', platform: 'Garanti BBVA', is_active: true, ...uid },
      { name: 'BIST100 Endeks Fonu', symbol: 'BNKFON', type: 'fon', quantity: 5000, avg_cost: 4.2, currency: 'TRY', platform: 'Yapı Kredi', is_active: true, ...uid },
      { name: 'Bitcoin', symbol: 'BTC', type: 'kripto', quantity: 0.05, avg_cost: 1800000, currency: 'TRY', platform: 'BtcTurk', is_active: true, ...uid },
    ]))

    // ── 7. KREDİ KARTI EKSTRELERİ (kolonlar: period_year, period_month) ─────
    const cards = await run<any[]>('kart listesi', supabase.from('credit_cards').select('id, name, due_day').limit(2))
    for (const card of (cards || [])) {
      await run('ekstre', supabase.from('credit_card_statements').insert({
        card_id: card.id,
        period_year: y,
        period_month: m,
        total_amount: card.name === 'Bonus' ? 8750 : 4320,
        minimum_payment: card.name === 'Bonus' ? 875 : 432,
        due_date: `${y}-${mm}-${String(card.due_day || 10).padStart(2, '0')}`,
        is_paid: false,
        ...uid,
      }))
    }

    return NextResponse.json({ success: true, message: 'Demo veriler yüklendi!' })
  } catch (err: any) {
    console.error('Seed error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
