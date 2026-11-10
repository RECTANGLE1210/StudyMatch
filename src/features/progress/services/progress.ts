import type { StudySession } from '../../../types/domain'
export function calculateProgress(userId: string, sessions: StudySession[], goals: { session_id: string; completed: boolean }[]) {
  const mine = sessions.filter(s => s.creator_id === userId || s.partner_id === userId)
  const completed = mine.filter(s => s.status === 'completed')
  const ids = new Set(completed.map(s => s.id))
  return { completedSessions: completed.length, missedSessions: mine.filter(s => s.status === 'missed').length,
    totalMinutes: completed.reduce((n, s) => n + (s.started_at && s.completed_at ? Math.max(0, Date.parse(s.completed_at) - Date.parse(s.started_at)) / 60_000 : 0), 0),
    partnerCount: new Set(completed.map(s => s.creator_id === userId ? s.partner_id : s.creator_id)).size,
    completedGoals: goals.filter(g => ids.has(g.session_id) && g.completed).length, history: mine }
}
