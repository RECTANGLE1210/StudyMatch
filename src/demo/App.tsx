import { useLocation, useNavigate } from 'react-router-dom'
import { Login } from '../features/auth/components/Login'
import { usePomodoro } from '../features/study-room/hooks/usePomodoro'
import { useEffect, useState } from 'react'
import { LibraryScreen, RoomResources, SEED_LIB, type LibItem } from './library'
import { Avatar, Onboard, ProfileScreen, ProfileProvider, PublicProfile, PEER_X, peerAvatar, scorePeer, useProfile } from './profile'

export type Scr = 'login' | 'onboard' | 'home' | 'match' | 'chat' | 'sessions' | 'room' | 'library' | 'progress' | 'pricing' | 'profile'
const NAV: [Scr, string, string][] = [
  ['home', 'Trang chủ', '☕'], ['match', 'Smart Match', '🍵'], ['chat', 'Tin nhắn', '💬'],
  ['sessions', 'Lịch học', '📅'], ['library', 'Ngân hàng tài liệu', '🗂'], ['room', 'Study Room', '📖'], ['progress', 'Tiến độ', '🌱'], ['pricing', 'Tiến độ & Gói', '♛'], ['profile', 'Hồ sơ', '👤'],
]
const SUBJECTS = ['Giải tích 1', 'Cấu trúc dữ liệu', 'Xác suất thống kê', 'Vật lý đại cương', 'Kinh tế vi mô', 'Lập trình Python']
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const SLOTS = ['Sáng', 'Chiều', 'Tối']

type Peer = { id: number; name: string; uni: string; score: number; C: number; T: number; G: number; L: number; strong: string; weak: string; goal: string; style: string; slots: string }
const PEERS: Peer[] = [
  { id: 1, name: 'Minh Anh', uni: 'ĐH Bách Khoa TP.HCM', score: 92, C: 95, T: 90, G: 88, L: 92, strong: 'Tích phân bội', weak: 'Chuỗi số', goal: 'Ôn thi cuối kỳ', style: 'Pomodoro yên tĩnh', slots: 'T3 · T5 tối' },
  { id: 2, name: 'Quốc Bảo', uni: 'ĐH Khoa học Tự nhiên', score: 85, C: 82, T: 88, G: 90, L: 78, strong: 'Chuỗi số, Giới hạn', weak: 'Tích phân bội', goal: 'Luyện bài tập', style: 'Thảo luận sôi nổi', slots: 'T4 chiều · T7 sáng' },
  { id: 3, name: 'Thu Hà', uni: 'ĐH Kinh tế Quốc dân', score: 74, C: 70, T: 72, G: 80, L: 75, strong: 'Đạo hàm riêng', weak: 'Giới hạn', goal: 'Cải thiện điểm số', style: 'Hỏi nhanh – giải thích', slots: 'T6 tối · CN chiều' },
]

const Av = ({ n, s = 44 }: { n: string; s?: number }) => (
  <div className="rounded-full grid place-items-center font-bold text-cream shrink-0" style={{ width: s, height: s, background: ['#365c4a', '#d89c57', '#8a9f7b', '#553f35'][n.length % 4] }}>{n[0]}</div>
)
const Ring = ({ v, s = 64 }: { v: number; s?: number }) => (
  <div className="rounded-full grid place-items-center shrink-0" style={{ width: s, height: s, background: `conic-gradient(#365c4a ${v * 3.6}deg,#e6ecdf 0)` }}>
    <div className="rounded-full bg-paper grid place-items-center font-extrabold text-forest" style={{ width: s - 12, height: s - 12 }}>{v}%</div>
  </div>
)
const Bar = ({ l, v }: { l: string; v: number }) => (
  <div className="text-xs"><div className="flex justify-between mb-1"><span>{l}</span><b>{v}%</b></div>
    <div className="h-2 rounded-full bg-matcha-soft"><div className="h-2 rounded-full bg-forest" style={{ width: v + '%' }} /></div></div>
)
const Modal = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 bg-espresso/40 grid place-items-center p-4" onClick={onClose}>
    <div className="card pop p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>{children}</div>
  </div>
)
const Empty = ({ t, d, a, f }: { t: string; d: string; a?: string; f?: () => void }) => (
  <div className="card p-8 text-center"><div className="text-4xl mb-2">🍃</div><h3 className="font-bold text-lg">{t}</h3>
    <p className="text-sm opacity-70 mt-1 mb-4">{d}</p>{a && <button className="btn btn-p" onClick={f}>{a}</button>}</div>
)

export default function App() { return <ProfileProvider><Inner /></ProfileProvider> }

