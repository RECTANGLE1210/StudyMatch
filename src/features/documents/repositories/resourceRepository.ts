import { requireSupabase } from '../../../lib/supabase/client'
import { MATERIALS_BUCKET, validateMaterial, signedMaterialUrl } from '../../../lib/supabase/storage'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const resourceRepository = {
  async list(sessionId: string) {
    const { data, error } = await requireSupabase().from('session_resources').select('*').eq('session_id', sessionId).order('created_at')
    if (error) throw error
    return data ?? []
  },
  async upload(sessionId: string, file: File, maxBytes?: number) {
    validateMaterial(file, maxBytes)
    if (!uuid.test(sessionId)) throw new Error('Invalid session ID')
    const db = requireSupabase()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError) throw authError
    if (!user) throw new Error('Authentication required')
    const path = `${sessionId}/${user.id}/${crypto.randomUUID()}`
    const { error: uploadError } = await db.storage.from(MATERIALS_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { error } = await db.from('session_resources').insert({ session_id: sessionId, uploader_id: user.id, name: file.name, storage_path: path, mime_type: file.type, size_bytes: file.size })
    if (error) {
      const { error: cleanupError } = await db.storage.from(MATERIALS_BUCKET).remove([path])
      if (cleanupError) throw new Error(`Metadata write failed; orphaned upload requires cleanup: ${path}`)
      throw error
    }
    return path
  },
  async addLink(sessionId: string, name: string, link: string) {
    const url = new URL(link)
    if (url.protocol !== 'https:') throw new Error('HTTPS educational links only')
    const db = requireSupabase()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError) throw authError
    if (!user) throw new Error('Authentication required')
    const { error } = await db.from('session_resources').insert({ session_id: sessionId, uploader_id: user.id, name: name.trim(), external_url: url.href })
    if (error) throw error
  },
  async remove(id: string) {
    const db = requireSupabase()
    const { data: { user }, error: authError } = await db.auth.getUser()
    if (authError) throw authError
    if (!user) throw new Error('Authentication required')
    const { data, error } = await db.from('session_resources').select('storage_path,uploader_id').eq('id', id).single()
    if (error) throw error
    if (data.uploader_id !== user.id) throw new Error('Only the uploader may delete materials')
    if (data.storage_path) {
      const { error: removeError } = await db.storage.from(MATERIALS_BUCKET).remove([data.storage_path])
      if (removeError) throw removeError
    }
    const { error: deleteError } = await db.from('session_resources').delete().eq('id', id).select('id').single()
    if (deleteError) throw deleteError
  },
  preview: signedMaterialUrl,
  download: signedMaterialUrl,
}
