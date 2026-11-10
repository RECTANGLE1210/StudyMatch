import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { signOut } from '../../lib/supabase/auth'
import { errorMessage } from '../../lib/utils/errors'
const navigation = [['/', 'Trang chủ', '☕'], ['/match', 'Smart Match', '🍵'], ['/messages', 'Tin nhắn', '💬'], ['/sessions', 'Lịch học', '📅'], ['/library', 'Ngân hàng tài liệu', '🗂'], ['/progress', 'Tiến độ', '🌱'], ['/profile', 'Hồ sơ', '👤']]
export function AppLayout() {
  const [error, setError] = useState('')
  const logout = async () => { try { await signOut() } catch (e) { setError(errorMessage(e)) } }
  return <div className="app-shell min-h-screen md:flex"><aside className="app-sidebar hidden md:flex flex-col gap-1 sticky top-0 h-screen"><div className="brand-lockup"><div className="brand-mark">S</div><div className="brand-title text-forest">StudyMatch</div></div>{navigation.map(([to, label, icon]) => <NavLink end={to === '/'} to={to} key={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><span>{icon}</span>{label}</NavLink>)}<button className="sidebar-signout mt-auto" onClick={logout}>Đăng xuất</button></aside><main className="app-main flex-1 p-4 md:px-10 md:py-8 pb-28">{error && <p role="alert">{error}</p>}<Outlet /></main><nav className="mobile-nav md:hidden fixed bottom-0 inset-x-0 flex flex-wrap justify-around z-40">{navigation.map(([to, label, icon]) => <NavLink to={to} key={to} className="mobile-nav-item"><span>{icon}</span>{label}</NavLink>)}<button onClick={logout}>Đăng xuất</button></nav></div>
}
export function IntegrationStatus({ feature }: { feature: string }) {
  return <div className="card p-6 space-y-3"><h1 className="text-2xl font-bold">{feature}</h1><p>UI prototype đã được giữ nguyên trong chế độ demo. Màn hình này chưa kết nối dữ liệu thật; không có thao tác mô phỏng nào được ghi thành công.</p><p>Auth và hồ sơ cơ bản đã có repository. Xem docs/IMPLEMENTATION_STATUS.md để tiếp tục nối dữ liệu cho tính năng này.</p></div>
}
