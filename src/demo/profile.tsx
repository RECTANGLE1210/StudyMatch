import { matchProfiles } from '../features/matching/domain/matching'
import type { LearningProfile } from '../types/domain'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type Level = 'Mới bắt đầu' | 'Trung bình' | 'Nâng cao'
export type Subj = { name: string; code: string; level: Level; strong: string[]; weak: string[] }
export type Profile = { name: string; uni: string; major: string; bio: string; avatar: string | null; subjects: Subj[]; goals: string[]; styles: string[]; avail: string[] }
export const LEVELS: Level[] = ['Mới bắt đầu', 'Trung bình', 'Nâng cao']
export const GOALS = ['Cùng giải bài tập', 'Ôn lý thuyết qua môn', 'Luyện đề đạt A/A+', 'Chuẩn bị thi cuối kỳ']
export const STYLES = ['Thảo luận sôi nổi', 'Pomodoro yên tĩnh', 'Hỏi đáp nhanh phần khó']
export const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const DAY_FULL: Record<string, string> = { T2: 'Thứ 2', T3: 'Thứ 3', T4: 'Thứ 4', T5: 'Thứ 5', T6: 'Thứ 6', T7: 'Thứ 7', CN: 'Chủ Nhật' }
export const SLOTS = ['Sáng', 'Chiều', 'Tối']

