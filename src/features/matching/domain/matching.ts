import type { Availability, LearningProfile } from '../../../types/domain'
import { MATCHING_WEIGHTS } from './weights'
const unique = (a: string[]) => [...new Set(a)]
const intersection = (a: string[], b: string[]) => unique(a).filter(x => b.includes(x))
const percent = (n: number, d: number) => d > 0 ? Math.round(Math.max(0, Math.min(100, 100 * n / d))) : 0
const similarity = (a: string[], b: string[]) => percent(2 * intersection(a, b).length, unique(a).length + unique(b).length)
function minutes(slots: Availability[]) {
  const result = new Set<number>()
  for (const s of slots) {
    if (![s.day, s.start, s.end].every(Number.isInteger) || s.day < 0 || s.day > 6 || s.start < 0 || s.end > 1440 || s.start >= s.end) throw new Error('Invalid weekly availability')
    for (let t = s.start; t < s.end; t++) result.add(s.day * 1440 + t)
  }
  return result
}
export function availabilityOverlap(a: Availability[], b: Availability[]) {
  const left = minutes(a), right = minutes(b)
  const overlapMinutes = [...left].filter(x => right.has(x)).length
  return { overlapMinutes, score: percent(overlapMinutes, Math.min(left.size, right.size)) }
}
export function matchProfiles(me: LearningProfile, peer: LearningProfile) {
  const sharedSubjects = unique(me.subjects.map(s => s.subjectId)).filter(id => peer.subjects.some(s => s.subjectId === id))
  const complements = sharedSubjects.map(subjectId => {
    const mine = me.subjects.find(s => s.subjectId === subjectId)!
    const theirs = peer.subjects.find(s => s.subjectId === subjectId)!
    const teachMe = intersection(mine.weak, theirs.strong).filter(t => !theirs.weak.includes(t))
    const iTeach = intersection(theirs.weak, mine.strong).filter(t => !mine.weak.includes(t))
    return { subjectId, teachMe, iTeach, C: 40 + 60 * (teachMe.length + iTeach.length) / Math.max(1, unique(mine.weak).length + unique(theirs.weak).length) }
  })
  const C = complements.length ? Math.round(complements.reduce((n, x) => n + x.C, 0) / complements.length) : 0
  const { score: T, overlapMinutes } = availabilityOverlap(me.availability, peer.availability)
  const G = similarity(me.goals, peer.goals), L = similarity(me.styles, peer.styles)
  const score = sharedSubjects.length ? Math.round(C * MATCHING_WEIGHTS.C + T * MATCHING_WEIGHTS.T + G * MATCHING_WEIGHTS.G + L * MATCHING_WEIGHTS.L) : 0
  return { id: peer.id, score, C, T, G, L, sharedSubjects, complements, overlapMinutes,
    reasons: [sharedSubjects.length ? `${sharedSubjects.length} shared subject(s)` : 'No shared subject', `${overlapMinutes} overlapping minutes`, `${complements.reduce((n, c) => n + c.teachMe.length + c.iTeach.length, 0)} complementary topic(s)`] }
}
export function rankCandidates(me: LearningProfile, candidates: LearningProfile[], options: { subjectId?: string; minimumScore?: number; blockedIds?: string[] } = {}) {
  return candidates.filter(p => p.id !== me.id && !options.blockedIds?.includes(p.id) && (!options.subjectId || p.subjects.some(s => s.subjectId === options.subjectId)))
    .map(p => matchProfiles(me, p)).filter(m => m.sharedSubjects.length && m.score >= (options.minimumScore ?? 0))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}
