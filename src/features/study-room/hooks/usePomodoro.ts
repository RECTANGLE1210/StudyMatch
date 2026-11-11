import { useEffect, useState } from 'react'
import { createTimer, pauseTimer, remainingMs, startTimer } from '../domain/timer'
import type { RoomData, SessionView } from '../../../types/product'
export interface RoomClock {
  serverMs: number
  sampledAt: number
}

export function usePomodoro(
  session: SessionView | undefined,
  clock: RoomClock | undefined,
  sync: RoomData['roomSync']
) {
  const [tick, setTick] = useState(() => performance.now())
  const [localMode, setLocalMode] = useState<25 | 50>(25)
  const [local, setLocal] = useState(() => createTimer(25))
  const shared = Boolean(sync?.ready && sync.timer && clock)
  const waiting = Boolean(sync?.eligible && !sync.ready)
  const mode = shared ? sync!.timer!.duration_minutes : localMode
  const serverNow = clock ? clock.serverMs + Math.max(0, tick - clock.sampledAt) : Date.now()
  const timer = shared
    ? {
        durationMs: mode * 60_000,
        elapsedMs: sync!.timer!.elapsed_ms,
        startedAt: sync!.timer!.started_at ? Date.parse(sync!.timer!.started_at) : null,
      }
    : local
  const left = remainingMs(timer, shared && session ? Math.min(serverNow, Date.parse(session.ends_at)) : tick)
  const running = session?.status === 'in_progress' && timer.startedAt !== null && left > 0
  useEffect(() => {
    setLocalMode(25)
    setLocal(createTimer(25))
    setTick(performance.now())
  }, [session?.id])
  useEffect(() => {
    setTick(performance.now())
    if (!running) return
    const interval = window.setInterval(() => setTick(performance.now()), 250)
    return () => window.clearInterval(interval)
  }, [running, clock])
  const controlLocal = (command: 'start' | 'pause' | 'reset', minutes?: 25 | 50) => {
    const at = performance.now()
    setTick(at)
    if (command === 'reset') {
      setLocalMode(minutes ?? localMode)
      setLocal(createTimer(minutes ?? localMode))
    } else setLocal((timer) => (command === 'start' ? startTimer(timer, at) : pauseTimer(timer, at)))
  }
  return { mode, secondsLeft: Math.ceil(left / 1000), running, shared, waiting, controlLocal }
}
