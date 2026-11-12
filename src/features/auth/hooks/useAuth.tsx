import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../lib/supabase/client'
import { errorMessage } from '../../../lib/utils/errors'
interface AuthState {
  session: Session | null
  loading: boolean
  error: string
  passwordRecovery: boolean
}
const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  error: '',
  passwordRecovery: false,
})
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: Boolean(supabase),
    error: '',
    passwordRecovery: false,
  })
  useEffect(() => {
    if (!supabase) return
    let active = true,
      receivedEvent = false
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      receivedEvent = true
      if (active)
        setState((previous) => ({
          session,
          loading: false,
          error: '',
          passwordRecovery:
            event === 'PASSWORD_RECOVERY' ||
            (event !== 'SIGNED_IN' &&
              Boolean(session) &&
              previous.session?.user.id === session?.user.id &&
              previous.passwordRecovery),
        }))
    })
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !receivedEvent)
          setState({
            session: data.session,
            loading: false,
            error: error ? error.message : '',
            passwordRecovery: false,
          })
      })
      .catch((e) => {
        if (active)
          setState({ session: null, loading: false, error: errorMessage(e), passwordRecovery: false })
      })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
