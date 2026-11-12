import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { requireSupabase } from '../../../lib/supabase/client'
import { errorMessage } from '../../../lib/utils/errors'
import { libraryRepository } from '../repositories/libraryRepository'
import type { ResourceView } from '../../../types/product'
export function useLibrary(sessionId?: string) {
  const { session } = useAuth(),
    { data } = useWorkspace()
  const key = `${session?.user.id ?? ''}:${sessionId ?? ''}`
  const active = useRef(key),
    sequence = useRef(0),
    applied = useRef(0),
    nextProbe = useRef(0),
    supported = useRef(false)
  const [snapshot, setSnapshot] = useState<{
    key: string
    resources: ResourceView[]
    available: boolean
  } | null>(null)
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(false)
  active.current = key
  const reload = useCallback(async () => {
    if (!session?.user.id) return
    const ticket = ++sequence.current
    setLoading(true)
    try {
      let resources: ResourceView[] = [],
        available = false
      if (performance.now() >= nextProbe.current) {
        try {
          resources = await libraryRepository.list(sessionId)
          available = true
          supported.current = true
        } catch (e) {
          const failure = e as { code?: string; message?: string }
          if (
            !['PGRST202', '42883'].includes(failure.code ?? '') ||
            !failure.message?.includes('get_library_resources') ||
            supported.current
          )
            throw e
          nextProbe.current = performance.now() + 15_000
        }
      }
      if (active.current === key && ticket >= applied.current) {
        applied.current = ticket
        setSnapshot({ key, resources, available })
        setError('')
      }
    } catch (e) {
      if (active.current === key && ticket >= applied.current) {
        applied.current = ticket
        setError(errorMessage(e))
      }
    } finally {
      if (active.current === key && ticket === sequence.current) setLoading(false)
    }
  }, [key, sessionId, session?.user.id])
  useEffect(() => {
    active.current = key
    setSnapshot(null)
    setError('')
    void reload()
    return () => {
      active.current = ''
    }
  }, [key, reload])
  useEffect(() => {
    if (data) void reload()
  }, [data, reload])
  useEffect(() => {
    if (!session?.user.id) return
    const db = requireSupabase()
    let debounce: number | undefined
    const changed = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        void reload()
      }, 100)
    }
    let channel = db.channel(`library:${key}`)
    for (const table of ['library_resources', 'library_grants', 'library_attachments'])
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, changed)
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') changed()
    })
    const poll = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') changed()
      },
      sessionId ? 3000 : 10_000
    )
    window.addEventListener('focus', changed)
    window.addEventListener('online', changed)
    document.addEventListener('visibilitychange', changed)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(poll)
      window.removeEventListener('focus', changed)
      window.removeEventListener('online', changed)
      document.removeEventListener('visibilitychange', changed)
      void db.removeChannel(channel)
    }
  }, [key, reload, sessionId, session?.user.id])
  return {
    resources: snapshot?.key === key ? snapshot.resources : [],
    available: snapshot?.key === key ? snapshot.available : null,
    loading,
    error,
    reload,
  }
}
