import { requireSupabase } from './client'
export async function signInWithGoogle() {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/login` },
  })
  if (error) throw error
}
export async function signOut() {
  const { error } = await requireSupabase().auth.signOut()
  if (error) throw error
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
}
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: `${window.location.origin}/login` },
  })
  if (error) throw error
  return data.session
}
export async function requestPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}
export async function resendConfirmation(email: string) {
  const { error } = await requireSupabase().auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: `${window.location.origin}/login` },
  })
  if (error) throw error
}
export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password })
  if (error) throw error
}
