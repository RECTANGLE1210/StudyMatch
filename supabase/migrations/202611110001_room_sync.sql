-- For this live rollout use 202611110002_room_sync_rollout.sql instead.
-- Retained for already-upgraded installations and historical migration tests.
-- Apply after 202611100001_product.sql. Existing sessions/Meet links are preserved.
begin;

-- Fail instead of waiting indefinitely behind live traffic; settings end with this transaction.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.study_sessions
 add column pomodoro_minutes smallint not null default 25 check (pomodoro_minutes in (25,50)),
 add column pomodoro_elapsed_ms integer not null default 0,
 add column pomodoro_started_at timestamptz,
 add column pomodoro_revision bigint not null default 0,
 add constraint pomodoro_elapsed_bounds check (pomodoro_elapsed_ms between 0 and pomodoro_minutes * 60000);

-- Serialize controls on the session row. Stale controls cannot undo a partner's action.
create function public.control_pomodoro(session uuid, command text, expected_revision bigint, minutes integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare s public.study_sessions; at_time timestamptz; elapsed integer;
begin
 select * into s from public.study_sessions where id=session for update;
 at_time := clock_timestamp();
 if auth.uid() is null or s.id is null or auth.uid() not in (s.creator_id,s.partner_id) then
  raise exception 'Session participant access required';
 end if;
 if s.status <> 'in_progress' or at_time < s.starts_at or at_time >= s.ends_at then
  raise exception 'Pomodoro requires an active study session';
 end if;
 if expected_revision is distinct from s.pomodoro_revision then
  raise exception 'Pomodoro vừa thay đổi. Hãy thử lại sau khi phòng cập nhật.';
 end if;
 if command is null or command not in ('start','pause','reset') or
    (minutes is not null and (command <> 'reset' or minutes not in (25,50))) then
  raise exception 'Invalid Pomodoro control';
 end if;
 elapsed := least(s.pomodoro_minutes * 60000, s.pomodoro_elapsed_ms +
  case when s.pomodoro_started_at is null then 0 else
   greatest(0,floor(extract(epoch from (at_time-s.pomodoro_started_at))*1000))::integer end);
 if command='start' then
  if elapsed >= s.pomodoro_minutes * 60000 then raise exception 'Reset the completed Pomodoro first'; end if;
  if s.pomodoro_started_at is not null then return; end if;
  update public.study_sessions set pomodoro_started_at=at_time,pomodoro_revision=pomodoro_revision+1 where id=session;
 elsif command='pause' then
  update public.study_sessions set pomodoro_elapsed_ms=elapsed,pomodoro_started_at=null,pomodoro_revision=pomodoro_revision+1 where id=session;
 else
  update public.study_sessions set pomodoro_minutes=coalesce(minutes,s.pomodoro_minutes),pomodoro_elapsed_ms=0,
   pomodoro_started_at=null,pomodoro_revision=pomodoro_revision+1 where id=session;
 end if;
end $$;
revoke all on function public.control_pomodoro(uuid,text,bigint,integer) from public,anon;
grant execute on function public.control_pomodoro(uuid,text,bigint,integer) to authenticated;

-- A completed/cancelled/blocked/expired room freezes its clock without trusting a client.
create function private.freeze_room_pomodoro() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='in_progress' and new.status<>'in_progress' then
  new.pomodoro_elapsed_ms := least(old.pomodoro_minutes * 60000,old.pomodoro_elapsed_ms +
   case when old.pomodoro_started_at is null then 0 else greatest(0,floor(extract(epoch from
    (least(coalesce(new.completed_at,clock_timestamp()),new.ends_at)-old.pomodoro_started_at))*1000))::integer end);
  new.pomodoro_started_at := null;
  new.pomodoro_revision := old.pomodoro_revision+1;
 end if;
 return new;
end $$;
revoke all on function private.freeze_room_pomodoro() from public,anon,authenticated;
create trigger freeze_room_pomodoro before update of status on public.study_sessions
 for each row execute function private.freeze_room_pomodoro();

create or replace function public.get_room(session uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.is_session_member(session) then raise exception 'Session participant access required'; end if;
 perform public.refresh_session_statuses();
 select jsonb_build_object('session',public.get_session_snapshot(session),
 'goals',coalesce((select jsonb_agg(g order by g.created_at) from public.session_goals g where g.session_id=session),'[]'::jsonb),
 'resources',coalesce((select jsonb_agg(r order by r.created_at) from public.session_resources r where r.session_id=session),'[]'::jsonb),
 'feedback',(select to_jsonb(f) from public.session_feedback f where f.session_id=session and f.user_id=auth.uid()),
 'serverNow',clock_timestamp()) into result;
 return result;
end $$;

-- Reapply safely even if Realtime was enabled after the earlier migrations ran.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='study_sessions') then
   alter publication supabase_realtime add table public.study_sessions;
  end if;
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
