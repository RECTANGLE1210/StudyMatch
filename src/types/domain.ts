export interface LearningSubject {
  subjectId: string
  proficiency: number
  strong: string[]
  weak: string[]
}
// Normalized UTC-week minutes; adapters must convert each user's timezone first.
export interface Availability { day: number; start: number; end: number }
export interface LearningProfile {
  id: string
  subjects: LearningSubject[]
  goals: string[]
  styles: string[]
  availability: Availability[]
}
export type SessionStatus = 'proposed' | 'scheduled' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'missed'
export interface StudySession {
  id: string
  creator_id: string
  partner_id: string
  subject_id: string
  starts_at: string
  ends_at: string
  started_at: string | null
  completed_at: string | null
  status: SessionStatus
}
