import { Navigate, Outlet } from 'react-router-dom'
import { useProfile } from '../../features/profile/hooks/ProfileProvider'
import { Loading } from '../../components/shared/Loading'
import { ErrorNotice } from '../../components/shared/Feedback'
export function OnboardingGuard() {
  const { p, loading, error, reload } = useProfile()
  if (loading) return <Loading />
  if (error && !p.onboardingCompleted)
    return (
      <ErrorNotice
        error={error}
        retry={() => {
          void reload()
        }}
      />
    )
  return p.onboardingCompleted ? <Outlet /> : <Navigate to="/onboarding" replace />
}
