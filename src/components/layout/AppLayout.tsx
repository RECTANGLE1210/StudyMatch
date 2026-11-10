import { useEffect, useState } from 'react'
import { Outlet, useBlocker, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import { useProfile } from '../../features/profile/hooks/ProfileProvider'
import { useWorkspace } from '../../features/workspace/hooks/useWorkspace'
import { Avatar } from '../../features/profile/components/ProfileScreens'
import { NotificationBell } from '../../features/notifications/components/NotificationBell'
import { Loading } from '../shared/Loading'
import { ErrorNotice, Modal, Empty } from '../shared/Feedback'
import { signOut } from '../../lib/supabase/auth'
import { errorMessage } from '../../lib/utils/errors'
export function AppLayout() {
  const { p, dirty, error: profileError } = useProfile(),
    { data, error, realtimeWarning, toast, refresh } = useWorkspace(),
    location = useLocation(),
    navigate = useNavigate()
  const [logout, setLogout] = useState(false),
    [logoutError, setLogoutError] = useState(''),
    [signingOut, setSigningOut] = useState(false)
  const room =
    data?.sessions.find((s) => s.status === 'in_progress') ??
    data?.sessions
      .filter((s) => s.status === 'scheduled')
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const nav = [
    ['/', 'Trang chủ', '☕'],
    ['/match', 'Smart Match', '🍵'],
    ['/messages', 'Tin nhắn', '💬'],
    ['/sessions', 'Lịch học', '📅'],
    ['/library', 'Ngân hàng tài liệu', '🗂'],
    [room ? `/sessions/${room.id}` : '/room', 'Study Room', '📖'],
    ['/progress', 'Tiến độ', '🌱'],
    ['/pricing', 'Tiến độ & Gói', '♛'],
    ['/profile', 'Hồ sơ', '👤'],
  ]
  const active = (to: string) =>
    location.pathname === to || (to === '/messages' && location.pathname.startsWith('/messages/'))
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname && Object.values(dirty.current).some(Boolean)
  )
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (Object.values(dirty.current).some(Boolean)) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  const exit = async () => {
    setSigningOut(true)
    setLogoutError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (e) {
      setLogoutError(errorMessage(e))
    } finally {
      setSigningOut(false)
    }
  }
  return (
    <div className="app-shell min-h-screen md:flex">
      <aside className="app-sidebar hidden md:flex flex-col gap-1 sticky top-0 h-screen">
        <div className="brand-lockup">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-title text-forest">StudyMatch</div>
            <div className="brand-caption">Học tốt hơn, cùng nhau</div>
          </div>
        </div>
        <p className="nav-eyebrow">Không gian học tập</p>
        {nav.map(([to, label, icon]) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className={`nav-item ${active(to) ? 'active' : ''} ${active(to) && to === '/pricing' ? 'pricing-active' : ''}`}
          >
            <span aria-hidden="true" className="nav-icon">
              {icon}
            </span>
            <span>{label}</span>
            {active(to) && <span className="nav-dot" />}
          </button>
        ))}
        <div className="sidebar-profile mt-auto">
          <Avatar src={p.avatar} name={p.name} size={40} />
          <div className="min-w-0 flex-1">
            <span className="font-semibold text-sm truncate block">{p.name}</span>
            <span className="text-[11px] opacity-55 truncate block">{p.major || 'Hồ sơ học tập'}</span>
          </div>
        </div>
        <button className="sidebar-signout" onClick={() => setLogout(true)}>
          Đăng xuất
        </button>
      </aside>
      <main
        className="app-main flex-1 p-4 md:px-10 md:py-8 pb-28 md:pb-10 w-full pop"
        key={location.pathname}
      >
        <div className="page-kicker">
          <span>{nav.find(([to]) => active(to))?.[1] ?? 'Study Room'}</span>
          <span className="page-kicker-line" />
        </div>
        <ErrorNotice
          error={error || profileError}
          retry={() => {
            void refresh()
          }}
        />
        {realtimeWarning && (
          <p role="status" className="text-xs bg-caramel/15 rounded-xl p-3 mb-3">
            {realtimeWarning}
          </p>
        )}
        {data ? (
          <Outlet context={{ requestSignOut: () => setLogout(true) }} />
        ) : error ? (
          <Empty title="Không tải được dữ liệu" description="Kiểm tra kết nối và thử tải lại." />
        ) : (
          <Loading />
        )}
      </main>
      <nav className="mobile-nav md:hidden fixed bottom-0 inset-x-0 flex justify-around z-40">
        {nav
          .filter(([to]) => to !== '/progress')
          .map(([to, label, icon]) => (
            <button
              key={label}
              onClick={() => navigate(to)}
              className={`mobile-nav-item ${active(to) ? 'active' : ''}`}
            >
              <span aria-hidden="true" className="text-lg">
                {icon}
              </span>
              <span>{to === '/library' ? 'Tài liệu' : to === '/pricing' ? 'Gói' : label.split(' ')[0]}</span>
            </button>
          ))}
      </nav>
      {blocker.state === 'blocked' && (
        <Modal onClose={() => blocker.reset()}>
          <h3 className="font-bold text-lg">Bỏ các thay đổi chưa lưu?</h3>
          <p className="text-sm opacity-70 my-2">
            Bạn đang chỉnh sửa hồ sơ. Rời đi bây giờ sẽ không giữ lại thay đổi.
          </p>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-o" onClick={() => blocker.reset()}>
              Ở lại chỉnh sửa
            </button>
            <button
              className="btn btn-p"
              onClick={() => {
                dirty.current = {}
                blocker.proceed()
              }}
            >
              Bỏ thay đổi
            </button>
          </div>
        </Modal>
      )}
      {logout && (
        <Modal onClose={() => setLogout(false)}>
          <h3 className="font-bold text-lg">Hẹn gặp lại bạn nhé?</h3>
          <p className="text-sm opacity-70 my-2">Bạn có chắc muốn đăng xuất?</p>
          <ErrorNotice error={logoutError} />
          <div className="flex gap-2 justify-end">
            <button className="btn btn-o" onClick={() => setLogout(false)}>
              Ở lại
            </button>
            <button
              className="btn btn-p"
              disabled={signingOut}
              onClick={() => {
                void exit()
              }}
            >
              Đăng xuất
            </button>
          </div>
        </Modal>
      )}
      <NotificationBell />
      {toast && (
        <div
          role="status"
          className="fixed top-20 right-4 z-[60] bg-forest text-cream px-5 py-3 rounded-2xl shadow-lg pop"
        >
          ✓ {toast}
        </div>
      )}
    </div>
  )
}
export function useLayout() {
  return useOutletContext<{ requestSignOut: () => void }>()
}
