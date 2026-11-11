import type { Availability } from '../../../types/domain'
const formatters = new Map<string, Intl.DateTimeFormat>()
function localParts(at: number, zone: string) {
  let formatter = formatters.get(zone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    formatters.set(zone, formatter)
  }
  const parts = formatter.formatToParts(new Date(at))
  const get = (key: string) => Number(parts.find((p) => p.type === key)!.value)
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
}
export function localDateTimeToUtc(input: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error('Ngày giờ không hợp lệ')
  const target = Date.parse(input + ':00Z')
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 16) !== input)
    throw new Error('Ngày giờ không hợp lệ')
  let guess = target
  for (let i = 0; i < 5; i++) {
    const delta = target - localParts(guess, zone)
    if (!delta) {
      const earlier = [180, 150, 120, 90, 60, 30, 0]
        .map((minutes) => guess - minutes * 60_000)
        .find((at) => localParts(at, zone) === target)!
      return new Date(earlier).toISOString()
    }
    guess += delta
  }
  throw new Error('Giờ này không tồn tại trong múi giờ đã chọn (DST). Hãy chọn giờ khác.')
}
export function normalizeWeeklyAvailability(
  slots: Availability[],
  zone: string,
  reference = new Date()
): Availability[] {
  const monday = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
  )
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  const result: Availability[] = []
  for (const slot of slots) {
    if (
      !Number.isInteger(slot.day) ||
      slot.day < 0 ||
      slot.day > 6 ||
      !Number.isInteger(slot.start) ||
      !Number.isInteger(slot.end) ||
      slot.start < 0 ||
      slot.end > 1440 ||
      slot.end <= slot.start
    )
      throw new Error('Invalid weekly slot')
    const date = new Date(monday)
    date.setUTCDate(date.getUTCDate() + ((slot.day + 6) % 7))
    const input = (minute: number) => {
      const d = new Date(date.getTime() + minute * 60_000)
      return d.toISOString().slice(0, 16)
    }
    const start = Date.parse(localDateTimeToUtc(input(slot.start), zone)),
      end = Date.parse(localDateTimeToUtc(input(slot.end), zone))
    for (let t = start; t < end;) {
      const d = new Date(t)
      const minute = d.getUTCHours() * 60 + d.getUTCMinutes(),
        duration = Math.min((end - t) / 60_000, 1440 - minute)
      result.push({ day: d.getUTCDay(), start: minute, end: minute + duration })
      t += duration * 60_000
    }
  }
  return result
}

export function availabilitySlotKey(slot: Availability): string | null {
  const period =
    slot.start === 480 ? 'Sáng' : slot.start === 780 ? 'Chiều' : slot.start === 1080 ? 'Tối' : null
  return period ? `${['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][slot.day]}-${period}` : null
}

export function overlappingAvailabilitySlots(
  viewer: Availability[],
  viewerZone: string,
  displayed: Availability[],
  displayedZone: string,
  reference = new Date()
): string[] {
  const mine = normalizeWeeklyAvailability(viewer, viewerZone, reference)
  return displayed.flatMap((slot) => {
    const key = availabilitySlotKey(slot)
    const shared = normalizeWeeklyAvailability([slot], displayedZone, reference).some((other) =>
      mine.some(
        (own) => own.day === other.day && Math.max(own.start, other.start) < Math.min(own.end, other.end)
      )
    )
    return key && shared ? [key] : []
  })
}
