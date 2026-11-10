import { useCallback, useEffect, useRef, useState } from 'react'
import { requireSupabase } from '../../../lib/supabase/client'
import { rpc } from '../../../lib/supabase/rpc'
import { errorMessage } from '../../../lib/utils/errors'
import type { ChatMessage } from '../../../types/product'
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  return [...new Map([...current, ...incoming].map((m) => [m.id, m])).values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  )
}
export function useMessages(conversation: string) {
  const [snapshot, setSnapshot] = useState<{ id: string; rows: ChatMessage[] }>({ id: '', rows: [] }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [more, setMore] = useState(false)
  const active = useRef(conversation),
    firstLoaded = useRef(false)
  active.current = conversation
  const load = useCallback(
    async (before?: ChatMessage) => {
      if (!conversation) return
      setLoading(true)
      try {
        const rows = await rpc<ChatMessage[]>('message_page', {
          conversation,
          before_at: before?.created_at ?? null,
          before_id: before?.id ?? null,
        })
        if (active.current !== conversation) return
        setSnapshot((old) => ({
          id: conversation,
          rows: mergeMessages(old.id === conversation ? old.rows : [], rows),
        }))
        if (before || !firstLoaded.current) setMore(rows.length === 50)
        firstLoaded.current = true
        setError('')
      } catch (e) {
        if (active.current === conversation) setError(errorMessage(e))
      } finally {
        if (active.current === conversation) setLoading(false)
      }
    },
    [conversation]
  )
  useEffect(() => {
    firstLoaded.current = false
    setSnapshot({ id: conversation, rows: [] })
    setError('')
    setMore(false)
    if (!conversation) return
    void load()
    const db = requireSupabase()
    const channel = db
      .channel(`chat:${conversation}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage
          if (active.current === conversation)
            setSnapshot((old) => ({
              id: conversation,
              rows: mergeMessages(old.id === conversation ? old.rows : [], [message]),
            }))
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void load()
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
          setError('Tin nhắn trực tiếp đang gián đoạn; lịch sử sẽ đồng bộ khi kết nối lại.')
      })
    const focus = () => {
      void load()
    }
    window.addEventListener('focus', focus)
    return () => {
      void db.removeChannel(channel)
      window.removeEventListener('focus', focus)
    }
  }, [conversation, load])
  return {
    messages: snapshot.id === conversation ? snapshot.rows : [],
    loading,
    error,
    more,
    reload: () => load(),
    older: () => load(snapshot.rows[0]),
  }
}