function Inner() {
  const { p: profile, dirty, notify } = useProfile()
  const location = useLocation(), navigate = useNavigate()
  const paths: Record<Scr, string> = { login: '/login', onboard: '/onboarding', home: '/', match: '/match', chat: '/messages', sessions: '/sessions', room: '/sessions/demo-session', library: '/library', progress: '/progress', pricing: '/pricing', profile: '/profile' }
  const route = Object.entries(paths).find(([, path]) => path === location.pathname)?.[0] as Scr | undefined
  const scr: Scr | undefined = route ?? (location.pathname.startsWith('/messages/') ? 'chat' : /^\/sessions\/[^/]+$/.test(location.pathname) ? 'room' : undefined)
  const setScr = (screen: Scr) => navigate(paths[screen])
  const [toast, setToast] = useState('')
  const [modal, setModal] = useState<null | { kind: string; peer?: Peer; to?: Scr }>(null)
  const [inv, setInv] = useState<Record<number, 'sent' | 'accepted' | 'cancelled' | 'blocked'>>({ 3: 'accepted' })
  const [partner, setPartner] = useState<Peer>(PEERS[2])
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400) }
  notify.current = say
  const go = (s: Scr) => { if (Object.values(dirty.current).some(Boolean)) setModal({ kind: 'leave', to: s }); else setScr(s) }


  const [invs, setInvs] = useState(['Quốc Bảo', 'Thu Hà'])
  const [notes, setNotes] = useState([
    { id: 1, t: 'Thu Hà đã đề xuất lịch học mới', h: '10 phút trước', unread: true },
    { id: 2, t: 'Nhắc nhở: buổi học bắt đầu lúc 19:30 mai', h: '1 giờ trước', unread: true },
    { id: 3, t: 'Minh Anh đã chấp nhận lời mời của bạn', h: 'Hôm qua', unread: false },
  ])
  const respond = (n: string, ok: boolean) => {
    setInvs(invs.filter(x => x !== n)); say(ok ? `Đã kết nối với ${n}!` : 'Đã từ chối lời mời')
    const pid = PEERS.find(p => p.name === n)?.id; if (pid && ok) setInv({ ...inv, [pid]: 'accepted' })
  }
  const [lib, setLib] = useState<LibItem[]>(SEED_LIB); const [attached, setAttached] = useState<number[]>([1])
  if (!scr) return <div className="card m-8 p-8">Không tìm thấy trang. <button className="btn btn-p" onClick={() => setScr('home')}>Trang chủ</button></div>
  if (scr === 'login') return <Login go={go} />
  if (scr === 'onboard') return <Onboard done={() => { go('home'); say('Hồ sơ đã sẵn sàng. Chào mừng đến StudyMatch!') }} />
  const props = { go, say, setModal, inv, setInv, partner, setPartner, invs, respond, lib, attached, setAttached }
  return (
    <div className="app-shell min-h-screen md:flex">
      <aside className="app-sidebar hidden md:flex flex-col gap-1 sticky top-0 h-screen">
        <div className="brand-lockup">
          <div className="brand-mark">S</div>
          <div><div className="brand-title text-forest">StudyMatch</div><div className="brand-caption">Học tốt hơn, cùng nhau</div></div>
        </div>
        <p className="nav-eyebrow">Không gian học tập</p>
        {NAV.map(([k, l, i]) => (
          <button key={k} onClick={() => go(k)} className={`nav-item ${scr === k ? 'active' : ''} ${scr === k && k === 'pricing' ? 'pricing-active' : ''}`}><span className="nav-icon">{i}</span><span>{l}</span>{scr === k && <span className="nav-dot" />}</button>
        ))}
        <div className="sidebar-profile mt-auto"><Avatar src={profile.avatar} name={profile.name} size={40} /><div className="min-w-0 flex-1"><span className="font-semibold text-sm truncate block">{profile.name}</span><span className="text-[11px] opacity-55 truncate block">{profile.major || 'Hồ sơ học tập'}</span></div></div>
        <button className="sidebar-signout" onClick={() => setModal({ kind: 'signout' })}>Đăng xuất</button>
      </aside>
      <main className="app-main flex-1 p-4 md:px-10 md:py-8 pb-28 md:pb-10 w-full pop" key={scr}>
        <div className="page-kicker"><span>{NAV.find(([k]) => k === scr)?.[1]}</span><span className="page-kicker-line" /></div>
        {scr === 'home' && <Home {...props} />}
        {scr === 'match' && <Match {...props} />}
        {scr === 'chat' && <Chat {...props} />}
        {scr === 'sessions' && <Sessions {...props} />}
        {scr === 'room' && <Room {...props} />}
        {scr === 'library' && <LibraryScreen lib={lib} setLib={setLib} attached={attached} setAttached={setAttached} say={say} go={go} />}
        {scr === 'progress' && <Progress {...props} />}
        {scr === 'pricing' && <Pricing say={say} />}
        {scr === 'profile' && <ProfileScreen setModal={setModal} />}
      </main>
      <nav className="mobile-nav md:hidden fixed bottom-0 inset-x-0 flex justify-around z-40">
        {NAV.filter(n => n[0] !== 'progress').map(([k, l, i]) => (
          <button key={k} onClick={() => go(k)} className={`mobile-nav-item ${scr === k ? 'active' : ''}`}><span className="text-lg">{i}</span><span>{k === 'library' ? 'Tài liệu' : k === 'pricing' ? 'Gói' : l.split(' ')[0]}</span></button>
        ))}
      </nav>
      {modal?.kind === 'leave' && <Modal onClose={() => setModal(null)}><h3 className="font-bold text-lg">Bỏ các thay đổi chưa lưu?</h3><p className="text-sm opacity-70 my-2">Bạn đang chỉnh sửa hồ sơ. Rời đi bây giờ sẽ không giữ lại thay đổi.</p><div className="flex gap-2 justify-end"><button className="btn btn-o" onClick={() => setModal(null)}>Ở lại chỉnh sửa</button><button className="btn btn-p" onClick={() => { dirty.current = {}; setScr(modal.to!); setModal(null) }}>Bỏ thay đổi</button></div></Modal>}
      {modal?.kind === 'signout' && <Modal onClose={() => setModal(null)}><h3 className="font-bold text-lg">Hẹn gặp lại bạn nhé?</h3><p className="text-sm opacity-70 my-2">Bạn có chắc muốn đăng xuất?</p><div className="flex gap-2 justify-end"><button className="btn btn-o" onClick={() => setModal(null)}>Ở lại</button><button className="btn btn-p" onClick={() => { setModal(null); go('login') }}>Đăng xuất</button></div></Modal>}
      {modal?.kind === 'report' && <Modal onClose={() => setModal(null)}><h3 className="font-bold text-lg">Báo cáo hoặc chặn {modal.peer?.name}</h3><p className="text-sm opacity-70 my-2">Người này sẽ không thấy bạn nữa. Bạn có thể bỏ chặn trong Hồ sơ.</p><textarea placeholder="Lý do (không bắt buộc)" /><div className="flex gap-2 justify-end mt-3"><button className="btn btn-o" onClick={() => setModal(null)}>Huỷ</button><button className="btn btn-p" onClick={() => { setInv({ ...inv, [modal.peer!.id]: 'blocked' }); setModal(null); say('Đã chặn và gửi báo cáo.') }}>Chặn</button></div></Modal>}
      <Bell invs={invs} respond={respond} notes={notes} setNotes={setNotes} />
      {toast && <div className="fixed top-20 right-4 z-[60] bg-forest text-cream px-5 py-3 rounded-2xl shadow-lg pop">✓ {toast}</div>}
    </div>
  )
}
function Bell({ invs, respond, notes, setNotes }: { invs: string[]; respond: (n: string, ok: boolean) => void; notes: { id: number; t: string; h: string; unread: boolean }[]; setNotes: (n: any) => void }) {
  const [open, setOpen] = useState(false)
  const count = invs.length + notes.filter(n => n.unread).length
  return (<div className="app-bell fixed top-3 right-3 md:top-6 md:right-8 z-40">
    <button aria-label="Thông báo" onClick={() => setOpen(!open)} className="bell-button">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#365c4a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>
      {count > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-caramel text-espresso text-[11px] font-bold grid place-items-center">{count}</span>}
    </button>
    {open && <><div className="fixed inset-0" onClick={() => setOpen(false)} />
      <div className="card pop absolute right-0 mt-2 w-[min(92vw,380px)] max-h-[75vh] overflow-y-auto p-4">
        <div className="flex items-center mb-2"><b className="flex-1 text-lg">Thông báo</b>{notes.some(n => n.unread) && <button className="text-xs text-forest font-semibold" onClick={() => setNotes(notes.map(n => ({ ...n, unread: false })))}>Đánh dấu đã đọc</button>}</div>
        <h4 className="text-xs font-bold uppercase tracking-wide opacity-60 mt-2 mb-2">Lời mời đang chờ ({invs.length})</h4>
        {invs.length ? invs.map(n => <div key={n} className="flex items-center gap-2 mb-2 p-2 rounded-2xl bg-matcha-soft/60"><Av n={n} s={36} /><span className="flex-1 text-sm font-medium">{n}<br /><span className="text-xs opacity-60 font-normal">muốn học cùng bạn</span></span>
          <button className="btn btn-o text-xs !px-3 !py-1.5" onClick={() => respond(n, false)}>Từ chối</button><button className="btn btn-p text-xs !px-3 !py-1.5" onClick={() => respond(n, true)}>Chấp nhận</button></div>)
          : <p className="text-sm opacity-60 mb-2">Không có lời mời nào đang chờ.</p>}
        <h4 className="text-xs font-bold uppercase tracking-wide opacity-60 mt-3 mb-2">Gần đây</h4>
        {notes.length ? notes.map(n => <button key={n.id} onClick={() => setNotes(notes.map(x => (x.id === n.id ? { ...x, unread: false } : x)))} className="w-full text-left flex gap-2 p-2 rounded-xl hover:bg-cream">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.unread ? 'bg-caramel' : 'bg-transparent'}`} /><span className="text-sm flex-1">{n.t}<br /><span className="text-xs opacity-50">{n.h}</span></span></button>)
          : <p className="text-sm opacity-60">Chưa có thông báo mới. Chúc bạn một ngày học thật vui!</p>}
      </div></>}
  </div>)
}

type P = { lib?: LibItem[]; attached?: number[]; setAttached?: (a: number[]) => void; invs?: string[]; respond?: (n: string, ok: boolean) => void; go: (s: Scr) => void; say: (m: string) => void; setModal: (m: any) => void; inv: Record<number, any>; setInv: (v: any) => void; partner: Peer; setPartner: (p: Peer) => void }

function Chips({ items, init = [] as string[], single = false }: { items: string[]; init?: string[]; single?: boolean }) {
  const [sel, setSel] = useState<string[]>(init)
  return <div className="flex flex-wrap gap-2">{items.map(i => (
    <button key={i} className={`chip ${sel.includes(i) ? 'on' : ''}`} onClick={() => setSel(single ? [i] : sel.includes(i) ? sel.filter(x => x !== i) : [...sel, i])}>{i}</button>))}</div>
}

function Home({ go }: P) {
  const { p: profile } = useProfile()
  const [empty, setEmpty] = useState(false)
  return (<div className="space-y-6">
    <header className="flex flex-wrap justify-between items-end gap-2"><div><h1 className="text-3xl font-extrabold">Chào {profile.name} ☀️</h1><p className="opacity-70">Hôm nay mình học gì nhỉ?</p></div>
      <button className="text-xs underline opacity-60" onClick={() => setEmpty(!empty)}>{empty ? 'Xem tài khoản có dữ liệu' : 'Xem trạng thái người dùng mới'}</button></header>
    {empty ? <div className="card p-8 bg-matcha-soft text-center"><div className="text-5xl">🍵</div><h2 className="text-xl font-bold mt-2">Chưa có buổi học nào, bắt đầu từ ly matcha đầu tiên nhé</h2><p className="text-sm opacity-70 my-3">Chọn một môn và để StudyMatch gợi ý bạn học hợp gu.</p><button className="btn btn-p" onClick={() => go('match')}>Tìm bạn học</button></div> : <>
      <div className="grid grid-cols-3 gap-3">{[['12.5h', 'Giờ học'], ['9', 'Buổi hoàn thành'], ['3', 'Bạn học']].map(([a, b]) => <div key={b} className="card p-4"><div className="text-2xl md:text-3xl font-extrabold text-forest">{a}</div><div className="text-xs opacity-70">{b}</div></div>)}</div>
      <div className="grid md:grid-cols-2 gap-4">
        <section className="card p-5"><h3 className="font-bold mb-3">Buổi học sắp tới</h3><div className="flex gap-3 items-center"><Av n="Thu Hà" /><div className="flex-1 min-w-0"><b className="whitespace-nowrap">Giải tích 1 · Đạo hàm riêng</b><p className="text-xs opacity-70">Mai, 19:30 · 50 phút · cùng Thu Hà</p></div><button className="btn btn-p text-sm" onClick={() => go('room')}>Vào phòng</button></div></section>
        <section className="card p-5"><h3 className="font-bold mb-3">Gợi ý cho bạn</h3>{PEERS.slice(0, 2).map(p => <div key={p.id} className="flex items-center gap-3 mb-2"><Av n={p.name} /><span className="flex-1">{p.name}<br /><span className="text-xs opacity-60">{p.strong}</span></span><Ring v={p.score} s={48} /></div>)}<button className="text-sm text-forest font-semibold" onClick={() => go('match')}>Xem thêm →</button></section>
      </div></>}
  </div>)
}

function Match({ inv, setInv, say, setModal, go, setPartner }: P) {
  const { p: me } = useProfile()
  const [subj, setSubj] = useState('Giải tích 1'); const [open, setOpen] = useState<Peer | null>(null); const [loading, setLoading] = useState(false)
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 600); return () => clearTimeout(t) }, [subj])
  const list = PEERS.filter(p => PEER_X[p.id].subjects.some(s => s.name === subj)).map(p => ({ p, sc: scorePeer(p.id, me, subj) })).sort((a, b) => b.sc.score - a.sc.score)
  const stateLabel = (p: Peer) => ({ sent: 'Đang chờ phản hồi', accepted: 'Đã kết nối', cancelled: 'Đã huỷ lời mời', blocked: 'Đã chặn' } as any)[inv[p.id]]
  const invite = (p: Peer) => { setInv({ ...inv, [p.id]: 'sent' }); say('Đã gửi lời mời học cùng!') }
  return (<div className="space-y-5">
    <h1 className="text-3xl font-extrabold">Tìm bạn học hợp gu</h1>
    <select value={subj} onChange={e => setSubj(e.target.value)} className="max-w-xs">{Array.from(new Set([...me.subjects.map(s => s.name), ...SUBJECTS])).map(s => <option key={s}>{s}</option>)}</select>
    {loading ? <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="card h-28 animate-pulse bg-matcha-soft" />)}</div>
      : !list.length ? <Empty t="Chưa có bạn học phù hợp lúc này" d="Thử thêm khung giờ rảnh hoặc chọn môn khác. Chúng mình sẽ báo khi có người hợp gu." a="Chỉnh lịch rảnh" f={() => go('profile')} />
      : list.map(({ p, sc }) => (<div key={p.id} className="card p-5 hover:-translate-y-0.5 transition">
        <div className="flex gap-4 items-center"><Avatar src={peerAvatar(p.name)} name={p.name} size={52} /><div className="flex-1"><b className="text-lg">{p.name}</b><p className="text-xs opacity-70">{PEER_X[p.id].major} · {p.uni}</p>
          {(sc.teachMe.length > 0 || sc.iTeach.length > 0) && <p className="text-sm mt-1 bg-caramel/15 rounded-xl px-3 py-1.5 inline-block">🤝 {sc.teachMe.length > 0 && <>{p.name} vững <b>{sc.teachMe.join(', ')}</b></>}{sc.teachMe.length > 0 && sc.iTeach.length > 0 && ' · '}{sc.iTeach.length > 0 && <>bạn giúp lại <b>{sc.iTeach.join(', ')}</b></>}</p>}</div><Ring v={sc.score} /></div>
        <div className="flex flex-wrap gap-2 mt-3 items-center"><span className="chip">{sc.overlap.length} khung giờ trùng</span>{PEER_X[p.id].goals.slice(0, 1).map(g => <span key={g} className="chip">{g}</span>)}{PEER_X[p.id].styles.map(g => <span key={g} className="chip">{g}</span>)}
          <span className="flex-1" />{inv[p.id] && <span className="text-xs font-semibold text-forest">{stateLabel(p)}</span>}
          <button className="btn btn-o text-sm" onClick={() => setOpen(p)}>Xem hồ sơ</button>
          {(!inv[p.id] || inv[p.id] === 'cancelled') && <button className="btn btn-p text-sm" onClick={() => invite(p)}>Gửi lời mời</button>}
          {inv[p.id] === 'sent' && <button className="btn btn-s text-sm" onClick={() => { setInv({ ...inv, [p.id]: 'cancelled' }); say('Đã huỷ lời mời') }}>Huỷ lời mời</button>}
          {inv[p.id] === 'accepted' && <button className="btn btn-p text-sm" onClick={() => { setPartner(p); go('chat') }}>Nhắn tin</button>}
        </div></div>))}
    {open && <PublicProfile id={open.id} name={open.name} uni={open.uni} subject={subj} onClose={() => setOpen(null)} action={<>
      <button className="text-sm text-red-700 underline mr-auto" onClick={() => { setModal({ kind: 'report', peer: open }); setOpen(null) }}>Báo cáo / chặn</button>
      {(!inv[open.id] || inv[open.id] === 'cancelled') && <button className="btn btn-p" onClick={() => { invite(open); setOpen(null) }}>Gửi lời mời</button>}</>} />}
  </div>)
}

function Chat({ partner, go, say }: P) {
  const [prof, setProf] = useState(false)
  const [msgs, setMsgs] = useState([{ me: false, t: 'Mai mình ôn đạo hàm riêng nhé?', h: '20:10' }, { me: true, t: 'Ok bạn, 19:30 nha!', h: '20:12' }])
  const [v, setV] = useState(''); const [fail, setFail] = useState(false)
  const send = () => { if (!v.trim()) return; const bad = v.includes('lỗi'); setMsgs([...msgs, { me: true, t: v, h: 'Vừa xong' }]); setFail(bad); setV('') }
  return (<div className="grid md:grid-cols-[260px_1fr] gap-4 h-[75vh]">
    <div className="card p-3 hidden md:block"><div className="flex items-center gap-3 p-2 rounded-2xl bg-matcha-soft"><Av n={partner.name} /><div className="flex-1"><b>{partner.name}</b><p className="text-xs opacity-60">Mai ôn đạo hàm…</p></div><span className="bg-caramel text-white text-xs rounded-full px-2">2</span></div></div>
    <div className="card flex flex-col overflow-hidden"><div className="p-4 border-b border-line flex items-center gap-3"><Avatar src={peerAvatar(partner.name)} name={partner.name} /><b className="flex-1">{partner.name}</b><button className="btn btn-o text-sm" onClick={() => setProf(true)}>Xem hồ sơ</button><button className="btn btn-s text-sm" onClick={() => go('sessions')}>Hẹn buổi học</button></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">{msgs.map((m, i) => <div key={i} className={`flex ${m.me ? 'justify-end' : ''}`}><div className={`px-4 py-2 rounded-2xl max-w-[75%] ${m.me ? 'bg-forest text-cream' : 'bg-matcha-soft'}`}>{m.t}<div className="text-[10px] opacity-60">{m.h}</div></div></div>)}
        {fail && <p className="text-xs text-red-700 text-right">Gửi chưa được. <button className="underline" onClick={() => { setFail(false); say('Đã gửi lại') }}>Thử lại</button></p>}</div>
      {prof && <PublicProfile id={partner.id} name={partner.name} uni={partner.uni} subject="Giải tích 1" onClose={() => setProf(false)} />}
      <div className="p-3 flex gap-2 border-t border-line"><input value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Nhắn gì đó…" /><button className="btn btn-p" onClick={send}>Gửi</button></div></div></div>)
}

function Sessions({ go, say, partner }: P) {
  const [tab, setTab] = useState('Sắp tới'); const [form, setForm] = useState(false); const [cancel, setCancel] = useState(false)
  const data: any = { 'Sắp tới': [['Giải tích 1 · Đạo hàm riêng', 'Mai 19:30 · 50 phút', 'Thu Hà']], 'Hoàn thành': [['Xác suất · Biến ngẫu nhiên', '12/05 · 25 phút', 'Minh Anh']], 'Đã huỷ / lỡ': [] }
  return (<div className="space-y-5"><div className="flex justify-between items-center"><h1 className="text-3xl font-extrabold">Lịch học</h1><button className="btn btn-p" onClick={() => setForm(true)}>+ Hẹn buổi học</button></div>
    <div className="flex gap-2">{Object.keys(data).map(t => <button key={t} className={`chip ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>
    {data[tab].length ? data[tab].map((s: string[]) => <div key={s[0]} className="card p-5 flex flex-wrap items-center gap-3"><Av n={s[2]} /><div className="flex-1"><b>{s[0]}</b><p className="text-sm opacity-70">{s[1]} · {s[2]}</p></div>
      {tab === 'Sắp tới' ? <><button className="btn btn-p text-sm" onClick={() => go('room')}>Mở phòng</button><button className="btn btn-o text-sm" onClick={() => setForm(true)}>Dời lịch</button><button className="btn btn-o text-sm" onClick={() => setCancel(true)}>Huỷ</button></> : <button className="btn btn-s text-sm" onClick={() => setForm(true)}>Học lại cùng bạn này</button>}</div>)
      : <Empty t="Chưa có buổi nào ở đây" d="Một buổi học nhỏ, một bước tiến lớn." a="Hẹn buổi học" f={() => setForm(true)} />}
    {form && <Modal onClose={() => setForm(false)}><h3 className="font-bold text-lg mb-3">Đề xuất buổi học</h3><div className="space-y-3 text-sm"><select defaultValue={partner.name}><option>{partner.name}</option><option>Minh Anh</option></select><select>{SUBJECTS.map(s => <option key={s}>{s}</option>)}</select><Chips items={['Đạo hàm riêng', 'Tích phân bội', 'Chuỗi số']} init={['Đạo hàm riêng']} /><div className="grid grid-cols-2 gap-2"><input type="date" /><input type="time" defaultValue="19:30" /></div><Chips single items={['25 phút', '50 phút', '90 phút']} init={['50 phút']} /><input placeholder="Mục tiêu: làm xong 10 bài tập…" /></div><div className="flex justify-end gap-2 mt-4"><button className="btn btn-o" onClick={() => setForm(false)}>Đóng</button><button className="btn btn-p" onClick={() => { setForm(false); say('Đã gửi đề xuất, chờ bạn học xác nhận') }}>Gửi đề xuất</button></div></Modal>}
    {cancel && <Modal onClose={() => setCancel(false)}><h3 className="font-bold text-lg">Huỷ buổi học này?</h3><p className="text-sm opacity-70 my-2">Bạn học sẽ nhận được thông báo.</p><div className="flex justify-end gap-2"><button className="btn btn-o" onClick={() => setCancel(false)}>Giữ lại</button><button className="btn btn-p" onClick={() => { setCancel(false); say('Đã huỷ buổi học') }}>Huỷ buổi học</button></div></Modal>}
  </div>)
}

function Room({ go, say, lib = [], attached = [], setAttached = () => {} }: P) {
  const [phase, setPhase] = useState<'before' | 'during' | 'after'>('before')
  const { mode: len, secondsLeft: left, running: run, reset, toggle } = usePomodoro()
  const [goals, setGoals] = useState([{ t: 'Ôn đạo hàm riêng', d: true }, { t: 'Làm 5 bài tập', d: false }]); const [g, setG] = useState('')
  const mm = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0')
  return (<div className="space-y-5"><div className="card p-5 bg-paper text-espresso border-matcha flex flex-wrap items-center gap-3"><Av n="Thu Hà" /><div className="flex-1"><b>Giải tích 1 · Đạo hàm riêng</b><p className="text-xs opacity-70">Cùng Thu Hà · Mai 19:30</p></div>
      <span className={`text-xs px-3 py-1 rounded-full ${phase === 'during' ? 'bg-caramel text-espresso font-bold' : 'bg-matcha-soft text-forest font-semibold'}`}>{phase === 'before' ? 'Chuẩn bị' : phase === 'during' ? '● Đang học' : 'Đã xong'}</span></div>
    {phase === 'before' && <div className="card p-6 space-y-3"><h3 className="font-bold text-lg">Sẵn sàng cho một phiên học thật tập trung?</h3><p className="text-sm">✓ Bạn đã xác nhận tham gia<br />⏳ Thu Hà chưa xác nhận</p><button className="btn btn-p" onClick={() => setPhase('during')}>Bắt đầu phiên học</button></div>}
    {phase === 'during' && <div className="grid md:grid-cols-2 gap-4"><div className="card p-6 text-center bg-matcha-soft"><div className="flex justify-center gap-2 mb-3">{([25, 50] as const).map(n => <button key={n} className={`chip ${len === n ? 'on' : ''}`} onClick={() => reset(n)}>{n} phút</button>)}</div>
        <div className="text-6xl font-extrabold text-forest tabular-nums">{mm}</div><div className="flex justify-center gap-2 mt-4"><button className="btn btn-p" onClick={toggle}>{run ? 'Tạm dừng' : 'Bắt đầu'}</button><button className="btn btn-o" onClick={() => reset()}>Đặt lại</button></div></div>
      <div className="card p-5"><h3 className="font-bold mb-2">Mục tiêu chung</h3>{goals.map((x, i) => <label key={i} className="flex gap-2 py-1 cursor-pointer"><input type="checkbox" className="!w-5" checked={x.d} onChange={() => setGoals(goals.map((y, j) => (j === i ? { ...y, d: !y.d } : y)))} /><span className={x.d ? 'line-through opacity-50' : ''}>{x.t}</span></label>)}<div className="flex gap-2 mt-2"><input value={g} onChange={e => setG(e.target.value)} placeholder="Thêm mục tiêu" /><button className="btn btn-s" onClick={() => { if (g) { setGoals([...goals, { t: g, d: false }]); setG('') } }}>Thêm</button></div></div>
      <RoomResources lib={lib} attached={attached} setAttached={setAttached} go={go} />
      <div className="card p-5"><h3 className="font-bold mb-2">Google Meet</h3><div className="flex gap-2"><input defaultValue="https://meet.google.com/abc-defg-hij" /><button className="btn btn-p" onClick={() => window.open('https://meet.google.com', '_blank')}>Mở</button></div></div>
      <button className="btn btn-p md:col-span-2" onClick={() => setPhase('after')}>Kết thúc & xác nhận hoàn thành</button></div>}
    {phase === 'after' && <div className="card p-6 space-y-3 text-center"><div className="text-5xl">🎉</div><h3 className="text-xl font-bold">Hoàn thành {goals.filter(x => x.d).length}/{goals.length} mục tiêu</h3><textarea placeholder="Một chút cảm nhận về buổi học…" /><p className="text-sm">Muốn học tiếp cùng Thu Hà chứ?</p><div className="flex justify-center gap-2"><button className="btn btn-p" onClick={() => { say('Tiến độ đã được cập nhật'); go('sessions') }}>Hẹn buổi tiếp theo</button><button className="btn btn-o" onClick={() => go('match')}>Tìm bạn học khác</button></div></div>}
  </div>)
}

function Progress({ go }: P) {
  return (<div className="space-y-5"><h1 className="text-3xl font-extrabold">Hành trình học của bạn</h1>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['12.5h', 'Tổng giờ học'], ['9', 'Buổi hoàn thành'], ['1', 'Buổi lỡ'], ['3', 'Bạn học']].map(([a, b]) => <div key={b} className="card p-4"><div className="text-3xl font-extrabold text-forest">{a}</div><div className="text-xs opacity-70">{b}</div></div>)}</div>
    <div className="card p-5"><h3 className="font-bold mb-3">Giờ học 7 ngày qua</h3><div className="flex items-end gap-3 h-28">{[30, 60, 0, 90, 45, 70, 20].map((h, i) => <div key={i} className="flex-1 text-center text-xs"><div className="bg-matcha rounded-t-xl" style={{ height: h }} />{DAYS[i]}</div>)}</div></div>
    <div className="card p-5"><h3 className="font-bold mb-3">Bạn học đã đồng hành</h3>{PEERS.map(p => <div key={p.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0"><Av n={p.name} /><span className="flex-1">{p.name}</span><button className="btn btn-s text-sm" onClick={() => go('sessions')}>Hẹn lại</button></div>)}<button className="btn btn-p mt-3" onClick={() => go('match')}>Tìm bạn học mới</button></div></div>)
}

const PRICING_PLANS = [
  {
    name: 'GÓI CƠ BẢN',
    price: '0đ',
    period: '/ mãi mãi',
    description: 'Dành cho sinh viên muốn trải nghiệm tự học và kiểm tra thuật toán ghép đôi.',
    features: ['Giới hạn tối đa 3 lời mời ghép (1/3 đã dùng)', 'Phòng học P2P Pomodoro 25 phút'],
    cta: 'Gói hiện tại',
  },
  {
    name: 'PASS MÙA THI (SPRINT)',
    price: '19.000đ',
    period: '/ 2 tuần cao điểm',
    description: 'Bảo hiểm qua môn hoàn hảo cho 2 tuần ôn thi Giữa kỳ hoặc Cuối kỳ.',
    features: ['Ưu tiên ghép bạn giỏi trong 3 phút', 'Tặng thêm 10 lời mời gửi trực tiếp'],
    badge: 'CẤP TỐC MÙA THI',
    cta: 'Chọn gói Sprint',
  },
  {
    name: 'STUDYMATCH PLUS',
    price: '29.000đ',
    period: '/ tháng (~900đ/ngày)',
    description: 'Dành cho sinh viên quyết tâm đạt GPA 3.2+ để săn học bổng khuyến khích.',
    features: ['Không giới hạn lời mời ghép đôi', 'Bảo vệ chuỗi Streak Freeze khi bận thi'],
    badge: 'KHUYÊN DÙNG NHẤT',
    featured: true,
    cta: 'Chọn StudyMatch Plus',
  },
]

function Pricing({ say }: { say: (m: string) => void }) {
  const [metrics, setMetrics] = useState(false)
  const choose = (name: string) => say(name === 'GÓI CƠ BẢN' ? 'Bạn đang sử dụng Gói Cơ Bản' : `Đã ghi nhận quan tâm: ${name}`)
  return <div className="space-y-6 text-[#2C221E]">
    <section className="rounded-2xl border border-[#E2DDD5] p-7 overflow-hidden relative" style={{ background: 'linear-gradient(130deg,#EFECE6 0%,#F9F6F0 52%,#E7EFE8 100%)' }}>
      <div className="absolute -right-20 -top-24 w-64 h-64 rounded-full bg-[#A7B99A]/20" />
      <div className="relative grid lg:grid-cols-[3fr_2fr] gap-7 items-center">
        <div>
          <span className="inline-flex rounded-full bg-[#FDF2F2] text-[#C53030] px-3 py-1.5 text-xs font-semibold">Chiến Lược Neo Giá Học Thuật (Price Anchoring)</span>
          <h1 className="mt-4 text-2xl font-extrabold leading-[1.4] tracking-[-0.02em]">Trượt 1 môn đại cương tốn <span className="text-[#C53030] line-through decoration-2">2.400.000đ</span> học lại. Gói bảo hiểm qua môn chỉ từ <span className="text-[#2D5A43]">19.000đ</span>.</h1>
          <p className="mt-3 text-sm leading-6 text-[#5C534E]">Tại ĐH Bách khoa Hà Nội và các trường kỹ thuật, tỷ lệ trượt môn Giải tích, Đại số dao động từ 25% – 35% kèm nguy cơ Cảnh cáo học vụ Mức 1 (bị khóa trần còn 14 tín chỉ). Chi phí gói StudyMatch chỉ tương đương 0,8% tiền học lại — chưa bằng một suất cơm bụi sinh viên.</p>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
          <div className="rounded-xl border border-[#FEB2B2] bg-[#FFF5F5] p-4 text-center flex flex-col justify-center">
            <p className="text-[10px] font-bold tracking-wide text-[#9B2C2C]">THIỆT HẠI HỌC LẠI</p>
            <strong className="text-[22px] text-[#C53030] mt-1">2.400.000đ</strong>
            <p className="text-[11px] text-[#7B4545] mt-1">+ Nguy cơ Cảnh cáo Mức 1</p>
          </div>
          <span className="self-center text-xs font-extrabold text-[#8C827C]">VS</span>
          <div className="rounded-xl border border-[#86EFAC] bg-[#F0FDF4] p-4 text-center flex flex-col justify-center">
            <p className="text-[10px] font-bold tracking-wide text-[#2D5A43]">✨ GÓI PASS MÙA THI</p>
            <strong className="text-[22px] text-[#2D5A43] mt-1">19.000đ</strong>
            <p className="text-[11px] text-[#47745E] mt-1">Chỉ bằng ~0,8% chi phí!</p>
          </div>
        </div>
      </div>
    </section>

    <header className="flex flex-wrap items-end gap-4">
      <div className="flex-1">
        <h2 className="text-xl font-extrabold">Bảng Giá Dịch Vụ &amp; Đo Lường Fake Door Test</h2>
        <p className="mt-1 text-[13px] text-[#746A64]">Mô hình kinh doanh vi mô (Micro-subscription) đánh trúng tâm lý vượt qua kỳ thi của sinh viên</p>
      </div>
      <button className="btn btn-o text-xs" onClick={() => setMetrics(true)}>✨ Số Liệu Đo Lường Khởi Nghiệp (Startup Metrics)</button>
    </header>

    <div className="grid lg:grid-cols-3 gap-5 items-stretch">
      {PRICING_PLANS.map(plan => <article key={plan.name} className={`relative rounded-2xl bg-white p-6 flex flex-col border ${plan.featured ? 'border-2 border-[#2D5A43] shadow-[0_18px_40px_-24px_rgba(45,90,67,.45)]' : 'border-[#E2DDD5] shadow-[0_12px_30px_-24px_rgba(44,34,30,.28)]'}`}>
        {plan.badge && <span className={`absolute -top-3 left-6 rounded-full px-3 py-1 text-[10px] font-bold tracking-wide ${plan.featured ? 'bg-[#2D5A43] text-white' : 'bg-[#F5D8A8] text-[#70491F]'}`}>{plan.badge}</span>}
        <p className="text-xs font-extrabold tracking-[.08em] text-[#5C534E]">{plan.name}</p>
        <div className="flex items-end gap-2 mt-5"><strong className="text-[28px] leading-none text-[#2D5A43]">{plan.price}</strong><span className="text-xs text-[#746A64]">{plan.period}</span></div>
        <p className="text-sm leading-6 text-[#5C534E] mt-5 min-h-18">{plan.description}</p>
        <div className="h-px bg-[#EEEAE3] my-5" />
        <ul className="space-y-3 flex-1">{plan.features.map(feature => <li key={feature} className="flex gap-2.5 text-sm leading-5"><span className="w-5 h-5 rounded-full bg-[#E7F0E9] text-[#2D5A43] grid place-items-center shrink-0 text-xs font-bold">✓</span>{feature}</li>)}</ul>
        <button disabled={plan.name === 'GÓI CƠ BẢN'} onClick={() => choose(plan.name)} className={`mt-6 h-11 rounded-full text-sm font-semibold transition disabled:cursor-default ${plan.featured ? 'bg-[#2D5A43] text-white hover:bg-[#244936]' : plan.name === 'GÓI CƠ BẢN' ? 'bg-[#EFECE6] text-[#746A64]' : 'border border-[#2D5A43] text-[#2D5A43] hover:bg-[#F0F7F2]'}`}>{plan.cta}</button>
      </article>)}
    </div>

    {metrics && <Modal onClose={() => setMetrics(false)}>
      <h3 className="text-lg font-extrabold">Số liệu Fake Door Test</h3>
      <p className="text-sm text-[#746A64] mt-1">Dữ liệu minh họa để kiểm tra mức độ quan tâm trước khi triển khai thanh toán thật.</p>
      <div className="grid grid-cols-3 gap-2 my-5">{[['128', 'Lượt xem'], ['34', 'Bấm chọn gói'], ['26,6%', 'Ý định mua']].map(([v, l]) => <div key={l} className="rounded-xl bg-[#F9F6F0] p-3 text-center"><strong className="block text-xl text-[#2D5A43]">{v}</strong><span className="text-[10px] text-[#746A64]">{l}</span></div>)}</div>
      <button className="btn btn-p w-full" onClick={() => setMetrics(false)}>Đóng báo cáo</button>
    </Modal>}
  </div>
}
