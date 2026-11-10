import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { Avatar } from '../../profile/components/ProfileScreens'
import { Loading } from '../../../components/shared/Loading'
import { Empty } from '../../../components/shared/Feedback'
import { displayDate } from '../../../lib/utils/dates'
import type { ProfileView } from '../../../types/product'
export function ProgressPage() {
  const { data, loading } = useWorkspace(),
    { p } = useProfile(),
    navigate = useNavigate()
  if (!data)
    return loading ? (
      <Loading />
    ) : (
      <Empty title="Chưa tải được tiến độ" description="Thử tải lại dữ liệu để xem hành trình học." />
    )
  const stats = data.progress,
    partners = new Map<string, ProfileView>()
  data.sessions
    .filter((s) => s.status === 'completed')
    .forEach((s) => {
      const peer = s.creator_id === p.id ? s.partner : s.creator
      if (peer) partners.set(peer.id, peer)
    })
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: p.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const today = formatter.format(new Date()),
    days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today + 'T12:00:00Z')
      date.setUTCDate(date.getUTCDate() - 6 + i)
      const key = date.toISOString().slice(0, 10)
      return {
        key,
        label: new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' }).format(date),
        minutes: stats.daily.find((d) => d.date === key)?.minutes ?? 0,
      }
    }),
    max = Math.max(1, ...days.map((d) => d.minutes))
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Hành trình học của bạn</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          [`${(stats.totalMinutes / 60).toFixed(1)}h`, 'Tổng giờ học'],
          [String(stats.completedSessions), 'Buổi hoàn thành'],
          [String(stats.missedSessions), 'Buổi lỡ'],
          [String(stats.partnerCount), 'Bạn học'],
        ].map(([value, label]) => (
          <div key={label} className="card p-4">
            <div className="text-3xl font-extrabold text-forest">{value}</div>
            <div className="text-xs opacity-70">{label}</div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h3 className="font-bold mb-3">Giờ học 7 ngày qua</h3>
        <div className="flex items-end gap-3 h-28">
          {days.map((d) => (
            <div key={d.key} className="flex-1 text-center text-xs" title={`${d.minutes.toFixed(0)} phút`}>
              <div className="bg-matcha rounded-t-xl" style={{ height: (90 * d.minutes) / max }} />
              {d.label}
            </div>
          ))}
        </div>
        <p className="text-xs mt-3 opacity-70">Đã hoàn thành {stats.completedGoals} mục tiêu học tập.</p>
      </div>
      <div className="card p-5">
        <h3 className="font-bold mb-3">Bạn học đã đồng hành</h3>
        {[...partners.values()].map((peer) => (
          <div key={peer.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
            <Avatar src={peer.avatar} name={peer.name} />
            <span className="flex-1">{peer.name}</span>
            <button className="btn btn-s text-sm" onClick={() => navigate('/sessions')}>
              Hẹn lại
            </button>
          </div>
        ))}
        {!partners.size && <p className="text-sm opacity-60">Bạn chưa hoàn thành buổi học cùng bạn khác.</p>}
        <button className="btn btn-p mt-3" onClick={() => navigate('/match')}>
          Tìm bạn học mới
        </button>
      </div>
      <div className="card p-5">
        <h3 className="font-bold mb-3">Lịch sử học tập</h3>
        {data.sessions
          .filter((s) => ['completed', 'missed', 'cancelled', 'rejected'].includes(s.status))
          .map((s) => (
            <button
              key={s.id}
              className="w-full text-left py-3 border-b border-line"
              onClick={() => navigate(`/sessions/${s.id}`)}
            >
              <b>{s.subjectName}</b>
              <p className="text-xs opacity-70">
                {displayDate(s.starts_at, p.timezone)} · {s.status}
              </p>
            </button>
          ))}
      </div>
    </div>
  )
}
