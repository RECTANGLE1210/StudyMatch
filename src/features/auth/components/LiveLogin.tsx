import { Navigate } from 'react-router-dom'
import { Login } from './Login'
import { useAuth } from '../hooks/useAuth'
import { signInWithGoogle } from '../../../lib/supabase/auth'
import { Loading } from '../../../components/shared/Loading'
export function LiveLogin() {
  const { session, loading, error } = useAuth()
  if (loading) return <Loading />
  if (session) return <Navigate to="/" replace />
  return <>{error && <p role="alert">{error}</p>}<Login go={() => {}} onSignIn={signInWithGoogle} /></>
}
