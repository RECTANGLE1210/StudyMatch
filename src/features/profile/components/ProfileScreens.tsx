import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useProfile } from '../hooks/ProfileProvider'
import { profileService } from '../services/profileService'
import { SubjectCreateForm } from '../../subjects/components/SubjectCreateForm'
import { subjectNameKey, subjectCodeKey } from '../../subjects/domain/subjectIdentity'
import { catalogRepository } from '../../subjects/repositories/catalogRepository'
import { scoreProfiles } from '../../matching/services/scoreProfiles'
import { ErrorNotice } from '../../../components/shared/Feedback'
import { errorMessage } from '../../../lib/utils/errors'
import type { ProfileView as Profile, SubjectProfile as Subj, Level } from '../../../types/product'
export const LEVELS: Level[] = ['Mới bắt đầu', 'Trung bình', 'Nâng cao']
export const GOALS = [
  'Cùng giải bài tập',
  'Ôn lý thuyết qua môn',
  'Luyện đề đạt A/A+',
  'Chuẩn bị thi cuối kỳ',
]
export const STYLES = ['Thảo luận sôi nổi', 'Pomodoro yên tĩnh', 'Hỏi đáp nhanh phần khó']
export const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const DAY_FULL: Record<string, string> = {
  T2: 'Thứ 2',
  T3: 'Thứ 3',
  T4: 'Thứ 4',
  T5: 'Thứ 5',
  T6: 'Thứ 6',
  T7: 'Thứ 7',
  CN: 'Chủ Nhật',
}
export const SLOTS = ['Sáng', 'Chiều', 'Tối']
const loadUnis = async () => (await catalogRepository.universities()).map((v) => v.name)
const loadMajors = async () => (await catalogRepository.majors()).map((v) => v.name)
type CatalogView = { name: string; code: string; topics: string[] }
const loadSubjects = async (): Promise<CatalogView[]> =>
  (await profileService.subjects()).map((s) => ({ ...s, topics: s.topics.map((t) => t.name) }))
function useDirty(key: string, value: boolean) {
  const { dirty } = useProfile()
  useEffect(() => {
    dirty.current[key] = value
    return () => {
      dirty.current[key] = false
    }
  }, [key, value, dirty])
}

/* ---------- small UI ---------- */
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-espresso/40 flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="card pop p-5 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto !rounded-b-none md:!rounded-b-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
export function Avatar({ src, name, size = 44 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full grid place-items-center shrink-0 bg-matcha-soft text-forest border border-dashed border-matcha"
      style={{ width: size, height: size }}
    >
      👤
    </div>
  )
}
function Pick({
  items,
  sel,
  on,
  tone = 'forest',
}: {
  items: string[]
  sel: string[]
  on: (i: string) => void
  tone?: 'forest' | 'caramel'
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <button
          type="button"
          key={i}
          onClick={() => on(i)}
          className={`chip ${sel.includes(i) ? (tone === 'forest' ? 'on' : '!bg-caramel !text-espresso !border-caramel font-semibold') : ''}`}
        >
          {sel.includes(i) ? '✓ ' : ''}
          {i}
        </button>
      ))}
    </div>
  )
}
const tog = (a: string[], i: string) => (a.includes(i) ? a.filter((x) => x !== i) : [...a, i])
function Sec({
  title,
  sub,
  action,
  children,
}: {
  title: string
  sub?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1">
          <h3 className="font-bold text-lg">{title}</h3>
          {sub && <p className="text-xs opacity-60">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
const Tag = ({ children, c = 'matcha' }: { children: ReactNode; c?: 'matcha' | 'caramel' | 'plain' }) => (
  <span
    className={`text-xs rounded-full px-2.5 py-1 ${c === 'matcha' ? 'bg-matcha-soft text-forest' : c === 'caramel' ? 'bg-caramel/20' : 'border border-line'}`}
  >
    {children}
  </span>
)

function Combo({
  value,
  onChange,
  load,
  placeholder,
  err,
}: {
  value: string
  onChange: (v: string) => void
  load: () => Promise<string[]>
  placeholder: string
  err?: string
}) {
  const [items, setItems] = useState<string[] | null>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(value)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void load()
      .then((v) => {
        if (active) setItems(v)
      })
      .catch((e) => {
        if (active) {
          setItems([])
          setError(errorMessage(e))
        }
      })
    return () => {
      active = false
    }
  }, [load])
  useEffect(() => setQ(value), [value])
  const f = (items || []).filter((i) => i.toLowerCase().includes(q.toLowerCase()))
  const pick = (v: string) => {
    onChange(v)
    setQ(v)
    setOpen(false)
  }
  return (
    <div className="relative">
      <input
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget)) setOpen(false)
        }}
        style={err ? { borderColor: '#b3402f' } : undefined}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full card !rounded-2xl p-1 max-h-48 overflow-y-auto">
          {!items ? (
            <p className="p-3 text-sm opacity-60 animate-pulse">Đang tải danh sách…</p>
          ) : (
            <>
              {f.map((i) => (
                <button
                  type="button"
                  key={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(i)}
                  className="block w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-matcha-soft"
                >
                  {i}
                </button>
              ))}
              {q.trim() && !items.some((i) => i.toLowerCase() === q.trim().toLowerCase()) && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(q.trim())}
                  className="block w-full text-left px-3 py-2 rounded-xl text-sm text-forest font-semibold hover:bg-matcha-soft"
                >
                  + Dùng “{q.trim()}”
                </button>
              )}
              {!f.length && !q.trim() && <p className="p-3 text-sm opacity-60">Không có dữ liệu</p>}
            </>
          )}
        </div>
      )}
      {(err || error) && (
        <p role="alert" className="text-xs text-red-700 mt-1">
          {err || error}
        </p>
      )}
    </div>
  )
}

