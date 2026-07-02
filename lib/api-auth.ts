import { createClient } from '@supabase/supabase-js'

// API rotalari icin sunucu tarafi kimlik dogrulama.
// Istemci, Supabase oturum token'ini "Authorization: Bearer <jwt>" ile gonderir;
// token Supabase'e dogrulatilir. Gecersiz/eksik token -> null.
export async function getUserFromRequest(request: Request) {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
