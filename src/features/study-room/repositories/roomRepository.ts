import { requireSupabase } from '../../../lib/supabase/client'
export const roomRepository = {
  async attend(sessionId: string) {
    const { error } = await requireSupabase().rpc('confirm_attendance', { session: sessionId })
    if (error) throw error
  },
  async addGoal(sessionId: string, title: string) {
    const { error } = await requireSupabase().from('session_goals').insert({ session_id: sessionId, title: title.trim() })
    if (error) throw error
  },
  async completeGoal(id: string, completed: boolean) {
    const { error } = await requireSupabase().from('session_goals').update({ completed }).eq('id', id).select('id').single()
    if (error) throw error
  },
  async setMeetLink(sessionId: string, link: string) {
    if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+$/.test(link)) throw new Error('Invalid Google Meet URL')
    const { error } = await requireSupabase().rpc('set_meet_link', { session: sessionId, link })
    if (error) throw error
  },
  async feedback(sessionId: string, rating: number, comment: string) {
    const { data: { user }, error: authError } = await requireSupabase().auth.getUser()
    if (authError) throw authError
    if (!user) throw new Error('Authentication required')
    const { error } = await requireSupabase().from('session_feedback').upsert({ session_id: sessionId, user_id: user.id, rating, comment })
    if (error) throw error
  },
}
