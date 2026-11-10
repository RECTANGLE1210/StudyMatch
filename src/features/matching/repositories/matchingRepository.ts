import { requireSupabase } from '../../../lib/supabase/client'
export interface CandidateSnapshot {
  id: string; goals: string[]; styles: string[]; timezone: string
  user_subjects: { subject_id: string; proficiency: number; user_topics: { topic_id: string; knowledge: 'strong' | 'weak' }[] }[]
  user_availability: { day: number; start_minute: number; end_minute: number }[]
}
export const matchingRepository = {
  async candidates(subjectId: string, page = 0): Promise<CandidateSnapshot[]> {
    if (!Number.isInteger(page) || page < 0) throw new Error('Invalid candidate page')
    const { data, error } = await requireSupabase().from('profiles').select('id,goals,styles,timezone,user_subjects!inner(subject_id,proficiency,user_topics(topic_id,knowledge)),user_availability(day,start_minute,end_minute)').eq('onboarding_completed', true).eq('user_subjects.subject_id', subjectId).order('id').range(page * 50, page * 50 + 49)
    if (error) throw error
    return data ?? []
  },
}
