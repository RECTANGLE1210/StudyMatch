import { requireSupabase } from '../../../lib/supabase/client'
export const notificationRepository = {
  async list() {
    const { data, error } = await requireSupabase().from('notifications').select('*').order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return data ?? []
  },
  async markRead(id: string) {
    const { error } = await requireSupabase().rpc('mark_notification_read', { notification: id })
    if (error) throw error
  },
}
