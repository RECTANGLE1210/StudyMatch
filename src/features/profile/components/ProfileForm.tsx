import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import { profileRepository, type ProfileRecord } from '../repositories/profileRepository'
import { catalogRepository, type CatalogOption, type SubjectOption } from '../../subjects/repositories/catalogRepository'
import { errorMessage } from '../../../lib/utils/errors'
import { Loading } from '../../../components/shared/Loading'
interface SubjectDraft { subject_id: string; proficiency: number; strong: string[]; weak: string[] }
interface AvailabilityDraft { day: number; start_minute: number; end_minute: number }
const empty = { display_name: '', avatar_url: null, university_id: null, major_id: null, bio: '', goals: [], styles: [], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, onboarding_completed: false } satisfies Omit<ProfileRecord, 'id'>
const list = (value: string) => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))]
export function ProfileForm({ onboarding = false }: { onboarding?: boolean }) {
  const { session } = useAuth(), navigate = useNavigate()
  const [draft, setDraft] = useState<Omit<ProfileRecord, 'id'>>(empty)
  const [subjects, setSubjects] = useState<SubjectDraft[]>([])
  const [availability, setAvailability] = useState<AvailabilityDraft[]>([])
  const [catalog, setCatalog] = useState<{ universities: CatalogOption[]; majors: CatalogOption[]; subjects: SubjectOption[] }>({ universities: [], majors: [], subjects: [] })
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  useEffect(() => {
    if (!session) return
    let active = true
    void Promise.all([profileRepository.get(session.user.id), profileRepository.learning(session.user.id), catalogRepository.universities(), catalogRepository.majors(), catalogRepository.subjects()]).then(([profile, learning, universities, majors, options]) => {
      if (!active) return
      if (profile) { const { id: _id, ...fields } = profile; setDraft(fields) }
      setSubjects(learning.subjects.map(s => ({ ...s, strong: learning.topics.filter(t => t.subject_id === s.subject_id && t.knowledge === 'strong').map(t => t.topic_id), weak: learning.topics.filter(t => t.subject_id === s.subject_id && t.knowledge === 'weak').map(t => t.topic_id) })))
      setAvailability(learning.availability); setCatalog({ universities, majors, subjects: options })
    }).catch(e => { if (active) setError(errorMessage(e)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [session?.user.id])
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setSaved(false)
    try {
      await profileRepository.save({ ...draft, display_name: draft.display_name.trim(), onboarding_completed: true }, subjects, availability)
      setSaved(true)
      if (onboarding) navigate('/', { replace: true })
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  if (loading) return <Loading />
  return <form onSubmit={save} className="card p-6 space-y-4 max-w-3xl mx-auto my-6"><h1 className="text-2xl font-bold">{onboarding ? 'Hồ sơ học tập của bạn' : 'Chỉnh sửa hồ sơ'}</h1>
    {error && <p role="alert" className="text-red-700">{error}</p>}{saved && <p role="status">Đã lưu hồ sơ vào Supabase.</p>}
    <label className="block">Tên hiển thị<input required maxLength={100} value={draft.display_name} onChange={e => setDraft({ ...draft, display_name: e.target.value })} /></label>
    <label className="block">Avatar URL<input type="url" value={draft.avatar_url ?? ''} onChange={e => setDraft({ ...draft, avatar_url: e.target.value || null })} /></label>
    {(['university_id', 'major_id'] as const).map((field, i) => <label className="block" key={field}>{i ? 'Ngành học' : 'Trường đại học'}<select required value={draft[field] ?? ''} onChange={e => setDraft({ ...draft, [field]: e.target.value })}><option value="">Chọn…</option>{(i ? catalog.majors : catalog.universities).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>)}
    <label className="block">Giới thiệu<textarea maxLength={200} value={draft.bio} onChange={e => setDraft({ ...draft, bio: e.target.value })} /></label>
    <label className="block">Múi giờ (IANA)<input required value={draft.timezone} onChange={e => setDraft({ ...draft, timezone: e.target.value })} /></label>
    <label className="block">Mục tiêu (phân cách bằng dấu phẩy)<input required defaultValue={draft.goals.join(', ')} onBlur={e => setDraft({ ...draft, goals: list(e.target.value) })} /></label>
    <label className="block">Phong cách học (phân cách bằng dấu phẩy)<input required defaultValue={draft.styles.join(', ')} onBlur={e => setDraft({ ...draft, styles: list(e.target.value) })} /></label>
    <h2 className="font-bold">Môn học và kiến thức</h2>{subjects.map((s, i) => <SubjectFields key={s.subject_id} value={s} name={catalog.subjects.find(c => c.id === s.subject_id)?.name ?? ''} onChange={v => setSubjects(subjects.map((x, j) => i === j ? v : x))} onRemove={() => setSubjects(subjects.filter((_, j) => i !== j))} />)}
    <select aria-label="Thêm môn học" value="" onChange={e => { if (e.target.value) setSubjects([...subjects, { subject_id: e.target.value, proficiency: 1, strong: [], weak: [] }]) }}><option value="">+ Thêm môn học</option>{catalog.subjects.filter(c => !subjects.some(s => s.subject_id === c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <h2 className="font-bold">Lịch rảnh theo múi giờ của bạn</h2>{availability.map((a, i) => <div key={i} className="flex gap-2"><select aria-label="Ngày" value={a.day} onChange={e => setAvailability(availability.map((x, j) => i === j ? { ...x, day: Number(e.target.value) } : x))}>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, n) => <option key={day} value={n}>{day}</option>)}</select>{(['start_minute', 'end_minute'] as const).map(field => <input key={field} aria-label={field} type="time" step={900} value={`${String(Math.floor(a[field] / 60)).padStart(2, '0')}:${String(a[field] % 60).padStart(2, '0')}`} onChange={e => setAvailability(availability.map((x, j) => i === j ? { ...x, [field]: e.target.value.split(':').reduce((h, n) => h * 60 + Number(n), 0) } : x))} />)}<button type="button" onClick={() => setAvailability(availability.filter((_, j) => i !== j))}>Xóa</button></div>)}
    <button type="button" className="btn btn-s" onClick={() => setAvailability([...availability, { day: 1, start_minute: 1140, end_minute: 1200 }])}>+ Khoảng thời gian</button>
    <button className="btn btn-p block" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
  </form>
}
function SubjectFields({ value, name, onChange, onRemove }: { value: SubjectDraft; name: string; onChange: (v: SubjectDraft) => void; onRemove: () => void }) {
  const [topics, setTopics] = useState<CatalogOption[]>([]), [error, setError] = useState('')
  useEffect(() => { let active = true; void catalogRepository.topics(value.subject_id).then(t => { if (active) setTopics(t) }).catch(e => { if (active) setError(errorMessage(e)) }); return () => { active = false } }, [value.subject_id])
  const toggle = (kind: 'strong' | 'weak', id: string) => { const other = kind === 'strong' ? 'weak' : 'strong'; onChange({ ...value, [kind]: value[kind].includes(id) ? value[kind].filter(x => x !== id) : [...value[kind], id], [other]: value[other].filter(x => x !== id) }) }
  return <fieldset className="border border-line rounded-xl p-3"><legend>{name}</legend>{error && <p role="alert">{error}</p>}<label>Trình độ<select value={value.proficiency} onChange={e => onChange({ ...value, proficiency: Number(e.target.value) })}>{['Mới bắt đầu', 'Trung bình', 'Nâng cao'].map((label, i) => <option key={label} value={i}>{label}</option>)}</select></label>{(['strong', 'weak'] as const).map(kind => <div key={kind}><b>{kind === 'strong' ? 'Điểm mạnh' : 'Cần cải thiện'}</b><div className="flex flex-wrap gap-2 my-2">{topics.map(t => <button key={t.id} type="button" className={`chip ${value[kind].includes(t.id) ? 'on' : ''}`} onClick={() => toggle(kind, t.id)}>{t.name}</button>)}</div></div>)}<button type="button" className="btn btn-o" onClick={onRemove}>Xóa môn</button></fieldset>
}
