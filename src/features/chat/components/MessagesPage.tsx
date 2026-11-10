import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { useProfile } from '../../profile/hooks/ProfileProvider'
import { Avatar, PublicProfile } from '../../profile/components/ProfileScreens'
import { useMessages } from '../hooks/useMessages'
import { rpc } from '../../../lib/supabase/rpc'
import { ErrorNotice, Empty } from '../../../components/shared/Feedback'
import { errorMessage } from '../../../lib/utils/errors'
import { displayTime } from '../../../lib/utils/dates'
export function MessagesPage() {
  const { data, action, busy } = useWorkspace(),
    { p } = useProfile(),
    { conversationId } = useParams(),
    navigate = useNavigate(),
    [viewProfile, setViewProfile] = useState(false),
    [text, setText] = useState(''),
    [readError, setReadError] = useState('')
  const conversation =
      data?.conversations.find((c) => c.id === conversationId) ??
      (!conversationId ? data?.conversations[0] : undefined),
    id = conversation?.id ?? '',
    peer = conversation?.peer,
    history = useMessages(id),
    bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setText('')
    setViewProfile(false)
  }, [id])
  const last = history.messages.at(-1)?.id
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'nearest' })
    if (id && document.visibilityState === 'visible')
      void rpc('mark_conversation_read', { conversation: id }).catch((e) => setReadError(errorMessage(e)))
  }, [id, last])
  useEffect(() => {
    const read = () => {
      if (id && document.visibilityState === 'visible')
        void rpc('mark_conversation_read', { conversation: id }).catch((e) => setReadError(errorMessage(e)))
    }
    document.addEventListener('visibilitychange', read)
    return () => document.removeEventListener('visibilitychange', read)
  }, [id])
  const send = async () => {
    if (!id || !text.trim() || busy) return
    const body = text.trim()
    if (await action(() => rpc('send_message', { conversation: id, content: body }))) {
      setText('')
      await history.reload()
    }
  }
  if (!data?.conversations.length)
    return (
      <Empty
        title="Chưa có cuộc trò chuyện"
        description="Kết nối với bạn học để bắt đầu nhắn tin."
        action="Tìm bạn học"
        onAction={() => navigate('/match')}
      />
    )
  if (!conversation || !peer)
    return (
      <Empty
        title="Không tìm thấy cuộc trò chuyện"
        description="Cuộc trò chuyện không tồn tại hoặc bạn không có quyền truy cập."
        action="Về tin nhắn"
        onAction={() => navigate('/messages')}
      />
    )
  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4 h-[75vh]">
      <div className="card p-3 overflow-y-auto">
        <select
          className="md:hidden mb-2"
          aria-label="Cuộc trò chuyện"
          value={id}
          onChange={(e) => navigate(`/messages/${e.target.value}`)}
        >
          {data.conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.peer?.name}
            </option>
          ))}
        </select>
        <div className="hidden md:block">
          {data.conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/messages/${c.id}`)}
              className={`w-full text-left flex items-center gap-3 p-2 rounded-2xl ${c.id === id ? 'bg-matcha-soft' : ''}`}
            >
              <Avatar src={c.peer?.avatar} name={c.peer?.name ?? ''} />
              <div className="flex-1 min-w-0">
                <b>{c.peer?.name}</b>
                <p className="text-xs opacity-60 truncate">{c.lastMessage?.body ?? 'Chưa có tin nhắn'}</p>
              </div>
              {c.unread > 0 && (
                <span className="bg-caramel text-white text-xs rounded-full px-2">{c.unread}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="card flex flex-col overflow-hidden">
        <div className="p-4 border-b border-line flex flex-wrap items-center gap-3">
          <Avatar src={peer.avatar} name={peer.name} />
          <b className="flex-1">{peer.name}</b>
          <button className="btn btn-o text-sm" onClick={() => setViewProfile(true)}>
            Xem hồ sơ
          </button>
          <button className="btn btn-s text-sm" onClick={() => navigate(`/sessions?partner=${peer.id}`)}>
            Hẹn buổi học
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <ErrorNotice
            error={history.error || readError}
            retry={() => {
              void history.reload()
            }}
          />
          {history.more && (
            <button
              disabled={history.loading}
              className="btn btn-o text-xs"
              onClick={() => {
                void history.older()
              }}
            >
              Tải tin nhắn trước
            </button>
          )}
          {history.loading && !history.messages.length && (
            <p role="status" className="text-sm opacity-60">
              Đang tải tin nhắn…
            </p>
          )}
          {history.messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender_id === p.id ? 'justify-end' : ''}`}>
              <div
                className={`px-4 py-2 rounded-2xl max-w-[75%] break-words ${message.sender_id === p.id ? 'bg-forest text-cream' : 'bg-matcha-soft'}`}
              >
                {message.body}
                <div className="text-[10px] opacity-60">{displayTime(message.created_at, p.timezone)}</div>
              </div>
            </div>
          ))}
          <div ref={bottom} />
        </div>
        <form
          className="p-3 flex gap-2 border-t border-line"
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <input
            aria-label="Tin nhắn"
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhắn gì đó…"
          />
          <button className="btn btn-p" disabled={busy || !text.trim()}>
            Gửi
          </button>
        </form>
      </div>
      {viewProfile && (
        <PublicProfile
          profile={peer}
          subject={peer.subjects.find((s) => p.subjects.some((x) => x.id === s.id))?.name ?? ''}
          onClose={() => setViewProfile(false)}
        />
      )}
    </div>
  )
}
