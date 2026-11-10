import { useCallback, useEffect, useRef, useState } from 'react'
import { rpc } from '../../../lib/supabase/rpc'
import { errorMessage } from '../../../lib/utils/errors'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import type { RoomData } from '../../../types/product'
export function useRoom(id: string) {
  const { data } = useWorkspace(),
    [snapshot, setSnapshot] = useState<{ id: string; value: RoomData } | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    active = useRef(id),
    revision = useRef(0)
  active.current = id
  const load = useCallback(async () => {
    if (!id) return
    const ticket = ++revision.current
    setLoading(true)
    try {
      const value = await rpc<RoomData>('get_room', { session: id })
      if (active.current === id && ticket === revision.current) {
        setSnapshot({ id, value })
        setError('')
      }
    } catch (e) {
      if (active.current === id && ticket === revision.current) setError(errorMessage(e))
    } finally {
      if (active.current === id && ticket === revision.current) setLoading(false)
    }
  }, [id])
  useEffect(() => {
    setSnapshot(null)
    setError('')
    void load()
  }, [id, load])
  useEffect(() => {
    if (data) void load()
  }, [data, load])
  return { room: snapshot?.id === id ? snapshot.value : null, error, loading, reload: load }
}
