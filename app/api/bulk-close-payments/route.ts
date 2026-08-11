import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/api-auth'
import { loanNote, isLoanPayment, isActiveInMonth } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Ödeme kayıtları oluşturan bir uç — yalnızca giriş yapmış kullanıcı.
  // Sorgular kullanıcının JWT'siyle çalışır, RLS uygulanır.
  const ctx = await getAuthContext(req)
  if (!ctx) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  const { supabase, user } = ctx
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
      .select('*')
      .eq('period_year', year)
      .eq('period_month', month)
      .eq('is_paid', true)

    const paidExpenseIds = new Set((existing || []).map((e: any) => e.expense_id).filter(Boolean))
    const paidRows = existing || []

    for (const loan of (loans || [])) {
      if (!loan.payment_day) continue
      // O ayda henüz başlamamış / bitmiş plan için ödeme kaydı uydurma
      if (!isActiveInMonth(loan.start_date, loan.end_date, year, month)) continue
      if (paidRows.some((p: any) => isLoanPayment(p, loan.id))) continue
      records.push({
        expense_id: null,
        loan_id: loan.id,
        notes: loanNote(loan.id),
        period_year: year,
        period_month: month,
        amount: loan.monthly_payment,
        is_paid: true,
        paid_date: `${year}-${String(month).padStart(2, '0')}-${String(loan.payment_day).padStart(2, '0')}`,
        user_id: user.id,
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
        user_id: user.id,
      })
    }
  }

  if (records.length === 0) {
    return NextResponse.json({ message: 'Tum odemeler zaten kapali', count: 0 })
  }

  let { error } = await supabase.from('recurring_payments').insert(records)
  // loan_id kolonu henüz migrate edilmemişse kolonsuz tekrar dene —
  // krediyle bağ notes içindeki "loan_<id>" öneki ile korunur
  if (error && (error.code === '42703' || error.message.includes('column'))) {
    const stripped = records.map(({ loan_id, ...rest }) => rest)
    ;({ error } = await supabase.from('recurring_payments').insert(stripped))
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: `${records.length} odeme kapatildi`, count: records.length })
}
