import { requireSupabase } from '../../../lib/supabase/client'
export interface CatalogOption { id: string; name: string }
export interface SubjectOption extends CatalogOption { code: string }
export const catalogRepository = {
  async universities(): Promise<CatalogOption[]> {
    const { data, error } = await requireSupabase().from('universities').select('id,name').order('name')
    if (error) throw error
    return data ?? []
  },
  async majors(): Promise<CatalogOption[]> {
    const { data, error } = await requireSupabase().from('majors').select('id,name').order('name')
    if (error) throw error
    return data ?? []
  },
  async subjects(): Promise<SubjectOption[]> {
    const { data, error } = await requireSupabase().from('subjects').select('id,name,code').order('name')
    if (error) throw error
    return data ?? []
  },
  async topics(subjectId: string): Promise<CatalogOption[]> {
    const { data, error } = await requireSupabase().from('topics').select('id,name').eq('subject_id', subjectId).order('name')
    if (error) throw error
    return data ?? []
  },
}
