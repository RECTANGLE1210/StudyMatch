import { requireSupabase } from './client'
export async function signInWithGoogle() {
  const { error } = await requireSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/login` } })
  if (error) throw error
}
export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
}
