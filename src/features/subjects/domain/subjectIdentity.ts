export const subjectNameKey = (value: string) =>
  value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
export const subjectCodeKey = (value: string) => value.normalize('NFC').replace(/\s+/g, '').toUpperCase()
