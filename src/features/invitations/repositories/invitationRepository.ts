import { requireSupabase } from '../../../lib/supabase/client'
import type { InvitationStatus } from '../services/invitationRules'
export const invitationRepository = {
  async send(recipientId: string, subjectId: string) {
    const { data, error } = await requireSupabase().rpc('send_invitation', { recipient: recipientId, subject: subjectId })
    if (error) throw error
    return data as string
  },
  async respond(id: string, status: Exclude<InvitationStatus, 'pending'>) {
    const { data, error } = await requireSupabase().rpc('respond_invitation', { request_id: id, next_status: status })
    if (error) throw error
    return data as string | null
  },
  async list() {
    const { data, error } = await requireSupabase().from('match_requests').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },
}
