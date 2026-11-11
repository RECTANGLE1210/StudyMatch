import { useCallback, useEffect, useRef, useState } from 'react'
import { requireSupabase } from '../../../lib/supabase/client'
import { useAuth } from '../../auth/hooks/useAuth'
import type { RoomClock } from './usePomodoro'
import { rpc } from '../../../lib/supabase/rpc'
import { errorMessage } from '../../../lib/utils/errors'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import type { RoomData } from '../../../types/product'
export function useRoom(id: string) {
  const { session } = useAuth()
  const key = `${session?.user.id ?? ''}:${id}`
  const { data } = useWorkspace(),
    [snapshot, setSnapshot] = useState<{ key: string; value: RoomData; clock: RoomClock | undefined } | null>(
      null
    ),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    active = useRef(key),
    revision = useRef(0),
    applied = useRef(0),
    nextProbe = useRef(0),
    joined = useRef(''),
    sharedRooms = useRef(new Set<string>())
  active.current = key
  const load = useCallback(async () => {
    if (!id) return
    const ticket = ++revision.current
    const sentAt = performance.now()
    setLoading(true)
    try {
      let value: RoomData
      if (performance.now() >= nextProbe.current) {
        try {
          value = await rpc<RoomData>('get_room_v2', { session: id })
          if (value.roomSync?.eligible && !value.roomSync.ready && joined.current !== key) {
            await rpc('join_room_sync', { session: id })
            joined.current = key
            value = await rpc<RoomData>('get_room_v2', { session: id })
          }
        } catch (e) {
          const failure = e as { code?: string; message?: string }
          if (
            !['PGRST202', '42883'].includes(failure.code ?? '') ||
            !failure.message?.includes('get_room_v2') ||
            sharedRooms.current.has(key)
          )
            throw e
          nextProbe.current = performance.now() + 30_000
          value = await rpc<RoomData>('get_room', { session: id })
        }
      } else value = await rpc<RoomData>('get_room', { session: id })
      if (active.current === key && ticket >= applied.current) {
        applied.current = ticket
        if (value.roomSync?.ready) sharedRooms.current.add(key)
        const receivedAt = performance.now()
        setSnapshot({
          key,
          value,
          clock:
            value.serverNow && Number.isFinite(Date.parse(value.serverNow))
              ? { serverMs: Date.parse(value.serverNow) + (receivedAt - sentAt) / 2, sampledAt: receivedAt }
              : undefined,
        })
        setError('')
      }
    } catch (e) {
      if (active.current === key && ticket >= applied.current) {
        applied.current = ticket
        setError(errorMessage(e))
      }
    } finally {
      if (active.current === key && ticket === revision.current) setLoading(false)
    }
  }, [id, key])
  useEffect(() => {
    active.current = key
    setSnapshot(null)
    setError('')
    void load()
    return () => {
      active.current = ''
    }
  }, [key, load])
  useEffect(() => {
    if (data) void load()
  }, [data, load])
  useEffect(() => {
    if (!id) return
    const db = requireSupabase()
    let debounce: number | undefined
    const changed = () => {
      window.clearTimeout(debounce)
      debounce = window.setTimeout(() => {
        void load()
      }, 100)
    }
    let channel = db.channel(`room:${key}`)
    for (const table of [
      'study_sessions',
      'room_sync_state',
      'session_attendance',
      'session_goals',
      'session_resources',
      'session_feedback',
    ]) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${table === 'study_sessions' ? 'id' : 'session_id'}=eq.${id}`,
        },
        changed
      )
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') changed()
    })
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') changed()
    }, 2000)
    window.addEventListener('focus', changed)
    window.addEventListener('online', changed)
    window.addEventListener('pageshow', changed)
    document.addEventListener('visibilitychange', changed)
    return () => {
      window.clearTimeout(debounce)
      window.clearInterval(poll)
      window.removeEventListener('focus', changed)
      window.removeEventListener('online', changed)
      window.removeEventListener('pageshow', changed)
      document.removeEventListener('visibilitychange', changed)
      void db.removeChannel(channel)
    }
  }, [id, key, load])
  return {
    room: snapshot?.key === key ? snapshot.value : null,
    clock: snapshot?.key === key ? snapshot.clock : undefined,
    error,
    loading,
    reload: load,
  }
}
