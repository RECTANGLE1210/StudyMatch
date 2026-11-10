import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { profileService } from '../services/profileService'
import { errorMessage } from '../../../lib/utils/errors'
import type { ProfileView } from '../../../types/product'
export function emptyProfile(id = '', name = '', avatar: string | null = null): ProfileView {
  return {
    id,
    name,
    uni: '',
    major: '',
    bio: '',
    avatar,
    avatarPath: null,
    subjects: [],
    goals: [],
    styles: [],
    avail: [],
    weeklyAvailability: [],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    onboardingCompleted: false,
  }
}
interface ProfileState {
  p: ProfileView
  set: (update: (p: ProfileView) => ProfileView) => void
  save: (update: (p: ProfileView) => ProfileView, complete?: boolean) => Promise<boolean>
  reload: () => Promise<void>
  loading: boolean
  ready: boolean
  saving: boolean
  error: string
  email: string
  googleAvatar: string | null
  dirty: React.MutableRefObject<Record<string, boolean>>
  notify: React.MutableRefObject<(message: string) => void>
}
const Context = createContext<ProfileState | null>(null)
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth(),
    user = session?.user,
    id = user?.id ?? ''
  const googleAvatar =
    typeof user?.user_metadata.avatar_url === 'string' ? user.user_metadata.avatar_url : null
  const [profile, setProfile] = useState(() => emptyProfile()),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('')
  const current = useRef(profile),
    activeId = useRef(id),
    locked = useRef(false),
    requestId = useRef(0)
  activeId.current = id
  const dirty = useRef<Record<string, boolean>>({}),
    notify = useRef<(message: string) => void>(() => {})
  const set = (update: (p: ProfileView) => ProfileView) => {
    const next = update(current.current)
    current.current = next
    setProfile(next)
  }
  const reload = useCallback(async () => {
    if (!id) return
    const ticket = ++requestId.current
    setLoading(current.current.id !== id)
    setError('')
    try {
      const loaded = await profileService.get(id)
      if (activeId.current !== id || ticket !== requestId.current) return
      const next =
        loaded ??
        emptyProfile(
          id,
          typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '',
          googleAvatar
        )
      current.current = next
      setProfile(next)
    } catch (e) {
      if (activeId.current === id && ticket === requestId.current) setError(errorMessage(e))
    } finally {
      if (activeId.current === id && ticket === requestId.current) setLoading(false)
    }
  }, [id, googleAvatar])
  useEffect(() => {
    locked.current = false
    setSaving(false)
    current.current = emptyProfile()
    setProfile(current.current)
    dirty.current = {}
    setError('')
    if (id) void reload()
    else setLoading(false)
  }, [id, reload])
  useEffect(() => {
    if (!id) return
    const timer = window.setInterval(() => {
      if (
        current.current.onboardingCompleted &&
        !Object.values(dirty.current).some(Boolean) &&
        !locked.current
      )
        void reload()
    }, 45 * 60_000)
    return () => window.clearInterval(timer)
  }, [id, reload])
  const save = async (update: (p: ProfileView) => ProfileView, complete?: boolean) => {
    if (!id || locked.current) return false
    locked.current = true
    requestId.current++
    setLoading(false)
    setSaving(true)
    setError('')
    try {
      const next = update(current.current)
      const saved = await profileService.save(next, complete ?? next.onboardingCompleted)
      if (activeId.current !== id) return false
      current.current = saved
      setProfile(saved)
      return true
    } catch (e) {
      if (activeId.current === id) setError(errorMessage(e))
      return false
    } finally {
      locked.current = false
      if (activeId.current === id) setSaving(false)
    }
  }
  const value = profile.id === id ? profile : emptyProfile(id)
  return (
    <Context.Provider
      value={{
        p: value,
        set,
        save,
        reload,
        loading: loading || Boolean(id && profile.id !== id && !error),
        ready: profile.id === id,
        saving,
        error,
        email: user?.email ?? '',
        googleAvatar,
        dirty,
        notify,
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useProfile() {
  const value = useContext(Context)
  if (!value) throw new Error('ProfileProvider missing')
  return value
}
