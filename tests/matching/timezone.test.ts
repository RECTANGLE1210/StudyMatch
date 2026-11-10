import { describe, expect, it } from 'vitest'
import { localDateTimeToUtc, normalizeWeeklyAvailability } from '../../src/features/matching/domain/timezone'
import { availabilityOverlap } from '../../src/features/matching/domain/matching'
describe('timezone-aware matching and scheduling', () => {
  it('converts Vietnam local time to UTC', () => {
    expect(localDateTimeToUtc('2026-11-10T19:30', 'Asia/Ho_Chi_Minh')).toBe('2026-11-10T12:30:00.000Z')
  })
  it('selects the earlier occurrence of an ambiguous clock time', () => {
    expect(localDateTimeToUtc('2026-11-01T01:30', 'America/New_York')).toBe('2026-11-01T05:30:00.000Z')
    expect(localDateTimeToUtc('2026-04-05T01:45', 'Australia/Lord_Howe')).toBe('2026-04-04T14:45:00.000Z')
  })
  it('rejects invalid dates and missing local minutes', () => {
    expect(() => localDateTimeToUtc('2026-02-30T12:00', 'UTC')).toThrow()
    expect(() => localDateTimeToUtc('2026-11-10', 'UTC')).toThrow()
  })
  it('rejects nonexistent daylight-saving times', () => {
    expect(() => localDateTimeToUtc('2026-03-08T02:30', 'America/New_York')).toThrow()
  })
  it('handles a DST offset change on the reference week', () => {
    expect(
      normalizeWeeklyAvailability(
        [{ day: 1, start: 480, end: 660 }],
        'America/New_York',
        new Date('2026-03-02T00:00:00Z')
      )
    ).toEqual([{ day: 1, start: 780, end: 960 }])
    expect(
      normalizeWeeklyAvailability(
        [{ day: 1, start: 480, end: 660 }],
        'America/New_York',
        new Date('2026-03-09T00:00:00Z')
      )
    ).toEqual([{ day: 1, start: 720, end: 900 }])
  })
  it('compares the same real interval in different zones', () => {
    const day = new Date('2026-11-09T00:00:00Z')
    expect(
      availabilityOverlap(
        normalizeWeeklyAvailability([{ day: 1, start: 1080, end: 1260 }], 'Asia/Ho_Chi_Minh', day),
        normalizeWeeklyAvailability([{ day: 1, start: 660, end: 840 }], 'UTC', day)
      ).score
    ).toBe(100)
  })
  it('splits intervals across UTC midnight/week boundary', () => {
    expect(
      normalizeWeeklyAvailability(
        [{ day: 1, start: 60, end: 240 }],
        'Asia/Ho_Chi_Minh',
        new Date('2026-11-09T00:00:00Z')
      )
    ).toEqual([{ day: 0, start: 1080, end: 1260 }])
    expect(() => normalizeWeeklyAvailability([{ day: 7, start: 0, end: 60 }], 'UTC')).toThrow()
  })
})
