import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { Loading } from '../../components/shared/Loading'
export function AuthGuard() {
  const { session, loading, error } = useAuth()
  if (loading) return <Loading />
  if (error) return <p role="alert" className="card p-6 m-6">{error}</p>
  return session ? <Outlet /> : <Navigate to="/login" replace />
}
