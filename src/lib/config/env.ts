export interface AppEnvironment { DEV?: boolean; VITE_DEMO_MODE?: string; VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string }
export function readEnvironment(raw: AppEnvironment) {
  const demo = raw.DEV === true && raw.VITE_DEMO_MODE === 'true'
  const url = raw.VITE_SUPABASE_URL?.trim() ?? ''
  const key = raw.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? ''
  if (url || key) {
    if (!url || !key) throw new Error('Cần cả VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY.')
    let parsed: URL
    try { parsed = new URL(url) } catch { throw new Error('Supabase URL không hợp lệ.') }
    const local = raw.DEV && parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)
    if ((parsed.protocol !== 'https:' && !local) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Supabase URL không hợp lệ.')
    if (!key.startsWith('sb_publishable_')) throw new Error('Chỉ sử dụng Supabase publishable key (sb_publishable_).')
  }
  return { demo, url, key, configured: Boolean(url && key) }
}
const configuration = (() => {
  try { return { value: readEnvironment(import.meta.env), error: '' } }
  catch (error) { return { value: { demo: false, configured: false, url: '', key: '' }, error: error instanceof Error ? error.message : 'Invalid environment configuration' } }
})()
export const env = configuration.value
export const configurationError = configuration.error
