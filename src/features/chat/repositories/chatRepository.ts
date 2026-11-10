import { requireSupabase } from '../../../lib/supabase/client'
export interface Message { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
export const chatRepository = {
  async history(conversationId: string, before?: string): Promise<Message[]> {
    let query = requireSupabase().from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(50)
    if (before) query = query.lt('created_at', before)
    const { data, error } = await query
    if (error) throw error
    return (data ?? []).reverse()
  },
  async send(conversationId: string, body: string) {
    const text = body.trim()
    if (!text || text.length > 4000) throw new Error('Message must contain 1–4000 characters')
    const { data, error } = await requireSupabase().rpc('send_message', { conversation: conversationId, content: text })
    if (error) throw error
    return data as string
  },
  async markRead(conversationId: string) {
    const { error } = await requireSupabase().rpc('mark_conversation_read', { conversation: conversationId })
    if (error) throw error
  },
  subscribe(conversationId: string, onMessage: (message: Message) => void, onError: (message: string) => void) {
    const db = requireSupabase()
    const channel = db.channel(`messages:${conversationId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, payload => onMessage(payload.new as Message)).subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError('Realtime disconnected; reload conversation history')
    })
    return () => { void db.removeChannel(channel) }
  },
}
