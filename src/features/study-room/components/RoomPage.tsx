import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { Avatar } from '../../profile/components/ProfileScreens'
import { RoomResources } from '../../documents/components/LibraryScreen'
import { useRoom } from '../hooks/useRoom'
import { usePomodoro } from '../hooks/usePomodoro'
import { roomRepository } from '../repositories/roomRepository'
import { rpc } from '../../../lib/supabase/rpc'
import { Empty, ErrorNotice } from '../../../components/shared/Feedback'
import { Loading } from '../../../components/shared/Loading'
import { displayDate } from '../../../lib/utils/dates'
import { SESSION_LABELS } from '../../scheduling/components/SessionsPage'
export function RoomPage() {
  const { sessionId } = useParams(),
    { data, action, busy } = useWorkspace(),
    { p } = useProfile(),
    navigate = useNavigate()
  const candidate =
      data?.sessions.find((s) => s.status === 'in_progress') ??
      data?.sessions
        .filter((s) => s.status === 'scheduled')
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0],
    id = sessionId ?? candidate?.id ?? '',
    query = useRoom(id),
    room = query.room,
    session = data?.sessions.find((s) => s.id === id) ?? room?.session
  const timer = usePomodoro(),
    [goal, setGoal] = useState(''),
    [meet, setMeet] = useState(''),
    [rating, setRating] = useState(0),
    [comment, setComment] = useState(''),
    [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(tick)
  }, [])
  useEffect(() => {
    setMeet(session?.meet_link ?? '')
  }, [id, session?.meet_link])
  useEffect(() => {
    if (room?.feedback) {
      setRating(room.feedback.rating)
      setComment(room.feedback.comment)
    }
  }, [room?.feedback?.rating, room?.feedback?.comment])
  if (!id)
    return (
      <Empty
        title="Chưa có phòng học sẵn sàng"
        description="Hẹn và xác nhận một buổi học để mở Study Room."
        action="Xem lịch học"
        onAction={() => navigate('/sessions')}
      />
    )
  if (!room || !session)
    return query.loading ? (
      <Loading />
    ) : (
      <>
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.reload()
          }}
        />
        <Empty
          title="Không mở được phòng học"
          description="Buổi học không tồn tại hoặc bạn không có quyền tham gia."
        />
      </>
    )
  const peer = session.creator_id === p.id ? session.partner : session.creator,
    editable = ['proposed', 'scheduled', 'in_progress'].includes(session.status),
    attended = session.attendance.includes(p.id),
    both = session.attendance.length === 2,
    during = session.status === 'in_progress',
    completed = session.status === 'completed'
  const remaining =
    String(Math.floor(timer.secondsLeft / 60)).padStart(2, '0') +
    ':' +
    String(timer.secondsLeft % 60).padStart(2, '0')
  const feedback = async (next?: string) => {
    if (rating < 1) return
    if (await action(() => roomRepository.feedback(id, rating, comment), 'Đã lưu phản hồi buổi học')) {
      await query.reload()
      if (next) navigate(next)
    }
  }
  return (
    <div className="space-y-5">
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.reload()
        }}
      />
      <div className="card p-5 bg-paper text-espresso border-matcha flex flex-wrap items-center gap-3">
        <Avatar src={peer?.avatar} name={peer?.name ?? ''} />
        <div className="flex-1">
          <b>
            {session.subjectName}
            {session.topics.length ? ` · ${session.topics.map((t) => t.name).join(', ')}` : ''}
          </b>
          <p className="text-xs opacity-70">
            Cùng {peer?.name ?? 'hồ sơ không còn khả dụng'} · {displayDate(session.starts_at, p.timezone)}
          </p>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full ${during ? 'bg-caramel text-espresso font-bold' : 'bg-matcha-soft text-forest font-semibold'}`}
        >
          {SESSION_LABELS[session.status]}
        </span>
      </div>
      {!during && !completed && (
        <div className="card p-6 space-y-3">
          <h3 className="font-bold text-lg">Sẵn sàng cho một phiên học thật tập trung?</h3>
          {session.status === 'proposed' ? (
            <>
              <p className="text-sm">Buổi học đang chờ bạn học xác nhận.</p>
              {session.partner_id === p.id && (
                <button
                  disabled={busy}
                  className="btn btn-p"
                  onClick={() => {
                    void action(
                      () => rpc('transition_session', { session: id, next_status: 'scheduled' }),
                      'Đã xác nhận lịch học'
                    )
                  }}
                >
                  Chấp nhận lịch học
                </button>
              )}
            </>
          ) : session.status === 'scheduled' ? (
            <>
              <p className="text-sm">
                {attended ? '✓ Bạn đã xác nhận tham gia' : '⏳ Bạn chưa xác nhận tham gia'}
                <br />
                {both
                  ? '✓ Cả hai đã xác nhận'
                  : `⏳ ${peer?.name ?? 'Bạn học'} chưa xác nhận hoặc đang chờ bạn`}
              </p>
              {!attended && (
                <button
                  disabled={busy}
                  className="btn btn-s"
                  onClick={() => {
                    void action(() => roomRepository.attend(id), 'Đã xác nhận tham gia')
                  }}
                >
                  Xác nhận tham gia
                </button>
              )}
              <button
                className="btn btn-p"
                disabled={
                  busy || !both || now < Date.parse(session.starts_at) || now >= Date.parse(session.ends_at)
                }
                onClick={() => {
                  void action(
                    () => rpc('transition_session', { session: id, next_status: 'in_progress' }),
                    'Buổi học đã bắt đầu'
                  )
                }}
              >
                Bắt đầu phiên học
              </button>
              <p className="text-xs opacity-60">
                Phòng bắt đầu trong khung giờ đã hẹn sau khi cả hai xác nhận.
              </p>
            </>
          ) : (
            <p className="text-sm">Buổi học này đã kết thúc. Bạn có thể xem lại tài liệu và mục tiêu.</p>
          )}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {during && (
          <div className="card p-6 text-center bg-matcha-soft">
            <div className="flex justify-center gap-2 mb-3">
              {([25, 50] as const).map((n) => (
                <button
                  key={n}
                  className={`chip ${timer.mode === n ? 'on' : ''}`}
                  onClick={() => timer.reset(n)}
                >
                  {n} phút
                </button>
              ))}
            </div>
            <div className="text-6xl font-extrabold text-forest tabular-nums">{remaining}</div>
            <div className="flex justify-center gap-2 mt-4">
              <button className="btn btn-p" disabled={timer.secondsLeft === 0} onClick={timer.toggle}>
                {timer.running ? 'Tạm dừng' : 'Bắt đầu'}
              </button>
              <button className="btn btn-o" onClick={() => timer.reset()}>
                Đặt lại
              </button>
            </div>
          </div>
        )}
        <div className="card p-5">
          <h3 className="font-bold mb-2">Mục tiêu chung</h3>
          {room.goals.map((g) => (
            <div key={g.id} className="flex items-center gap-2">
              <label className="flex gap-2 py-1 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  className="!w-5"
                  checked={g.completed}
                  disabled={!editable || busy}
                  onChange={() => {
                    void action(() => roomRepository.completeGoal(g.id, !g.completed))
                  }}
                />
                <span className={g.completed ? 'line-through opacity-50' : ''}>{g.title}</span>
              </label>
              {editable && (
                <button
                  aria-label={`Xóa mục tiêu ${g.title}`}
                  disabled={busy}
                  className="text-xs opacity-60 underline"
                  onClick={() => {
                    void action(() => rpc('remove_session_goal', { goal: g.id }))
                  }}
                >
                  Xóa
                </button>
              )}
            </div>
          ))}
          {!room.goals.length && <p className="text-sm opacity-60">Chưa có mục tiêu chung.</p>}
          {editable && (
            <form
              className="flex gap-2 mt-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (goal.trim() && (await action(() => roomRepository.addGoal(id, goal)))) setGoal('')
              }}
            >
              <input
                value={goal}
                maxLength={300}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Thêm mục tiêu"
              />
              <button className="btn btn-s" disabled={busy || !goal.trim()}>
                Thêm
              </button>
            </form>
          )}
        </div>
        <RoomResources sessionId={id} resources={room.resources} editable={editable} />
        <div className="card p-5">
          <h3 className="font-bold mb-2">Google Meet</h3>
          <div className="flex flex-wrap gap-2">
            <input
              aria-label="Google Meet"
              disabled={!editable}
              value={meet}
              onChange={(e) => setMeet(e.target.value)}
              placeholder="https://meet.google.com/…"
            />
            {editable && (
              <button
                disabled={busy || meet === session.meet_link || !meet}
                className="btn btn-s"
                onClick={() => {
                  void action(() => roomRepository.setMeetLink(id, meet), 'Đã lưu Google Meet')
                }}
              >
                Lưu
              </button>
            )}
            <button
              className="btn btn-p"
              disabled={!session.meet_link}
              onClick={() => {
                if (session.meet_link) window.open(session.meet_link, '_blank', 'noopener,noreferrer')
              }}
            >
              Mở
            </button>
          </div>
        </div>
        {during && (
          <button
            className="btn btn-p md:col-span-2"
            disabled={busy}
            onClick={() => {
              void action(
                () => rpc('transition_session', { session: id, next_status: 'completed' }),
                'Đã hoàn thành buổi học và ghi nhận tiến độ'
              )
            }}
          >
            Kết thúc & xác nhận hoàn thành
          </button>
        )}
      </div>
      {completed && (
        <div className="card p-6 space-y-3 text-center">
          <div className="text-5xl">🎉</div>
          <h3 className="text-xl font-bold">
            Hoàn thành {room.goals.filter((g) => g.completed).length}/{room.goals.length} mục tiêu
          </h3>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-label={`Đánh giá ${n} sao`}
                className={`chip ${rating === n ? 'on' : ''}`}
                onClick={() => setRating(n)}
              >
                {n} ★
              </button>
            ))}
          </div>
          <textarea
            maxLength={1000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Một chút cảm nhận về buổi học…"
          />
          <p className="text-sm">Muốn học tiếp cùng {peer?.name ?? 'bạn học'} chứ?</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              disabled={busy || rating === 0}
              className="btn btn-s"
              onClick={() => {
                void feedback()
              }}
            >
              Lưu phản hồi
            </button>
            <button
              disabled={busy || rating === 0}
              className="btn btn-p"
              onClick={() => {
                void feedback(`/sessions?partner=${peer?.id ?? ''}`)
              }}
            >
              Hẹn buổi tiếp theo
            </button>
            <button className="btn btn-o" onClick={() => navigate('/match')}>
              Tìm bạn học khác
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
