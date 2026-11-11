import { availabilitySlotKey } from '../../matching/domain/timezone'
import { rpc } from '../../../lib/supabase/rpc'
import { requireSupabase } from '../../../lib/supabase/client'
import type { CatalogSubject, ProfileView } from '../../../types/product'
export function withSlots(p: ProfileView): ProfileView {
  return {
    ...p,
    avail: (p.weeklyAvailability ?? []).flatMap((a) => {
      const key = availabilitySlotKey(a)
      return key ? [key] : []
    }),
  }
}
export async function hydrateProfile(p: ProfileView): Promise<ProfileView> {
  const profile = withSlots(p)
  if (profile.avatarPath) {
    const { data, error } = await requireSupabase()
      .storage.from('avatars')
      .createSignedUrl(profile.avatarPath, 3600)
    if (error) throw error
    profile.avatar = data.signedUrl
  }
  return profile
}
export const profileService = {
  async get(id: string) {
    const p = await rpc<ProfileView | null>('get_profile_snapshot', { target: id })
    return p ? hydrateProfile(p) : null
  },
  async save(profile: ProfileView, complete = profile.onboardingCompleted) {
    await rpc<void>('save_profile_view', {
      profile: { ...profile, avatar: profile.avatarPath ? null : profile.avatar },
      complete,
    })
    const saved = await this.get(profile.id)
    if (!saved) throw new Error('Không tải được hồ sơ vừa lưu')
    return saved
  },
  async subjects(): Promise<CatalogSubject[]> {
    const { data, error } = await requireSupabase()
      .from('subjects')
      .select('id,name,code,topics(id,name)')
      .order('name')
    if (error) throw error
    return data ?? []
  },
  async uploadAvatar(file: File, userId: string) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2_000_000 || !file.size)
      throw new Error('Chọn ảnh JPG/PNG/WebP dưới 2MB')
    const db = requireSupabase(),
      path = `${userId}/${crypto.randomUUID()}`
    const { error } = await db.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw error
    const { data, error: signedError } = await db.storage.from('avatars').createSignedUrl(path, 3600)
    if (signedError) throw signedError
    return { path, url: data.signedUrl }
  },
}
