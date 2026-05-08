import { createClient } from '@supabase/supabase-js'

export const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
export type Account = {
  id: number
  name: string
  bank: string
  type: string
  currency: string
  balance: number
  notes?: string
  is_active: boolean
  updated_at: string
}

export type Loan = {
  id: number
  name: string
  bank: string
  type: string
  currency: string
  original_amount: number
  remaining_amount: number
  monthly_payment: number
  payment_day: number
  total_installments: number
  paid_installments: number
  interest_rate: number
  start_date: string
  end_date: string
  collateral?: string
  notes?: string
  is_active: boolean
}

export type CreditCard = {
  id: number
  name: string
  bank: string
  card_type: string
  limit_amount: number
  statement_day: number
  due_day: number
  is_active: boolean
}

export type CreditCardStatement = {
  id: number
  card_id: number
  period_year: number
  period_month: number
  total_amount: number
  minimum_payment: number
  due_date: string
  is_paid: boolean
  paid_amount?: number
}

export type RecurringExpense = {
  id: number
  name: string
  category: string
  subcategory?: string
  amount: number
  currency: string
  payment_day?: number
  is_variable: boolean
  is_active: boolean
  remind_days_before: number
  expense_type: 'recurring' | 'one_time'
  expense_date?: string
  end_date?: string
}

export type DebtRecord = {
  id: number
  person_name: string
  type: 'alacak' | 'verecek'
  amount: number
  currency: string
  description?: string
  transaction_date: string
  due_date?: string
  is_settled: boolean
  notes?: string
  is_recurring?: boolean
  frequency?: string
  expected_day?: number
  total_amount?: number
  paid_amount?: number
}

export type CreditCardTransaction = {
  id: number
  card_id: number
  statement_id?: number
  transaction_date: string
  description: string
  category: string
  amount: number
  currency: string
  created_at?: string
}

export type Investment = {
  id: number
  name: string
  type: string
  symbol?: string
  quantity: number
  avg_cost: number
  currency: string
  platform?: string
  is_active: boolean
}

export type ExchangeRate = {
  id: number
  date: string
  usd_try: number
  eur_try: number
  btc_usd: number
  eth_usd: number
  gold_try: number
}

export type DebtTransaction = {
  id: number
  debt_id: number
  type: 'tahsilat' | 'ilave' | 'ilk_tutar'
  amount: number
  currency: string
  transaction_date: string
  notes?: string
  created_at?: string
}

// Helper: format currency
export function fmt(amount: number, currency = 'TRY'): string {
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  if (currency === 'TRY') {
    return '₺' + amount.toLocaleString('tr-TR', opts)
  }
  if (currency === 'EUR') {
    return '€' + amount.toLocaleString('tr-TR', opts)
  }
  if (currency === 'USD') {
    return '$' + amount.toLocaleString('tr-TR', opts)
  }
  return amount.toLocaleString('tr-TR', opts) + ' ' + currency
}

// Helper: days until payment
export function daysUntil(paymentDay: number): number {
  const today = new Date()
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), paymentDay)
  if (thisMonth < today) {
    thisMonth.setMonth(thisMonth.getMonth() + 1)
  }
  return Math.ceil((thisMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function daysUntilLabel(days: number): string {
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Yarın'
  if (days <= 3) return `${days} gün sonra ⚠️`
  if (days <= 7) return `${days} gün sonra`
  return `${days} gün sonra`
}
