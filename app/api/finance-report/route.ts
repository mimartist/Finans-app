import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Tüm finansal veriyi döndürür — yalnızca giriş yapmış kullanıcı erişebilir.
  // Sorgular kullanıcının JWT'siyle çalışır, RLS uygulanır.
  const ctx = await getAuthContext(request)
  if (!ctx) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const { supabase } = ctx

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
