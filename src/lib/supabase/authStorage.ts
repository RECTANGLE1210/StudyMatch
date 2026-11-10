export interface SessionStorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}
export const REMEMBER_KEY = 'studymatch:remember'
export function createAuthStorage(local: SessionStorageLike, session: SessionStorageLike) {
  let remembered = local.getItem(REMEMBER_KEY) !== 'false'
  const chosen = () => (remembered ? local : session)
  return {
    getRemember: () => remembered,
    setRemember: (value: boolean) => {
      remembered = value
      local.setItem(REMEMBER_KEY, String(value))
    },
    getItem: (key: string) => chosen().getItem(key),
    setItem: (key: string, value: string) => {
      const active = chosen()
      ;(active === local ? session : local).removeItem(key)
      active.setItem(key, value)
    },
    removeItem: (key: string) => {
      local.removeItem(key)
      session.removeItem(key)
    },
  }
}
export const browserAuthStorage =
  typeof window === 'undefined' ? undefined : createAuthStorage(window.localStorage, window.sessionStorage)
export function rememberPreference() {
  return browserAuthStorage?.getRemember() ?? true
}
export function setRememberPreference(value: boolean) {
  browserAuthStorage?.setRemember(value)
}
