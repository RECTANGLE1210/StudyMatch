-- StudyMatch live MVP. Apply after 202611040001; no fake users or activity.
begin;
alter table public.profiles add column avatar_path text;
alter table public.profiles add constraint avatar_owned_path check(avatar_path is null or avatar_path like id::text || '/%');
alter table public.session_resources add column kind text not null default 'doc' check(kind in ('doc','quiz'));
alter table public.session_resources drop constraint session_resources_check;
alter table public.session_resources add constraint session_resources_payload check(
 (storage_path is not null and external_url is null and mime_type is not null and size_bytes is not null and size_bytes between 1 and 10485760 and mime_type in ('application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'))
 or (storage_path is null and external_url is not null and mime_type is null and size_bytes is null));
update storage.buckets set allowed_mime_types=array['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'] where id='session-materials';
grant insert(kind) on public.session_resources to authenticated;
alter policy resources_add on public.session_resources with check(uploader_id=auth.uid() and private.session_editable(session_id) and (storage_path is null or exists(select 1 from storage.objects o where o.bucket_id='session-materials' and o.name=session_resources.storage_path)));
create table public.user_reports (
 id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles,
 reported_id uuid not null references public.profiles, reason text not null check(length(reason) between 1 and 1000),
 created_at timestamptz not null default now(), check(reporter_id<>reported_id)
);
alter table public.user_reports enable row level security;
revoke all on public.user_reports from anon,authenticated;
grant select on public.user_reports to authenticated;
create policy own_reports on public.user_reports for select to authenticated using(reporter_id=auth.uid());
create index user_reports_reporter on public.user_reports(reporter_id);

create function public.get_profile_snapshot(target uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.display_name,'uni',coalesce(u.name,''),'major',coalesce(m.name,''),'bio',p.bio,
 'avatar',p.avatar_url,'avatarPath',p.avatar_path,'goals',p.goals,'styles',p.styles,'timezone',p.timezone,'onboardingCompleted',p.onboarding_completed,
 'subjects',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'code',s.code,'level',(array['Mới bắt đầu','Trung bình','Nâng cao'])[us.proficiency+1],
 'strong',coalesce((select jsonb_agg(t.name order by t.name) from public.user_topics ut join public.topics t on t.id=ut.topic_id where ut.user_id=p.id and ut.subject_id=s.id and ut.knowledge='strong'),'[]'::jsonb),
 'weak',coalesce((select jsonb_agg(t.name order by t.name) from public.user_topics ut join public.topics t on t.id=ut.topic_id where ut.user_id=p.id and ut.subject_id=s.id and ut.knowledge='weak'),'[]'::jsonb)) order by s.name)
 from public.user_subjects us join public.subjects s on s.id=us.subject_id where us.user_id=p.id),'[]'::jsonb),
 'weeklyAvailability',coalesce((select jsonb_agg(jsonb_build_object('day',a.day,'start',a.start_minute,'end',a.end_minute) order by a.day,a.start_minute) from public.user_availability a where a.user_id=p.id),'[]'::jsonb))
 from public.profiles p left join public.universities u on u.id=p.university_id left join public.majors m on m.id=p.major_id where p.id=target;
$$;

create function public.save_profile_view(profile jsonb,complete boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); uni uuid; major uuid; subject uuid; topic uuid; item jsonb; slot jsonb; topic_name text; knowledge text;
 normalized jsonb:='[]'; strong_ids jsonb; weak_ids jsonb; availability jsonb:='[]'; day_index integer; start_time integer;
 slot_days text[]:=array['CN','T2','T3','T4','T5','T6','T7']; slot_name text; owned_avatar_path text:=nullif(profile->>'avatarPath','');
