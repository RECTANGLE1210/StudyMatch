import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useMatches } from '../hooks/useMatches'
import { Avatar, PublicProfile } from '../../profile/components/ProfileScreens'
import { Empty, ErrorNotice, Modal, Ring } from '../../../components/shared/Feedback'
import { rpc } from '../../../lib/supabase/rpc'
import type { ProfileView } from '../../../types/product'
export function MatchPage() {
  const { p } = useProfile(),
    { data, action, busy } = useWorkspace(),
    navigate = useNavigate()
  const [selected, select] = useState(''),
    [open, setOpen] = useState<ProfileView | null>(null),
    [report, setReport] = useState<ProfileView | null>(null),
    [reason, setReason] = useState(''),
    [minimum, setMinimum] = useState(0)
  const subject = p.subjects.find((s) => s.id === selected) ?? p.subjects[0],
    query = useMatches(subject?.id ?? '')
  const list = query.matches.filter(
    (m) => m.score.score >= minimum && !data?.blockedUsers.includes(m.peer.id)
  )
  const invite = async (peer: ProfileView) => {
    if (!subject?.id) return
    if (
      await action(
        () => rpc('send_invitation', { recipient: peer.id, subject: subject.id }),
        'Đã gửi lời mời học cùng'
      )
    )
      setOpen(null)
  }
  const controls = (peer: ProfileView) => {
    const invitation = data?.invitations.find(
      (i) =>
        (i.sender_id === peer.id || i.recipient_id === peer.id) && ['pending', 'accepted'].includes(i.status)
    )
    const conversation = data?.conversations.find((c) => c.peer?.id === peer.id)
    if (invitation?.status === 'accepted' && conversation)
      return (
        <>
          <span className="text-xs font-semibold text-forest">Đã kết nối</span>
          <button className="btn btn-p text-sm" onClick={() => navigate(`/messages/${conversation.id}`)}>
            Nhắn tin
          </button>
        </>
      )
    if (invitation?.status === 'pending')
      return invitation.sender_id === p.id ? (
        <>
          <span className="text-xs font-semibold text-forest">Đang chờ phản hồi</span>
          <button
            disabled={busy}
            className="btn btn-s text-sm"
            onClick={() => {
              void action(
                () => rpc('respond_invitation', { request_id: invitation.id, next_status: 'cancelled' }),
                'Đã hủy lời mời'
              )
            }}
          >
            Hủy lời mời
          </button>
        </>
      ) : (
        <>
          <button
            disabled={busy}
            className="btn btn-o text-sm"
            onClick={() => {
              void action(
                () => rpc('respond_invitation', { request_id: invitation.id, next_status: 'rejected' }),
                'Đã từ chối lời mời'
              )
            }}
          >
            Từ chối
          </button>
          <button
            disabled={busy}
            className="btn btn-p text-sm"
            onClick={() => {
              void action(
                () => rpc('respond_invitation', { request_id: invitation.id, next_status: 'accepted' }),
                'Đã kết nối'
              )
            }}
          >
            Chấp nhận
          </button>
        </>
      )
    return (
      <button
        disabled={busy}
        className="btn btn-p text-sm"
        onClick={() => {
          void invite(peer)
        }}
      >
        Gửi lời mời
      </button>
    )
  }
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Tìm bạn học hợp gu</h1>
      <div className="flex flex-wrap gap-3 items-center">
        <select
          aria-label="Môn học ghép đôi"
          value={subject?.id ?? ''}
          onChange={(e) => select(e.target.value)}
          className="max-w-xs"
        >
          {p.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="text-xs">
          Điểm tối thiểu
          <input
            aria-label="Điểm tương thích tối thiểu"
            className="!w-20 ml-2"
            type="number"
            min={0}
            max={100}
            value={minimum}
            onChange={(e) => setMinimum(Math.max(0, Math.min(100, Number(e.target.value))))}
          />
        </label>
      </div>
      <ErrorNotice error={query.error} retry={query.reload} />
      {query.loading && !list.length ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-28 animate-pulse bg-matcha-soft" />
          ))}
        </div>
      ) : !list.length ? (
        <Empty
          title="Chưa có bạn học phù hợp lúc này"
          description="Thử thêm khung giờ rảnh hoặc chọn môn khác."
          action="Chỉnh lịch rảnh"
          onAction={() => navigate('/profile')}
        />
      ) : (
        list.map(({ peer, score }) => (
          <div key={peer.id} className="card p-5 hover:-translate-y-0.5 transition">
            <div className="flex gap-4 items-center">
              <Avatar src={peer.avatar} name={peer.name} size={52} />
              <div className="flex-1">
                <b className="text-lg">{peer.name}</b>
                <p className="text-xs opacity-70">
                  {peer.major} · {peer.uni}
                </p>
                {(score.teachMe.length > 0 || score.iTeach.length > 0) && (
                  <p className="text-sm mt-1 bg-caramel/15 rounded-xl px-3 py-1.5 inline-block">
                    🤝{' '}
                    {score.teachMe.length > 0 && (
                      <>
                        {peer.name} vững <b>{score.teachMe.join(', ')}</b>
                      </>
                    )}
                    {score.teachMe.length > 0 && score.iTeach.length > 0 && ' · '}
                    {score.iTeach.length > 0 && (
                      <>
                        bạn giúp lại <b>{score.iTeach.join(', ')}</b>
                      </>
                    )}
                  </p>
                )}
              </div>
              <Ring value={score.score} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3 items-center">
              <span className="chip">{score.overlapMinutes} phút trùng lịch</span>
              {peer.goals.slice(0, 1).map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
              {peer.styles.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
              <span className="flex-1" />
              <button className="btn btn-o text-sm" onClick={() => setOpen(peer)}>
                Xem hồ sơ
              </button>
              {controls(peer)}
            </div>
          </div>
        ))
      )}
      {query.more && (
        <button className="btn btn-o" disabled={query.loading} onClick={query.loadMore}>
          Tải thêm bạn học
        </button>
      )}
      {open && (
        <PublicProfile
          profile={open}
          subject={subject?.name ?? ''}
          onClose={() => setOpen(null)}
          action={
            <>
              <button
                className="text-sm text-red-700 underline mr-auto"
                onClick={() => {
                  setReport(open)
                  setOpen(null)
                }}
              >
                Báo cáo / chặn
              </button>
              {controls(open)}
            </>
          }
        />
      )}
      {report && (
        <Modal onClose={() => setReport(null)}>
          <h3 className="font-bold text-lg">Báo cáo hoặc chặn {report.name}</h3>
          <p className="text-sm opacity-70 my-2">
            Các lời mời và buổi học đang hoạt động sẽ được hủy. Người này sẽ không thể gửi tin nhắn cho bạn.
          </p>
          <textarea
            value={reason}
            maxLength={1000}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do (không bắt buộc)"
          />
          <div className="flex gap-2 justify-end mt-3">
            <button className="btn btn-o" onClick={() => setReport(null)}>
              Hủy
            </button>
            <button
              disabled={busy}
              className="btn btn-p"
              onClick={async () => {
                if (
                  await action(() => rpc('block_user', { target: report.id, reason }), 'Đã chặn người học')
                ) {
                  setReport(null)
                  setReason('')
                  query.reload()
                }
              }}
            >
              Chặn
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
