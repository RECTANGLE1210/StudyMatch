import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { Avatar } from '../../profile/components/ProfileScreens'
import { SessionForm } from './SessionForm'
import { Empty, Modal } from '../../../components/shared/Feedback'
import { rpc } from '../../../lib/supabase/rpc'
import { displayDate } from '../../../lib/utils/dates'
import type { SessionView } from '../../../types/product'
export const SESSION_LABELS = {
  proposed: 'Chờ xác nhận',
  scheduled: 'Đã xác nhận',
  in_progress: 'Đang học',
  completed: 'Hoàn thành',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
  missed: 'Đã lỡ',
}
export function SessionsPage() {
  const { data, action, busy } = useWorkspace(),
    { p } = useProfile(),
    navigate = useNavigate(),
    [search, setSearch] = useSearchParams(),
    [tab, setTab] = useState('Sắp tới'),
    [form, setForm] = useState(false),
    [reschedule, setReschedule] = useState<SessionView | undefined>(),
    [cancel, setCancel] = useState<SessionView | null>(null)
  const partner = search.get('partner') ?? '',
    showForm = form || Boolean(partner),
    rows = (data?.sessions ?? [])
      .filter((s) =>
        tab === 'Sắp tới'
          ? ['proposed', 'scheduled', 'in_progress'].includes(s.status)
          : tab === 'Hoàn thành'
            ? s.status === 'completed'
            : ['cancelled', 'rejected', 'missed'].includes(s.status)
      )
      .sort((a, b) =>
        tab === 'Sắp tới' ? a.starts_at.localeCompare(b.starts_at) : b.starts_at.localeCompare(a.starts_at)
      )
  const close = () => {
    setForm(false)
    setReschedule(undefined)
    if (partner) setSearch({}, { replace: true })
  }
  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-extrabold">Lịch học</h1>
        <button className="btn btn-p" onClick={() => setForm(true)}>
          + Hẹn buổi học
        </button>
      </div>
      <div className="flex gap-2">
        {['Sắp tới', 'Hoàn thành', 'Đã hủy / lỡ'].map((label) => (
          <button key={label} className={`chip ${tab === label ? 'on' : ''}`} onClick={() => setTab(label)}>
            {label}
          </button>
        ))}
      </div>
      {rows.length ? (
        rows.map((s) => {
          const peer = s.creator_id === p.id ? s.partner : s.creator
          return (
            <div key={s.id} className="card p-5 flex flex-wrap items-center gap-3">
              <Avatar src={peer?.avatar} name={peer?.name ?? ''} />
              <div className="flex-1">
                <b>
                  {s.subjectName}
                  {s.topics.length ? ` · ${s.topics.map((t) => t.name).join(', ')}` : ''}
                </b>
                <p className="text-sm opacity-70">
                  {displayDate(s.starts_at, p.timezone)} ·{' '}
                  {Math.round((Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60_000)} phút ·{' '}
                  {peer?.name ?? 'Hồ sơ không còn khả dụng'}
                </p>
                <span className="text-xs text-forest">{SESSION_LABELS[s.status]}</span>
              </div>
              {s.status === 'proposed' && s.partner_id === p.id && (
                <>
                  <button
                    disabled={busy}
                    className="btn btn-p text-sm"
                    onClick={() => {
                      void action(
                        () => rpc('transition_session', { session: s.id, next_status: 'scheduled' }),
                        'Đã xác nhận buổi học'
                      )
                    }}
                  >
                    Chấp nhận
                  </button>
                  <button
                    disabled={busy}
                    className="btn btn-o text-sm"
                    onClick={() => {
                      void action(
                        () => rpc('transition_session', { session: s.id, next_status: 'rejected' }),
                        'Đã từ chối đề xuất'
                      )
                    }}
                  >
                    Từ chối
                  </button>
                </>
              )}
              <button className="btn btn-p text-sm" onClick={() => navigate(`/sessions/${s.id}`)}>
                {['scheduled', 'in_progress'].includes(s.status) ? 'Mở phòng' : 'Chi tiết'}
              </button>
              {['proposed', 'scheduled'].includes(s.status) && s.creator_id === p.id && (
                <button
                  className="btn btn-o text-sm"
                  onClick={() => {
                    setReschedule(s)
                    setForm(true)
                  }}
                >
                  Dời lịch
                </button>
              )}
              {['proposed', 'scheduled', 'in_progress'].includes(s.status) && (
                <button className="btn btn-o text-sm" onClick={() => setCancel(s)}>
                  Hủy
                </button>
              )}
            </div>
          )
        })
      ) : (
        <Empty
          title="Chưa có buổi nào ở đây"
          description="Một buổi học nhỏ, một bước tiến lớn."
          action="Hẹn buổi học"
          onAction={() => setForm(true)}
        />
      )}
      {showForm &&
        (data?.conversations.length ? (
          <SessionForm onClose={close} existing={reschedule} partnerId={partner} />
        ) : (
          <Modal onClose={close}>
            <Empty
              title="Bạn chưa có bạn học đã kết nối"
              description="Gửi hoặc chấp nhận lời mời trước khi hẹn buổi học."
              action="Tìm bạn học"
              onAction={() => navigate('/match')}
            />
          </Modal>
        ))}
      {cancel && (
        <Modal onClose={() => setCancel(null)}>
          <h3 className="font-bold text-lg">Hủy buổi học này?</h3>
          <p className="text-sm opacity-70 my-2">Bạn học sẽ nhận được thông báo.</p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-o" onClick={() => setCancel(null)}>
              Giữ lại
            </button>
            <button
              disabled={busy}
              className="btn btn-p"
              onClick={async () => {
                if (
                  await action(
                    () => rpc('transition_session', { session: cancel.id, next_status: 'cancelled' }),
                    'Đã hủy buổi học'
                  )
                )
                  setCancel(null)
              }}
            >
              Hủy buổi học
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
