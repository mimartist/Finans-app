import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Tüm finansal veriyi döndürür — yalnızca giriş yapmış kullanıcı erişebilir
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.json({ error: 'env missing' }, { status: 500 })
  const supabase = createClient(url, key)

  const [
    { data: accounts }, { data: loans }, { data: recurring },
    { data: alacak }, { data: verecek }, { data: rates },
    { data: cards }, { data: statements }, { data: investments },
    { data: snapshots },
  ] = await Promise.all([
    supabase.from('accounts').select('*').eq('is_active', true),
    supabase.from('loans').select('*').eq('is_active', true),
    supabase.from('recurring_expenses').select('*').eq('is_active', true).order('payment_day'),
    supabase.from('debt_records').select('*').eq('type', 'alacak').eq('is_settled', false),
    supabase.from('debt_records').select('*').eq('type', 'verecek').eq('is_settled', false),
    supabase.from('exchange_rates').select('*').order('date', { ascending: false }).limit(1),
    supabase.from('credit_cards').select('*').eq('is_active', true),
    supabase.from('credit_card_statements').select('*').eq('period_year', new Date().getFullYear()).eq('period_month', new Date().getMonth() + 1),
    supabase.from('investments').select('*').eq('is_active', true),
    supabase.from('investment_snapshots').select('*').order('snapshot_date', { ascending: false }),
  ])

  return NextResponse.json({
    rates: rates?.[0] || null,
    accounts: accounts || [],
    loans: loans || [],
    recurring: (recurring || []).filter((r: any) => r.expense_type === 'recurring'),
    alacak: alacak || [],
    verecek: verecek || [],
    cards: cards || [],
    statements: statements || [],
    investments: investments || [],
    snapshots: snapshots || [],
  })
}
