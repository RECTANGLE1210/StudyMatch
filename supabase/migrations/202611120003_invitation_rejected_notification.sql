-- Apply after foundation/product. Notify only future rejections; keep existing data and RPCs.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

alter table public.notifications drop constraint notifications_kind_check,
 add constraint notifications_kind_check check(kind in
 ('invitation','invitation_accepted','invitation_rejected','message','session_proposed','session_confirmed','session_cancelled'));

-- respond_invitation already locks the invitation and checks the actor/status.
-- A trigger covers every rejection path atomically without changing that RPC.
create function private.notify_invitation_rejected() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(user_id,kind,entity_id)
 values(new.sender_id,'invitation_rejected',new.id);
 return null;
end $$;
revoke all on function private.notify_invitation_rejected() from public,anon,authenticated;
create trigger invitation_rejected_notification after update of status on public.match_requests
 for each row when (old.status='pending' and new.status='rejected')
 execute function private.notify_invitation_rejected();

commit;
