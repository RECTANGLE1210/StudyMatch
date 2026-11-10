import { useNavigate } from 'react-router-dom'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useMatches } from '../../matching/hooks/useMatches'
import { Avatar } from '../../profile/components/ProfileScreens'
import { Empty, Ring } from '../../../components/shared/Feedback'
import { Loading } from '../../../components/shared/Loading'
import { displayDate } from '../../../lib/utils/dates'
export function HomePage() {
  const { p } = useProfile(),
    { data, loading } = useWorkspace(),
    navigate = useNavigate(),
    suggestions = useMatches(p.subjects[0]?.id ?? '')
  if (!data)
    return loading ? (
      <Loading />
    ) : (
      <Empty
        title="Chưa tải được không gian học tập"
        description="Kiểm tra kết nối và thử tải lại dữ liệu."
      />
    )
  const upcoming = data.sessions
    .filter((s) => ['scheduled', 'in_progress', 'proposed'].includes(s.status))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const partner = upcoming && (upcoming.creator_id === p.id ? upcoming.partner : upcoming.creator)
  const progress = data.progress
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between items-end gap-2">
        <div>
          <h1 className="text-3xl font-extrabold">Chào {p.name} ☀️</h1>
          <p className="opacity-70">Hôm nay mình học gì nhỉ?</p>
        </div>
      </header>
      {!data.sessions.length ? (
        <div className="card p-8 bg-matcha-soft text-center">
          <div className="text-5xl">🍵</div>
          <h2 className="text-xl font-bold mt-2">Chưa có buổi học nào, bắt đầu từ ly matcha đầu tiên nhé</h2>
          <p className="text-sm opacity-70 my-3">Chọn một môn và để StudyMatch gợi ý bạn học hợp gu.</p>
          <button className="btn btn-p" onClick={() => navigate('/match')}>
            Tìm bạn học
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              [`${(progress.totalMinutes / 60).toFixed(1)}h`, 'Giờ học'],
              [String(progress.completedSessions), 'Buổi hoàn thành'],
              [String(progress.partnerCount), 'Bạn học'],
            ].map(([value, label]) => (
              <div key={label} className="card p-4">
                <div className="text-2xl md:text-3xl font-extrabold text-forest">{value}</div>
                <div className="text-xs opacity-70">{label}</div>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <section className="card p-5">
              <h3 className="font-bold mb-3">Buổi học sắp tới</h3>
              {upcoming ? (
                <div className="flex gap-3 items-center">
                  <Avatar src={partner?.avatar} name={partner?.name ?? ''} />
                  <div className="flex-1 min-w-0">
                    <b>
                      {upcoming.subjectName}
                      {upcoming.topics.length ? ` · ${upcoming.topics.map((t) => t.name).join(', ')}` : ''}
                    </b>
                    <p className="text-xs opacity-70">
                      {displayDate(upcoming.starts_at, p.timezone)} ·{' '}
                      {Math.round((Date.parse(upcoming.ends_at) - Date.parse(upcoming.starts_at)) / 60_000)}{' '}
                      phút · {partner?.name ?? 'Hồ sơ không còn khả dụng'}
                    </p>
                  </div>
                  <button className="btn btn-p text-sm" onClick={() => navigate(`/sessions/${upcoming.id}`)}>
                    Vào phòng
                  </button>
                </div>
              ) : (
                <p className="text-sm opacity-60">Chưa có buổi học sắp tới.</p>
              )}
            </section>
            <section className="card p-5">
              <h3 className="font-bold mb-3">Gợi ý cho bạn</h3>
              {suggestions.matches.slice(0, 2).map(({ peer, score }) => (
                <div key={peer.id} className="flex items-center gap-3 mb-2">
                  <Avatar src={peer.avatar} name={peer.name} />
                  <span className="flex-1">
                    {peer.name}
                    <br />
                    <span className="text-xs opacity-60">{peer.subjects[0]?.strong.join(', ')}</span>
                  </span>
                  <Ring value={score.score} size={48} />
                </div>
              ))}
              {!suggestions.matches.length && <p className="text-sm opacity-60">Chưa có bạn học phù hợp.</p>}
              <button className="text-sm text-forest font-semibold" onClick={() => navigate('/match')}>
                Xem thêm →
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
