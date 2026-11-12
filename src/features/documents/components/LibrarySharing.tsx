import { useEffect, useState } from 'react'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { Modal, ErrorNotice } from '../../../components/shared/Feedback'
import {
  libraryRepository,
  type LibrarySharing as Sharing,
  type LibraryUser,
} from '../repositories/libraryRepository'
import { errorMessage } from '../../../lib/utils/errors'
import type { ResourceView } from '../../../types/product'
export function LibrarySharing({
  resource,
  onChange,
  onClose,
}: {
  resource: ResourceView
  onChange: () => Promise<void>
  onClose: () => void
}) {
  const { action, busy, error: operationError } = useWorkspace()
  const [sharing, setSharing] = useState<Sharing | null>(null),
    [visibility, setVisibility] = useState<'restricted' | 'public'>('restricted'),
    [query, setQuery] = useState(''),
    [users, setUsers] = useState<LibraryUser[]>([]),
    [error, setError] = useState('')
  const load = async () => {
    const result = await libraryRepository.sharing(resource.id)
    setSharing(result)
    setVisibility(result.visibility)
  }
  useEffect(() => {
    let active = true
    void libraryRepository
      .sharing(resource.id)
      .then((value) => {
        if (active) {
          setSharing(value)
          setVisibility(value.visibility)
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
    return () => {
      active = false
    }
  }, [resource.id])
  useEffect(() => {
    let active = true
    setUsers([])
    if (query.trim().length < 2) return
    const timer = window.setTimeout(() => {
      void libraryRepository
        .users(query)
        .then((value) => {
          if (active) {
            setUsers(value)
            setError('')
          }
        })
        .catch((e) => {
          if (active) setError(errorMessage(e))
        })
    }, 250)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])
  const run = async (operation: () => Promise<unknown>) => {
    try {
      if (await action(operation, 'Đã cập nhật quyền tài liệu')) {
        await load()
        await onChange()
      }
    } catch (e) {
      setError(errorMessage(e))
    }
  }
  return (
    <Modal onClose={onClose}>
      <h3 className="text-xl font-bold mb-3">Chia sẻ “{resource.name}”</h3>
      <ErrorNotice error={error || operationError} />
      {sharing ? (
        <div className="space-y-4 text-sm">
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
          <button
            className="btn btn-s"
            disabled={busy || visibility === sharing.visibility}
            onClick={() => {
              void run(() => libraryRepository.visibility(resource.id, visibility))
            }}
          >
            Lưu quyền truy cập
          </button>
          <label className="block font-medium">
            Cấp quyền cho người dùng
            <input
              maxLength={100}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên hiển thị…"
            />
          </label>
          {users
            .filter((user) => !sharing.grants.some((grant) => grant.id === user.id))
            .map((user) => (
              <div key={user.id} className="flex gap-2 items-center">
                <span className="flex-1">{user.name}</span>
                <button
                  className="btn btn-s"
                  disabled={busy}
                  onClick={() => {
                    void run(() => libraryRepository.grant(resource.id, user.id, true))
                    setQuery('')
                  }}
                >
                  Cấp quyền cho {user.name}
                </button>
              </div>
            ))}
          <h4 className="font-bold">Người được cấp quyền trực tiếp</h4>
          {sharing.grants.map((user) => (
            <div key={user.id} className="flex items-center gap-2">
              <span className="flex-1">{user.name}</span>
              <button
                className="btn btn-o"
                disabled={busy}
                onClick={() => {
                  void run(() => libraryRepository.grant(resource.id, user.id, false))
                }}
              >
                Thu hồi quyền của {user.name}
              </button>
            </div>
          ))}
          {!sharing.grants.length && <p className="opacity-60">Chưa cấp quyền trực tiếp cho ai.</p>}
          <p className="opacity-70">
            Đã gắn vào {sharing.attachmentCount} buổi học. Thành viên các buổi đó vẫn được xem dù bị thu hồi
            quyền trực tiếp.
          </p>
          {sharing.attachmentCount > 0 && (
            <button
              className="btn btn-o"
              disabled={busy}
              onClick={() => {
                void run(() => libraryRepository.clearAttachments(resource.id))
              }}
            >
              Gỡ khỏi mọi buổi học
            </button>
          )}
          <p className="text-xs opacity-60">
            Người có quyền xem được gắn tài liệu vào buổi học họ tham gia. Liên kết tải đã cấp có hiệu lực tối
            đa 60 giây.
          </p>
        </div>
      ) : (
        <p role="status">Đang tải quyền chia sẻ…</p>
      )}
      <button
        className="btn btn-o mt-4 mr-2"
        disabled={busy}
        onClick={() => {
          void load().catch((e) => setError(errorMessage(e)))
        }}
      >
        Làm mới quyền
      </button>
      <button className="btn btn-p mt-4" onClick={onClose}>
        Đóng
      </button>
    </Modal>
  )
}
export function LibraryAttach({
  resource,
  onSaved,
  onClose,
}: {
  resource: ResourceView
  onSaved: () => Promise<void>
  onClose: () => void
}) {
  const { data, action, busy, error } = useWorkspace(),
    [session, setSession] = useState('')
  const sessions =
    data?.sessions.filter((s) => ['proposed', 'scheduled', 'in_progress'].includes(s.status)) ?? []
  return (
    <Modal onClose={onClose}>
      <h3 className="text-xl font-bold mb-3">Gắn tài liệu vào buổi học</h3>
      <ErrorNotice error={error} />
      <label>
        Buổi học
        <select value={session} onChange={(e) => setSession(e.target.value)}>
          <option value="">Chọn buổi học</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.subjectName}
              {resource.session_ids?.includes(s.id) ? ' · Đã gắn' : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm opacity-70 mt-3">
        Cả hai người tham gia buổi học sẽ được quyền xem tài liệu này.
      </p>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-o" onClick={onClose}>
          Hủy
        </button>
        <button
          className="btn btn-p"
          disabled={busy || !session || resource.session_ids?.includes(session)}
          onClick={async () => {
            if (
              await action(
                () => libraryRepository.attach(resource.id, session),
                'Đã gắn tài liệu và cấp quyền cho bạn học'
              )
            ) {
              await onSaved()
              onClose()
            }
          }}
        >
          Gắn
        </button>
      </div>
    </Modal>
  )
}