/* ---------- avatar ---------- */
function AvatarEditor({
  value,
  onChange,
  name,
}: {
  value: string | null
  onChange: (v: string | null, path?: string | null) => void
  name: string
}) {
  const { p, googleAvatar: GOOGLE_AVATAR } = useProfile()
  const [st, setSt] = useState<'idle' | 'load' | 'err'>('idle')
  const ref = useRef<HTMLInputElement>(null)
  const file = async (f?: File) => {
    if (!f) return
    setSt('load')
    try {
      const uploaded = await profileService.uploadAvatar(f, p.id)
      onChange(uploaded.url, uploaded.path)
      setSt('idle')
    } catch {
      setSt('err')
    }
  }
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="relative">
        {st === 'load' ? (
          <div className="w-24 h-24 rounded-full bg-matcha-soft animate-pulse grid place-items-center text-xs">
            Đang tải…
          </div>
        ) : (
          <Avatar src={value} name={name} size={96} />
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-s text-sm" onClick={() => ref.current?.click()}>
            {value && value !== GOOGLE_AVATAR ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </button>
          {value !== GOOGLE_AVATAR && (
            <button
              type="button"
              className="btn btn-o text-sm"
              onClick={() => {
                onChange(GOOGLE_AVATAR, null)
                setSt('idle')
              }}
            >
              Dùng ảnh Google
            </button>
          )}
          {value && (
            <button
              type="button"
              className="btn btn-o text-sm"
              onClick={() => {
                onChange(null, null)
                setSt('idle')
              }}
            >
              Xóa ảnh
            </button>
          )}
        </div>
        {st === 'err' ? (
          <p className="text-xs text-red-700">Không tải được ảnh. Hãy chọn ảnh JPG/PNG dưới 2MB.</p>
        ) : (
          <p className="text-xs opacity-60">Mặc định lấy từ tài khoản Google. Ảnh JPG/PNG, tối đa 2MB.</p>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            file(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

type Ident = Pick<Profile, 'name' | 'uni' | 'major' | 'bio' | 'avatar' | 'avatarPath'>
const MAXBIO = 200
const identErr = (d: Ident) => ({
  name: d.name.trim() ? '' : 'Bạn nhớ đặt một cái tên nhé',
  uni: d.uni.trim() ? '' : 'Hãy chọn trường của bạn',
  major: d.major.trim() ? '' : 'Hãy chọn ngành học',
})
function IdentityFields({ d, setD, show }: { d: Ident; setD: (d: Ident) => void; show: boolean }) {
  const e = show ? identErr(d) : { name: '', uni: '', major: '' }
  return (
    <div className="space-y-4">
      <AvatarEditor
        value={d.avatar}
        onChange={(v, path) => setD({ ...d, avatar: v, avatarPath: path ?? null })}
        name={d.name}
      />
      <label className="block text-sm font-medium">
        Tên hiển thị
        <input
          value={d.name}
          onChange={(x) => setD({ ...d, name: x.target.value })}
          maxLength={30}
          placeholder="Tên các bạn học sẽ thấy"
          style={e.name ? { borderColor: '#b3402f' } : undefined}
        />
        {e.name && <span className="text-xs text-red-700">{e.name}</span>}
      </label>
      <div className="text-sm font-medium">
        Trường đại học
        <Combo
          value={d.uni}
          onChange={(v) => setD({ ...d, uni: v })}
          load={loadUnis}
          placeholder="Tìm trường của bạn…"
          err={e.uni}
        />
      </div>
      <div className="text-sm font-medium">
        Ngành học
        <Combo
          value={d.major}
          onChange={(v) => setD({ ...d, major: v })}
          load={loadMajors}
          placeholder="Tìm ngành hoặc tự nhập…"
          err={e.major}
        />
      </div>
      <label className="block text-sm font-medium">
        Giới thiệu bản thân <span className="opacity-50 font-normal">(không bắt buộc)</span>
        <textarea
          rows={4}
          value={d.bio}
          maxLength={MAXBIO}
          onChange={(x) => setD({ ...d, bio: x.target.value })}
          placeholder="Bạn thích học thế nào? Đang tìm bạn ôn môn gì? Kể một chút nhé…"
        />
        <span className="text-xs opacity-50 float-right">
          {d.bio.length}/{MAXBIO}
        </span>
      </label>
    </div>
  )
}

/* ---------- subjects ---------- */
function SubjectEditor({
  init,
  isNew,
  onSave,
  onClose,
  onRemove,
}: {
  init: Subj
  isNew: boolean
  onSave: (s: Subj) => void
  onClose: () => void
  onRemove: () => void
}) {
  const [d, setD] = useState(init)
  const [extra, setExtra] = useState<string[]>([])
  const [nt, setNt] = useState('')
  const [rm, setRm] = useState(false)
  const [catTopics, setCat] = useState<string[]>([])
  const [catalogError, setCatalogError] = useState('')
  const { error: saveError, saving } = useProfile()
  useEffect(() => {
    let active = true
    void loadSubjects()
      .then((c) => {
        if (active) setCat(c.find((s) => s.name === init.name)?.topics || [])
      })
      .catch((e) => {
        if (active) setCatalogError(errorMessage(e))
      })
    return () => {
      active = false
    }
  }, [init.name])
  const topics = Array.from(new Set([...catTopics, ...init.strong, ...init.weak, ...extra]))
  const set = (k: 'strong' | 'weak', t: string) => {
    const o = k === 'strong' ? 'weak' : 'strong'
    setD({ ...d, [k]: tog(d[k], t), [o]: d[o].filter((x) => x !== t) })
  }
  const dirty = JSON.stringify(d) !== JSON.stringify(init)
  return (
    <Modal onClose={() => (dirty ? null : onClose())}>
      <ErrorNotice error={catalogError} />
      <p className="text-xs opacity-60">{d.code || 'Môn tự thêm'}</p>
      <h3 className="text-xl font-extrabold mb-4">{d.name}</h3>
      <div className="space-y-4">
        <div>
          <b className="text-sm">Trình độ môn này</b>
          <div className="grid grid-cols-3 gap-1 mt-2 p-1 rounded-full bg-matcha-soft">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setD({ ...d, level: l })}
                className={`rounded-full py-2 text-xs font-semibold transition ${d.level === l ? 'bg-forest text-cream' : ''}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div>
          <b className="text-sm">Phần mình vững</b>
          <div className="mt-2">
            <Pick items={topics} sel={d.strong} on={(t) => set('strong', t)} />
          </div>
        </div>
        <div>
          <b className="text-sm">Phần mình còn yếu</b>
          <div className="mt-2">
            <Pick tone="caramel" items={topics} sel={d.weak} on={(t) => set('weak', t)} />
          </div>
        </div>
        <p className="text-xs opacity-60">
          Mỗi chủ đề chỉ nằm ở một nhóm: chọn sang nhóm kia thì nhóm cũ sẽ tự bỏ.
        </p>
        <div className="flex gap-2">
          <input value={nt} onChange={(e) => setNt(e.target.value)} placeholder="Thêm chủ đề khác…" />
          <button
            type="button"
            className="btn btn-s shrink-0"
            onClick={() => {
              if (nt.trim()) {
                setExtra([...extra, nt.trim()])
                setNt('')
              }
            }}
          >
            Thêm
          </button>
        </div>
        {!d.strong.length && !d.weak.length && (
          <p className="text-xs bg-caramel/15 rounded-xl p-3">
            Chọn ít nhất một chủ đề để StudyMatch gợi ý bạn học bổ trợ chính xác hơn.
          </p>
        )}
      </div>
      {rm ? (
        <div className="mt-5 bg-red-50 rounded-2xl p-4 text-sm">
          <b>Xóa “{d.name}” khỏi hồ sơ?</b>
          <p className="my-1 opacity-70">Các chủ đề mạnh/yếu của môn này cũng sẽ bị xóa.</p>
          <div className="flex gap-2 justify-end">
            <button className="btn btn-o" onClick={() => setRm(false)}>
              Giữ lại
            </button>
            <button className="btn btn-p" onClick={onRemove}>
              Xóa môn
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-5 items-center">
          {!isNew && (
            <button
              type="button"
              className="text-sm text-red-700 underline mr-auto"
              onClick={() => setRm(true)}
            >
              Xóa môn
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn btn-o" onClick={onClose}>
            {dirty ? 'Bỏ thay đổi' : 'Đóng'}
          </button>
          <button type="button" className="btn btn-p" disabled={saving} onClick={() => onSave(d)}>
            {isNew ? 'Thêm môn' : 'Lưu'}
          </button>
        </div>
      )}
    </Modal>
  )
}
function SubjectPicker({
  have,
  onPick,
  onClose,
}: {
  have: string[]
  onPick: (s: { name: string; code: string }) => void
  onClose: () => void
}) {
  const [cat, setCat] = useState<CatalogView[] | null>(null)
  const [q, setQ] = useState('')
  const [manual, setManual] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void loadSubjects()
      .then((c) => {
        if (active) setCat(c)
      })
      .catch((e) => {
        if (active) {
          setCat([])
          setError(errorMessage(e))
        }
      })
    return () => {
      active = false
    }
  }, [])
  const f = (cat || []).filter(
    (s) =>
      !have.some((value) => subjectNameKey(value) === subjectNameKey(s.name)) &&
      (subjectNameKey(s.name).includes(subjectNameKey(q)) ||
        subjectCodeKey(s.code).includes(subjectCodeKey(q)))
  )
  return (
    <Modal onClose={onClose}>
      <ErrorNotice error={error} />
      <h3 className="text-xl font-extrabold mb-3">Thêm môn học</h3>
      {manual ? (
        <SubjectCreateForm initialName={q} have={have} onPick={onPick} onCancel={() => setManual(false)} />
      ) : (
        <>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên hoặc mã môn…"
          />
          <div className="mt-3 space-y-1">
            {!cat ? (
              [0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-matcha-soft animate-pulse" />)
            ) : (
              <>
                {f.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => onPick(s)}
                    className="w-full text-left px-4 py-3 rounded-2xl hover:bg-matcha-soft flex justify-between"
                  >
                    <b>{s.name}</b>
                    <span className="text-xs opacity-60">{s.code}</span>
                  </button>
                ))}
                {!f.length && !q.trim() && (
                  <p className="text-sm opacity-60 p-3">
                    Bạn đã thêm hết các môn có sẵn. Bấm “Tự bổ sung môn học” để tạo môn chưa có.
                  </p>
                )}
              </>
            )}
          </div>
          <button type="button" className="btn btn-s mt-4" onClick={() => setManual(true)}>
            + Tự bổ sung môn học
          </button>
        </>
      )}
    </Modal>
  )
}
const levelDot: Record<Level, string> = { 'Mới bắt đầu': '●○○', 'Trung bình': '●●○', 'Nâng cao': '●●●' }
function SubjectsManager() {
  const { p, save, saving, notify } = useProfile()
  const [edit, setEdit] = useState<{ i: number; s: Subj; isNew: boolean } | null>(null)
  const [pick, setPick] = useState(false)
  return (
    <Sec
      title="Môn học của tôi"
      sub="Mỗi môn có trình độ và chủ đề mạnh/yếu riêng"
      action={
        <button className="btn btn-p text-sm" onClick={() => setPick(true)}>
          + Thêm môn học
        </button>
      }
    >
      {!p.subjects.length ? (
        <div className="text-center py-6">
          <div className="text-4xl">📚</div>
          <p className="font-semibold mt-1">Bạn chưa thêm môn nào</p>
          <p className="text-sm opacity-60 mb-3">Thêm một môn để bắt đầu nhận gợi ý bạn học.</p>
          <button className="btn btn-s" onClick={() => setPick(true)}>
            Thêm môn đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {p.subjects.map((s, i) => (
            <button
              type="button"
              key={s.name}
              onClick={() => setEdit({ i, s, isNew: false })}
              className="text-left rounded-2xl border border-line p-4 bg-cream hover:-translate-y-0.5 hover:border-forest transition"
            >
              <div className="flex justify-between gap-2">
                <div>
                  <b>{s.name}</b>
                  <p className="text-xs opacity-60">{s.code || 'Môn tự thêm'}</p>
                </div>
                <span className="text-xs text-forest font-semibold whitespace-nowrap">
                  {levelDot[s.level]} {s.level}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {s.strong.map((t) => (
                  <Tag key={t}>✓ {t}</Tag>
                ))}
                {s.weak.map((t) => (
                  <Tag key={t} c="caramel">
                    ↗ {t}
                  </Tag>
                ))}
                {!s.strong.length && !s.weak.length && (
                  <span className="text-xs opacity-50">Chạm để chọn chủ đề</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {pick && (
        <SubjectPicker
          have={p.subjects.map((s) => s.name)}
          onClose={() => setPick(false)}
          onPick={(s) => {
            setPick(false)
            setEdit({
              i: -1,
              isNew: true,
              s: { name: s.name, code: s.code, level: 'Trung bình', strong: [], weak: [] },
            })
          }}
        />
      )}
      {edit && (
        <SubjectEditor
          key={edit.s.name}
          init={edit.s}
          isNew={edit.isNew}
          onClose={() => setEdit(null)}
          onSave={async (s) => {
            if (saving) return
            if (
              await save((x) => ({
                ...x,
                subjects: edit.isNew ? [...x.subjects, s] : x.subjects.map((o, i) => (i === edit.i ? s : o)),
              }))
            ) {
              setEdit(null)
              notify.current(`Đã lưu môn ${s.name}`)
            }
          }}
          onRemove={async () => {
            if (await save((x) => ({ ...x, subjects: x.subjects.filter((_, i) => i !== edit.i) }))) {
              setEdit(null)
              notify.current('Đã xóa môn học')
            }
          }}
        />
      )}
    </Sec>
  )
}

/* ---------- availability ---------- */
export function summarize(av: string[]) {
  const parts = SLOTS.map((s) => ({
    s,
    d: DAYS.filter((d) => av.includes(`${d}-${s}`)).map((d) => DAY_FULL[d]),
  }))
    .filter((x) => x.d.length)
    .map((x) => `${x.s.toLowerCase()} ${x.d.join(', ')}`)
  if (!parts.length) return 'Bạn chưa chọn khung giờ rảnh nào.'
  return (
    'Rảnh ' +
    (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' và ' + parts[parts.length - 1] : parts[0]) +
    '.'
  )
}
export function AvailabilityGrid({
  value,
  onChange,
  compare,
}: {
  value: string[]
  onChange?: (v: string[]) => void
  compare?: string[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full text-center border-separate" style={{ borderSpacing: 4 }}>
        <thead>
          <tr>
            <th />
            {DAYS.map((d) => (
              <th key={d} className="font-semibold pb-1">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((s) => (
            <tr key={s}>
              <td className="text-left pr-1 font-medium">{s}</td>
              {DAYS.map((d) => {
                const k = `${d}-${s}`,
                  on = value.includes(k),
                  both = on && compare?.includes(k)
                return (
                  <td key={k}>
                    <button
                      type="button"
                      disabled={!onChange}
                      aria-label={`${DAY_FULL[d]} ${s}`}
                      aria-pressed={on}
                      onClick={() => onChange?.(tog(value, k))}
                      className={`w-full min-w-9 h-10 md:h-11 rounded-xl transition grid place-items-center ${both ? 'bg-caramel text-espresso' : on ? 'bg-matcha text-forest' : 'bg-[#f1ebde] text-transparent'} ${onChange ? 'hover:scale-105 cursor-pointer' : 'cursor-default'}`}
                    >
                      {on ? '✓' : '·'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function AvailabilitySection() {
  const { p, save, notify } = useProfile()
  const [ed, setEd] = useState(false)
  const [zone, setZone] = useState(p.timezone)
  const [d, setD] = useState(p.avail)
  const [busy, setBusy] = useState(false)
  useDirty('avail', ed && (JSON.stringify(d) !== JSON.stringify(p.avail) || zone !== p.timezone))
  const persist = async () => {
    setBusy(true)
    if (await save((x) => ({ ...x, avail: d, timezone: zone }))) {
      setEd(false)
      notify.current('Đã cập nhật lịch rảnh')
    }
    setBusy(false)
  }
  return (
    <Sec
      title="Lịch rảnh của tôi"
      sub={ed ? 'Chạm vào ô để bật/tắt khung giờ' : 'Dùng để tìm bạn học trùng lịch'}
      action={
        !ed && (
          <button
            className="btn btn-s text-sm"
            onClick={() => {
              setD(p.avail)
              setEd(true)
            }}
          >
            Chỉnh sửa
          </button>
        )
      }
    >
      {ed && (
        <label className="block text-xs mb-3">
          Múi giờ
          <input value={zone} onChange={(e) => setZone(e.target.value)} />
        </label>
      )}
      <AvailabilityGrid value={ed ? d : p.avail} onChange={ed ? setD : undefined} />
      <div className="flex gap-4 text-xs mt-2 opacity-70">
        <span>
          <i className="inline-block w-3 h-3 rounded bg-matcha align-middle" /> Rảnh
        </span>
        <span>
          <i className="inline-block w-3 h-3 rounded bg-[#f1ebde] align-middle" /> Bận
        </span>
      </div>
      <p className="text-sm bg-matcha-soft rounded-xl p-3 mt-3">🗓 {summarize(ed ? d : p.avail)}</p>
      {ed && (
        <div className="flex gap-2 justify-end mt-3">
          <button className="btn btn-o" onClick={() => setEd(false)}>
            Hủy
          </button>
          <button className="btn btn-p disabled:opacity-60" disabled={busy} onClick={persist}>
            {busy ? 'Đang lưu…' : 'Lưu lịch rảnh'}
          </button>
        </div>
      )}
    </Sec>
  )
}

/* ---------- goals & styles ---------- */
function PrefsFields({
  goals,
  styles,
  setGoals,
  setStyles,
}: {
  goals: string[]
  styles: string[]
  setGoals: (g: string[]) => void
  setStyles: (s: string[]) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <b className="text-sm">Mục tiêu học</b>
        <div className="mt-2">
          <Pick items={GOALS} sel={goals} on={(i) => setGoals(tog(goals, i))} />
        </div>
      </div>
      <div>
        <b className="text-sm">Phong cách học</b>
        <div className="grid sm:grid-cols-3 gap-2 mt-2">
          {STYLES.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setStyles(tog(styles, s))}
              className={`rounded-2xl border p-3 text-sm text-left transition ${styles.includes(s) ? 'bg-forest text-cream border-forest' : 'bg-paper border-line hover:bg-matcha-soft'}`}
            >
              {styles.includes(s) ? '✓ ' : ''}
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
function PrefsSection() {
  const { p, save, saving, notify } = useProfile()
  const [ed, setEd] = useState(false)
  const [g, setG] = useState(p.goals)
  const [s, setS] = useState(p.styles)
  useDirty(
    'prefs',
    ed && (JSON.stringify(g) !== JSON.stringify(p.goals) || JSON.stringify(s) !== JSON.stringify(p.styles))
  )
  return (
    <Sec
      title="Mục tiêu & phong cách học"
      sub="Ảnh hưởng đến gợi ý trong Smart Match"
      action={
        !ed && (
          <button
            className="btn btn-s text-sm"
            onClick={() => {
              setG(p.goals)
              setS(p.styles)
              setEd(true)
            }}
          >
            Chỉnh sửa
          </button>
        )
      }
    >
      {ed ? (
        <>
          <PrefsFields goals={g} styles={s} setGoals={setG} setStyles={setS} />
          <div className="flex gap-2 justify-end mt-3">
            <button className="btn btn-o" onClick={() => setEd(false)}>
              Hủy
            </button>
            <button
              className="btn btn-p"
              disabled={saving}
              onClick={async () => {
                if (await save((x) => ({ ...x, goals: g, styles: s }))) {
                  setEd(false)
                  notify.current('Đã lưu. Gợi ý Smart Match sẽ được làm mới')
                }
              }}
            >
              Lưu
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {p.goals.length ? (
              p.goals.map((x) => <Tag key={x}>🎯 {x}</Tag>)
            ) : (
              <span className="text-sm opacity-50">Chưa chọn mục tiêu</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.styles.length ? (
              p.styles.map((x) => (
                <Tag key={x} c="caramel">
                  ☕ {x}
                </Tag>
              ))
            ) : (
              <span className="text-sm opacity-50">Chưa chọn phong cách</span>
            )}
          </div>
        </div>
      )}
    </Sec>
  )
}

/* ---------- public profile ---------- */
export function PublicProfile({
  profile: x,
  subject,
  onClose,
  action,
}: {
  profile: Profile
  subject: string
  onClose: () => void
  action?: ReactNode
}) {
  const { p } = useProfile()
  const { name, uni } = x
  const sc = scoreProfiles(p, x, subject)
  const shared = x.subjects.filter((s) => p.subjects.some((m) => m.name === s.name))
  return (
    <Modal onClose={onClose}>
      <div className="flex gap-4 items-center">
        <Avatar src={x.avatar} name={name} size={72} />
        <div className="flex-1">
          <h3 className="text-xl font-extrabold">{name}</h3>
          <p className="text-sm">{x.major}</p>
          <p className="text-xs opacity-60">{uni}</p>
        </div>
        <button className="text-xl" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>
      <p className="text-sm bg-cream border border-line rounded-2xl p-3 mt-4 italic">“{x.bio}”</p>
      <h4 className="font-bold mt-4 mb-2">Vì sao hợp với bạn · {sc.score}%</h4>
      {(sc.teachMe.length > 0 || sc.iTeach.length > 0) && (
        <div className="bg-caramel/15 rounded-2xl p-3 text-sm space-y-1">
          {sc.teachMe.length > 0 && (
            <p>
              🤝 {name} vững <b>{sc.teachMe.join(', ')}</b> – đúng phần bạn còn yếu.
            </p>
          )}
          {sc.iTeach.length > 0 && (
            <p>
              🌱 Bạn vững <b>{sc.iTeach.join(', ')}</b> và có thể giúp lại {name}.
            </p>
          )}
        </div>
      )}
      <div className="space-y-2 mt-3 text-xs">
        {(
          [
            ['Môn & kiến thức bổ trợ · 35%', sc.C],
            ['Lịch rảnh trùng · 30%', sc.T],
            ['Mục tiêu · 20%', sc.G],
            ['Phong cách học · 15%', sc.L],
          ] as [string, number][]
        ).map(([l, v]) => (
          <div key={l}>
            <div className="flex justify-between mb-1">
              <span>{l}</span>
              <b>{v}%</b>
            </div>
            <div className="h-2 rounded-full bg-matcha-soft">
              <div className="h-2 rounded-full bg-forest" style={{ width: v + '%' }} />
            </div>
          </div>
        ))}
      </div>
      <h4 className="font-bold mt-4 mb-2">Môn học {shared.length ? '(có môn chung)' : ''}</h4>
      <div className="space-y-2">
        {x.subjects.map((s) => (
          <div key={s.name} className="rounded-2xl border border-line p-3">
            <div className="flex justify-between">
              <b className="text-sm">{s.name}</b>
              <span className="text-xs">
                {s.level}
                {shared.includes(s) ? ' · môn chung' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {s.strong.map((t) => (
                <Tag key={t}>✓ {t}</Tag>
              ))}
              {s.weak.map((t) => (
                <Tag key={t} c="caramel">
                  ↗ {t}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
      <h4 className="font-bold mt-4 mb-2">
        Lịch rảnh <span className="text-xs font-normal opacity-60">(ô cam = trùng với bạn)</span>
      </h4>
      <AvailabilityGrid value={x.avail} compare={sc.overlap} />
      {x.timezone !== p.timezone && (
        <p className="text-xs opacity-60">
          Lịch hiển thị theo múi giờ {x.timezone}; ô cam tính theo thời gian thực trùng nhau.
        </p>
      )}
      <p className="text-xs mt-1">{summarize(x.avail)}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {x.goals.map((g) => (
          <Tag key={g}>🎯 {g}</Tag>
        ))}
        {x.styles.map((g) => (
          <Tag key={g} c="caramel">
            ☕ {g}
          </Tag>
        ))}
      </div>
      <p className="text-xs opacity-60 mt-4">🔒 Email và thông tin liên hệ của {name} được giữ riêng tư.</p>
      {action && <div className="flex justify-end gap-2 mt-3">{action}</div>}
    </Modal>
  )
}
function SelfPreview({ onClose }: { onClose: () => void }) {
  const { p } = useProfile()
  return (
    <Modal onClose={onClose}>
      <p className="text-xs bg-matcha-soft rounded-xl p-2 mb-3">
        Đây là những gì bạn học khác nhìn thấy. Email của bạn không hiển thị.
      </p>
      <div className="flex gap-4 items-center">
        <Avatar src={p.avatar} name={p.name} size={72} />
        <div>
          <h3 className="text-xl font-extrabold">{p.name}</h3>
          <p className="text-sm">{p.major}</p>
          <p className="text-xs opacity-60">{p.uni}</p>
        </div>
      </div>
      {p.bio && <p className="text-sm italic bg-cream border border-line rounded-2xl p-3 mt-3">“{p.bio}”</p>}
      <div className="space-y-2 mt-3">
        {p.subjects.map((s) => (
          <div key={s.name} className="rounded-2xl border border-line p-3">
            <b className="text-sm">{s.name}</b> <span className="text-xs">· {s.level}</span>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {s.strong.map((t) => (
                <Tag key={t}>✓ {t}</Tag>
              ))}
              {s.weak.map((t) => (
                <Tag key={t} c="caramel">
                  ↗ {t}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm mt-3">🗓 {summarize(p.avail)}</p>
      <div className="text-right mt-3">
        <button className="btn btn-p" onClick={onClose}>
          Đóng
        </button>
      </div>
    </Modal>
  )
}

/* ---------- profile screen ---------- */
export function ProfileScreen({ setModal }: { setModal: (m: { kind: 'signout' }) => void }) {
  const { p, save, saving, error, email: EMAIL, notify } = useProfile()
  const pick = (x: Profile): Ident => ({
    name: x.name,
    uni: x.uni,
    major: x.major,
    bio: x.bio,
    avatar: x.avatar,
    avatarPath: x.avatarPath,
  })
  const [ed, setEd] = useState(false)
  const [d, setD] = useState<Ident>(pick(p))
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [leave, setLeave] = useState(false)
  const [prev, setPrev] = useState(false)
  const dirty = ed && JSON.stringify(d) !== JSON.stringify(pick(p))
  useDirty('ident', dirty)
  const persist = async () => {
    setTried(true)
    if (Object.values(identErr(d)).some(Boolean)) return
    setBusy(true)
    if (await save((x) => ({ ...x, ...d, name: d.name.trim() }))) {
      setEd(false)
      setTried(false)
      notify.current('Đã cập nhật hồ sơ của bạn')
    }
    setBusy(false)
  }
  return (
    <div className="space-y-5">
      {!ed ? (
        <div className="card overflow-hidden">
          <div className="h-24 md:h-32 bg-matcha relative">
            <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-caramel/60" />
            <div className="absolute right-24 top-10 w-16 h-16 rounded-full bg-forest/30" />
          </div>
          <div className="px-5 pb-5 -mt-12 md:-mt-14 md:flex gap-5 items-end">
            <div className="relative z-10 border-4 border-paper rounded-full w-fit bg-paper">
              <Avatar src={p.avatar} name={p.name} size={104} />
            </div>
            <div className="flex-1 mt-2 md:mt-0 md:pt-14 relative z-10">
              <h1 className="text-2xl md:text-3xl font-extrabold">{p.name}</h1>
              <p className="text-sm">🎓 {p.major}</p>
              <p className="text-xs opacity-60">{p.uni}</p>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-o text-sm" onClick={() => setPrev(true)}>
                Xem như bạn học
              </button>
              <button
                className="btn btn-p text-sm"
                onClick={() => {
                  setD(pick(p))
                  setEd(true)
                }}
              >
                Chỉnh sửa thông tin
              </button>
            </div>
          </div>
          <div className="px-5 pb-5">
            {p.bio ? (
              <p className="text-sm bg-cream border border-line rounded-2xl p-4 leading-relaxed">{p.bio}</p>
            ) : (
              <p className="text-sm opacity-60 border border-dashed border-line rounded-2xl p-4">
                Bạn chưa viết giới thiệu. Một vài dòng sẽ giúp bạn học hiểu bạn hơn nhé.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-5 pop">
          <h2 className="font-bold text-lg mb-4">Chỉnh sửa thông tin cá nhân</h2>
          <IdentityFields d={d} setD={setD} show={tried} />
          <div className="flex gap-2 justify-end mt-5">
            <button className="btn btn-o" onClick={() => (dirty ? setLeave(true) : setEd(false))}>
              Hủy
            </button>
            <button className="btn btn-p disabled:opacity-60" disabled={busy} onClick={persist}>
              {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
            </button>
          </div>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <SubjectsManager />
        </div>
        <AvailabilitySection />
        <PrefsSection />
      </div>
      <Sec title="Tài khoản & quyền riêng tư">
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-matcha-soft p-4">
            <b>👁 Bạn học khác thấy</b>
            <p className="mt-1 opacity-80">
              Ảnh, tên hiển thị, trường, ngành, giới thiệu, môn học, chủ đề mạnh/yếu, mục tiêu, phong cách và
              lịch rảnh.
            </p>
          </div>
          <div className="rounded-2xl border border-line p-4">
            <b>🔒 Chỉ mình bạn</b>
            <p className="mt-1">Email Google: {EMAIL}</p>
            <p className="opacity-70">
              Đăng nhập bằng Google. Không chia sẻ thông tin liên hệ khi bạn chưa đồng ý.
            </p>
          </div>
        </div>
        <button className="btn btn-o mt-3" onClick={() => setModal({ kind: 'signout' })}>
          Đăng xuất
        </button>
      </Sec>
      {leave && (
        <Modal onClose={() => setLeave(false)}>
          <h3 className="font-bold text-lg">Bỏ các thay đổi chưa lưu?</h3>
          <p className="text-sm opacity-70 my-2">Những chỉnh sửa vừa rồi sẽ không được giữ lại.</p>
          <div className="flex justify-end gap-2">
            <button className="btn btn-o" onClick={() => setLeave(false)}>
              Tiếp tục chỉnh sửa
            </button>
            <button
              className="btn btn-p"
              onClick={() => {
                setLeave(false)
                setEd(false)
                setTried(false)
              }}
            >
              Bỏ thay đổi
            </button>
          </div>
        </Modal>
      )}
      {prev && <SelfPreview onClose={() => setPrev(false)} />}
    </div>
  )
}

/* ---------- onboarding ---------- */
export function Onboard({ done }: { done: () => void }) {
  const { p, set, save, saving, error } = useProfile()
  const [step, setStep] = useState(0)
  const [tried, setTried] = useState(false)
  const [stepError, setStepError] = useState('')
  const titles = ['Về bạn', 'Môn học', 'Gu học tập', 'Lịch rảnh', 'Xem lại']
  const copy = [
    'Một chút về bạn nhé',
    'Bạn đang học môn nào?',
    'Bạn thích học thế nào?',
    'Khi nào bạn rảnh?',
    'Hồ sơ của bạn đã sẵn sàng',
  ]
  const ident: Ident = {
    name: p.name,
    uni: p.uni,
    major: p.major,
    bio: p.bio,
    avatar: p.avatar,
    avatarPath: p.avatarPath,
  }
  const next = async () => {
    setStepError('')
    if (step === 0) {
      setTried(true)
      if (Object.values(identErr(ident)).some(Boolean)) return
    }
    if (step === 1 && !p.subjects.length) {
      setStepError('Thêm ít nhất một môn học trước khi tiếp tục.')
      return
    }
    if (step === 2 && (!p.goals.length || !p.styles.length)) {
      setStepError('Chọn ít nhất một mục tiêu và một phong cách học.')
      return
    }
    if (step === 3) {
      if (!p.avail.length) {
        setStepError('Chọn ít nhất một khung giờ rảnh.')
        return
      }
      try {
        new Intl.DateTimeFormat('vi-VN', { timeZone: p.timezone })
      } catch {
        setStepError('Múi giờ chưa hợp lệ.')
        return
      }
    }
    setTried(false)
    if (step < 4) setStep(step + 1)
    else if (await save((x) => x, true)) done()
  }
  return (
    <div className="min-h-screen grid place-items-center p-3 md:p-6">
      <div className="card p-5 md:p-9 w-full max-w-2xl pop" key={step}>
        <div className="flex gap-1.5 mb-2">
          {titles.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition ${i <= step ? 'bg-forest' : 'bg-matcha-soft'}`}
            />
          ))}
        </div>
        <p className="text-xs opacity-60">
          Bước {step + 1}/5 · {titles[step]}
        </p>
        <h2 className="text-2xl font-extrabold mb-4">{copy[step]}</h2>
        {step === 0 && (
          <>
            <IdentityFields d={ident} setD={(v) => set((x) => ({ ...x, ...v }))} show={tried} />
            <p className="text-xs bg-matcha-soft rounded-xl p-3 mt-4">
              🔒 Email và thông tin liên hệ sẽ không hiển thị với bạn học khác. Bạn có thể sửa mọi thứ sau
              trong Hồ sơ.
            </p>
          </>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm opacity-70">
              Với mỗi môn, chọn trình độ và phần mình vững/yếu. Thêm ít nhất một môn trước khi hoàn tất hồ sơ.
            </p>
            <SubjectsManager />
          </div>
        )}
        {step === 2 && (
          <PrefsFields
            goals={p.goals}
            styles={p.styles}
            setGoals={(g) => set((x) => ({ ...x, goals: g }))}
            setStyles={(s) => set((x) => ({ ...x, styles: s }))}
          />
        )}
        {step === 3 && (
          <>
            <label className="block text-xs mb-3">
              Múi giờ
              <input value={p.timezone} onChange={(e) => set((x) => ({ ...x, timezone: e.target.value }))} />
            </label>
            <AvailabilityGrid value={p.avail} onChange={(a) => set((x) => ({ ...x, avail: a }))} />
            <p className="text-sm bg-matcha-soft rounded-xl p-3 mt-3">🗓 {summarize(p.avail)}</p>
          </>
        )}
        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-3 items-center">
              <Avatar src={p.avatar} name={p.name} size={64} />
              <div className="flex-1">
                <b className="text-lg">{p.name}</b>
                <p>
                  {p.major} · {p.uni}
                </p>
              </div>
              <button className="underline" onClick={() => setStep(0)}>
                Sửa
              </button>
            </div>
            {[
              [
                'Môn học',
                p.subjects.length
                  ? p.subjects.map((s) => `${s.name} (${s.level})`).join(', ')
                  : 'Chưa thêm môn nào',
                1,
              ],
              ['Mục tiêu & phong cách', [...p.goals, ...p.styles].join(', ') || 'Chưa chọn', 2],
              ['Lịch rảnh', summarize(p.avail), 3],
            ].map(([l, v, s]) => (
              <div key={l as string} className="flex gap-3 rounded-2xl border border-line p-3">
                <div className="flex-1">
                  <b>{l}</b>
                  <p className="opacity-80">{v}</p>
                </div>
                <button className="underline" onClick={() => setStep(s as number)}>
                  Sửa
                </button>
              </div>
            ))}
          </div>
        )}
        <ErrorNotice error={stepError || error} />
        <div className="flex justify-between mt-7">
          <button
            className="btn btn-o disabled:opacity-40"
            disabled={!step}
            onClick={() => setStep(step - 1)}
          >
            Quay lại
          </button>
          <button className="btn btn-p disabled:opacity-50" disabled={saving} onClick={next}>
            {step < 4 ? 'Tiếp tục' : 'Bắt đầu tìm bạn học'}
          </button>
        </div>
      </div>
    </div>
  )
}
