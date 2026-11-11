-- Live rollout: apply directly after product.sql. room_sync.sql (001) is NOT required.
-- Only new tables/functions: existing session schema, triggers and RPCs remain unchanged.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

create table public.room_sync_rollout (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 starts_at timestamptz not null default clock_timestamp()
);
insert into public.room_sync_rollout(singleton) values(true);

-- Intentionally no FK to legacy tables: installing this feature does not lock parent tables for FK DDL.
-- RPCs validate membership/session existence; only definer RPCs can write these rows.
create table public.room_sync_state (
 session_id uuid primary key,
 creator_joined boolean not null default false,
 partner_joined boolean not null default false,
 activated_at timestamptz,
 duration_minutes smallint not null default 25 check(duration_minutes in (25,50)),
 elapsed_ms integer not null default 0,
 started_at timestamptz,
 revision bigint not null default 0,
 check(elapsed_ms between 0 and duration_minutes * 60000),
 check(activated_at is null or (creator_joined and partner_joined))
);
alter table public.room_sync_rollout enable row level security;
alter table public.room_sync_state enable row level security;
revoke all on public.room_sync_rollout,public.room_sync_state from public,anon,authenticated;
grant select on public.room_sync_rollout,public.room_sync_state to authenticated;
create policy room_rollout_read on public.room_sync_rollout for select to authenticated using(true);
create policy room_sync_read on public.room_sync_state for select to authenticated using(private.is_session_member(session_id));

create function public.join_room_sync(session uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.study_sessions; gate public.room_sync_rollout; state public.room_sync_state;
begin
 select * into s from public.study_sessions where id=session for update;
 if auth.uid() is null or s.id is null or auth.uid() not in (s.creator_id,s.partner_id) then raise exception 'Session participant access required'; end if;
 select * into gate from public.room_sync_rollout where singleton;
 if not gate.enabled or s.created_at < gate.starts_at or s.status not in ('scheduled','in_progress') or s.ends_at<=clock_timestamp() then return; end if;
 select * into state from public.room_sync_state where session_id=session;
 if state.activated_at is not null or (auth.uid()=s.creator_id and state.creator_joined) or (auth.uid()=s.partner_id and state.partner_joined) then return; end if;
 insert into public.room_sync_state(session_id,creator_joined,partner_joined)
 values(session,auth.uid()=s.creator_id,auth.uid()=s.partner_id)
 on conflict(session_id) do update set creator_joined=public.room_sync_state.creator_joined or excluded.creator_joined,
  partner_joined=public.room_sync_state.partner_joined or excluded.partner_joined;
 update public.room_sync_state set activated_at=clock_timestamp()
 where session_id=session and activated_at is null and creator_joined and partner_joined;
end $$;

create function public.get_room_v2(session uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; s public.study_sessions; state public.room_sync_state; gate public.room_sync_rollout; eligible boolean; elapsed integer;
begin
 -- Keep the legacy API intact and preserve its existing authorization rules.
 result := public.get_room(session);
 select * into s from public.study_sessions where id=session;
 select * into gate from public.room_sync_rollout where singleton;
 select * into state from public.room_sync_state where session_id=session;
 eligible := state.activated_at is not null or (gate.enabled and s.created_at>=gate.starts_at and s.status in ('scheduled','in_progress') and s.ends_at>clock_timestamp());
 elapsed := coalesce(state.elapsed_ms,0);
 if s.status<>'in_progress' and state.started_at is not null then
  elapsed := least(state.duration_minutes*60000,elapsed+greatest(0,floor(extract(epoch from
   (least(coalesce(s.completed_at,s.updated_at),s.ends_at)-state.started_at))*1000))::integer);
 end if;
 return result || jsonb_build_object('serverNow',clock_timestamp(),'roomSync',jsonb_build_object(
  'eligible',eligible,'ready',state.activated_at is not null,
  'timer',case when state.activated_at is not null then jsonb_build_object('duration_minutes',state.duration_minutes,
   'elapsed_ms',elapsed,'started_at',case when s.status='in_progress' then state.started_at else null end,'revision',state.revision) else null end));
end $$;

create function public.control_pomodoro_v2(session uuid,command text,expected_revision bigint,minutes integer default null)
returns void language plpgsql security definer set search_path='' as $$
declare s public.study_sessions; state public.room_sync_state; at_time timestamptz; elapsed integer;
begin
 select * into s from public.study_sessions where id=session for update;
 at_time := clock_timestamp();
 if auth.uid() is null or s.id is null or auth.uid() not in (s.creator_id,s.partner_id) then raise exception 'Session participant access required'; end if;
 if s.status<>'in_progress' or at_time<s.starts_at or at_time>=s.ends_at then raise exception 'Pomodoro requires an active study session'; end if;
 select * into state from public.room_sync_state where session_id=session for update;
 if state.activated_at is null then raise exception 'Both participants must open the updated room'; end if;
 if expected_revision is distinct from state.revision then raise exception 'Pomodoro vừa thay đổi. Hãy thử lại sau khi phòng cập nhật.'; end if;
 if command is null or command not in ('start','pause','reset') or (minutes is not null and (command<>'reset' or minutes not in (25,50))) then raise exception 'Invalid Pomodoro control'; end if;
 elapsed := least(state.duration_minutes*60000,state.elapsed_ms+case when state.started_at is null then 0 else greatest(0,floor(extract(epoch from (at_time-state.started_at))*1000))::integer end);
 if command='start' then
  if elapsed>=state.duration_minutes*60000 then raise exception 'Reset the completed Pomodoro first'; end if;
  if state.started_at is not null then return; end if;
  update public.room_sync_state set started_at=at_time,revision=revision+1 where session_id=session;
 elsif command='pause' then
  update public.room_sync_state set elapsed_ms=elapsed,started_at=null,revision=revision+1 where session_id=session;
 else
  update public.room_sync_state set duration_minutes=coalesce(minutes,state.duration_minutes),elapsed_ms=0,started_at=null,revision=revision+1 where session_id=session;
 end if;
end $$;
revoke all on function public.join_room_sync(uuid), public.get_room_v2(uuid),public.control_pomodoro_v2(uuid,text,bigint,integer) from public,anon;
grant execute on function public.join_room_sync(uuid), public.get_room_v2(uuid),public.control_pomodoro_v2(uuid,text,bigint,integer) to authenticated;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and
  not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_sync_state') then
  alter publication supabase_realtime add table public.room_sync_state;
 end if;
end $$;
notify pgrst, 'reload schema';
commit;
-- Activation is deliberately separate: see docs/ROOM_SYNC.md after deploying compatible frontend.