const svg = (c: string, ch: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='160' height='160' fill='${c}'/><text x='80' y='108' font-size='84' text-anchor='middle' fill='#f8f5ee' font-family='sans-serif' font-weight='700'>${ch}</text></svg>`)
export const GOOGLE_AVATAR = svg('#d89c57', 'L')
export const peerAvatar = (n: string) => svg(n.length % 2 ? '#8a9f7b' : '#553f35', n[0])

// Catalogs are loaded asynchronously to mimic data coming from the database.
const wait = <T,>(v: T, ms = 450) => new Promise<T>(r => setTimeout(() => r(v), ms))
export const loadUnis = () => wait(['ĐH Bách Khoa TP.HCM', 'ĐH Khoa học Tự nhiên', 'ĐH Kinh tế Quốc dân', 'ĐH Công nghệ Thông tin', 'ĐH Bách Khoa Hà Nội', 'ĐH Ngoại thương', 'ĐH Sư phạm TP.HCM'])
export const loadMajors = () => wait(['Khoa học dữ liệu & Trí tuệ nhân tạo', 'Công nghệ thông tin', 'Khoa học máy tính', 'Kỹ thuật máy tính', 'Kỹ thuật điện tử', 'Quản trị kinh doanh', 'Kinh tế'])
const CATALOG: { name: string; code: string; topics: string[] }[] = [
  { name: 'Giải tích 1', code: 'MT1003', topics: ['Giới hạn', 'Đạo hàm', 'Chuỗi số', 'Tích phân suy rộng', 'Đạo hàm riêng'] },
  { name: 'Cấu trúc dữ liệu', code: 'CO2003', topics: ['Mảng', 'Danh sách liên kết', 'Cây', 'Đồ thị', 'Quy hoạch động'] },
  { name: 'Xác suất thống kê', code: 'MT2013', topics: ['Biến ngẫu nhiên', 'Phân phối chuẩn', 'Ước lượng', 'Kiểm định giả thuyết'] },
  { name: 'Vật lý đại cương', code: 'PH1003', topics: ['Cơ học', 'Nhiệt học', 'Điện từ', 'Dao động'] },
  { name: 'Kinh tế vi mô', code: 'EC1001', topics: ['Cung cầu', 'Độ co giãn', 'Thị trường cạnh tranh', 'Lý thuyết hành vi'] },
  { name: 'Lập trình Python', code: 'CO1005', topics: ['Cú pháp cơ bản', 'Hàm', 'OOP', 'Xử lý tệp'] },
]
export const loadSubjects = () => wait(CATALOG)

type PeerX = { major: string; bio: string; subjects: Subj[]; goals: string[]; styles: string[]; avail: string[] }
export const PEER_X: Record<number, PeerX> = {
  1: { major: 'Khoa học máy tính', bio: 'Năm 2, thích học yên tĩnh với Pomodoro và cuối buổi tổng kết lại bài.', subjects: [{ name: 'Giải tích 1', code: 'MT1003', level: 'Nâng cao', strong: ['Tích phân suy rộng', 'Đạo hàm'], weak: ['Chuỗi số'] }], goals: ['Luyện đề đạt A/A+', 'Ôn lý thuyết qua môn'], styles: ['Pomodoro yên tĩnh'], avail: ['T2-Tối', 'T4-Tối', 'T5-Tối', 'CN-Chiều'] },
  2: { major: 'Công nghệ thông tin', bio: 'Thích giải bài tập theo nhóm nhỏ, vừa làm vừa trao đổi.', subjects: [{ name: 'Giải tích 1', code: 'MT1003', level: 'Trung bình', strong: ['Tích phân suy rộng', 'Giới hạn'], weak: ['Chuỗi số'] }], goals: ['Cùng giải bài tập'], styles: ['Thảo luận sôi nổi'], avail: ['T4-Chiều', 'T7-Sáng', 'CN-Chiều'] },
  3: { major: 'Kinh tế', bio: 'Hay hỏi nhanh phần khó rồi tự làm tiếp. Học hiệu quả vào buổi tối.', subjects: [{ name: 'Giải tích 1', code: 'MT1003', level: 'Trung bình', strong: ['Đạo hàm riêng', 'Đạo hàm'], weak: ['Giới hạn'] }], goals: ['Luyện đề đạt A/A+'], styles: ['Hỏi đáp nhanh phần khó'], avail: ['T2-Tối', 'T6-Tối', 'CN-Chiều'] },
}

const BLANK: Profile = { name: 'Lan Phương', uni: '', major: '', bio: '', avatar: GOOGLE_AVATAR, subjects: [], goals: [], styles: [], avail: [] }
const START: Profile = {
  name: 'Lan Phương', uni: 'ĐH Bách Khoa TP.HCM', major: 'Khoa học dữ liệu & Trí tuệ nhân tạo',
  bio: 'Mình là sinh viên năm 2 ngành Data Science & AI. Thích học nhóm, giải bài tập và trao đổi kiến thức. Đang tìm bạn ôn Giải tích và Xác suất cùng nhau!',
  avatar: GOOGLE_AVATAR,
  subjects: [
    { name: 'Giải tích 1', code: 'MT1003', level: 'Trung bình', strong: ['Chuỗi số', 'Giới hạn'], weak: ['Tích phân suy rộng'] },
    { name: 'Cấu trúc dữ liệu', code: 'CO2003', level: 'Nâng cao', strong: ['Mảng', 'Danh sách liên kết'], weak: ['Đồ thị', 'Quy hoạch động'] },
  ],
  goals: ['Cùng giải bài tập', 'Luyện đề đạt A/A+'], styles: ['Pomodoro yên tĩnh'], avail: ['T2-Tối', 'T4-Tối', 'CN-Chiều'],
}
export const EMAIL = 'lanphuong@gmail.com'

type Ctx = { p: Profile; set: (f: (p: Profile) => Profile) => void; reset: () => void; dirty: { current: Record<string, boolean> }; notify: { current: (m: string) => void } }
const C = createContext<Ctx>(null!)
export const useProfile = () => useContext(C)
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Profile>(START)
  const dirty = useRef<Record<string, boolean>>({}); const notify = useRef<(m: string) => void>(() => {})
  return <C.Provider value={{ p, set: f => setP(f), reset: () => setP(BLANK), dirty, notify }}>{children}</C.Provider>
}
function useDirty(key: string, v: boolean) {
  const { dirty } = useProfile()
  useEffect(() => { dirty.current[key] = v; return () => { dirty.current[key] = false } }, [v])
}

/* ---------- matching ---------- */
export function scorePeer(id: number, me: Profile, subject: string) {
  const peer = PEER_X[id]
  const convert = (p: Pick<Profile, 'subjects' | 'goals' | 'styles' | 'avail'>, key: string): LearningProfile => ({
    id: key, subjects: p.subjects.filter(s => s.name === subject).map(s => ({ subjectId: s.name, proficiency: LEVELS.indexOf(s.level), strong: s.strong, weak: s.weak })),
    goals: p.goals, styles: p.styles,
    availability: p.avail.map(a => { const [day, slot] = a.split('-'); const starts: Record<string, number> = { 'Sáng': 480, 'Chiều': 780, 'Tối': 1080 }; return { day: DAYS.indexOf(day), start: starts[slot], end: starts[slot] + 180 } }),
  })
  const result = matchProfiles(convert(me, 'me'), convert(peer, String(id)))
  return { ...result, teachMe: result.complements.flatMap(c => c.teachMe), iTeach: result.complements.flatMap(c => c.iTeach), overlap: me.avail.filter(a => peer.avail.includes(a)) }
}

/* ---------- small UI ---------- */
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-espresso/40 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
    <div className="card pop p-5 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto !rounded-b-none md:!rounded-b-[24px]" onClick={e => e.stopPropagation()}>{children}</div></div>
}
export function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return src ? <img src={src} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
    : <div className="rounded-full grid place-items-center shrink-0 bg-matcha-soft text-forest border border-dashed border-matcha" style={{ width: size, height: size }}>👤</div>
}
function Pick({ items, sel, on, tone = 'forest' }: { items: string[]; sel: string[]; on: (i: string) => void; tone?: 'forest' | 'caramel' }) {
  return <div className="flex flex-wrap gap-2">{items.map(i => <button type="button" key={i} onClick={() => on(i)}
    className={`chip ${sel.includes(i) ? (tone === 'forest' ? 'on' : '!bg-caramel !text-espresso !border-caramel font-semibold') : ''}`}>{sel.includes(i) ? '✓ ' : ''}{i}</button>)}</div>
}
const tog = (a: string[], i: string) => (a.includes(i) ? a.filter(x => x !== i) : [...a, i])
function Sec({ title, sub, action, children }: { title: string; sub?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="card p-5"><div className="flex items-start gap-2 mb-3"><div className="flex-1"><h3 className="font-bold text-lg">{title}</h3>{sub && <p className="text-xs opacity-60">{sub}</p>}</div>{action}</div>{children}</section>
}
const Tag = ({ children, c = 'matcha' }: { children: ReactNode; c?: 'matcha' | 'caramel' | 'plain' }) =>
  <span className={`text-xs rounded-full px-2.5 py-1 ${c === 'matcha' ? 'bg-matcha-soft text-forest' : c === 'caramel' ? 'bg-caramel/20' : 'border border-line'}`}>{children}</span>

function Combo({ value, onChange, load, placeholder, err }: { value: string; onChange: (v: string) => void; load: () => Promise<string[]>; placeholder: string; err?: string }) {
  const [items, setItems] = useState<string[] | null>(null); const [open, setOpen] = useState(false); const [q, setQ] = useState(value)
  useEffect(() => { load().then(setItems) }, [])
  useEffect(() => setQ(value), [value])
  const f = (items || []).filter(i => i.toLowerCase().includes(q.toLowerCase()))
  const pick = (v: string) => { onChange(v); setQ(v); setOpen(false) }
  return <div className="relative"><input value={q} placeholder={placeholder} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true) }}
    onBlur={() => setTimeout(() => { setOpen(false); if (q.trim()) onChange(q.trim()) }, 150)} style={err ? { borderColor: '#b3402f' } : undefined} />
    {open && <div className="absolute z-30 mt-1 w-full card !rounded-2xl p-1 max-h-48 overflow-y-auto">
      {!items ? <p className="p-3 text-sm opacity-60 animate-pulse">Đang tải danh sách…</p> : <>
        {f.map(i => <button type="button" key={i} onMouseDown={() => pick(i)} className="block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-matcha-soft">{i}</button>)}
        {q.trim() && !items.some(i => i.toLowerCase() === q.trim().toLowerCase()) && <button type="button" onMouseDown={() => pick(q.trim())} className="block w-full text-left px-3 py-2 rounded-xl text-sm text-forest font-semibold hover:bg-matcha-soft">+ Dùng “{q.trim()}”</button>}
        {!f.length && !q.trim() && <p className="p-3 text-sm opacity-60">Không có dữ liệu</p>}</>}
    </div>}{err && <p className="text-xs text-red-700 mt-1">{err}</p>}</div>
}

/* ---------- avatar ---------- */
function AvatarEditor({ value, onChange, name }: { value: string | null; onChange: (v: string | null) => void; name: string }) {
  const [st, setSt] = useState<'idle' | 'load' | 'err'>('idle'); const ref = useRef<HTMLInputElement>(null)
  const file = (f?: File) => {
    if (!f) return
    if (!f.type.startsWith('image/') || f.size > 2_000_000) { setSt('err'); return }
    setSt('load'); const r = new FileReader()
    r.onload = () => setTimeout(() => { onChange(String(r.result)); setSt('idle') }, 800); r.onerror = () => setSt('err'); r.readAsDataURL(f)
  }
  return <div className="flex items-center gap-4 flex-wrap">
    <div className="relative">{st === 'load' ? <div className="w-24 h-24 rounded-full bg-matcha-soft animate-pulse grid place-items-center text-xs">Đang tải…</div> : <Avatar src={value} name={name} size={96} />}</div>
    <div className="space-y-2"><div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-s text-sm" onClick={() => ref.current?.click()}>{value && value !== GOOGLE_AVATAR ? 'Đổi ảnh' : 'Tải ảnh lên'}</button>
      {value !== GOOGLE_AVATAR && <button type="button" className="btn btn-o text-sm" onClick={() => { onChange(GOOGLE_AVATAR); setSt('idle') }}>Dùng ảnh Google</button>}
      {value && <button type="button" className="btn btn-o text-sm" onClick={() => { onChange(null); setSt('idle') }}>Xóa ảnh</button>}</div>
      {st === 'err' ? <p className="text-xs text-red-700">Không tải được ảnh. Hãy chọn ảnh JPG/PNG dưới 2MB.</p> : <p className="text-xs opacity-60">Mặc định lấy từ tài khoản Google. Ảnh JPG/PNG, tối đa 2MB.</p>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { file(e.target.files?.[0]); e.target.value = '' }} /></div></div>
}

type Ident = Pick<Profile, 'name' | 'uni' | 'major' | 'bio' | 'avatar'>
const MAXBIO = 200
const identErr = (d: Ident) => ({ name: d.name.trim() ? '' : 'Bạn nhớ đặt một cái tên nhé', uni: d.uni.trim() ? '' : 'Hãy chọn trường của bạn', major: d.major.trim() ? '' : 'Hãy chọn ngành học' })
function IdentityFields({ d, setD, show }: { d: Ident; setD: (d: Ident) => void; show: boolean }) {
  const e = show ? identErr(d) : { name: '', uni: '', major: '' }
  return <div className="space-y-4">
    <AvatarEditor value={d.avatar} onChange={v => setD({ ...d, avatar: v })} name={d.name} />
    <label className="block text-sm font-medium">Tên hiển thị<input value={d.name} onChange={x => setD({ ...d, name: x.target.value })} maxLength={30} placeholder="Tên các bạn học sẽ thấy" style={e.name ? { borderColor: '#b3402f' } : undefined} />{e.name && <span className="text-xs text-red-700">{e.name}</span>}</label>
    <div className="text-sm font-medium">Trường đại học<Combo value={d.uni} onChange={v => setD({ ...d, uni: v })} load={loadUnis} placeholder="Tìm trường của bạn…" err={e.uni} /></div>
    <div className="text-sm font-medium">Ngành học<Combo value={d.major} onChange={v => setD({ ...d, major: v })} load={loadMajors} placeholder="Tìm ngành hoặc tự nhập…" err={e.major} /></div>
    <label className="block text-sm font-medium">Giới thiệu bản thân <span className="opacity-50 font-normal">(không bắt buộc)</span>
      <textarea rows={4} value={d.bio} maxLength={MAXBIO} onChange={x => setD({ ...d, bio: x.target.value })} placeholder="Bạn thích học thế nào? Đang tìm bạn ôn môn gì? Kể một chút nhé…" />
      <span className="text-xs opacity-50 float-right">{d.bio.length}/{MAXBIO}</span></label></div>
}

/* ---------- subjects ---------- */
function SubjectEditor({ init, isNew, onSave, onClose, onRemove }: { init: Subj; isNew: boolean; onSave: (s: Subj) => void; onClose: () => void; onRemove: () => void }) {
  const [d, setD] = useState(init); const [extra, setExtra] = useState<string[]>([]); const [nt, setNt] = useState(''); const [rm, setRm] = useState(false); const [catTopics, setCat] = useState<string[]>([])
  useEffect(() => { loadSubjects().then(c => setCat(c.find(s => s.name === init.name)?.topics || [])) }, [])
  const topics = Array.from(new Set([...catTopics, ...init.strong, ...init.weak, ...extra]))
  const set = (k: 'strong' | 'weak', t: string) => { const o = k === 'strong' ? 'weak' : 'strong'; setD({ ...d, [k]: tog(d[k], t), [o]: d[o].filter(x => x !== t) }) }
  const dirty = JSON.stringify(d) !== JSON.stringify(init)
  return <Modal onClose={() => (dirty ? null : onClose())}>
    <p className="text-xs opacity-60">{d.code || 'Môn tự thêm'}</p><h3 className="text-xl font-extrabold mb-4">{d.name}</h3>
    <div className="space-y-4">
      <div><b className="text-sm">Trình độ môn này</b><div className="grid grid-cols-3 gap-1 mt-2 p-1 rounded-full bg-matcha-soft">{LEVELS.map(l => <button key={l} type="button" onClick={() => setD({ ...d, level: l })} className={`rounded-full py-2 text-xs font-semibold transition ${d.level === l ? 'bg-forest text-cream' : ''}`}>{l}</button>)}</div></div>
      <div><b className="text-sm">Phần mình vững</b><div className="mt-2"><Pick items={topics} sel={d.strong} on={t => set('strong', t)} /></div></div>
      <div><b className="text-sm">Phần mình còn yếu</b><div className="mt-2"><Pick tone="caramel" items={topics} sel={d.weak} on={t => set('weak', t)} /></div></div>
      <p className="text-xs opacity-60">Mỗi chủ đề chỉ nằm ở một nhóm: chọn sang nhóm kia thì nhóm cũ sẽ tự bỏ.</p>
      <div className="flex gap-2"><input value={nt} onChange={e => setNt(e.target.value)} placeholder="Thêm chủ đề khác…" /><button type="button" className="btn btn-s shrink-0" onClick={() => { if (nt.trim()) { setExtra([...extra, nt.trim()]); setNt('') } }}>Thêm</button></div>
      {!d.strong.length && !d.weak.length && <p className="text-xs bg-caramel/15 rounded-xl p-3">Chọn ít nhất một chủ đề để StudyMatch gợi ý bạn học bổ trợ chính xác hơn.</p>}
    </div>
    {rm ? <div className="mt-5 bg-red-50 rounded-2xl p-4 text-sm"><b>Xóa “{d.name}” khỏi hồ sơ?</b><p className="my-1 opacity-70">Các chủ đề mạnh/yếu của môn này cũng sẽ bị xóa.</p><div className="flex gap-2 justify-end"><button className="btn btn-o" onClick={() => setRm(false)}>Giữ lại</button><button className="btn btn-p" onClick={onRemove}>Xóa môn</button></div></div>
      : <div className="flex gap-2 mt-5 items-center">{!isNew && <button type="button" className="text-sm text-red-700 underline mr-auto" onClick={() => setRm(true)}>Xóa môn</button>}<span className="flex-1" />
        <button type="button" className="btn btn-o" onClick={onClose}>{dirty ? 'Bỏ thay đổi' : 'Đóng'}</button><button type="button" className="btn btn-p" onClick={() => onSave(d)}>{isNew ? 'Thêm môn' : 'Lưu'}</button></div>}
  </Modal>
}
function SubjectPicker({ have, onPick, onClose }: { have: string[]; onPick: (s: { name: string; code: string }) => void; onClose: () => void }) {
  const [cat, setCat] = useState<typeof CATALOG | null>(null); const [q, setQ] = useState('')
  useEffect(() => { loadSubjects().then(setCat) }, [])
  const f = (cat || []).filter(s => !have.includes(s.name) && (s.name + s.code).toLowerCase().includes(q.toLowerCase()))
  return <Modal onClose={onClose}><h3 className="text-xl font-extrabold mb-3">Thêm môn học</h3><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên hoặc mã môn…" />
    <div className="mt-3 space-y-1">{!cat ? [0, 1, 2].map(i => <div key={i} className="h-12 rounded-xl bg-matcha-soft animate-pulse" />) : <>
      {f.map(s => <button key={s.code} type="button" onClick={() => onPick(s)} className="w-full text-left px-4 py-3 rounded-2xl hover:bg-matcha-soft flex justify-between"><b>{s.name}</b><span className="text-xs opacity-60">{s.code}</span></button>)}
      {q.trim() && !(cat || []).some(s => s.name.toLowerCase() === q.trim().toLowerCase()) && <button type="button" onClick={() => onPick({ name: q.trim(), code: '' })} className="w-full text-left px-4 py-3 rounded-2xl text-forest font-semibold hover:bg-matcha-soft">+ Thêm môn “{q.trim()}”</button>}
      {!f.length && !q.trim() && <p className="text-sm opacity-60 p-3">Bạn đã thêm hết các môn có sẵn. Gõ tên để thêm môn mới.</p>}</>}</div></Modal>
}
const levelDot: Record<Level, string> = { 'Mới bắt đầu': '●○○', 'Trung bình': '●●○', 'Nâng cao': '●●●' }
function SubjectsManager() {
  const { p, set, notify } = useProfile(); const [edit, setEdit] = useState<{ i: number; s: Subj; isNew: boolean } | null>(null); const [pick, setPick] = useState(false)
  return <Sec title="Môn học của tôi" sub="Mỗi môn có trình độ và chủ đề mạnh/yếu riêng" action={<button className="btn btn-p text-sm" onClick={() => setPick(true)}>+ Thêm môn học</button>}>
    {!p.subjects.length ? <div className="text-center py-6"><div className="text-4xl">📚</div><p className="font-semibold mt-1">Bạn chưa thêm môn nào</p><p className="text-sm opacity-60 mb-3">Thêm một môn để bắt đầu nhận gợi ý bạn học.</p><button className="btn btn-s" onClick={() => setPick(true)}>Thêm môn đầu tiên</button></div>
      : <div className="grid md:grid-cols-2 gap-3">{p.subjects.map((s, i) => <button type="button" key={s.name} onClick={() => setEdit({ i, s, isNew: false })} className="text-left rounded-2xl border border-line p-4 bg-cream hover:-translate-y-0.5 hover:border-forest transition">
        <div className="flex justify-between gap-2"><div><b>{s.name}</b><p className="text-xs opacity-60">{s.code || 'Môn tự thêm'}</p></div><span className="text-xs text-forest font-semibold whitespace-nowrap">{levelDot[s.level]} {s.level}</span></div>
        <div className="flex flex-wrap gap-1.5 mt-3">{s.strong.map(t => <Tag key={t}>✓ {t}</Tag>)}{s.weak.map(t => <Tag key={t} c="caramel">↗ {t}</Tag>)}{!s.strong.length && !s.weak.length && <span className="text-xs opacity-50">Chạm để chọn chủ đề</span>}</div></button>)}</div>}
    {pick && <SubjectPicker have={p.subjects.map(s => s.name)} onClose={() => setPick(false)} onPick={s => { setPick(false); setEdit({ i: -1, isNew: true, s: { name: s.name, code: s.code, level: 'Trung bình', strong: [], weak: [] } }) }} />}
    {edit && <SubjectEditor key={edit.s.name} init={edit.s} isNew={edit.isNew} onClose={() => setEdit(null)}
      onSave={s => { set(x => ({ ...x, subjects: edit.isNew ? [...x.subjects, s] : x.subjects.map((o, i) => (i === edit.i ? s : o)) })); setEdit(null); notify.current(`Đã lưu môn ${s.name}`) }}
      onRemove={() => { set(x => ({ ...x, subjects: x.subjects.filter((_, i) => i !== edit.i) })); setEdit(null); notify.current('Đã xóa môn học') }} />}
  </Sec>
}

/* ---------- availability ---------- */
export function summarize(av: string[]) {
  const parts = SLOTS.map(s => ({ s, d: DAYS.filter(d => av.includes(`${d}-${s}`)).map(d => DAY_FULL[d]) })).filter(x => x.d.length).map(x => `${x.s.toLowerCase()} ${x.d.join(', ')}`)
  if (!parts.length) return 'Bạn chưa chọn khung giờ rảnh nào.'
  return 'Rảnh ' + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' và ' + parts[parts.length - 1] : parts[0]) + '.'
}
export function AvailabilityGrid({ value, onChange, compare }: { value: string[]; onChange?: (v: string[]) => void; compare?: string[] }) {
  return <div className="overflow-x-auto"><table className="text-xs w-full text-center border-separate" style={{ borderSpacing: 4 }}><thead><tr><th />{DAYS.map(d => <th key={d} className="font-semibold pb-1">{d}</th>)}</tr></thead>
    <tbody>{SLOTS.map(s => <tr key={s}><td className="text-left pr-1 font-medium">{s}</td>{DAYS.map(d => { const k = `${d}-${s}`, on = value.includes(k), both = on && compare?.includes(k)
      return <td key={k}><button type="button" disabled={!onChange} aria-label={`${DAY_FULL[d]} ${s}`} aria-pressed={on} onClick={() => onChange?.(tog(value, k))}
        className={`w-full min-w-9 h-10 md:h-11 rounded-xl transition grid place-items-center ${both ? 'bg-caramel text-espresso' : on ? 'bg-matcha text-forest' : 'bg-[#f1ebde] text-transparent'} ${onChange ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}>{on ? '✓' : '·'}</button></td> })}</tr>)}</tbody></table></div>
}
function AvailabilitySection() {
  const { p, set, notify } = useProfile(); const [ed, setEd] = useState(false); const [d, setD] = useState(p.avail); const [busy, setBusy] = useState(false)
  useDirty('avail', ed && JSON.stringify(d) !== JSON.stringify(p.avail))
  const save = () => { setBusy(true); setTimeout(() => { set(x => ({ ...x, avail: d })); setBusy(false); setEd(false); notify.current('Đã cập nhật lịch rảnh') }, 600) }
  return <Sec title="Lịch rảnh của tôi" sub={ed ? 'Chạm vào ô để bật/tắt khung giờ' : 'Dùng để tìm bạn học trùng lịch'} action={!ed && <button className="btn btn-s text-sm" onClick={() => { setD(p.avail); setEd(true) }}>Chỉnh sửa</button>}>
    <AvailabilityGrid value={ed ? d : p.avail} onChange={ed ? setD : undefined} />
    <div className="flex gap-4 text-xs mt-2 opacity-70"><span><i className="inline-block w-3 h-3 rounded bg-matcha align-middle" /> Rảnh</span><span><i className="inline-block w-3 h-3 rounded bg-[#f1ebde] align-middle" /> Bận</span></div>
    <p className="text-sm bg-matcha-soft rounded-xl p-3 mt-3">🗓 {summarize(ed ? d : p.avail)}</p>
    {ed && <div className="flex gap-2 justify-end mt-3"><button className="btn btn-o" onClick={() => setEd(false)}>Hủy</button><button className="btn btn-p disabled:opacity-60" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu lịch rảnh'}</button></div>}</Sec>
}

/* ---------- goals & styles ---------- */
function PrefsFields({ goals, styles, setGoals, setStyles }: { goals: string[]; styles: string[]; setGoals: (g: string[]) => void; setStyles: (s: string[]) => void }) {
  return <div className="space-y-4"><div><b className="text-sm">Mục tiêu học</b><div className="mt-2"><Pick items={GOALS} sel={goals} on={i => setGoals(tog(goals, i))} /></div></div>
    <div><b className="text-sm">Phong cách học</b><div className="grid sm:grid-cols-3 gap-2 mt-2">{STYLES.map(s => <button type="button" key={s} onClick={() => setStyles(tog(styles, s))} className={`rounded-2xl border p-3 text-sm text-left transition ${styles.includes(s) ? 'bg-forest text-cream border-forest' : 'bg-paper border-line hover:bg-matcha-soft'}`}>{styles.includes(s) ? '✓ ' : ''}{s}</button>)}</div></div></div>
}
function PrefsSection() {
  const { p, set, notify } = useProfile(); const [ed, setEd] = useState(false); const [g, setG] = useState(p.goals); const [s, setS] = useState(p.styles)
  useDirty('prefs', ed && (JSON.stringify(g) !== JSON.stringify(p.goals) || JSON.stringify(s) !== JSON.stringify(p.styles)))
  return <Sec title="Mục tiêu & phong cách học" sub="Ảnh hưởng đến gợi ý trong Smart Match" action={!ed && <button className="btn btn-s text-sm" onClick={() => { setG(p.goals); setS(p.styles); setEd(true) }}>Chỉnh sửa</button>}>
    {ed ? <><PrefsFields goals={g} styles={s} setGoals={setG} setStyles={setS} /><div className="flex gap-2 justify-end mt-3"><button className="btn btn-o" onClick={() => setEd(false)}>Hủy</button><button className="btn btn-p" onClick={() => { set(x => ({ ...x, goals: g, styles: s })); setEd(false); notify.current('Đã lưu. Gợi ý Smart Match sẽ được làm mới') }}>Lưu</button></div></>
      : <div className="space-y-3"><div className="flex flex-wrap gap-2">{p.goals.length ? p.goals.map(x => <Tag key={x}>🎯 {x}</Tag>) : <span className="text-sm opacity-50">Chưa chọn mục tiêu</span>}</div><div className="flex flex-wrap gap-2">{p.styles.length ? p.styles.map(x => <Tag key={x} c="caramel">☕ {x}</Tag>) : <span className="text-sm opacity-50">Chưa chọn phong cách</span>}</div></div>}</Sec>
}

/* ---------- public profile ---------- */
export function PublicProfile({ id, name, uni, subject, onClose, action }: { id: number; name: string; uni: string; subject: string; onClose: () => void; action?: ReactNode }) {
  const { p } = useProfile(); const x = PEER_X[id]; const sc = scorePeer(id, p, subject); const shared = x.subjects.filter(s => p.subjects.some(m => m.name === s.name))
  return <Modal onClose={onClose}>
    <div className="flex gap-4 items-center"><Avatar src={peerAvatar(name)} name={name} size={72} /><div className="flex-1"><h3 className="text-xl font-extrabold">{name}</h3><p className="text-sm">{x.major}</p><p className="text-xs opacity-60">{uni}</p></div><button className="text-xl" onClick={onClose} aria-label="Đóng">×</button></div>
    <p className="text-sm bg-cream border border-line rounded-2xl p-3 mt-4 italic">“{x.bio}”</p>
    <h4 className="font-bold mt-4 mb-2">Vì sao hợp với bạn · {sc.score}%</h4>
    {(sc.teachMe.length > 0 || sc.iTeach.length > 0) && <div className="bg-caramel/15 rounded-2xl p-3 text-sm space-y-1">{sc.teachMe.length > 0 && <p>🤝 {name} vững <b>{sc.teachMe.join(', ')}</b> – đúng phần bạn còn yếu.</p>}{sc.iTeach.length > 0 && <p>🌱 Bạn vững <b>{sc.iTeach.join(', ')}</b> và có thể giúp lại {name}.</p>}</div>}
    <div className="space-y-2 mt-3 text-xs">{([['Môn & kiến thức bổ trợ · 35%', sc.C], ['Lịch rảnh trùng · 30%', sc.T], ['Mục tiêu · 20%', sc.G], ['Phong cách học · 15%', sc.L]] as [string, number][]).map(([l, v]) => <div key={l}><div className="flex justify-between mb-1"><span>{l}</span><b>{v}%</b></div><div className="h-2 rounded-full bg-matcha-soft"><div className="h-2 rounded-full bg-forest" style={{ width: v + '%' }} /></div></div>)}</div>
    <h4 className="font-bold mt-4 mb-2">Môn học {shared.length ? '(có môn chung)' : ''}</h4>
    <div className="space-y-2">{x.subjects.map(s => <div key={s.name} className="rounded-2xl border border-line p-3"><div className="flex justify-between"><b className="text-sm">{s.name}</b><span className="text-xs">{s.level}{shared.includes(s) ? ' · môn chung' : ''}</span></div><div className="flex flex-wrap gap-1.5 mt-2">{s.strong.map(t => <Tag key={t}>✓ {t}</Tag>)}{s.weak.map(t => <Tag key={t} c="caramel">↗ {t}</Tag>)}</div></div>)}</div>
    <h4 className="font-bold mt-4 mb-2">Lịch rảnh <span className="text-xs font-normal opacity-60">(ô cam = trùng với bạn)</span></h4>
    <AvailabilityGrid value={x.avail} compare={p.avail} /><p className="text-xs mt-1">{summarize(x.avail)}</p>
    <div className="flex flex-wrap gap-2 mt-3">{x.goals.map(g => <Tag key={g}>🎯 {g}</Tag>)}{x.styles.map(g => <Tag key={g} c="caramel">☕ {g}</Tag>)}</div>
    <p className="text-xs opacity-60 mt-4">🔒 Email và thông tin liên hệ của {name} được giữ riêng tư.</p>
    {action && <div className="flex justify-end gap-2 mt-3">{action}</div>}
  </Modal>
}
function SelfPreview({ onClose }: { onClose: () => void }) {
  const { p } = useProfile()
  return <Modal onClose={onClose}><p className="text-xs bg-matcha-soft rounded-xl p-2 mb-3">Đây là những gì bạn học khác nhìn thấy. Email của bạn không hiển thị.</p>
    <div className="flex gap-4 items-center"><Avatar src={p.avatar} name={p.name} size={72} /><div><h3 className="text-xl font-extrabold">{p.name}</h3><p className="text-sm">{p.major}</p><p className="text-xs opacity-60">{p.uni}</p></div></div>
    {p.bio && <p className="text-sm italic bg-cream border border-line rounded-2xl p-3 mt-3">“{p.bio}”</p>}
    <div className="space-y-2 mt-3">{p.subjects.map(s => <div key={s.name} className="rounded-2xl border border-line p-3"><b className="text-sm">{s.name}</b> <span className="text-xs">· {s.level}</span><div className="flex flex-wrap gap-1.5 mt-2">{s.strong.map(t => <Tag key={t}>✓ {t}</Tag>)}{s.weak.map(t => <Tag key={t} c="caramel">↗ {t}</Tag>)}</div></div>)}</div>
    <p className="text-sm mt-3">🗓 {summarize(p.avail)}</p><div className="text-right mt-3"><button className="btn btn-p" onClick={onClose}>Đóng</button></div></Modal>
}

/* ---------- profile screen ---------- */
export function ProfileScreen({ setModal }: { setModal: (m: any) => void }) {
  const { p, set, notify } = useProfile(); const pick = (x: Profile): Ident => ({ name: x.name, uni: x.uni, major: x.major, bio: x.bio, avatar: x.avatar })
  const [ed, setEd] = useState(false); const [d, setD] = useState<Ident>(pick(p)); const [tried, setTried] = useState(false); const [busy, setBusy] = useState(false); const [leave, setLeave] = useState(false); const [prev, setPrev] = useState(false)
  const dirty = ed && JSON.stringify(d) !== JSON.stringify(pick(p)); useDirty('ident', dirty)
  const save = () => { setTried(true); if (Object.values(identErr(d)).some(Boolean)) return; setBusy(true); setTimeout(() => { set(x => ({ ...x, ...d, name: d.name.trim() })); setBusy(false); setEd(false); setTried(false); notify.current('Đã cập nhật hồ sơ của bạn') }, 700) }
  return <div className="space-y-5">
    {!ed ? <div className="card overflow-hidden"><div className="h-24 md:h-32 bg-matcha relative"><div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-caramel/60" /><div className="absolute right-24 top-10 w-16 h-16 rounded-full bg-forest/30" /></div>
      <div className="px-5 pb-5 -mt-12 md:-mt-14 md:flex gap-5 items-end"><div className="relative z-10 border-4 border-paper rounded-full w-fit bg-paper"><Avatar src={p.avatar} name={p.name} size={104} /></div>
        <div className="flex-1 mt-2 md:mt-0 md:pt-14 relative z-10"><h1 className="text-2xl md:text-3xl font-extrabold">{p.name}</h1><p className="text-sm">🎓 {p.major}</p><p className="text-xs opacity-60">{p.uni}</p></div>
        <div className="flex gap-2 mt-3"><button className="btn btn-o text-sm" onClick={() => setPrev(true)}>Xem như bạn học</button><button className="btn btn-p text-sm" onClick={() => { setD(pick(p)); setEd(true) }}>Chỉnh sửa thông tin</button></div></div>
      <div className="px-5 pb-5">{p.bio ? <p className="text-sm bg-cream border border-line rounded-2xl p-4 leading-relaxed">{p.bio}</p> : <p className="text-sm opacity-60 border border-dashed border-line rounded-2xl p-4">Bạn chưa viết giới thiệu. Một vài dòng sẽ giúp bạn học hiểu bạn hơn nhé.</p>}</div></div>
      : <div className="card p-5 pop"><h2 className="font-bold text-lg mb-4">Chỉnh sửa thông tin cá nhân</h2><IdentityFields d={d} setD={setD} show={tried} />
        <div className="flex gap-2 justify-end mt-5"><button className="btn btn-o" onClick={() => (dirty ? setLeave(true) : setEd(false))}>Hủy</button><button className="btn btn-p disabled:opacity-60" disabled={busy} onClick={save}>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button></div></div>}
    <div className="grid md:grid-cols-2 gap-5"><div className="md:col-span-2"><SubjectsManager /></div><AvailabilitySection /><PrefsSection /></div>
    <Sec title="Tài khoản & quyền riêng tư"><div className="grid md:grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-matcha-soft p-4"><b>👁 Bạn học khác thấy</b><p className="mt-1 opacity-80">Ảnh, tên hiển thị, trường, ngành, giới thiệu, môn học, chủ đề mạnh/yếu, mục tiêu, phong cách và lịch rảnh.</p></div>
      <div className="rounded-2xl border border-line p-4"><b>🔒 Chỉ mình bạn</b><p className="mt-1">Email Google: {EMAIL}</p><p className="opacity-70">Đăng nhập bằng Google. Không chia sẻ thông tin liên hệ khi bạn chưa đồng ý.</p></div></div>
      <button className="btn btn-o mt-3" onClick={() => setModal({ kind: 'signout' })}>Đăng xuất</button></Sec>
    {leave && <Modal onClose={() => setLeave(false)}><h3 className="font-bold text-lg">Bỏ các thay đổi chưa lưu?</h3><p className="text-sm opacity-70 my-2">Những chỉnh sửa vừa rồi sẽ không được giữ lại.</p><div className="flex justify-end gap-2"><button className="btn btn-o" onClick={() => setLeave(false)}>Tiếp tục chỉnh sửa</button><button className="btn btn-p" onClick={() => { setLeave(false); setEd(false); setTried(false) }}>Bỏ thay đổi</button></div></Modal>}
    {prev && <SelfPreview onClose={() => setPrev(false)} />}
  </div>
}

/* ---------- onboarding ---------- */
export function Onboard({ done }: { done: () => void }) {
  const { p, set, reset } = useProfile(); const [step, setStep] = useState(0); const [tried, setTried] = useState(false)
  useEffect(() => { reset() }, [])
  const titles = ['Về bạn', 'Môn học', 'Gu học tập', 'Lịch rảnh', 'Xem lại']
  const copy = ['Một chút về bạn nhé', 'Bạn đang học môn nào?', 'Bạn thích học thế nào?', 'Khi nào bạn rảnh?', 'Hồ sơ của bạn đã sẵn sàng']
  const ident: Ident = { name: p.name, uni: p.uni, major: p.major, bio: p.bio, avatar: p.avatar }
  const next = () => { if (step === 0) { setTried(true); if (Object.values(identErr(ident)).some(Boolean)) return } setTried(false); step < 4 ? setStep(step + 1) : done() }
  return <div className="min-h-screen grid place-items-center p-3 md:p-6"><div className="card p-5 md:p-9 w-full max-w-2xl pop" key={step}>
    <div className="flex gap-1.5 mb-2">{titles.map((_, i) => <div key={i} className={`h-2 flex-1 rounded-full transition ${i <= step ? 'bg-forest' : 'bg-matcha-soft'}`} />)}</div>
    <p className="text-xs opacity-60">Bước {step + 1}/5 · {titles[step]}</p><h2 className="text-2xl font-extrabold mb-4">{copy[step]}</h2>
    {step === 0 && <><IdentityFields d={ident} setD={v => set(x => ({ ...x, ...v }))} show={tried} /><p className="text-xs bg-matcha-soft rounded-xl p-3 mt-4">🔒 Email và thông tin liên hệ sẽ không hiển thị với bạn học khác. Bạn có thể sửa mọi thứ sau trong Hồ sơ.</p></>}
    {step === 1 && <div className="space-y-3"><p className="text-sm opacity-70">Với mỗi môn, chọn trình độ và phần mình vững/yếu. Bạn có thể bỏ qua và thêm sau.</p><SubjectsManager /></div>}
    {step === 2 && <PrefsFields goals={p.goals} styles={p.styles} setGoals={g => set(x => ({ ...x, goals: g }))} setStyles={s => set(x => ({ ...x, styles: s }))} />}
    {step === 3 && <><AvailabilityGrid value={p.avail} onChange={a => set(x => ({ ...x, avail: a }))} /><p className="text-sm bg-matcha-soft rounded-xl p-3 mt-3">🗓 {summarize(p.avail)}</p></>}
    {step === 4 && <div className="space-y-3 text-sm"><div className="flex gap-3 items-center"><Avatar src={p.avatar} name={p.name} size={64} /><div className="flex-1"><b className="text-lg">{p.name}</b><p>{p.major} · {p.uni}</p></div><button className="underline" onClick={() => setStep(0)}>Sửa</button></div>
      {[['Môn học', p.subjects.length ? p.subjects.map(s => `${s.name} (${s.level})`).join(', ') : 'Chưa thêm môn nào', 1], ['Mục tiêu & phong cách', [...p.goals, ...p.styles].join(', ') || 'Chưa chọn', 2], ['Lịch rảnh', summarize(p.avail), 3]].map(([l, v, s]) => <div key={l as string} className="flex gap-3 rounded-2xl border border-line p-3"><div className="flex-1"><b>{l}</b><p className="opacity-80">{v}</p></div><button className="underline" onClick={() => setStep(s as number)}>Sửa</button></div>)}</div>}
    <div className="flex justify-between mt-7"><button className="btn btn-o disabled:opacity-40" disabled={!step} onClick={() => setStep(step - 1)}>Quay lại</button><button className="btn btn-p" onClick={next}>{step < 4 ? (step === 1 && !p.subjects.length ? 'Bỏ qua bước này' : 'Tiếp tục') : 'Bắt đầu tìm bạn học'}</button></div>
  </div></div>
}
