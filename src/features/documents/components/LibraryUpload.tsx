import { useState } from 'react'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { Modal, ErrorNotice } from '../../../components/shared/Feedback'
import { libraryRepository } from '../repositories/libraryRepository'
import { displayDate } from '../../../lib/utils/dates'
export function LibraryUpload({
  sessionId = '',
  onSaved,
  onClose,
}: {
  sessionId?: string
  onSaved: () => Promise<void>
  onClose: () => void
}) {
  const { data, action, busy, error } = useWorkspace()
  const [kind, setKind] = useState<'doc' | 'quiz'>('doc'),
    [name, setName] = useState(''),
    [subject, setSubject] = useState('')
  const [visibility, setVisibility] = useState<'restricted' | 'public'>('restricted'),
    [session, setSession] = useState(sessionId)
  const [mode, setMode] = useState<'file' | 'link'>('file'),
    [file, setFile] = useState<File | null>(null),
    [link, setLink] = useState('')
  const sessions =
    data?.sessions.filter((s) => ['proposed', 'scheduled', 'in_progress'].includes(s.status)) ?? []
  return (
    <Modal onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          const input = { name, kind, subject, visibility, sessionId: session }
          if (
            await action(
              () =>
                mode === 'file'
                  ? libraryRepository.upload(file!, input)
                  : libraryRepository.addLink(link, input),
              'Đã lưu vào ngân hàng tài liệu'
            )
          ) {
            await onSaved()
            onClose()
          }
        }}
      >
        <h3 className="text-xl font-extrabold mb-4">Thêm vào ngân hàng</h3>
        <ErrorNotice error={error} />
        <div className="space-y-4 text-sm">
          <div className="flex gap-2">
            {(['doc', 'quiz'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`chip ${kind === value ? 'on' : ''}`}
                onClick={() => setKind(value)}
              >
                {value === 'doc' ? '📄 Tài liệu' : '❓ Quiz'}
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
            Môn học (không bắt buộc)
            <input maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </label>
          <label className="block font-medium">
            Quyền truy cập
            <select
              aria-label="Quyền truy cập"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as typeof visibility)}
            >
              <option value="restricted">Chỉ tôi và người được cấp quyền</option>
              <option value="public">Công khai với tài khoản StudyMatch</option>
            </select>
          </label>
          <p className="text-xs opacity-70">
            Có thể cấp quyền cho người cụ thể sau khi lưu. Khi gắn vào buổi học, cả hai người tham gia được
            xem.
          </p>
          {(sessions.length > 0 || sessionId) && (
            <label className="block font-medium">
              Gắn vào buổi học (không bắt buộc)
              <select
                value={session}
                disabled={Boolean(sessionId)}
                onChange={(e) => setSession(e.target.value)}
              >
                <option value="">Chưa gắn · Chỉ lưu vào ngân hàng</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.subjectName} · {displayDate(s.starts_at)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex gap-2">
            {(['file', 'link'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`chip ${mode === value ? 'on' : ''}`}
                onClick={() => setMode(value)}
              >
                {value === 'file' ? 'Tải tệp lên' : 'Dán liên kết'}
              </button>
            ))}
          </div>
          {mode === 'file' ? (
            <label className="block border-2 border-dashed border-matcha rounded-2xl p-5 text-center cursor-pointer">
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const selected = e.target.files?.[0]
                  if (selected) {
                    setFile(selected)
                    if (!name) setName(selected.name.replace(/\.[^.]+$/, ''))
                  }
                }}
              />
              {file ? <b>{file.name}</b> : 'Chọn tệp (PDF, Word, PPT, ảnh · tối đa 10MB)'}
            </label>
          ) : (
            <input
              required
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://… (Google Drive, Forms, Quizlet…)"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn btn-o" onClick={onClose}>
            Hủy
          </button>
          <button
            className="btn btn-p disabled:opacity-60"
            disabled={busy || !name.trim() || (mode === 'file' && !file)}
          >
            {busy ? 'Đang tải lên…' : 'Lưu vào ngân hàng'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