begin
 if me is null then raise exception 'Authentication required'; end if;
 if profile ? 'id' and (profile->>'id')::uuid<>me then raise exception 'Authentication changed while editing profile'; end if;
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if coalesce(length(trim(profile->>'name')),0) not between 1 and 100 or coalesce(length(profile->>'bio'),0)>200 then raise exception 'Invalid profile name or bio'; end if;
 if coalesce(jsonb_typeof(profile->'subjects'),'null')<>'array' or coalesce(jsonb_typeof(profile->'avail'),'null')<>'array' then raise exception 'Learning arrays required'; end if;
 if coalesce(jsonb_typeof(profile->'goals'),'null')<>'array' or coalesce(jsonb_typeof(profile->'styles'),'null')<>'array' then raise exception 'Goal/style arrays required'; end if;
 if jsonb_array_length(profile->'goals')>20 or jsonb_array_length(profile->'styles')>20 or exists(select 1 from jsonb_array_elements((profile->'goals')||(profile->'styles')) e(value) where jsonb_typeof(value)<>'string' or length(trim(value#>>'{}')) not between 1 and 150) then raise exception 'Invalid goals/styles'; end if;
 if jsonb_array_length(profile->'subjects')>100 or jsonb_array_length(profile->'avail')>21 then raise exception 'Profile too large'; end if;
 if owned_avatar_path is not null and (owned_avatar_path not like me::text || '/%' or not exists(select 1 from storage.objects where bucket_id='avatars' and name=owned_avatar_path)) then raise exception 'Invalid avatar ownership'; end if;
 if nullif(trim(profile->>'uni'),'') is not null then
  if length(profile->>'uni')>200 then raise exception 'University name too long'; end if;
  insert into public.universities(name) values(trim(profile->>'uni')) on conflict(name) do update set name=excluded.name returning id into uni;
 end if;
 if nullif(trim(profile->>'major'),'') is not null then
  if length(profile->>'major')>200 then raise exception 'Major name too long'; end if;
  insert into public.majors(name) values(trim(profile->>'major')) on conflict(name) do update set name=excluded.name returning id into major;
 end if;
 for item in select * from jsonb_array_elements(profile->'subjects') loop
  if coalesce(length(trim(item->>'name')),0) not between 1 and 200 then raise exception 'Invalid subject name'; end if;
  select id into subject from public.subjects where name=trim(item->>'name');
  if subject is null then
   insert into public.subjects(code,name) values('SM-'||gen_random_uuid()::text,trim(item->>'name')) on conflict(name) do update set name=excluded.name returning id into subject;
  end if;
  strong_ids:='[]'; weak_ids:='[]';
  foreach knowledge in array array['strong','weak'] loop
   if coalesce(jsonb_typeof(item->knowledge),'null')<>'array' or jsonb_array_length(item->knowledge)>100 then raise exception 'Invalid topic list'; end if;
   for topic_name in select jsonb_array_elements_text(item->knowledge) loop
    if length(trim(topic_name)) not between 1 and 200 then raise exception 'Invalid topic'; end if;
    insert into public.topics(subject_id,name) values(subject,trim(topic_name)) on conflict(subject_id,name) do update set name=excluded.name returning id into topic;
    if knowledge='strong' then strong_ids:=strong_ids||jsonb_build_array(topic); else weak_ids:=weak_ids||jsonb_build_array(topic); end if;
   end loop;
  end loop;
  normalized:=normalized||jsonb_build_array(jsonb_build_object('subject_id',subject,'proficiency',array_position(array['Mới bắt đầu','Trung bình','Nâng cao'],item->>'level')-1,'strong',strong_ids,'weak',weak_ids));
 end loop;
 for slot in select * from jsonb_array_elements(profile->'avail') loop
  day_index:=array_position(slot_days,split_part(slot#>>'{}','-',1))-1;
  slot_name:=split_part(slot#>>'{}','-',2);
  start_time:=case slot_name when 'Sáng' then 480 when 'Chiều' then 780 when 'Tối' then 1080 else null end;
  if day_index is null or start_time is null then raise exception 'Invalid weekly slot'; end if;
  availability:=availability||jsonb_build_array(jsonb_build_object('day',day_index,'start_minute',start_time,'end_minute',start_time+180));
 end loop;
 perform public.save_learning_profile(jsonb_build_object('display_name',trim(profile->>'name'),'avatar_url',nullif(profile->>'avatar',''),'university_id',uni,'major_id',major,'bio',coalesce(profile->>'bio',''),'goals',profile->'goals','styles',profile->'styles','timezone',profile->>'timezone','onboarding_completed',complete),normalized,availability);
 update public.profiles set avatar_path=owned_avatar_path where id=me;
end $$;

create function public.find_candidate_profiles(subject uuid,page_index integer default 0) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(public.get_profile_snapshot(q.id)),'[]'::jsonb) from
 (select p.id from public.profiles p join public.user_subjects us on us.user_id=p.id where p.onboarding_completed and p.id<>auth.uid() and us.subject_id=subject order by p.id limit 50 offset greatest(0,page_index)*50) q;
$$;

-- Private avatars; user photos are visible only to authenticated users allowed to read the owner's profile.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,2000000,array['image/png','image/jpeg','image/webp']);
create function private.can_read_avatar(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()::text=split_part(path,'/',1) or exists(select 1 from public.profiles p where p.id::text=split_part(path,'/',1) and private.profile_visible(p.id));
$$;
revoke all on function private.can_read_avatar(text) from public,anon,authenticated;
grant execute on function private.can_read_avatar(text) to authenticated;
create policy avatars_read on storage.objects for select to authenticated using(bucket_id='avatars' and private.can_read_avatar(name));
create policy avatars_add on storage.objects for insert to authenticated with check(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=2);
create policy avatars_remove on storage.objects for delete to authenticated using(bucket_id='avatars' and split_part(name,'/',1)=auth.uid()::text);

-- Expired sessions cannot be edited just because no client has reconciled their status yet.
create or replace function private.session_editable(session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.study_sessions s where s.id=session and auth.uid() in (s.creator_id,s.partner_id)
 and ((s.status='proposed' and s.starts_at>now()) or (s.status in ('scheduled','in_progress') and s.ends_at>now())));
$$;

-- Topic selection is transactional and always scoped to a session's subject.
create function public.set_session_topics(session uuid,topic_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare s public.study_sessions;
begin
 select * into s from public.study_sessions where id=session for update;
 if auth.uid() is null or s.id is null or auth.uid()<>s.creator_id or s.status not in ('proposed','scheduled') then raise exception 'Only proposer may edit session topics'; end if;
 if exists(select 1 from unnest(topic_ids) t where not exists(select 1 from public.topics where id=t and subject_id=s.subject_id)) then raise exception 'Topic belongs to another subject'; end if;
 delete from public.session_topics where session_id=session;
 insert into public.session_topics select session,t from (select distinct unnest(topic_ids) t) q;
end $$;
create function public.propose_study_session(partner uuid,subject uuid,starts timestamptz,ends timestamptz,topic_ids uuid[],goal text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 result:=public.propose_session(partner,subject,starts,ends);
 perform public.set_session_topics(result,topic_ids);
 if nullif(trim(goal),'') is not null then insert into public.session_goals(session_id,title) values(result,trim(goal)); end if;
 return result;
end $$;
create function public.reschedule_study_session(session uuid,starts timestamptz,ends timestamptz,topic_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$ begin
 perform public.reschedule_session(session,starts,ends); perform public.set_session_topics(session,topic_ids);
end $$;

-- Blocking also withdraws pending communication and cancels active sessions in the same transaction.
create function private.on_user_blocked() returns trigger language plpgsql security definer set search_path='' as $$ begin
 update public.match_requests set status='cancelled' where status in ('pending','accepted') and least(sender_id,recipient_id)=least(new.blocker_id,new.blocked_id) and greatest(sender_id,recipient_id)=greatest(new.blocker_id,new.blocked_id);
 with cancelled as (update public.study_sessions set status='cancelled' where status in ('proposed','scheduled','in_progress') and least(creator_id,partner_id)=least(new.blocker_id,new.blocked_id) and greatest(creator_id,partner_id)=greatest(new.blocker_id,new.blocked_id) returning id,creator_id,partner_id)
 insert into public.notifications(user_id,kind,entity_id) select recipients.user_id,'session_cancelled',c.id from cancelled c cross join lateral (values(c.creator_id),(c.partner_id)) recipients(user_id);
 return new;
end $$;
revoke all on function private.on_user_blocked() from public,anon,authenticated;
create trigger block_cancels_active after insert on public.user_blocks for each row execute function private.on_user_blocked();
create function public.block_user(target uuid,reason text default '') returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null or target=auth.uid() then raise exception 'Invalid block'; end if;
 insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),target) on conflict do nothing;
 if nullif(trim(reason),'') is not null then insert into public.user_reports(reporter_id,reported_id,reason) values(auth.uid(),target,trim(reason)); end if;
end $$;
create function public.unblock_user(target uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=target;
end $$;

-- Lazy reconciliation is safe to call on workspace load; historical times remain server-owned.
create function public.refresh_session_statuses() returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.study_sessions set status='missed' where auth.uid() in (creator_id,partner_id) and status='scheduled' and ends_at<=now();
 update public.study_sessions set status='completed',completed_at=ends_at where auth.uid() in (creator_id,partner_id) and status='in_progress' and ends_at<=now();
 with cancelled as (update public.study_sessions set status='cancelled' where auth.uid() in (creator_id,partner_id) and status='proposed' and starts_at<=now() returning id,creator_id,partner_id)
 insert into public.notifications(user_id,kind,entity_id) select recipients.user_id,'session_cancelled',c.id from cancelled c cross join lateral (values(c.creator_id),(c.partner_id)) recipients(user_id);
end $$;

create function public.get_session_snapshot(session uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select to_jsonb(s)||jsonb_build_object('subjectName',su.name,'creator',public.get_profile_snapshot(s.creator_id),'partner',public.get_profile_snapshot(s.partner_id),
 'topics',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)) from public.session_topics st join public.topics t on t.id=st.topic_id where st.session_id=s.id),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(a.user_id) from public.session_attendance a where a.session_id=s.id),'[]'::jsonb))
 from public.study_sessions s join public.subjects su on su.id=s.subject_id where s.id=session;
$$;
create function public.get_progress() returns jsonb language sql stable security invoker set search_path='' as $$
 with mine as (select * from public.study_sessions where auth.uid() in (creator_id,partner_id)),
 done as (select * from mine where status='completed'),
 zone as (select coalesce((select timezone from public.profiles where id=auth.uid()),'UTC') tz)
 select jsonb_build_object('totalMinutes',coalesce((select sum(extract(epoch from completed_at-started_at)/60) from done),0),
 'completedSessions',(select count(*) from done),'missedSessions',(select count(*) from mine where status='missed'),
 'partnerCount',(select count(distinct case when creator_id=auth.uid() then partner_id else creator_id end) from done),
 'completedGoals',(select count(*) from public.session_goals g join done d on d.id=g.session_id where g.completed),
 'daily',coalesce((select jsonb_agg(jsonb_build_object('date',day_key,'minutes',minutes) order by day_key) from
 (select (completed_at at time zone zone.tz)::date as day_key,sum(extract(epoch from completed_at-started_at)/60) minutes from done cross join zone where completed_at>=now()-interval '8 days' group by day_key) q),'[]'::jsonb));
$$;
create function public.get_workspace() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 perform public.refresh_session_statuses();
 select jsonb_build_object(
 'invitations',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('sender',public.get_profile_snapshot(r.sender_id),'recipient',public.get_profile_snapshot(r.recipient_id),'subjectName',s.name) order by r.created_at desc) from public.match_requests r join public.subjects s on s.id=r.subject_id where auth.uid() in (r.sender_id,r.recipient_id)),'[]'::jsonb),
 'conversations',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'peer',public.get_profile_snapshot(case when c.user_low=auth.uid() then c.user_high else c.user_low end),
 'lastMessage',(select to_jsonb(m) from public.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1),
 'unread',(select count(*) from public.messages m join public.conversation_participants cp on cp.conversation_id=m.conversation_id and cp.user_id=auth.uid() where m.conversation_id=c.id and m.sender_id<>auth.uid() and m.created_at>cp.last_read_at)) order by c.created_at desc) from public.conversations c),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(public.get_session_snapshot(s.id) order by s.starts_at desc) from public.study_sessions s where auth.uid() in (s.creator_id,s.partner_id)),'[]'::jsonb),
 'resources',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('subjectName',su.name,'uploaderName',p.display_name) order by r.created_at desc) from public.session_resources r join public.study_sessions s on s.id=r.session_id join public.subjects su on su.id=s.subject_id left join public.profiles p on p.id=r.uploader_id),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(q order by q.created_at desc) from (select * from public.notifications where user_id=auth.uid() order by created_at desc limit 100) q),'[]'::jsonb),
 'unreadNotifications',(select count(*) from public.notifications where user_id=auth.uid() and read_at is null and kind<>'invitation'),
 'blockedUsers',coalesce((select jsonb_agg(blocked_id) from public.user_blocks where blocker_id=auth.uid()),'[]'::jsonb),
 'progress',public.get_progress()) into result;
 return result;
