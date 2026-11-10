import type { ReactNode } from 'react'
import { AuthProvider } from '../features/auth/hooks/useAuth'
export function Providers({ children }: { children: ReactNode }) { return <AuthProvider>{children}</AuthProvider> }
