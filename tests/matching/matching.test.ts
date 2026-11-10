import { describe, expect, it } from 'vitest'
import { availabilityOverlap, matchProfiles, rankCandidates } from '../../src/features/matching/domain/matching'
import type { LearningProfile } from '../../src/types/domain'
const me: LearningProfile = { id: 'me', subjects: [{ subjectId: 'math', proficiency: 1, strong: ['limits'], weak: ['integrals'] }], goals: ['exam'], styles: ['quiet'], availability: [{ day: 1, start: 600, end: 660 }] }
const peer = (patch: Partial<LearningProfile> = {}): LearningProfile => ({ ...me, id: 'peer', subjects: [{ subjectId: 'math', proficiency: 1, strong: ['integrals'], weak: ['limits'] }], ...patch })
describe('explainable matching', () => {
  it('gives 100 for complementary knowledge and identical preferences', () => { const r = matchProfiles(me, peer()); expect(r.score).toBe(100); expect(r.complements[0].teachMe).toEqual(['integrals']); expect(r.reasons).toHaveLength(3) })
  it('requires a shared subject even with identical availability/goals', () => { expect(matchProfiles(me, peer({ subjects: [{ ...me.subjects[0], subjectId: 'physics' }] })).score).toBe(0) })
  it('does not mistake shared weaknesses for complementarity', () => { const r = matchProfiles(me, peer({ subjects: [{ ...me.subjects[0], strong: [] }] })); expect(r.C).toBe(40); expect(r.complements[0].teachMe).toEqual([]); expect(r.complements[0].iTeach).toEqual([]) })
  it('ignores contradictory topic strengths', () => { expect(matchProfiles(me, peer({ subjects: [{ subjectId: 'math', proficiency: 1, strong: ['integrals'], weak: ['integrals'] }] })).C).toBe(40) })
  it('counts partial overlap by minutes and merges duplicate slots', () => { expect(availabilityOverlap([...me.availability, ...me.availability], [{ day: 1, start: 630, end: 690 }])).toEqual({ overlapMinutes: 30, score: 50 }) })
  it('returns zero for disjoint and empty availability', () => { expect(availabilityOverlap(me.availability, [{ day: 2, start: 600, end: 660 }]).score).toBe(0); expect(availabilityOverlap([], []).score).toBe(0) })
  it('rejects invalid intervals', () => { expect(() => availabilityOverlap([{ day: 7, start: 2, end: 1 }], [])).toThrow() })
  it('uses the documented four weights', () => { const r = matchProfiles(me, peer({ goals: ['practice'], styles: ['discussion'], availability: [] })); expect(r).toMatchObject({ C: 100, T: 0, G: 0, L: 0, score: 35 }) })
  it('keeps duplicate goals and topics within 0–100', () => { const r = matchProfiles(me, peer({ goals: ['exam', 'exam'], subjects: [{ subjectId: 'math', proficiency: 1, strong: ['integrals', 'integrals'], weak: ['limits', 'limits'] }] })); expect(r.score).toBe(100) })
  it('breaks ties deterministically and supports filters', () => { const candidates = [peer({ id: 'z' }), peer({ id: 'a' }), me]; expect(rankCandidates(me, candidates).map(r => r.id)).toEqual(['a', 'z']); expect(rankCandidates(me, candidates, { blockedIds: ['a'], subjectId: 'math', minimumScore: 100 }).map(r => r.id)).toEqual(['z']); expect(rankCandidates(me, candidates, { subjectId: 'physics' })).toEqual([]) })
})
