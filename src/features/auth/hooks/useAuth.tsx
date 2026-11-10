import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase/client'
import { errorMessage } from '../../../lib/utils/errors'
interface AuthState { session: Session | null; loading: boolean; error: string }
const AuthContext = createContext<AuthState>({ session: null, loading: true, error: '' })
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: Boolean(supabase), error: '' })
  useEffect(() => {
    if (!supabase) return
    let active = true, receivedEvent = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedEvent = true
      if (active) setState({ session, loading: false, error: '' })
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedEvent) setState({ session: data.session, loading: false, error: error ? error.message : '' })
    }).catch(e => { if (active) setState({ session: null, loading: false, error: errorMessage(e) }) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
