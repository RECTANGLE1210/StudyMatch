export const subjectNameKey = (value: string) =>
  value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
export const subjectCodeKey = (value: string) => value.normalize('NFC').replace(/\s+/g, '').toUpperCase()

// Generated catalog keys are internal identifiers, not user-facing course codes.
export const visibleSubjectCode = (value: string) =>
  /^SM-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim()) ? '' : value.trim()
