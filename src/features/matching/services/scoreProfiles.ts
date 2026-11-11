import { matchProfiles } from '../domain/matching'
import { normalizeWeeklyAvailability, overlappingAvailabilitySlots } from '../domain/timezone'
import type { LearningProfile } from '../../../types/domain'
import type { ProfileView } from '../../../types/product'
export function scoreProfiles(me: ProfileView, peer: ProfileView, subject: string) {
  const reference = new Date()
  const convert = (p: ProfileView): LearningProfile => ({
    id: p.id,
    goals: p.goals,
    styles: p.styles,
    availability: normalizeWeeklyAvailability(p.weeklyAvailability, p.timezone, reference),
    subjects: p.subjects
      .filter((s) => s.name === subject || s.id === subject)
      .map((s) => ({
        subjectId: s.id ?? s.name,
        proficiency: ['Mới bắt đầu', 'Trung bình', 'Nâng cao'].indexOf(s.level),
        strong: s.strong,
        weak: s.weak,
      })),
  })
  const result = matchProfiles(convert(me), convert(peer))
  return {
    ...result,
    teachMe: result.complements.flatMap((s) => s.teachMe),
    iTeach: result.complements.flatMap((s) => s.iTeach),
    overlap: overlappingAvailabilitySlots(
      me.weeklyAvailability,
      me.timezone,
      peer.weeklyAvailability,
      peer.timezone,
      reference
    ),
  }
}
