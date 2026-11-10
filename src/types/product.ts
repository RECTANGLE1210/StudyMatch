import type { SessionStatus, Availability } from './domain'
export type Level = 'Mới bắt đầu' | 'Trung bình' | 'Nâng cao'
export interface SubjectProfile {
  id?: string
  name: string
  code: string
  level: Level
  strong: string[]
  weak: string[]
}
export interface ProfileView {
  id: string
  name: string
  uni: string
  major: string
  bio: string
  avatar: string | null
  avatarPath: string | null
  subjects: SubjectProfile[]
  goals: string[]
  styles: string[]
  avail: string[]
  timezone: string
  onboardingCompleted: boolean
  weeklyAvailability: Availability[]
}
export interface CatalogSubject {
  id: string
  name: string
  code: string
  topics: { id: string; name: string }[]
}
export interface Invitation {
  id: string
  sender_id: string
  recipient_id: string
  subject_id: string
  subjectName: string
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  sender: ProfileView | null
  recipient: ProfileView | null
  created_at: string
}
export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}
export interface Conversation {
  id: string
  peer: ProfileView | null
  lastMessage: ChatMessage | null
  unread: number
}
export interface SessionView {
  id: string
  creator_id: string
  partner_id: string
  subject_id: string
  status: SessionStatus
  starts_at: string
  ends_at: string
  started_at: string | null
  completed_at: string | null
  meet_link: string | null
  subjectName: string
  creator: ProfileView | null
  partner: ProfileView | null
  topics: { id: string; name: string }[]
  attendance: string[]
}
export interface ResourceView {
  id: string
  session_id: string
  uploader_id: string
  uploaderName?: string
  name: string
  kind: 'doc' | 'quiz'
  subjectName?: string
  storage_path: string | null
  external_url: string | null
  mime_type: string | null
  size_bytes: number | null
  attached: boolean
  created_at: string
}
export interface NotificationView {
  id: string
  kind:
    | 'invitation'
    | 'invitation_accepted'
    | 'message'
    | 'session_proposed'
    | 'session_confirmed'
    | 'session_cancelled'
  entity_id: string
  read_at: string | null
  created_at: string
}
export interface ProgressView {
  totalMinutes: number
  completedSessions: number
  missedSessions: number
  partnerCount: number
  completedGoals: number
  daily: { date: string; minutes: number }[]
}
export interface WorkspaceData {
  invitations: Invitation[]
  conversations: Conversation[]
  sessions: SessionView[]
  resources: ResourceView[]
  notifications: NotificationView[]
  unreadNotifications: number
  blockedUsers: string[]
  progress: ProgressView
}
export interface GoalView {
  id: string
  session_id: string
  title: string
  completed: boolean
  created_at: string
}
export interface RoomData {
  session: SessionView
  goals: GoalView[]
  resources: ResourceView[]
  feedback: { rating: number; comment: string } | null
}
