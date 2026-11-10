import { describe, expect, it } from 'vitest'
import { assertTransition, canTransition, validateProposal } from '../../src/features/scheduling/domain/session'
const now = Date.parse('2026-11-01T00:00:00Z')
const valid = { creatorId: 'a', partnerId: 'b', subjectId: 'math', startsAt: '2026-11-04T19:00:00+07:00', endsAt: '2026-11-04T20:00:00+07:00' }
describe('scheduling rules', () => {
  it('validates proposals and normalizes to UTC', () => { expect(validateProposal(valid, now).startsAt).toBe('2026-11-04T12:00:00.000Z') })
  it.each([
    { partnerId: 'a' }, { subjectId: '' }, { startsAt: 'bad' }, { startsAt: '2026-11-04T19:00:00' },
    { endsAt: valid.startsAt }, { endsAt: '2026-11-04T10:00:00Z' }, { endsAt: '2026-11-05T12:00:00Z' },
    { startsAt: '2026-10-01T00:00:00Z' },
  ])('rejects invalid creation data %j', patch => { expect(() => validateProposal({ ...valid, ...patch }, now)).toThrow() })
  it.each([['proposed', 'scheduled'], ['scheduled', 'in_progress'], ['in_progress', 'completed'], ['proposed', 'rejected'], ['scheduled', 'missed']] as const)('allows %s -> %s', (from, to) => { expect(canTransition(from, to)).toBe(true) })
  it.each([['proposed', 'completed'], ['scheduled', 'completed'], ['completed', 'cancelled'], ['rejected', 'scheduled'], ['cancelled', 'in_progress'], ['missed', 'completed']] as const)('rejects %s -> %s', (from, to) => { expect(() => assertTransition(from, to)).toThrow() })
  it('permits cancellation only before a terminal status', () => { expect(canTransition('in_progress', 'cancelled')).toBe(true); expect(canTransition('completed', 'cancelled')).toBe(false) })
})
