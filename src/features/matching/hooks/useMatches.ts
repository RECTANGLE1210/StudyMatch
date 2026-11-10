import { useEffect, useMemo, useState } from 'react'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { hydrateProfile } from '../../profile/services/profileService'
import { rpc } from '../../../lib/supabase/rpc'
import { errorMessage } from '../../../lib/utils/errors'
import { scoreProfiles } from '../services/scoreProfiles'
import type { ProfileView } from '../../../types/product'
export function useMatches(subjectId: string) {
  const { p } = useProfile(),
    [page, setPage] = useState(0),
    [revision, setRevision] = useState(0),
    [snapshot, setSnapshot] = useState<{ subject: string; profiles: ProfileView[] }>({
      subject: '',
      profiles: [],
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [more, setMore] = useState(false)
  useEffect(() => {
    setPage(0)
    setSnapshot({ subject: subjectId, profiles: [] })
  }, [subjectId])
  useEffect(() => {
    if (!subjectId || !p.onboardingCompleted) return
    let active = true
    setLoading(true)
    setError('')
    void rpc<ProfileView[]>('find_candidate_profiles', { subject: subjectId, page_index: page })
      .then(async (rows) => {
        const profiles = await Promise.all(rows.map(hydrateProfile))
        if (!active) return
        setSnapshot((old) => ({
          subject: subjectId,
          profiles:
            page && old.subject === subjectId
              ? [...new Map([...old.profiles, ...profiles].map((v) => [v.id, v])).values()]
              : profiles,
        }))
        setMore(rows.length === 50)
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [subjectId, p.id, p.onboardingCompleted, page, revision])
  const matches = useMemo(
    () =>
      snapshot.subject === subjectId
        ? snapshot.profiles
            .map((peer) => ({ peer, score: scoreProfiles(p, peer, subjectId) }))
            .sort((a, b) => b.score.score - a.score.score || a.peer.id.localeCompare(b.peer.id))
        : [],
    [snapshot, p, subjectId]
  )
  return {
    matches,
    loading,
    error,
    more,
    loadMore: () => setPage((n) => n + 1),
    reload: () => {
      setPage(0)
      setRevision((n) => n + 1)
    },
  }
}
