import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { hydrateProfile } from '../../profile/services/profileService'
import { rpc } from '../../../lib/supabase/rpc'
import { requireSupabase } from '../../../lib/supabase/client'
import { errorMessage } from '../../../lib/utils/errors'
import type { ProfileView, WorkspaceData } from '../../../types/product'
interface WorkspaceState {
  data: WorkspaceData | null
  loading: boolean
  error: string
  realtimeWarning: string
  toast: string
  busy: boolean
  refresh: () => Promise<void>
  action: (operation: () => Promise<unknown>, message?: string) => Promise<boolean>
  say: (message: string) => void
}
const Context = createContext<WorkspaceState | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth(),
    { p, notify } = useProfile(),
    id = session?.user.id ?? '',
    enabled = Boolean(id && p.onboardingCompleted)
  const [snapshot, setSnapshot] = useState<{ userId: string; value: WorkspaceData } | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [realtimeWarning, setRealtimeWarning] = useState(''),
    [toast, say] = useState(''),
    [pending, setPending] = useState(0)
  const revision = useRef(0),
    currentId = useRef(id)
  currentId.current = id
  notify.current = say
  const refresh = useCallback(async () => {
    if (!enabled) return
    const ticket = ++revision.current
    setLoading(true)
    try {
      const data = await rpc<WorkspaceData>('get_workspace')
      const profiles = new Map<string, Promise<ProfileView>>()
      const hydrate = (profile: ProfileView | null) => {
        if (!profile) return Promise.resolve(null)
        let request = profiles.get(profile.id)
        if (!request) {
          request = hydrateProfile(profile)
          profiles.set(profile.id, request)
        }
        return request
      }
      await Promise.all([
        ...data.conversations.map(async (c) => {
          c.peer = await hydrate(c.peer)
        }),
        ...data.invitations.map(async (i) => {
          ;[i.sender, i.recipient] = await Promise.all([hydrate(i.sender), hydrate(i.recipient)])
        }),
        ...data.sessions.map(async (s) => {
          ;[s.creator, s.partner] = await Promise.all([hydrate(s.creator), hydrate(s.partner)])
        }),
      ])
      if (ticket === revision.current && currentId.current === id) {
        setSnapshot({ userId: id, value: data })
        setError('')
      }
    } catch (e) {
      if (ticket === revision.current && currentId.current === id) setError(errorMessage(e))
    } finally {
      if (ticket === revision.current && currentId.current === id) setLoading(false)
    }
  }, [id, enabled])
  useEffect(() => {
    setSnapshot(null)
    setPending(0)
    setError('')
    setRealtimeWarning('')
    if (enabled) void refresh()
    else {
      revision.current++
      setLoading(false)
    }
  }, [id, enabled, refresh])
  useEffect(() => {
    if (!enabled) return
    const db = requireSupabase()
    let debounce: number | undefined
    const changed = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        void refresh()
      }, 180)
    }
    let channel = db.channel(`workspace:${id}`)
    for (const table of [
      'match_requests',
      'messages',
      'conversation_participants',
      'study_sessions',
      'session_attendance',
      'session_goals',
      'session_resources',
      'session_feedback',
      'notifications',
      'user_blocks',
    ])
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setRealtimeWarning('')
        changed()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        setRealtimeWarning('Kết nối trực tiếp đang gián đoạn. Dữ liệu sẽ được tải lại khi kết nối phục hồi.')
    })
    window.addEventListener('focus', changed)
    window.addEventListener('online', changed)
    const timer = window.setInterval(changed, 30_000)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(timer)
      window.removeEventListener('focus', changed)
      window.removeEventListener('online', changed)
      void db.removeChannel(channel)
    }
  }, [id, enabled, refresh])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => say(''), 3500)
    return () => window.clearTimeout(timer)
  }, [toast])
  const action = async (operation: () => Promise<unknown>, message = '') => {
    setPending((n) => n + 1)
    setError('')
    try {
      await operation()
      if (currentId.current !== id) return false
      await refresh()
      if (message && currentId.current === id) say(message)
      return true
    } catch (e) {
      if (currentId.current === id) setError(errorMessage(e))
      return false
    } finally {
      setPending((n) => Math.max(0, n - 1))
    }
  }
  return (
    <Context.Provider
      value={{
        data: snapshot?.userId === id ? snapshot.value : null,
        loading,
        error,
        realtimeWarning,
        toast,
        busy: pending > 0,
        refresh,
        action,
        say,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('WorkspaceProvider missing')
  return value
}
