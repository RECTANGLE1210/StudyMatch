import { expect, it } from 'vitest'
import { readEnvironment } from '../../src/lib/config/env'
import { validateMaterial } from '../../src/lib/supabase/storage'
it('requires a real backend configuration and has no implicit demo fallback', () => {
  expect(readEnvironment({ DEV: true }).configured).toBe(false)
  expect(readEnvironment({ DEV: false }).configured).toBe(false)
  expect(readEnvironment({ DEV: true })).not.toHaveProperty('demo')
})
it('rejects incomplete and privileged credentials', () => {
  expect(() => readEnvironment({ VITE_SUPABASE_URL: 'https://example.supabase.co' })).toThrow()
  expect(() =>
    readEnvironment({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_invalid',
    })
  ).toThrow()
})
it('enforces material type and size limits', () => {
  expect(() => validateMaterial({ size: 10, type: 'application/pdf' })).not.toThrow()
  expect(() => validateMaterial({ size: 0, type: 'application/pdf' })).toThrow()
  expect(() => validateMaterial({ size: 11_000_000, type: 'image/png' })).toThrow()
  expect(() => validateMaterial({ size: 100, type: 'text/html' })).toThrow()
  expect(() => validateMaterial({ size: 100, type: 'image/png' }, 50)).toThrow()
})

it('rejects malformed URLs and insecure production endpoints', () => {
  expect(() =>
    readEnvironment({
      VITE_SUPABASE_URL: 'https://',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    })
  ).toThrow()
  expect(() =>
    readEnvironment({
      DEV: false,
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    })
  ).toThrow()
  expect(
    readEnvironment({
      DEV: true,
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
    }).configured
  ).toBe(true)
})