end $$;
create function public.get_room(session uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.is_session_member(session) then raise exception 'Session participant access required'; end if;
 select jsonb_build_object('session',public.get_session_snapshot(session),
 'goals',coalesce((select jsonb_agg(g order by g.created_at) from public.session_goals g where g.session_id=session),'[]'::jsonb),
 'resources',coalesce((select jsonb_agg(r order by r.created_at) from public.session_resources r where r.session_id=session),'[]'::jsonb),
 'feedback',(select to_jsonb(f) from public.session_feedback f where f.session_id=session and f.user_id=auth.uid())) into result;
 return result;
end $$;

-- Material attachment is collaborative but cannot change its session/owner or progress metadata.
alter table public.session_resources add column attached boolean not null default true;
create function public.attach_resource(resource uuid,attached boolean) returns void language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 select session_id into target from public.session_resources where id=resource for update;
 if target is null or not private.session_editable(target) then raise exception 'Editable session participant access required'; end if;
 update public.session_resources set attached=attach_resource.attached where id=resource;
end $$;
create function public.remove_session_goal(goal uuid) returns void language plpgsql security definer set search_path='' as $$
declare session uuid;
begin
 select session_id into session from public.session_goals where id=goal for update;
 if session is null or not private.session_editable(session) then raise exception 'Editable session participant access required'; end if;
 delete from public.session_goals where id=goal;
end $$;

create function public.mark_all_notifications_read() returns void language plpgsql security definer set search_path='' as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.notifications set read_at=now() where user_id=auth.uid() and read_at is null;
end $$;

create function public.message_page(conversation uuid,before_at timestamptz default null,before_id uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.can_converse(conversation) then raise exception 'Conversation participant access required'; end if;
 select coalesce(jsonb_agg(q order by q.created_at,q.id),'[]'::jsonb) into result from
 (select * from public.messages where conversation_id=conversation and (before_at is null or (created_at,id)<(before_at,before_id)) order by created_at desc,id desc limit 50) q;
 return result;
end $$;
create or replace function public.mark_conversation_read(conversation uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.can_converse(conversation) then raise exception 'Participant access required'; end if;
 update public.conversation_participants set last_read_at=now() where conversation_id=conversation and user_id=auth.uid();
 update public.notifications n set read_at=coalesce(read_at,now()) where n.user_id=auth.uid() and n.kind='message' and exists(select 1 from public.messages m where m.id=n.entity_id and m.conversation_id=conversation and m.created_at<=now());
end $$;

-- Browser roles can execute only the explicitly listed application entry points.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('get_profile_snapshot','save_profile_view','find_candidate_profiles','set_session_topics','propose_study_session','reschedule_study_session','block_user','unblock_user','refresh_session_statuses','get_session_snapshot','get_progress','get_workspace','get_room','attach_resource','remove_session_goal','mark_all_notifications_read','message_page') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
-- Realtime events still honor per-table RLS; table publication never grants read permissions.
do $$ declare t text; begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['profiles','match_requests','conversation_participants','study_sessions','session_attendance','session_goals','session_resources','session_feedback','user_blocks'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
  end loop;
 end if;
end $$;
commit;
