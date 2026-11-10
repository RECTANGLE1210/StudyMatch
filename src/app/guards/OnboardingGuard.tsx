import { Navigate, Outlet } from 'react-router-dom'
import { useLearningProfile } from '../../features/profile/hooks/useLearningProfile'
import { Loading } from '../../components/shared/Loading'
export function OnboardingGuard() {
  const { profile, loading, error, reload } = useLearningProfile()
  if (loading) return <Loading />
  if (error) return <div className="card p-6 m-6" role="alert">{error}<button className="btn btn-o" onClick={reload}>Thử lại</button></div>
  return profile?.onboarding_completed ? <Outlet /> : <Navigate to="/onboarding" replace />
}
