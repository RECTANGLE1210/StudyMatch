import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { env } from '../lib/config/env'
import { AuthGuard } from './guards/AuthGuard'
import { OnboardingGuard } from './guards/OnboardingGuard'
import { Loading } from '../components/shared/Loading'
import { LiveLogin } from '../features/auth/components/LiveLogin'
import { ProfileForm } from '../features/profile/components/ProfileForm'
import { AppLayout, IntegrationStatus } from '../components/layout/AppLayout'
const DemoApp = lazy(() => import('../demo/App'))
export function AppRouter() {
  return <BrowserRouter><Suspense fallback={<Loading />}>
    {env.demo ? <><div role="status" className="fixed bottom-24 md:bottom-2 left-2 z-[70] rounded-full bg-caramel text-espresso px-3 py-1 text-xs shadow">DEMO · dữ liệu mô phỏng, không gửi lên server</div><Routes><Route path="*" element={<DemoApp />} /></Routes></> :
      <Routes>
        <Route path="/login" element={<LiveLogin />} />
        <Route element={<AuthGuard />}>
          <Route path="/onboarding" element={<ProfileForm onboarding />} />
          <Route element={<OnboardingGuard />}><Route element={<AppLayout />}>
            <Route index element={<IntegrationStatus feature="Dashboard" />} />
            {['match', 'messages', 'messages/:conversationId', 'sessions', 'sessions/:sessionId', 'progress', 'library', 'pricing'].map(path => <Route key={path} path={path} element={<IntegrationStatus feature={path} />} />)}
            <Route path="profile" element={<ProfileForm />} />
          </Route></Route>
        </Route>
        <Route path="*" element={<div className="card p-8 m-8">Không tìm thấy trang. <a href="/">Về trang chủ</a></div>} />
      </Routes>}
  </Suspense></BrowserRouter>
}
