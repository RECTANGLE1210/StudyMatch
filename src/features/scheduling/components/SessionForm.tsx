import { useEffect, useState } from 'react'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { profileService } from '../../profile/services/profileService'
import { Modal, ErrorNotice } from '../../../components/shared/Feedback'
import { localInput } from '../../../lib/utils/dates'
import { localDateTimeToUtc } from '../../matching/domain/timezone'
import { rpc } from '../../../lib/supabase/rpc'
import { errorMessage } from '../../../lib/utils/errors'
import type { CatalogSubject, SessionView } from '../../../types/product'
export function SessionForm({
  onClose,
  existing,
  partnerId = '',
}: {
  onClose: () => void
  existing?: SessionView
  partnerId?: string
}) {
  const { p } = useProfile(),
    { data, action, busy, error: operationError } = useWorkspace(),
    [partner, setPartner] = useState(existing?.partner_id ?? partnerId),
    [subject, setSubject] = useState(existing?.subject_id ?? ''),
    [topics, setTopics] = useState(existing?.topics.map((t) => t.id) ?? []),
    [catalog, setCatalog] = useState<CatalogSubject[]>([]),
    [error, setError] = useState(''),
    [goal, setGoal] = useState('')
  const suggested = localInput(
      existing?.starts_at ?? new Date(Date.now() + 60 * 60_000).toISOString(),
      p.timezone
    ),
    [date, setDate] = useState(suggested.slice(0, 10)),
    [time, setTime] = useState(suggested.slice(11)),
    [duration, setDuration] = useState(
      existing ? Math.round((Date.parse(existing.ends_at) - Date.parse(existing.starts_at)) / 60_000) : 50
    )
  useEffect(() => {
    let active = true
    void profileService
      .subjects()
      .then((rows) => {
        if (active) setCatalog(rows)
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
    return () => {
      active = false
    }
  }, [])
  const peer = data?.conversations.find((c) => c.peer?.id === partner)?.peer,
    shared = p.subjects.filter((s) => peer?.subjects.some((t) => t.id === s.id)),
    selected = subject || shared[0]?.id || '',
    options = catalog.find((s) => s.id === selected)?.topics ?? []
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (!partner || !selected) throw new Error('Chọn bạn học và môn chung')
      const starts = localDateTimeToUtc(`${date}T${time}`, p.timezone),
        ends = new Date(Date.parse(starts) + duration * 60_000).toISOString()
      if (Date.parse(starts) <= Date.now()) throw new Error('Hãy chọn thời gian trong tương lai')
      const ok = await action(
        () =>
          existing
            ? rpc('reschedule_study_session', { session: existing.id, starts, ends, topic_ids: topics })
            : rpc('propose_study_session', {
                partner,
                subject: selected,
                starts,
                ends,
                topic_ids: topics,
                goal,
              }),
        existing ? 'Đã gửi đề xuất dời lịch, chờ bạn học xác nhận' : 'Đã gửi đề xuất, chờ bạn học xác nhận'
      )
      if (ok) onClose()
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <Modal onClose={onClose}>
      <form onSubmit={save}>
        <h3 className="font-bold text-lg mb-3">{existing ? 'Dời lịch học' : 'Đề xuất buổi học'}</h3>
        <ErrorNotice error={error || operationError} />
        <div className="space-y-3 text-sm">
          <select
            required
            aria-label="Bạn học"
            disabled={Boolean(existing)}
            value={partner}
            onChange={(e) => {
              setPartner(e.target.value)
              setSubject('')
              setTopics([])
            }}
          >
            <option value="">Chọn bạn học đã kết nối</option>
            {data?.conversations
              .filter((c) => c.peer)
              .map((c) => (
                <option key={c.id} value={c.peer!.id}>
                  {c.peer!.name}
                </option>
              ))}
          </select>
          <select
            required
            aria-label="Môn học"
            disabled={Boolean(existing)}
            value={selected}
            onChange={(e) => {
              setSubject(e.target.value)
              setTopics([])
            }}
          >
            <option value="">Chọn môn học chung</option>
            {shared.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            {options.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`chip ${topics.includes(t.id) ? 'on' : ''}`}
                onClick={() =>
                  setTopics(topics.includes(t.id) ? topics.filter((id) => id !== t.id) : [...topics, t.id])
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              aria-label="Ngày học"
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <input
              aria-label="Giờ học"
              required
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <p className="text-xs opacity-60">Múi giờ: {p.timezone}</p>
          <div className="flex gap-2">
            {[25, 50, 90].map((n) => (
              <button
                type="button"
                key={n}
                className={`chip ${duration === n ? 'on' : ''}`}
                onClick={() => setDuration(n)}
              >
                {n} phút
              </button>
            ))}
          </div>
          {!existing && (
            <input
              maxLength={300}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Mục tiêu: làm xong 10 bài tập…"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" className="btn btn-o" onClick={onClose}>
            Đóng
          </button>
          <button className="btn btn-p" disabled={busy || !selected || !partner}>
            Gửi đề xuất
          </button>
        </div>
      </form>
    </Modal>
  )
}
