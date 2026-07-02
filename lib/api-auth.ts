import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

// API rotalari icin sunucu tarafi kimlik dogrulama.
// Istemci, Supabase oturum token'ini "Authorization: Bearer <jwt>" ile gonderir;
// token Supabase'e dogrulatilir. Gecersiz/eksik token -> null.
export async function getUserFromRequest(request: Request) {
  const ctx = await getAuthContext(request)
  return ctx?.user ?? null
}

// Kullanici + o kullanicinin JWT'sine bagli Supabase istemcisi.
// Bu istemciyle yapilan sorgular RLS'e "authenticated" rolüyle tabidir,
// yani rota yalnizca istegi atan kullanicinin verisine erisebilir.
export async function getAuthContext(
  request: Request
): Promise<{ user: User; supabase: SupabaseClient } | null> {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return { user: data.user, supabase }
}
