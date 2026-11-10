import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider, Link } from 'react-router-dom'
import { AuthGuard } from './guards/AuthGuard'
import { OnboardingGuard } from './guards/OnboardingGuard'
import { AppLayout } from '../components/layout/AppLayout'
import { Loading } from '../components/shared/Loading'
import { LiveLogin } from '../features/auth/components/LiveLogin'
const Home = lazy(() => import('../features/home/components/HomePage').then((m) => ({ default: m.HomePage })))
const Match = lazy(() =>
  import('../features/matching/components/MatchPage').then((m) => ({ default: m.MatchPage }))
)
const Messages = lazy(() =>
  import('../features/chat/components/MessagesPage').then((m) => ({ default: m.MessagesPage }))
)
const Sessions = lazy(() =>
  import('../features/scheduling/components/SessionsPage').then((m) => ({ default: m.SessionsPage }))
)
const Room = lazy(() =>
  import('../features/study-room/components/RoomPage').then((m) => ({ default: m.RoomPage }))
)
const Library = lazy(() =>
  import('../features/documents/components/LibraryScreen').then((m) => ({ default: m.LibraryScreen }))
)
const Progress = lazy(() =>
  import('../features/progress/components/ProgressPage').then((m) => ({ default: m.ProgressPage }))
)
const Profile = lazy(() =>
  import('../features/profile/components/ProfilePage').then((m) => ({ default: m.ProfilePage }))
)
const Onboarding = lazy(() =>
  import('../features/onboarding/components/OnboardingPage').then((m) => ({ default: m.OnboardingPage }))
)
const Pricing = lazy(() =>
  import('../features/pricing/components/PricingPage').then((m) => ({ default: m.PricingPage }))
)
function Page({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Loading />}>{children}</Suspense>
}
const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LiveLogin />} />
      <Route element={<AuthGuard />}>
        <Route
          path="/onboarding"
          element={
            <Page>
              <Onboarding />
            </Page>
          }
        />
        <Route element={<OnboardingGuard />}>
          <Route element={<AppLayout />}>
            <Route
              index
              element={
                <Page>
                  <Home />
                </Page>
              }
            />
            <Route
              path="match"
              element={
                <Page>
                  <Match />
                </Page>
              }
            />
            <Route
              path="messages"
              element={
                <Page>
                  <Messages />
                </Page>
              }
            />
            <Route
              path="messages/:conversationId"
              element={
                <Page>
                  <Messages />
                </Page>
              }
            />
            <Route
              path="sessions"
              element={
                <Page>
                  <Sessions />
                </Page>
              }
            />
            <Route
              path="sessions/:sessionId"
              element={
                <Page>
                  <Room />
                </Page>
              }
            />
            <Route
              path="room"
              element={
                <Page>
                  <Room />
                </Page>
              }
            />
            <Route
              path="library"
              element={
                <Page>
                  <Library />
                </Page>
              }
            />
            <Route
              path="progress"
              element={
                <Page>
                  <Progress />
                </Page>
              }
            />
            <Route
              path="profile"
              element={
                <Page>
                  <Profile />
                </Page>
              }
            />
            <Route
              path="pricing"
              element={
                <Page>
                  <Pricing />
                </Page>
              }
            />
          </Route>
        </Route>
      </Route>
      <Route
        path="*"
        element={
          <div className="card p-8 m-8">
            Không tìm thấy trang. <Link to="/">Về trang chủ</Link>
          </div>
        }
      />
    </>
  )
)
export function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
      <RouterProvider router={router} />
    </Suspense>
  )
}
