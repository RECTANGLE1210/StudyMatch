import { useState, type ReactNode } from 'react'

export type LibItem = { id: number; name: string; kind: 'doc' | 'quiz'; subject: string; url: string; fileName?: string; owner: string; at: string }
export const SEED_LIB: LibItem[] = [
  { id: 1, name: 'Slide chương 3 – Đạo hàm riêng', kind: 'doc', subject: 'Giải tích 1', url: '', fileName: 'chuong3.pdf', owner: 'Thu Hà', at: '12/05' },
  { id: 2, name: 'Quiz ôn chuỗi số (20 câu)', kind: 'quiz', subject: 'Giải tích 1', url: 'https://forms.google.com', owner: 'Lan Phương', at: '10/05' },
  { id: 3, name: 'Tổng hợp cây nhị phân', kind: 'doc', subject: 'Cấu trúc dữ liệu', url: '', fileName: 'cay-nhi-phan.pdf', owner: 'Lan Phương', at: '08/05' },
]
const SUBJ = ['Giải tích 1', 'Cấu trúc dữ liệu', 'Xác suất thống kê', 'Vật lý đại cương', 'Kinh tế vi mô', 'Lập trình Python']
const icon = (k: string) => (k === 'quiz' ? '❓' : '📄')

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 bg-espresso/40 flex items-end md:items-center justify-center md:p-4" onClick={onClose}>
    <div className="card pop p-5 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto !rounded-b-none md:!rounded-b-[24px]" onClick={e => e.stopPropagation()}>{children}</div></div>
}
const openItem = (i: LibItem) => { if (i.url) window.open(i.url, '_blank') }

