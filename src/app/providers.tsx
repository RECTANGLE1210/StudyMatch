import type { ReactNode } from 'react'
import { AuthProvider } from '../features/auth/hooks/useAuth'
import { ProfileProvider } from '../features/profile/hooks/ProfileProvider'
import { WorkspaceProvider } from '../features/workspace/hooks/useWorkspace'
export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </ProfileProvider>
    </AuthProvider>
  )
}
