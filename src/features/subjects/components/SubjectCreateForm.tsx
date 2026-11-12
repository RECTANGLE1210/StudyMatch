import { useEffect, useRef, useState } from 'react'
import { profileService } from '../../profile/services/profileService'
import { subjectNameKey, subjectCodeKey } from '../domain/subjectIdentity'
import { ErrorNotice } from '../../../components/shared/Feedback'
import { errorMessage } from '../../../lib/utils/errors'
import type { CatalogSubject } from '../../../types/product'
export function SubjectCreateForm({
  initialName,
  have,
  onPick,
  onCancel,
}: {
  initialName: string
  have: string[]
  onPick: (subject: CatalogSubject) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName),
    [code, setCode] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [existing, setExisting] = useState<CatalogSubject | null>(null)
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const find = (items: CatalogSubject[]) =>
    items.find(
      (subject) =>
        subjectNameKey(subject.name) === subjectNameKey(name) ||
        Boolean(subjectCodeKey(code) && subjectCodeKey(subject.code) === subjectCodeKey(code))
    )
  const alreadyAdded =
    existing && have.some((value) => subjectNameKey(value) === subjectNameKey(existing.name))
  return (
    <form
      className="space-y-3 mt-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        setExisting(null)
        try {
          const duplicate = find(await profileService.subjects())
          if (!active.current) return
          if (duplicate) {
            setExisting(duplicate)
            setError('Môn học đã tồn tại trong cơ sở dữ liệu, không thể thêm mới. Hãy chọn môn có sẵn.')
            return
          }
          const created = await profileService.createSubject(name, code)
          if (active.current) onPick(created)
        } catch (e) {
          if (active.current) {
            const failure = e as { code?: string; message?: string }
            setError(
              failure.code === 'PGRST202' && failure.message?.includes('create_subject')
                ? 'Chức năng tạo môn mới chưa được bật trên máy chủ. Vui lòng thử lại sau.'
                : errorMessage(e)
            )
            if (failure.code === '23505')
              try {
                const duplicate = find(await profileService.subjects())
                if (active.current) setExisting(duplicate ?? null)
              } catch {}
          }
        } finally {
          if (active.current) setBusy(false)
        }
      }}
    >
      <h4 className="font-bold">Tự bổ sung môn học</h4>
      <p className="text-xs opacity-70">
        Chỉ tạo môn chưa có trong danh mục chung. Môn mới sẽ có sẵn cho mọi người chọn.
      </p>
      <label className="block text-sm font-medium">
        Tên môn học
        <input
          required
          maxLength={200}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setExisting(null)
            setError('')
          }}
          placeholder="Ví dụ: Phân tích dữ liệu nâng cao"
        />
      </label>
      <label className="block text-sm font-medium">
        Mã môn học (không bắt buộc)
        <input
          maxLength={80}
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setExisting(null)
            setError('')
          }}
          placeholder="Ví dụ: IT1234"
        />
      </label>
      <ErrorNotice error={error} />
      {existing && (
        <div className="rounded-xl bg-matcha-soft p-3 text-sm">
          <b>{existing.name}</b>
          <p className="opacity-70">{existing.code}</p>
          {alreadyAdded ? (
            <p>Môn này đã có trong hồ sơ của bạn.</p>
          ) : (
            <button type="button" className="btn btn-s mt-2" disabled={busy} onClick={() => onPick(existing)}>
              Chọn môn có sẵn
            </button>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-o" disabled={busy} onClick={onCancel}>
          Quay lại danh sách
        </button>
        <button className="btn btn-p" disabled={busy || !subjectNameKey(name)}>
          {busy ? 'Đang kiểm tra…' : 'Tạo môn mới'}
        </button>
      </div>
    </form>
  )
}
