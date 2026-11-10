import { rememberPreference, setRememberPreference } from '../../../lib/supabase/authStorage'
import { useEffect, useState } from 'react'
import { errorMessage } from '../../../lib/utils/errors'

const wavePath = (x0: number, amp: number, ph: number) => {
  let d = `M${x0} 0`
  for (let y = 0; y <= 640; y += 8)
    d += ` L${(x0 + amp * Math.sin((y / 640) * Math.PI * 7 + ph)).toFixed(1)} ${y}`
  return d + ' L150 640 L150 0 Z'
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
const PillIcon = ({ children }: { children: React.ReactNode }) => (
  <span className="w-8 h-8 rounded-full bg-[#F8F5EE] grid place-items-center shrink-0">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#365C4A"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  </span>
)

export function Login({ onSignIn }: { onSignIn: () => Promise<void> }) {
  const [st, setSt] = useState<'idle' | 'load' | 'err'>('idle')
  const [sc, setSc] = useState(1)
  const [error, setError] = useState('')
  // Always render the horizontal 1100x640 card; scale it down on smaller viewports instead of stacking.
  useEffect(() => {
    const fit = () => setSc(Math.min(1, (window.innerWidth - 24) / 1100, (window.innerHeight - 24) / 640))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const click = async () => {
    setSt('load')
    setError('')
    try {
      await onSignIn()
    } catch (e) {
      setError(errorMessage(e))
      setSt('err')
    }
  }
  const glass =
    'rounded-2xl border border-white/80 bg-white/15 backdrop-blur-xl shadow-[0_16px_30px_-14px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.25)]'
  const field =
    'flex items-center gap-3 h-12 px-5 rounded-full bg-[#EFECE3] shadow-[inset_2px_3px_6px_rgba(85,63,53,.14),inset_-2px_-2px_5px_rgba(255,255,255,.7)]'
  const bare =
    'flex-1 min-w-0 !bg-transparent !border-0 !p-0 !shadow-none !rounded-none text-sm text-[#553F35] placeholder:text-[#8C786E]'
  return (
    <div className="relative min-h-screen grid place-items-center overflow-hidden bg-[#EFECE6]">
      <div
        className="absolute -top-40 -left-32 w-[560px] h-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(167,185,154,.38), transparent 65%)' }}
      />
      <div
        className="absolute -bottom-48 -right-24 w-[620px] h-[620px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(216,156,87,.3), transparent 65%)' }}
      />
      <div className="relative" style={{ width: 1100 * sc, height: 640 * sc }}>
        <main
          className="absolute top-0 left-0 w-[1100px] h-[640px] flex flex-row overflow-hidden rounded-[32px] shadow-[0_2px_4px_rgba(53,39,33,.08),0_12px_24px_rgba(53,39,33,.12),0_40px_80px_-10px_rgba(53,39,33,.3),0_70px_120px_-30px_rgba(53,39,33,.3)]"
          style={{
            transform: `scale(${sc})`,
            transformOrigin: 'top left',
            background: 'linear-gradient(150deg,#3F5E4F 0%,#365C4A 45%,#2C4A3C 100%)',
          }}
        >
          {/* LEFT 52% */}
          <section className="relative w-[52%] h-full p-12 flex flex-col justify-between text-[#F8F5EE]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 backdrop-blur-md px-4 py-1.5 text-xs font-medium">
                🍵 Study Café &amp; Peer Learning
              </span>
              <h1 className="mt-5 text-[48px] leading-none font-extrabold tracking-[-0.02em]">StudyMatch</h1>
              <p className="mt-3 text-[15px] leading-[1.55] text-[#E6E0D3] max-w-[340px]">
                Một góc học tập ấm áp, một người bạn đồng hành phù hợp
              </p>
            </div>
            <div className="space-y-4 max-w-[340px]">
              <div className={`${glass} p-4 flex gap-3 items-center`}>
                <span className="w-10 h-10 rounded-xl bg-[#D89C57] grid place-items-center text-lg shrink-0">
                  🤝
                </span>
                <div>
                  <b className="text-sm block">Ghép đôi thông minh 1-1</b>
                  <span className="text-xs text-[#E6E0D3]/85">
                    Đồng bộ lịch rảnh, luyện giải đề cùng cạ cứng
                  </span>
                </div>
              </div>
              <div className={`${glass} p-4 flex gap-3 items-center`}>
                <span className="w-10 h-10 rounded-xl bg-[#A7B99A] grid place-items-center text-lg shrink-0">
                  🍅
                </span>
                <div>
                  <b className="text-sm block">Phòng học Pomodoro chung</b>
                  <span className="text-xs text-[#E6E0D3]/85">Kết hợp âm nhạc lofi thư giãn</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-[#E6E0D3]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D89C57] shadow-[0_0_0_4px_rgba(216,156,87,.22),0_0_14px_4px_rgba(216,156,87,.75)]" />
              Không gian học tập hàng đầu cho sinh viên Việt Nam
            </div>
          </section>

          {/* vertical wave divider at the 52% seam */}
          <svg
            className="absolute top-0 h-full w-[150px] left-[calc(52%-100px)]"
            viewBox="0 0 150 640"
            preserveAspectRatio="none"
            aria-hidden
          >
            <path d={wavePath(24, 12, 0)} fill="#749F82" fillOpacity=".28" />
            <path d={wavePath(50, 10, 1.5)} fill="#749F82" fillOpacity=".75" />
            <path d={wavePath(78, 9, 2.8)} fill="#FAF7F2" />
          </svg>

          {/* RIGHT 48% */}
          <section className="absolute inset-y-0 right-0 w-[calc(48%-50px)] bg-[#FAF7F2] p-14 flex flex-col justify-center">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                click()
              }}
            >
              <h2 className="text-center text-[28px] font-extrabold tracking-[0.04em] text-[#553F35]">
                USER LOGIN
              </h2>
              <p className="text-center text-sm text-[#7D685E] mt-1 mb-7">Welcome to the website</p>
              <div className="space-y-3.5">
                <label className={field}>
                  <span className="text-base leading-none">📧</span>
                  <input
                    className={bare}
                    type="text"
                    disabled
                    title="Sử dụng Google OAuth"
                    placeholder="Email / Student ID"
                  />
                </label>
                <label className={field}>
                  <span className="text-base leading-none">🔑</span>
                  <input
                    className={bare}
                    type="password"
                    disabled
                    title="Sử dụng Google OAuth"
                    placeholder="Password"
                  />
                </label>
              </div>
              <div className="flex items-center justify-between mt-4 mb-5 text-xs text-[#7D685E]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={rememberPreference()}
                    disabled={st === 'load'}
                    onChange={(e) => setRememberPreference(e.target.checked)}
                    className="!w-4 !h-4 !p-0 accent-[#365C4A]"
                  />
                  Remember
                </label>
                <a
                  href="https://accounts.google.com/signin/recovery"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Khôi phục tài khoản Google"
                  className="text-[#553F35] font-medium hover:underline"
                >
                  Forgot password?
                </a>
              </div>
              <button
                type="button"
                disabled={st === 'load'}
                onClick={click}
                className={`w-full h-[52px] rounded-full text-white text-[13px] font-bold tracking-[0.08em] flex items-center justify-center gap-3 transition hover:-translate-y-0.5 shadow-[0_2px_0_#1f3a2d,0_10px_20px_-6px_rgba(54,92,74,.6),inset_0_1px_0_rgba(255,255,255,.25)] ${st === 'load' ? 'opacity-85 cursor-wait' : 'cursor-pointer'}`}
                style={{ background: 'linear-gradient(180deg,#4B7560 0%,#365C4A 55%,#2C4A3C 100%)' }}
              >
                <span className="w-7 h-7 rounded-md bg-white grid place-items-center">
                  {st === 'load' ? (
                    <svg
                      className="animate-spin"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#365C4A"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    >
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                  ) : (
                    <GoogleG />
                  )}
                </span>
                {st === 'load' ? 'ĐANG MỞ CỬA QUÁN...' : 'LOGIN WITH GOOGLE'}
              </button>
              {st === 'err' && (
                <p
                  role="alert"
                  className="mt-3 text-xs text-[#9a3b2b] bg-[#fbeceb] rounded-xl p-3 text-center"
                >
                  {error || 'Đăng nhập chưa thành công. Bạn thử lại nhé.'}
                </p>
              )}
              <p className="text-center mt-6">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    click()
                  }}
                  className="text-sm text-[#553F35] font-medium border-b-2 border-dotted border-[#553F35]/60 pb-0.5"
                >
                  Create Account
                </a>
              </p>
            </form>
          </section>
        </main>
      </div>
    </div>
  )
}
