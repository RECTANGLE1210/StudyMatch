import { matchingRepository, type CandidateSnapshot } from '../repositories/matchingRepository'
import { rankCandidates } from '../domain/matching'
import type { LearningProfile, Availability } from '../../../types/domain'
// Resolve weekly local availability for a specific reference week before scoring (including DST).
// Requiring an adapter prevents accidentally comparing local clock times from different zones.
export async function findMatches(me: LearningProfile, subjectId: string, normalize: (candidate: CandidateSnapshot) => Availability[], page = 0) {
  const snapshots = await matchingRepository.candidates(subjectId, page)
  const candidates = snapshots.map(p => ({ id: p.id, goals: p.goals, styles: p.styles, availability: normalize(p), subjects: p.user_subjects.map(s => ({ subjectId: s.subject_id, proficiency: s.proficiency, strong: s.user_topics.filter(t => t.knowledge === 'strong').map(t => t.topic_id), weak: s.user_topics.filter(t => t.knowledge === 'weak').map(t => t.topic_id) })) }))
  return rankCandidates(me, candidates, { subjectId })
}
