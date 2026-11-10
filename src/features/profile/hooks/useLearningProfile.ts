import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { profileRepository, type ProfileRecord } from '../repositories/profileRepository'
import { errorMessage } from '../../../lib/utils/errors'
export function useLearningProfile() {
  const { session } = useAuth()
  const id = session?.user.id
  const [profile, setProfile] = useState<ProfileRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = useCallback(() => setRevision(r => r + 1), [])
  useEffect(() => {
    let active = true
    setProfile(null); setError(''); setLoading(Boolean(id))
    if (id) void profileRepository.get(id).then(p => { if (active) setProfile(p) }).catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, revision])
  return { profile, loading, error, reload }
}
