import { ProfileScreen } from './ProfileScreens'
import { useLayout } from '../../../components/layout/AppLayout'
import { useWorkspace } from '../../workspace/hooks/useWorkspace'
import { rpc } from '../../../lib/supabase/rpc'
export function ProfilePage() {
  const { requestSignOut } = useLayout(),
    { data, action, busy } = useWorkspace()
  return (
    <>
      <ProfileScreen setModal={() => requestSignOut()} />
      <section className="card p-5 mt-5">
        <h3 className="font-bold text-lg mb-3">Người học đã chặn</h3>
        {data?.blockedUsers.length ? (
          data.blockedUsers.map((id) => (
            <div key={id} className="flex gap-3 py-2 border-b border-line items-center">
              <span className="text-xs flex-1">Tài khoản {id.slice(0, 8)}</span>
              <button
                className="btn btn-o text-sm"
                disabled={busy}
                onClick={() => {
                  void action(
                    () => rpc('unblock_user', { target: id }),
                    'Đã bỏ chặn. Các lời mời đã hủy không được tự động khôi phục.'
                  )
                }}
              >
                Bỏ chặn
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm opacity-60">Bạn chưa chặn ai.</p>
        )}
      </section>
    </>
  )
}
