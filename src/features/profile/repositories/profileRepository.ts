import { requireSupabase } from '../../../lib/supabase/client'
export interface ProfileRecord {
  id: string; display_name: string; avatar_url: string | null; university_id: string | null; major_id: string | null
  bio: string; goals: string[]; styles: string[]; timezone: string; onboarding_completed: boolean
}
export const profileRepository = {
  async get(id: string): Promise<ProfileRecord | null> {
    const { data, error } = await requireSupabase().from('profiles').select('id,display_name,avatar_url,university_id,major_id,bio,goals,styles,timezone,onboarding_completed').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  },
  async save(profile: Omit<ProfileRecord, 'id'>, subjects: { subject_id: string; proficiency: number; strong: string[]; weak: string[] }[], availability: { day: number; start_minute: number; end_minute: number }[]) {
    const { error } = await requireSupabase().rpc('save_learning_profile', { profile, subjects, availability })
    if (error) throw error
  },
  async learning(id: string) {
    const db = requireSupabase()
    const [subjects, topics, availability] = await Promise.all([
      db.from('user_subjects').select('subject_id,proficiency').eq('user_id', id),
      db.from('user_topics').select('subject_id,topic_id,knowledge').eq('user_id', id),
      db.from('user_availability').select('day,start_minute,end_minute').eq('user_id', id),
    ])
    for (const result of [subjects, topics, availability]) if (result.error) throw result.error
    return { subjects: subjects.data ?? [], topics: topics.data ?? [], availability: availability.data ?? [] }
  },
}
