import { requireSupabase } from '../../../lib/supabase/client'
import { validateProposal, type SessionProposal } from '../domain/session'
import type { SessionStatus, StudySession } from '../../../types/domain'
export const sessionRepository = {
  async list(): Promise<StudySession[]> {
    const { data, error } = await requireSupabase().from('study_sessions').select('*').order('starts_at')
    if (error) throw error
    return data ?? []
  },
  async get(id: string): Promise<StudySession | null> {
    const { data, error } = await requireSupabase().from('study_sessions').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async propose(input: SessionProposal) {
    const p = validateProposal(input)
    const { data, error } = await requireSupabase().rpc('propose_session', { partner: p.partnerId, subject: p.subjectId, starts: p.startsAt, ends: p.endsAt })
    if (error) throw error
    return data as string
  },
  async transition(id: string, status: SessionStatus) {
    const { error } = await requireSupabase().rpc('transition_session', { session: id, next_status: status })
    if (error) throw error
  },
  async reschedule(id: string, starts: string, ends: string) {
    const { error } = await requireSupabase().rpc('reschedule_session', { session: id, starts, ends })
    if (error) throw error
  },
}
