import { requireSupabase } from './client'
export const MATERIALS_BUCKET = 'session-materials'
export const MATERIALS_LIMITS = { maxBytes: 10 * 1024 * 1024, mimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] } as const
export function validateMaterial(file: Pick<File, 'size' | 'type'>, maxBytes = MATERIALS_LIMITS.maxBytes) {
  if (file.size <= 0 || file.size > maxBytes || file.size > MATERIALS_LIMITS.maxBytes) throw new Error('File size must be 1 byte–10 MiB')
  if (!(MATERIALS_LIMITS.mimeTypes as readonly string[]).includes(file.type)) throw new Error('Only PDF, PNG, JPEG and WebP are supported')
}
export async function signedMaterialUrl(path: string) {
  const { data, error } = await requireSupabase().storage.from(MATERIALS_BUCKET).createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}
