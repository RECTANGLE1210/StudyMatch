import { Navigate } from 'react-router-dom'
import { Login } from './Login'
import { EmailAuthForm, type AuthMode } from './EmailAuthForm'
import { useAuth } from '../hooks/useAuth'
import { Loading } from '../../../components/shared/Loading'
export function LiveLogin({ mode = 'login' }: { mode?: AuthMode }) {
  const { session, loading, error, passwordRecovery } = useAuth()
  const callbackFailed = new URLSearchParams(window.location.search).has('error')
  if (loading) return <Loading />
  if (session && mode !== 'reset') return <Navigate to="/" replace />
  return (
    <Login>
      <EmailAuthForm
        key={mode}
        mode={mode}
        error={
          error ||
          (callbackFailed
            ? 'Liên kết xác nhận hoặc đăng nhập không hợp lệ hay đã hết hạn. Vui lòng thử lại.'
            : '')
        }
        canReset={Boolean(session && passwordRecovery && !callbackFailed)}
        email={session?.user.email ?? ''}
      />
    </Login>
  )
}
