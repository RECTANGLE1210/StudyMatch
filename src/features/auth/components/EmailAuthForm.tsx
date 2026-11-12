import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { rememberPreference, setRememberPreference } from '../../../lib/supabase/authStorage'
import {
  requestPasswordReset,
  resendConfirmation,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  updatePassword,
} from '../../../lib/supabase/auth'
import { errorMessage } from '../../../lib/utils/errors'
export type AuthMode = 'login' | 'signup' | 'forgot' | 'reset'
const titles = {
  login: 'USER LOGIN',
  signup: 'CREATE ACCOUNT',
  forgot: 'QUÊN MẬT KHẨU',
  reset: 'MẬT KHẨU MỚI',
}
const actions = {
  login: 'LOGIN WITH EMAIL',
  signup: 'CREATE ACCOUNT',
  forgot: 'Gửi liên kết đặt lại',
  reset: 'Lưu mật khẩu mới',
}
const field =
  'flex items-center gap-3 h-12 px-5 rounded-full bg-[#EFECE3] shadow-[inset_2px_3px_6px_rgba(85,63,53,.14),inset_-2px_-2px_5px_rgba(255,255,255,.7)]'
const bare =
  'flex-1 min-w-0 !bg-transparent !border-0 !p-0 !shadow-none !rounded-none text-sm text-[#553F35] placeholder:text-[#8C786E]'
const button = 'w-full min-h-11 px-4 rounded-full bg-forest text-white text-sm font-bold disabled:opacity-60'
function authError(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === 'invalid_credentials') return 'Email hoặc mật khẩu chưa đúng.'
  if (code === 'email_not_confirmed')
    return 'Bạn cần xác nhận email trước khi đăng nhập. Kiểm tra hộp thư hoặc gửi lại email xác nhận.'
  if (code === 'user_already_exists')
    return 'Không thể đăng ký bằng thông tin này. Hãy đăng nhập hoặc dùng Quên mật khẩu.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.'
  return errorMessage(error)
}
const GoogleG = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
    <path
      fill="#EA4335"
      d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
    />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
    <path
      fill="#34A853"
      d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"
    />
  </svg>
)

