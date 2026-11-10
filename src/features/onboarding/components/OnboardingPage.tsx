import { Navigate, useNavigate } from 'react-router-dom'
import { Onboard } from '../../profile/components/ProfileScreens'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { Loading } from '../../../components/shared/Loading'
import { ErrorNotice } from '../../../components/shared/Feedback'
export function OnboardingPage() {
  const { p, loading, ready, error, reload } = useProfile(),
    navigate = useNavigate()
  if (loading) return <Loading />
  if (p.onboardingCompleted) return <Navigate to="/" replace />
  if (error && !ready)
    return (
      <ErrorNotice
        error={error}
        retry={() => {
          void reload()
        }}
      />
    )
  return <Onboard done={() => navigate('/', { replace: true })} />
}
