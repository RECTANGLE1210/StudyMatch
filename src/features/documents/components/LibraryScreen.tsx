import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { resourceRepository } from '../repositories/resourceRepository'
import { Modal, ErrorNotice, Empty } from '../../../components/shared/Feedback'
import { rpc } from '../../../lib/supabase/rpc'
import { errorMessage } from '../../../lib/utils/errors'
import { displayDate } from '../../../lib/utils/dates'
import type { ResourceView } from '../../../types/product'
const icon = (kind: string) => (kind === 'quiz' ? '❓' : '📄')
export function ResourcePreview({ resource, onClose }: { resource: ResourceView; onClose: () => void }) {
  const [url, setUrl] = useState(''),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setUrl('')
    setError('')
    if (resource.external_url) {
      setUrl(resource.external_url)
      return
    }
    if (resource.storage_path)
      void resourceRepository
        .preview(resource.storage_path)
        .then((value) => {
          if (active) setUrl(value)
        })
        .catch((e) => {
          if (active) setError(errorMessage(e))
        })
    return () => {
      active = false
    }
  }, [resource.id, revision])
  return (
    <Modal onClose={onClose}>
      <h3 className="font-bold text-lg mb-3">{resource.name}</h3>
      <ErrorNotice error={error} retry={() => setRevision((n) => n + 1)} />
      {!url && !error && <p role="status">Đang mở tài liệu…</p>}
      {url && !resource.external_url && resource.mime_type === 'application/pdf' && (
        <iframe title={resource.name} src={url} className="w-full h-[55vh] rounded-xl" />
      )}
      {url && !resource.external_url && resource.mime_type?.startsWith('image/') && (
        <img src={url} alt={resource.name} className="w-full max-h-[55vh] object-contain rounded-xl" />
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-p inline-block mt-3">
          {resource.external_url ? 'Mở liên kết' : 'Mở / tải xuống'}
        </a>
      )}
      {resource.storage_path && (
        <button className="btn btn-o ml-2 mt-3" onClick={() => setRevision((n) => n + 1)}>
          Làm mới liên kết
        </button>
      )}
      <button className="btn btn-o ml-2 mt-3" onClick={onClose}>
        Đóng
      </button>
    </Modal>
  )
}
function UploadModal({ onClose, sessionId = '' }: { onClose: () => void; sessionId?: string }) {
  const { data, action, busy, error: operationError } = useWorkspace(),
    [session, setSession] = useState(sessionId),
    [kind, setKind] = useState<'doc' | 'quiz'>('doc'),
    [name, setName] = useState(''),
    [mode, setMode] = useState<'file' | 'link'>('file'),
    [file, setFile] = useState<File | null>(null),
    [link, setLink] = useState(''),
    [error, setError] = useState('')
  const sessions =
    data?.sessions.filter((s) => ['proposed', 'scheduled', 'in_progress'].includes(s.status)) ?? []
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!session || !name.trim()) {
      setError('Chọn buổi học và đặt tên tài liệu')
      return
    }
    if (mode === 'file' && !file) {
      setError('Hãy chọn một tệp')
      return
    }
    if (
      await action(
        () =>
          mode === 'file'
            ? resourceRepository.upload(session, file!, undefined, { name, kind })
            : resourceRepository.addLink(session, name, link, kind),
        'Đã thêm tài liệu vào buổi học'
      )
    )
      onClose()
  }
  return (
    <Modal onClose={onClose}>
      <form onSubmit={save}>
        <h3 className="text-xl font-extrabold mb-4">Thêm vào ngân hàng</h3>
        <ErrorNotice error={error || operationError} />
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-matcha-soft">
            {(
              [
                ['doc', '📄 Tài liệu'],
                ['quiz', '❓ Quiz'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full py-2 font-semibold ${kind === k ? 'bg-forest text-cream' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block font-medium">
            Tên hiển thị
            <input
              required
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên tài liệu hoặc Quiz"
            />
          </label>
          <label className="block font-medium">
            Buổi học
            <select
              required
              disabled={Boolean(sessionId)}
              value={session}
              onChange={(e) => setSession(e.target.value)}
            >
              <option value="">Chọn buổi học chia sẻ tài liệu</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.subjectName} · {displayDate(s.starts_at)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div className="flex gap-2 mb-2">
              {(
                [
                  ['file', 'Tải tệp lên'],
                  ['link', 'Dán liên kết'],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={`chip ${mode === value ? 'on' : ''}`}
                  onClick={() => setMode(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'file' ? (
              <label className="block border-2 border-dashed border-matcha rounded-2xl p-5 text-center cursor-pointer hover:bg-matcha-soft/50">
                <input
                  type="file"
                  hidden
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setFile(f)
                      if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
                    }
                  }}
                />
                {file ? (
                  <b>{file.name}</b>
                ) : (
                  <span className="opacity-70">Chạm để chọn tệp (PDF, Word, PPT, ảnh · tối đa 10MB)</span>
                )}
              </label>
            ) : (
              <input
                type="url"
                required
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://… (Google Drive, Forms, Quizlet…)"
              />
            )}
          </div>
          {!sessions.length && (
            <p className="text-sm opacity-70">Cần tạo một buổi học trước khi chia sẻ tài liệu.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-o" onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn-p disabled:opacity-60" disabled={busy || !sessions.length}>
            {busy ? 'Đang tải lên…' : 'Lưu vào ngân hàng'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function LibraryScreen() {
  const { data, action, busy } = useWorkspace(),
    { p } = useProfile(),
    navigate = useNavigate(),
    [tab, setTab] = useState<'all' | 'doc' | 'quiz'>('all'),
    [query, setQuery] = useState(''),
    [upload, setUpload] = useState(false),
    [remove, setRemove] = useState<ResourceView | null>(null),
    [preview, setPreview] = useState<ResourceView | null>(null)
  const library = data?.resources ?? [],
    list = library.filter(
      (r) =>
        (tab === 'all' || r.kind === tab) &&
        (r.name + (r.subjectName ?? '')).toLowerCase().includes(query.toLowerCase())
    )
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="text-3xl font-extrabold">Ngân hàng tài liệu</h1>
          <p className="opacity-70">Tài liệu và Quiz dùng chung theo từng buổi học.</p>
        </div>
        <button className="btn btn-p" onClick={() => setUpload(true)}>
          + Tải lên
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {(
          [
            ['all', 'Tất cả'],
            ['doc', 'Tài liệu'],
            ['quiz', 'Quiz'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
        <input
          className="max-w-xs ml-auto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hoặc môn…"
        />
      </div>
      {!list.length ? (
        <Empty
          title={library.length ? 'Không tìm thấy tài liệu nào' : 'Ngân hàng đang trống'}
          description={
            library.length
              ? 'Thử từ khóa hoặc bộ lọc khác nhé.'
              : 'Tải lên tài liệu hoặc Quiz đầu tiên để cùng học.'
          }
          action="Tải lên ngay"
          onAction={() => setUpload(true)}
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.map((r) => (
            <div key={r.id} className="card p-4 hover:-translate-y-0.5 transition">
              <div className="flex gap-3">
                <div
                  className={`w-11 h-11 rounded-2xl grid place-items-center text-xl shrink-0 ${r.kind === 'quiz' ? 'bg-caramel/25' : 'bg-matcha-soft'}`}
                >
                  {icon(r.kind)}
                </div>
                <div className="flex-1 min-w-0">
                  <b className="block truncate">{r.name}</b>
                  <p className="text-xs opacity-60">
                    {r.kind === 'quiz' ? 'Quiz' : 'Tài liệu'} · {r.subjectName}
                  </p>
                  <p className="text-xs opacity-60">
                    {r.uploaderName ?? 'Hồ sơ không còn khả dụng'} · {displayDate(r.created_at, p.timezone)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3 justify-end">
                <button className="btn btn-o text-xs !py-1.5" onClick={() => setPreview(r)}>
                  Mở
                </button>
                <button
                  disabled={
                    busy ||
                    !data?.sessions.some(
                      (s) =>
                        s.id === r.session_id && ['proposed', 'scheduled', 'in_progress'].includes(s.status)
                    )
                  }
                  className={`btn ${r.attached ? 'btn-s' : 'btn-p'} text-xs !py-1.5`}
                  onClick={() => {
                    void action(
                      () => rpc('attach_resource', { resource: r.id, attached: !r.attached }),
                      r.attached ? 'Đã gỡ khỏi Study Room' : 'Đã gắn vào Study Room'
                    )
                  }}
                >
                  {r.attached ? '✓ Đã gắn · Gỡ' : 'Gắn vào Study Room'}
                </button>
                <button
                  className="btn btn-o text-xs !py-1.5"
                  onClick={() => navigate(`/sessions/${r.session_id}`)}
                >
                  Study Room
                </button>
                {r.uploader_id === p.id && (
                  <button className="btn btn-o text-xs !py-1.5 text-red-700" onClick={() => setRemove(r)}>
                    Xóa
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {upload && <UploadModal onClose={() => setUpload(false)} />}{' '}
      {preview && <ResourcePreview resource={preview} onClose={() => setPreview(null)} />}{' '}
      {remove && (
        <Modal onClose={() => setRemove(null)}>
          <h3 className="font-bold text-lg">Xóa “{remove.name}”?</h3>
          <p className="text-sm opacity-70 my-2">Tài liệu sẽ được xóa khỏi buổi học.</p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-o" onClick={() => setRemove(null)}>
              Giữ lại
            </button>
            <button
              disabled={busy}
              className="btn btn-p"
              onClick={async () => {
                if (await action(() => resourceRepository.remove(remove.id), 'Đã xóa tài liệu'))
                  setRemove(null)
              }}
            >
              Xóa
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
export function RoomResources({
  sessionId,
  resources,
  editable,
}: {
  sessionId: string
  resources: ResourceView[]
  editable: boolean
}) {
  const { action, busy } = useWorkspace(),
    [pick, setPick] = useState(false),
    [upload, setUpload] = useState(false),
    [query, setQuery] = useState(''),
    [preview, setPreview] = useState<ResourceView | null>(null),
    on = resources.filter((r) => r.attached),
    rest = resources.filter((r) => !r.attached && r.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="card p-5">
      <div className="flex items-center mb-2">
        <h3 className="font-bold flex-1">Tài liệu & Quiz</h3>
        {editable && (
          <button className="btn btn-s text-xs !py-1.5" onClick={() => setPick(true)}>
            + Gắn từ ngân hàng
          </button>
        )}
      </div>
      {on.length ? (
        on.map((r) => (
          <div key={r.id} className="flex items-center gap-2 py-2 border-b border-line last:border-0">
            <span>{icon(r.kind)}</span>
            <span className="flex-1 text-sm truncate">{r.name}</span>
            <button className="text-xs underline text-forest" onClick={() => setPreview(r)}>
              Mở
            </button>
            {editable && (
              <button
                disabled={busy}
                className="text-xs opacity-60 underline"
                onClick={() => {
                  void action(
                    () => rpc('attach_resource', { resource: r.id, attached: false }),
                    'Đã gỡ tài liệu'
                  )
                }}
              >
                Gỡ
              </button>
            )}
          </div>
        ))
      ) : (
        <p className="text-sm opacity-60">Chưa có tài liệu nào. Gắn từ ngân hàng để cả hai cùng xem.</p>
      )}
      <p className="text-[11px] opacity-50 mt-2">Chỉ hai người tham gia buổi học có quyền truy cập.</p>
      {pick && (
        <Modal onClose={() => setPick(false)}>
          <h3 className="text-xl font-extrabold mb-3">Gắn vào Study Room</h3>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tài liệu…" />
          <div className="mt-3 space-y-1">
            {rest.map((r) => (
              <button
                key={r.id}
                disabled={busy}
                className="w-full text-left flex gap-3 items-center p-3 rounded-2xl hover:bg-matcha-soft"
                onClick={() => {
                  void action(
                    () => rpc('attach_resource', { resource: r.id, attached: true }),
                    'Đã gắn tài liệu'
                  )
                }}
              >
                <span>{icon(r.kind)}</span>
                <span className="flex-1">
                  <b className="text-sm">{r.name}</b>
                </span>
                <span className="text-forest text-sm font-semibold">Gắn</span>
              </button>
            ))}
            {!rest.length && <p className="text-sm opacity-60 p-3">Không còn mục nào để gắn.</p>}
          </div>
          <div className="flex justify-between mt-4">
            <button
              className="text-sm underline text-forest"
              onClick={() => {
                setPick(false)
                setUpload(true)
              }}
            >
              Tải lên mục mới
            </button>
            <button className="btn btn-p" onClick={() => setPick(false)}>
              Xong
            </button>
          </div>
        </Modal>
      )}
      {upload && <UploadModal sessionId={sessionId} onClose={() => setUpload(false)} />}{' '}
      {preview && <ResourcePreview resource={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
