import { matchProfiles } from '../domain/matching'
import { normalizeWeeklyAvailability } from '../domain/timezone'
import type { LearningProfile } from '../../../types/domain'
import type { ProfileView } from '../../../types/product'
export function scoreProfiles(me: ProfileView, peer: ProfileView, subject: string) {
  const convert = (p: ProfileView): LearningProfile => ({
    id: p.id,
    goals: p.goals,
    styles: p.styles,
    availability: normalizeWeeklyAvailability(p.weeklyAvailability, p.timezone),
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
    overlap: me.timezone === peer.timezone ? me.avail.filter((a) => peer.avail.includes(a)) : [],
  }
}
