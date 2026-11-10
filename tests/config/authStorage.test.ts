import { expect, it } from 'vitest'
import { createAuthStorage, REMEMBER_KEY } from '../../src/lib/supabase/authStorage'
const memory = () => {
  const values = new Map<string, string>()
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v)
    },
    removeItem: (k: string) => {
      values.delete(k)
    },
  }
}
it('remembers sessions only when the user opted in', () => {
  const local = memory(),
    session = memory(),
    storage = createAuthStorage(local, session)
  storage.setItem('token', 'one')
  expect(local.getItem('token')).toBe('one')
  storage.setRemember(false)
  storage.setItem('token', 'two')
  expect(local.getItem('token')).toBeNull()
  expect(session.getItem('token')).toBe('two')
  expect(storage.getItem('token')).toBe('two')
})
it('sign out clears both persistence stores', () => {
  const local = memory(),
    session = memory(),
    storage = createAuthStorage(local, session)
  local.setItem('token', 'old')
  session.setItem('token', 'tab')
  storage.removeItem('token')
  expect(local.getItem('token')).toBeNull()
  expect(session.getItem('token')).toBeNull()
})

it('does not switch a running tab to another persistence store when a different tab changes its preference', () => {
  const local = memory(),
    session = memory(),
    storage = createAuthStorage(local, session)
  storage.setRemember(false)
  storage.setItem('token', 'tab-only')
  local.setItem(REMEMBER_KEY, 'true')
  expect(storage.getItem('token')).toBe('tab-only')
})