function UploadModal({ onSave, onClose }: { onSave: (i: LibItem) => void; onClose: () => void }) {
  const [kind, setKind] = useState<'doc' | 'quiz'>('doc'); const [name, setName] = useState(''); const [subject, setSubject] = useState(SUBJ[0])
  const [mode, setMode] = useState<'file' | 'link'>('file'); const [file, setFile] = useState<File | null>(null); const [link, setLink] = useState('')
  const [tried, setTried] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const bad = { name: !name.trim(), src: mode === 'file' ? !file : !/^https?:\/\//.test(link) }
  const pickFile = (f?: File) => { if (!f) return; if (f.size > 10_000_000) { setErr('File quá lớn, tối đa 10MB nhé.'); return } setErr(''); setFile(f); if (!name) setName(f.name.replace(/\.[^.]+$/, '')) }
  const save = () => {
    setTried(true); if (bad.name || bad.src) return; setBusy(true)
    setTimeout(() => { onSave({ id: Date.now(), name: name.trim(), kind, subject, url: mode === 'file' ? URL.createObjectURL(file!) : link, fileName: file?.name, owner: 'Lan Phương', at: 'Hôm nay' }) }, 700)
  }
  return <Modal onClose={onClose}><h3 className="text-xl font-extrabold mb-4">Thêm vào ngân hàng</h3>
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-matcha-soft">{([['doc', '📄 Tài liệu'], ['quiz', '❓ Quiz']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-full py-2 font-semibold ${kind === k ? 'bg-forest text-cream' : ''}`}>{l}</button>)}</div>
      <label className="block font-medium">Tên hiển thị<input value={name} onChange={e => setName(e.target.value)} placeholder={kind === 'quiz' ? 'VD: Quiz ôn giữa kỳ Xác suất' : 'VD: Slide chương 2'} style={tried && bad.name ? { borderColor: '#b3402f' } : undefined} />{tried && bad.name && <span className="text-xs text-red-700">Hãy đặt tên để bạn học dễ tìm</span>}</label>
      <label className="block font-medium">Môn học<select value={subject} onChange={e => setSubject(e.target.value)}>{SUBJ.map(s => <option key={s}>{s}</option>)}</select></label>
      <div><div className="flex gap-2 mb-2">{([['file', 'Tải tệp lên'], ['link', 'Dán liên kết']] as const).map(([k, l]) => <button key={k} type="button" className={`chip ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{l}</button>)}</div>
        {mode === 'file' ? <label className="block border-2 border-dashed border-matcha rounded-2xl p-5 text-center cursor-pointer hover:bg-matcha-soft/50">
          <input type="file" hidden accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" onChange={e => pickFile(e.target.files?.[0])} />{file ? <b>{file.name}</b> : <span className="opacity-70">Chạm để chọn tệp (PDF, Word, PPT, ảnh · tối đa 10MB)</span>}</label>
          : <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://… (Google Drive, Forms, Quizlet…)" />}
        {err && <p className="text-xs text-red-700 mt-1">{err}</p>}{tried && bad.src && !err && <p className="text-xs text-red-700 mt-1">{mode === 'file' ? 'Hãy chọn một tệp' : 'Liên kết cần bắt đầu bằng http:// hoặc https://'}</p>}</div>
    </div>
    <div className="flex justify-end gap-2 mt-5"><button className="btn btn-o" onClick={onClose}>Hủy</button><button className="btn btn-p disabled:opacity-60" disabled={busy} onClick={save}>{busy ? 'Đang tải lên…' : 'Lưu vào ngân hàng'}</button></div></Modal>
}

export function LibraryScreen({ lib, setLib, attached, setAttached, say, go }: { lib: LibItem[]; setLib: (l: LibItem[]) => void; attached: number[]; setAttached: (a: number[]) => void; say: (m: string) => void; go: (s: any) => void }) {
  const [tab, setTab] = useState<'all' | 'doc' | 'quiz'>('all'); const [q, setQ] = useState(''); const [up, setUp] = useState(false); const [del, setDel] = useState<LibItem | null>(null)
  const list = lib.filter(i => (tab === 'all' || i.kind === tab) && (i.name + i.subject).toLowerCase().includes(q.toLowerCase()))
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end gap-3"><div className="flex-1"><h1 className="text-3xl font-extrabold">Ngân hàng tài liệu</h1><p className="opacity-70">Tài liệu và Quiz dùng chung. Gắn vào Study Room để cả hai cùng xem.</p></div><button className="btn btn-p" onClick={() => setUp(true)}>+ Tải lên</button></div>
    <div className="flex flex-wrap gap-2 items-center">{([['all', 'Tất cả'], ['doc', 'Tài liệu'], ['quiz', 'Quiz']] as const).map(([k, l]) => <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>)}<input className="max-w-xs ml-auto" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên hoặc môn…" /></div>
    {!list.length ? <div className="card p-8 text-center"><div className="text-4xl mb-2">🗂</div><h3 className="font-bold text-lg">{lib.length ? 'Không tìm thấy tài liệu nào' : 'Ngân hàng đang trống'}</h3><p className="text-sm opacity-70 my-1 mb-4">{lib.length ? 'Thử từ khóa hoặc bộ lọc khác nhé.' : 'Tải lên tài liệu hoặc Quiz đầu tiên để cùng học.'}</p>{!lib.length && <button className="btn btn-p" onClick={() => setUp(true)}>Tải lên ngay</button>}</div>
      : <div className="grid md:grid-cols-2 gap-3">{list.map(i => <div key={i.id} className="card p-4 hover:-translate-y-0.5 transition">
        <div className="flex gap-3"><div className={`w-11 h-11 rounded-2xl grid place-items-center text-xl shrink-0 ${i.kind === 'quiz' ? 'bg-caramel/25' : 'bg-matcha-soft'}`}>{icon(i.kind)}</div>
          <div className="flex-1 min-w-0"><b className="block truncate">{i.name}</b><p className="text-xs opacity-60">{i.kind === 'quiz' ? 'Quiz' : 'Tài liệu'} · {i.subject}</p><p className="text-xs opacity-60">{i.owner} · {i.at}</p></div></div>
        <div className="flex flex-wrap gap-2 mt-3 justify-end">
          {i.url && <button className="btn btn-o text-xs !py-1.5" onClick={() => openItem(i)}>Mở</button>}
          {attached.includes(i.id) ? <button className="btn btn-s text-xs !py-1.5" onClick={() => { setAttached(attached.filter(x => x !== i.id)); say('Đã gỡ khỏi Study Room') }}>✓ Đã gắn · Gỡ</button>
            : <button className="btn btn-p text-xs !py-1.5" onClick={() => { setAttached([...attached, i.id]); say('Đã gắn vào Study Room') }}>Gắn vào Study Room</button>}
          {i.owner === 'Lan Phương' && <button className="btn btn-o text-xs !py-1.5 text-red-700" onClick={() => setDel(i)}>Xóa</button>}</div></div>)}</div>}
    {up && <UploadModal onClose={() => setUp(false)} onSave={i => { setLib([i, ...lib]); setUp(false); say('Đã thêm vào ngân hàng tài liệu') }} />}
    {del && <Modal onClose={() => setDel(null)}><h3 className="font-bold text-lg">Xóa “{del.name}”?</h3><p className="text-sm opacity-70 my-2">Tài liệu cũng sẽ biến mất khỏi các Study Room đang dùng.</p><div className="flex justify-end gap-2"><button className="btn btn-o" onClick={() => setDel(null)}>Giữ lại</button><button className="btn btn-p" onClick={() => { setLib(lib.filter(x => x.id !== del.id)); setAttached(attached.filter(x => x !== del.id)); setDel(null); say('Đã xóa khỏi ngân hàng') }}>Xóa</button></div></Modal>}
  </div>
}

export function RoomResources({ lib, attached, setAttached, go }: { lib: LibItem[]; attached: number[]; setAttached: (a: number[]) => void; go: (s: any) => void }) {
  const [pick, setPick] = useState(false); const [q, setQ] = useState('')
  const on = lib.filter(i => attached.includes(i.id)); const rest = lib.filter(i => !attached.includes(i.id) && (i.name + i.subject).toLowerCase().includes(q.toLowerCase()))
  return <div className="card p-5"><div className="flex items-center mb-2"><h3 className="font-bold flex-1">Tài liệu & Quiz</h3><button className="btn btn-s text-xs !py-1.5" onClick={() => setPick(true)}>+ Gắn từ ngân hàng</button></div>
    {on.length ? on.map(i => <div key={i.id} className="flex items-center gap-2 py-2 border-b border-line last:border-0"><span>{icon(i.kind)}</span><span className="flex-1 text-sm truncate">{i.name}</span>
      {i.url && <button className="text-xs underline text-forest" onClick={() => openItem(i)}>Mở</button>}<button className="text-xs opacity-60 underline" onClick={() => setAttached(attached.filter(x => x !== i.id))}>Gỡ</button></div>)
      : <p className="text-sm opacity-60">Chưa có tài liệu nào. Gắn từ ngân hàng để cả hai cùng xem.</p>}
    <p className="text-[11px] opacity-50 mt-2">Cả hai bạn đều thấy các mục đã gắn.</p>
    {pick && <Modal onClose={() => setPick(false)}><h3 className="text-xl font-extrabold mb-3">Gắn vào Study Room</h3><input value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm tài liệu…" />
      <div className="mt-3 space-y-1">{rest.map(i => <button key={i.id} onClick={() => setAttached([...attached, i.id])} className="w-full text-left flex gap-3 items-center p-3 rounded-2xl hover:bg-matcha-soft"><span>{icon(i.kind)}</span><span className="flex-1"><b className="text-sm">{i.name}</b><br /><span className="text-xs opacity-60">{i.subject}</span></span><span className="text-forest text-sm font-semibold">Gắn</span></button>)}
        {!rest.length && <p className="text-sm opacity-60 p-3">Không còn mục nào để gắn.</p>}</div>
      <div className="flex justify-between mt-4"><button className="text-sm underline text-forest" onClick={() => { setPick(false); go('library') }}>Tải lên mục mới</button><button className="btn btn-p" onClick={() => setPick(false)}>Xong</button></div></Modal>}
  </div>
}
