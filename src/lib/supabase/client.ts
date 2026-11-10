import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env'
export const supabase = env.configured ? createClient(env.url, env.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null
export function requireSupabase() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình. Xem .env.example.')
  return supabase
}
