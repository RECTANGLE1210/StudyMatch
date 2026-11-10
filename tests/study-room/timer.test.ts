import { describe, expect, it } from 'vitest'
import { checklistProgress, createTimer, pauseTimer, remainingMs, startTimer } from '../../src/features/study-room/domain/timer'
describe('timestamp Pomodoro', () => {
  it.each([25, 50] as const)('supports %i-minute duration', mode => { expect(createTimer(mode).durationMs).toBe(mode * 60_000) })
  it('measures real elapsed time across delayed browser ticks', () => { expect(remainingMs(startTimer(createTimer(25), 1000), 76_000)).toBe(25 * 60_000 - 75_000) })
  it('pauses and resumes without counting paused time', () => { const paused = pauseTimer(startTimer(createTimer(25), 1000), 61_000); expect(remainingMs(paused, 900_000)).toBe(24 * 60_000); expect(remainingMs(startTimer(paused, 900_000), 960_000)).toBe(23 * 60_000) })
  it('never becomes negative or increases after a backwards clock', () => { const t = startTimer(createTimer(25), 1000); expect(remainingMs(t, 99_999_999)).toBe(0); expect(remainingMs(t, 0)).toBe(t.durationMs) })
  it('does not restart an expired timer without reset', () => { const t = pauseTimer(startTimer(createTimer(25), 0), 2_000_000); expect(startTimer(t, 3_000_000).startedAt).toBeNull(); expect(createTimer(25).elapsedMs).toBe(0) })
  it('does not reset the origin when already running', () => { const t = startTimer(createTimer(25), 10); expect(startTimer(t, 100)).toBe(t) })
  it('handles empty, partial and complete checklists', () => { expect(checklistProgress([])).toBe(0); expect(checklistProgress([{ completed: true }, { completed: false }])).toBe(50); expect(checklistProgress([{ completed: true }])).toBe(100) })
})
