import type { SessionStatus } from '../../../types/domain'
export const SESSION_TRANSITIONS: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  proposed: ['scheduled', 'rejected', 'cancelled'], scheduled: ['in_progress', 'cancelled', 'missed'],
  in_progress: ['completed', 'cancelled'], completed: [], rejected: [], cancelled: [], missed: [],
}
export function canTransition(from: SessionStatus, to: SessionStatus) { return SESSION_TRANSITIONS[from].includes(to) }
export function assertTransition(from: SessionStatus, to: SessionStatus) {
  if (!canTransition(from, to)) throw new Error(`Invalid session transition: ${from} -> ${to}`)
}
export interface SessionProposal { creatorId: string; partnerId: string; subjectId: string; startsAt: string; endsAt: string }
export function validateProposal(p: SessionProposal, now = Date.now()) {
  if (!p.creatorId || !p.partnerId || !p.subjectId || p.creatorId === p.partnerId) throw new Error('A subject and two different participants are required')
  const utc = (s: string) => /(?:Z|[+-]\d{2}:\d{2})$/.test(s) && Number.isFinite(Date.parse(s))
  const start = Date.parse(p.startsAt), end = Date.parse(p.endsAt)
  if (!utc(p.startsAt) || !utc(p.endsAt) || start <= now || end <= start || end - start > 8 * 60 * 60 * 1000) throw new Error('Invalid session time range (maximum 8 hours; timezone required)')
  return { ...p, startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() }
}
