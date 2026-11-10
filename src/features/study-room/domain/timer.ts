export interface Timer { durationMs: number; elapsedMs: number; startedAt: number | null }
export function createTimer(mode: 25 | 50): Timer {
  if (mode !== 25 && mode !== 50) throw new Error('Unsupported Pomodoro mode')
  return { durationMs: mode * 60_000, elapsedMs: 0, startedAt: null }
}
export function remainingMs(t: Timer, now: number) {
  return Math.max(0, t.durationMs - t.elapsedMs - (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt)))
}
export function startTimer(t: Timer, now: number): Timer { return t.startedAt !== null || remainingMs(t, now) === 0 ? t : { ...t, startedAt: now } }
export function pauseTimer(t: Timer, now: number): Timer { return { ...t, elapsedMs: t.durationMs - remainingMs(t, now), startedAt: null } }
export function checklistProgress(goals: readonly { completed: boolean }[]) { return goals.length ? Math.round(100 * goals.filter(g => g.completed).length / goals.length) : 0 }