export function EmailAuthForm({
  mode,
  canReset,
  email: accountEmail,
  error: authFailure,
}: {
  mode: AuthMode
  canReset: boolean
  email: string
  error: string
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [sent, setSent] = useState(false),
    [resendEmail, setResendEmail] = useState('')
  const active = useRef(true),
    pending = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const run = async (work: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await work()
    } catch (e) {
      if (active.current) {
        setError(authError(e))
        if ((e as { code?: string }).code === 'email_not_confirmed') setResendEmail(email.trim())
      }
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }
  const invalidReset = mode === 'reset' && !canReset
  return (
    <div className="text-[#553F35] my-auto w-full">
      <h2 className="text-center text-[26px] font-extrabold tracking-[0.04em]">{titles[mode]}</h2>
      <p className="text-center text-sm text-[#7D685E] mt-1 mb-5">
        {mode === 'login'
          ? 'Welcome to the website'
          : mode === 'signup'
            ? 'Tạo tài khoản bằng email của bạn'
            : mode === 'forgot'
              ? 'Nhận liên kết đặt lại mật khẩu qua email'
              : accountEmail}
      </p>
      {invalidReset ? (
        <p role="alert" className="text-sm bg-caramel-soft rounded-xl p-3">
          Liên kết đặt lại không hợp lệ hoặc đã hết hạn. Hãy gửi yêu cầu mới và mở liên kết trong cùng trình
          duyệt đã yêu cầu.
        </p>
      ) : (
        !sent && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if ((mode === 'signup' || mode === 'reset') && password !== confirm) {
                setError('Mật khẩu xác nhận chưa khớp.')
                return
              }
              void run(async () => {
                if (mode === 'login') await signInWithEmail(email, password)
                else if (mode === 'signup') {
                  const session = await signUpWithEmail(email, password)
                  if (active.current && !session) {
                    setSent(true)
                    setResendEmail(email.trim())
                    setPassword('')
                    setConfirm('')
                    setMessage(
                      'Nếu địa chỉ email có thể đăng ký, bạn sẽ nhận được liên kết xác nhận. Kiểm tra hộp thư và mục thư rác, sau đó đăng nhập.'
                    )
                  }
                } else if (mode === 'forgot') {
                  await requestPasswordReset(email)
                  if (active.current) {
                    setSent(true)
                    setMessage(
                      'Nếu tài khoản tồn tại, liên kết đặt lại mật khẩu sẽ được gửi đến email của bạn. Kiểm tra hộp thư và mục thư rác.'
                    )
                  }
                } else {
                  await updatePassword(password)
                  if (active.current) {
                    setSent(true)
                    setPassword('')
                    setConfirm('')
                    setMessage('Đã lưu mật khẩu mới. Bạn có thể dùng email và mật khẩu này để đăng nhập.')
                  }
                }
              })
            }}
            className="space-y-3"
          >
            {mode !== 'reset' && (
              <label className={field}>
                <span aria-hidden>📧</span>
                <input
                  aria-label="Email"
                  autoComplete="email"
                  type="email"
                  required
                  disabled={busy}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setResendEmail('')
                  }}
                  placeholder="Email"
                  className={bare}
                />
              </label>
            )}
            {mode !== 'forgot' && (
              <label className={field}>
                <span aria-hidden>🔑</span>
                <input
                  aria-label="Password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  type="password"
                  required
                  disabled={busy}
                  minLength={mode === 'login' ? undefined : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'login' ? 'Password' : 'Mật khẩu (ít nhất 8 ký tự)'}
                  className={bare}
                />
              </label>
            )}
            {(mode === 'signup' || mode === 'reset') && (
              <label className={field}>
                <span aria-hidden>🔑</span>
                <input
                  aria-label="Confirm password"
                  autoComplete="new-password"
                  type="password"
                  required
                  disabled={busy}
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className={bare}
                />
              </label>
            )}
            {(mode === 'login' || mode === 'signup') && (
              <div className="flex items-center justify-between text-xs text-[#7D685E]">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    defaultChecked={rememberPreference()}
                    disabled={busy}
                    onChange={(e) => setRememberPreference(e.target.checked)}
                    className="!w-4 !h-4 !p-0 accent-[#365C4A]"
                  />
                  Remember
                </label>
                {mode === 'login' && (
                  <Link
                    to="/forgot-password"
                    onClick={(e) => {
                      if (busy) e.preventDefault()
                    }}
                    className="hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
            )}
            <button type="submit" disabled={busy} className={button}>
              {busy ? 'Đang xử lý…' : actions[mode]}
            </button>
          </form>
        )
      )}
      {!invalidReset && (error || authFailure) && (
        <p role="alert" className="mt-3 text-xs text-[#9a3b2b] bg-[#fbeceb] rounded-xl p-3">
          {error || authFailure}
        </p>
      )}
      {message && (
        <p role="status" className="mt-3 text-sm bg-matcha-soft rounded-xl p-3">
          {message}
        </p>
      )}
      {resendEmail && (
        <button
          type="button"
          className="text-sm underline mt-3"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await resendConfirmation(resendEmail)
              if (active.current)
                setMessage(
                  'Nếu email đang chờ xác nhận, một liên kết xác nhận mới sẽ được gửi đến hộp thư của bạn.'
                )
            })
          }
        >
          Gửi lại email xác nhận
        </button>
      )}
      {(mode === 'login' || mode === 'signup') && (
        <>
          <p className="text-xs text-center opacity-60 my-3">hoặc</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(signInWithGoogle)}
            className={`${button} flex items-center justify-center gap-3 shadow-lg`}
          >
            <span className="w-7 h-7 rounded-md bg-white grid place-items-center">
              <GoogleG />
            </span>
            LOGIN WITH GOOGLE
          </button>
        </>
      )}
      <p className="text-center mt-4 text-sm">
        <Link
          className="border-b border-dotted"
          to={
            mode === 'login'
              ? '/signup'
              : mode === 'reset' && sent
                ? '/'
                : invalidReset
                  ? '/forgot-password'
                  : '/login'
          }
          onClick={(e) => {
            if (busy) e.preventDefault()
          }}
        >
          {mode === 'login'
            ? 'Create Account'
            : mode === 'reset' && sent
              ? 'Tiếp tục vào StudyMatch'
              : invalidReset
                ? 'Gửi liên kết mới'
                : 'Quay lại đăng nhập'}
        </Link>
      </p>
    </div>
  )
}
