import { requireSupabase } from '../../../lib/supabase/client'
import { rpc } from '../../../lib/supabase/rpc'
import { MATERIALS_BUCKET, validateMaterial } from '../../../lib/supabase/storage'
import type { ResourceView } from '../../../types/product'
export const LIBRARY_BUCKET = 'library-materials'
export interface LibraryInput {
  name: string
  kind: 'doc' | 'quiz'
  subject: string
  visibility: 'restricted' | 'public'
  sessionId?: string
}
export interface LibraryUser {
  id: string
  name: string
}
export interface LibrarySharing {
  visibility: 'restricted' | 'public'
  grants: LibraryUser[]
  attachmentCount: number
}
const args = (id: string, input: LibraryInput) => ({
  resource: id,
  title: input.name.trim(),
  resource_kind: input.kind,
  subject: input.subject.trim(),
  access: input.visibility,
  attach_to: input.sessionId || null,
})
export const libraryRepository = {
  list: (sessionId?: string) => rpc<ResourceView[]>('get_library_resources', { session: sessionId || null }),
  async upload(file: File, input: LibraryInput) {
    validateMaterial(file)
    const db = requireSupabase()
    const {
      data: { user },
      error,
    } = await db.auth.getUser()
    if (error) throw error
    if (!user) throw new Error('Authentication required')
    const id = crypto.randomUUID(),
      path = `${user.id}/${id}`
    const { error: uploadError } = await db.storage
      .from(LIBRARY_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    try {
      await rpc('create_library_resource', { ...args(id, input), path, mime: file.type, bytes: file.size })
    } catch (e) {
      const { error: cleanup } = await db.storage.from(LIBRARY_BUCKET).remove([path])
      if (cleanup) throw new Error('Không lưu được tài liệu. Tệp đã tải cần được dọn lại trong Storage.')
      throw e
    }
    return id
  },
  async addLink(link: string, input: LibraryInput) {
    const url = new URL(link)
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('Chỉ chấp nhận liên kết HTTPS hợp lệ')
    const id = crypto.randomUUID()
    await rpc('create_library_resource', { ...args(id, input), link: url.href })
    return id
  },
  async preview(path: string) {
    const { data, error } = await requireSupabase().storage.from(LIBRARY_BUCKET).createSignedUrl(path, 60)
    if (error) throw error
    return data.signedUrl
  },
  attach: (resource: string, session: string) => rpc('attach_library_resource', { resource, session }),
  detach: (resource: string, session: string) => rpc('detach_library_resource', { resource, session }),
  sharing: (resource: string) => rpc<LibrarySharing>('get_library_sharing', { resource }),
  users: (query: string) => rpc<LibraryUser[]>('search_library_users', { query }),
  visibility: (resource: string, access: 'restricted' | 'public') =>
    rpc('set_library_visibility', { resource, access }),
  grant: (resource: string, recipient: string, allowed: boolean) =>
    rpc('set_library_grant', { resource, recipient, allowed }),
  clearAttachments: (resource: string) => rpc('clear_library_attachments', { resource }),
  async copyLegacy(resource: ResourceView) {
    const input: LibraryInput = {
      name: resource.name,
      kind: resource.kind,
      subject: resource.subjectName ?? '',
      visibility: 'restricted',
    }
    if (resource.external_url) return libraryRepository.addLink(resource.external_url, input)
    if (!resource.storage_path) throw new Error('Tài liệu không có tệp để sao chép')
    const { data, error } = await requireSupabase()
      .storage.from(MATERIALS_BUCKET)
      .download(resource.storage_path)
    if (error) throw error
    return libraryRepository.upload(
      new File([data], resource.name, { type: resource.mime_type ?? data.type }),
      input
    )
  },
  async remove(resource: string) {
    const path = await rpc<string | null>('remove_library_resource', { resource })
    if (path) {
      const { error } = await requireSupabase().storage.from(LIBRARY_BUCKET).remove([path])
      if (error)
        throw new Error('Quyền truy cập đã được thu hồi nhưng chưa dọn được tệp. Bấm Xóa để thử lại.')
    }
  },
}
