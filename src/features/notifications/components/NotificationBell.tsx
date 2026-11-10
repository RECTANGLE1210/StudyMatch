import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { Avatar } from '../../profile/components/ProfileScreens'
import { rpc } from '../../../lib/supabase/rpc'
import { requireSupabase } from '../../../lib/supabase/client'
import { displayDate } from '../../../lib/utils/dates'
import type { NotificationView } from '../../../types/product'
const labels: Record<NotificationView['kind'], string> = {
  invitation: 'Bạn nhận được lời mời học cùng',
  invitation_accepted: 'Lời mời của bạn đã được chấp nhận',
  message: 'Bạn có tin nhắn mới',
  session_proposed: 'Bạn nhận được đề xuất lịch học',
  session_confirmed: 'Buổi học đã được xác nhận',
  session_cancelled: 'Buổi học đã bị hủy',
}
export function NotificationBell() {
  const [open, setOpen] = useState(false),
    { data, action, busy } = useWorkspace(),
    { p } = useProfile(),
    navigate = useNavigate()
  const invitations =
      data?.invitations.filter((i) => i.recipient_id === p.id && i.status === 'pending') ?? [],
    notes = data?.notifications ?? []
  const count = invitations.length + (data?.unreadNotifications ?? 0)
  const respond = async (id: string, accepted: boolean) => {
    await action(
      () => rpc('respond_invitation', { request_id: id, next_status: accepted ? 'accepted' : 'rejected' }),
      accepted ? 'Đã kết nối với bạn học' : 'Đã từ chối lời mời'
    )
  }
  const visit = async (note: NotificationView) => {
    let route = note.kind.startsWith('session_') ? `/sessions/${note.entity_id}` : '/match'
    if (note.kind === 'message') {
      const ok = await action(async () => {
        const { data: message, error } = await requireSupabase()
          .from('messages')
          .select('conversation_id')
          .eq('id', note.entity_id)
          .single()
        if (error) throw error
        route = `/messages/${message.conversation_id}`
      })
      if (!ok) return
    }
    if (await action(() => rpc('mark_notification_read', { notification: note.id }))) {
      setOpen(false)
      navigate(route)
    }
  }
  return (
    <div className="app-bell fixed top-3 right-3 md:top-6 md:right-8 z-40">
      <button aria-label="Thông báo" onClick={() => setOpen(!open)} className="bell-button">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#365c4a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-caramel text-espresso text-[11px] font-bold grid place-items-center">
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0" onClick={() => setOpen(false)} />
          <div className="card pop absolute right-0 mt-2 w-[min(92vw,380px)] max-h-[75vh] overflow-y-auto p-4">
            <div className="flex items-center mb-2">
              <b className="flex-1 text-lg">Thông báo</b>
              {notes.some((n) => !n.read_at) && (
                <button
                  disabled={busy}
                  className="text-xs text-forest font-semibold"
                  onClick={() => {
                    void action(() => rpc('mark_all_notifications_read'))
                  }}
                >
                  Đánh dấu đã đọc
                </button>
              )}
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wide opacity-60 mt-2 mb-2">
              Lời mời đang chờ ({invitations.length})
            </h4>
            {invitations.length ? (
              invitations.map((i) => (
                <div key={i.id} className="flex items-center gap-2 mb-2 p-2 rounded-2xl bg-matcha-soft/60">
                  <Avatar src={i.sender?.avatar} name={i.sender?.name ?? ''} size={36} />
                  <span className="flex-1 text-sm font-medium">
                    {i.sender?.name ?? 'Hồ sơ không còn khả dụng'}
                    <br />
                    <span className="text-xs opacity-60 font-normal">
                      muốn học cùng bạn · {i.subjectName}
                    </span>
                  </span>
                  <button
                    disabled={busy}
                    className="btn btn-o text-xs !px-3 !py-1.5"
                    onClick={() => {
                      void respond(i.id, false)
                    }}
                  >
                    Từ chối
                  </button>
                  <button
                    disabled={busy}
                    className="btn btn-p text-xs !px-3 !py-1.5"
                    onClick={() => {
                      void respond(i.id, true)
                    }}
                  >
                    Chấp nhận
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm opacity-60 mb-2">Không có lời mời nào đang chờ.</p>
            )}
            <h4 className="text-xs font-bold uppercase tracking-wide opacity-60 mt-3 mb-2">Gần đây</h4>
            {notes.length ? (
              notes.map((n) => (
                <button
                  key={n.id}
                  disabled={busy}
                  onClick={() => {
                    void visit(n)
                  }}
                  className="w-full text-left flex gap-2 p-2 rounded-xl hover:bg-cream"
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${!n.read_at ? 'bg-caramel' : 'bg-transparent'}`}
                  />
                  <span className="text-sm flex-1">
                    {labels[n.kind]}
                    <br />
                    <span className="text-xs opacity-50">{displayDate(n.created_at, p.timezone)}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="text-sm opacity-60">Chưa có thông báo mới.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
