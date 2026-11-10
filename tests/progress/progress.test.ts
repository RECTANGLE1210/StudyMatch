import { expect, it } from 'vitest'
import { calculateProgress } from '../../src/features/progress/services/progress'
import type { StudySession } from '../../src/types/domain'
it('derives progress from completed participant sessions and goals', () => {
 const base: StudySession = { id: '1', creator_id: 'a', partner_id: 'b', subject_id: 'math', status: 'completed', starts_at: '2026-11-04T12:00:00Z', ends_at: '2026-11-04T13:00:00Z', started_at: '2026-11-04T12:00:00Z', completed_at: '2026-11-04T12:25:00Z' }
 const r = calculateProgress('a', [base, { ...base, id: '2', status: 'missed' }, { ...base, id: '3', creator_id: 'c', partner_id: 'd' }], [{ session_id: '1', completed: true }, { session_id: '2', completed: true }])
 expect(r).toMatchObject({ totalMinutes: 25, completedSessions: 1, missedSessions: 1, partnerCount: 1, completedGoals: 1 })
 expect(calculateProgress('a', [], []).totalMinutes).toBe(0)
})
