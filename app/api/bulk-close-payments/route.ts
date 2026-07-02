import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Ödeme kayıtları oluşturan bir uç — yalnızca giriş yapmış kullanıcı
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, supabaseKey)
  const { excludeMonth, excludeYear } = await req.json()

  const [{ data: loans }, { data: expenses }] = await Promise.all([
    supabase.from('loans').select('*').eq('is_active', true),
    supabase.from('recurring_expenses').select('*').eq('is_active', true),
  ])

  const now = new Date()
  const records: any[] = []

  for (let i = 1; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const year = d.getFullYear()
    const month = d.getMonth() + 1

    if (year === excludeYear && month === excludeMonth) continue

    const { data: existing } = await supabase
      .from('recurring_payments')
      .select('expense_id, notes')
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('is_paid', true)

    const paidExpenseIds = new Set((existing || []).map((e: any) => e.expense_id).filter(Boolean))
    const paidLoanNotes = new Set((existing || []).map((e: any) => e.notes).filter(Boolean))

    for (const loan of (loans || [])) {
      if (!loan.payment_day) continue
      const noteKey = `loan_${loan.id}`
      if (paidLoanNotes.has(noteKey)) continue
      records.push({
        expense_id: null,
        notes: noteKey,
        period_year: year,
        period_month: month,
        amount: loan.monthly_payment,
        is_paid: true,
        paid_date: `${year}-${String(month).padStart(2, '0')}-${String(loan.payment_day).padStart(2, '0')}`,
      })
    }

    for (const exp of (expenses || [])) {
      if (!exp.payment_day) continue
      if (exp.expense_type === 'one_time') continue
      if (paidExpenseIds.has(exp.id)) continue
      records.push({
        expense_id: exp.id,
        period_year: year,
        period_month: month,
        amount: exp.amount,
        is_paid: true,
        paid_date: `${year}-${String(month).padStart(2, '0')}-${String(exp.payment_day).padStart(2, '0')}`,
      })
    }
  }

  if (records.length === 0) {
    return NextResponse.json({ message: 'Tum odemeler zaten kapali', count: 0 })
  }

  const { error } = await supabase.from('recurring_payments').insert(records)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: `${records.length} odeme kapatildi`, count: records.length })
}
