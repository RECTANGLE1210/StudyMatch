import { requireSupabase } from './client'
export async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await requireSupabase().rpc(name, params)
  if (error) throw error
  return data as T
}
