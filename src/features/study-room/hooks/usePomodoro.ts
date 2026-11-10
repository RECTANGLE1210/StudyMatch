import { useEffect, useState } from 'react'
import { createTimer, pauseTimer, remainingMs, startTimer } from '../domain/timer'
export function usePomodoro() {
  const [mode, setMode] = useState<25 | 50>(25)
  const [timer, setTimer] = useState(() => createTimer(25))
  const [now, setNow] = useState(Date.now)
  const left = remainingMs(timer, now), running = timer.startedAt !== null && left > 0
  useEffect(() => {
    if (!running) return
    const tick = () => setNow(Date.now())
    tick(); const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [timer.startedAt, running])
  const reset = (next = mode) => { setMode(next); setTimer(createTimer(next)); setNow(Date.now()) }
  const toggle = () => { const at = Date.now(); setNow(at); setTimer(t => t.startedAt === null ? startTimer(t, at) : pauseTimer(t, at)) }
  return { mode, secondsLeft: Math.ceil(left / 1000), running, reset, toggle }
}
