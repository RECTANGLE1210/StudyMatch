-- Apply to a new Supabase project. No remote database is modified by this file.
begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.universities (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.majors (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.subjects (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null unique);
create table public.topics (
 id uuid primary key default gen_random_uuid(), subject_id uuid not null references public.subjects on delete cascade,
 name text not null, unique(subject_id,name), unique(id,subject_id)
);
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null check(length(trim(display_name)) between 1 and 100), avatar_url text check(avatar_url is null or avatar_url ~ '^https://'),
 university_id uuid references public.universities, major_id uuid references public.majors,
 bio text not null default '' check(length(bio)<=200), goals text[] not null default '{}', styles text[] not null default '{}',
 timezone text not null default 'Asia/Ho_Chi_Minh', onboarding_completed boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_subjects (
 user_id uuid not null references public.profiles on delete cascade, subject_id uuid not null references public.subjects,
 proficiency smallint not null check(proficiency between 0 and 2), primary key(user_id,subject_id)
);
create table public.user_topics (
 user_id uuid not null, subject_id uuid not null, topic_id uuid not null, knowledge text not null check(knowledge in ('strong','weak')),
 primary key(user_id,subject_id,topic_id), foreign key(user_id,subject_id) references public.user_subjects on delete cascade,
 foreign key(topic_id,subject_id) references public.topics(id,subject_id)
);
create table public.user_availability (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 day smallint not null check(day between 0 and 6), start_minute smallint not null check(start_minute>=0), end_minute smallint not null check(end_minute<=1440),
 check(start_minute<end_minute), unique(user_id,day,start_minute,end_minute)
);
create table public.user_blocks (
 blocker_id uuid not null references public.profiles on delete cascade, blocked_id uuid not null references public.profiles on delete cascade,
 created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
create table public.match_requests (
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles, recipient_id uuid not null references public.profiles,
 subject_id uuid not null references public.subjects, status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(sender_id<>recipient_id)
);
create unique index match_requests_active_pair on public.match_requests(least(sender_id,recipient_id),greatest(sender_id,recipient_id)) where status in ('pending','accepted');
create index match_requests_recipient on public.match_requests(recipient_id,created_at desc);
create table public.conversations (
 id uuid primary key default gen_random_uuid(), user_low uuid not null references public.profiles, user_high uuid not null references public.profiles,
 created_at timestamptz not null default now(), check(user_low<user_high), unique(user_low,user_high)
);
create table public.conversation_participants (
 conversation_id uuid not null references public.conversations on delete cascade, user_id uuid not null references public.profiles,
 last_read_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
create table public.messages (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations on delete cascade,
 sender_id uuid not null references public.profiles, body text not null check(length(trim(body)) between 1 and 4000),
 created_at timestamptz not null default now(), foreign key(conversation_id,sender_id) references public.conversation_participants(conversation_id,user_id)
);
create index messages_history on public.messages(conversation_id,created_at desc,id);
create table public.study_sessions (
 id uuid primary key default gen_random_uuid(), creator_id uuid not null references public.profiles, partner_id uuid not null references public.profiles,
 subject_id uuid not null references public.subjects,
 status text not null default 'proposed' check(status in ('proposed','scheduled','in_progress','completed','rejected','cancelled','missed')),
 starts_at timestamptz not null, ends_at timestamptz not null, started_at timestamptz, completed_at timestamptz,
 meet_link text check(meet_link is null or meet_link ~ '^https://meet[.]google[.]com/[a-z0-9-]+$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(creator_id<>partner_id), check(ends_at>starts_at and ends_at-starts_at<=interval '8 hours'),
 check(completed_at is null or (started_at is not null and completed_at>=started_at)),
 check(status<>'completed' or completed_at is not null)
);
create index study_sessions_creator on public.study_sessions(creator_id,starts_at);
create index study_sessions_partner on public.study_sessions(partner_id,starts_at);
create table public.session_topics (
 session_id uuid not null references public.study_sessions on delete cascade, topic_id uuid not null references public.topics,
 primary key(session_id,topic_id)
);
create table public.session_attendance (
 session_id uuid not null references public.study_sessions on delete cascade, user_id uuid not null references public.profiles,
 confirmed_at timestamptz not null default now(), primary key(session_id,user_id)
);
create table public.session_goals (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_sessions on delete cascade,
 title text not null check(length(trim(title)) between 1 and 300), completed boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.session_resources (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.study_sessions on delete cascade,
 uploader_id uuid not null references public.profiles, name text not null check(length(trim(name)) between 1 and 255),
 storage_path text unique, external_url text check(external_url is null or external_url ~ '^https://'), mime_type text, size_bytes bigint,
 created_at timestamptz not null default now(),
 check((storage_path is not null and external_url is null and mime_type is not null and size_bytes is not null and mime_type in ('application/pdf','image/png','image/jpeg','image/webp') and size_bytes between 1 and 10485760)
 or (storage_path is null and external_url is not null and mime_type is null and size_bytes is null)),
 check(storage_path is null or storage_path like session_id::text || '/' || uploader_id::text || '/%')
);
create index session_resources_session on public.session_resources(session_id);
create table public.session_feedback (
 session_id uuid not null references public.study_sessions on delete cascade, user_id uuid not null references public.profiles,
 rating smallint not null check(rating between 1 and 5), comment text not null default '' check(length(comment)<=1000),
 created_at timestamptz not null default now(), primary key(session_id,user_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 kind text not null check(kind in ('invitation','invitation_accepted','message','session_proposed','session_confirmed','session_cancelled')),
 entity_id uuid not null, read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_inbox on public.notifications(user_id,created_at desc);
create index user_subjects_subject on public.user_subjects(subject_id,user_id);
create index conversation_participants_user on public.conversation_participants(user_id);

-- Definer helpers live outside the exposed public schema; fixed search_path prevents object shadowing.
create function private.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create function private.can_converse(conversation uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversations c where c.id=conversation and auth.uid() in (c.user_low,c.user_high) and not private.is_blocked(c.user_low,c.user_high));
$$;
create function private.is_session_member(session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.study_sessions s where s.id=session and auth.uid() in (s.creator_id,s.partner_id));
$$;
create function private.session_editable(session uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.study_sessions s where s.id=session and auth.uid() in (s.creator_id,s.partner_id) and s.status in ('proposed','scheduled','in_progress'));
$$;
create function private.profile_visible(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid()=target or (auth.uid() is not null and not private.is_blocked(auth.uid(),target));
$$;
create function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger requests_updated before update on public.match_requests for each row execute function private.touch_updated_at();
create trigger sessions_updated before update on public.study_sessions for each row execute function private.touch_updated_at();

-- Deny by default. No browser role can write progress timestamps, participants, messages, notifications or state columns directly.
do $$ declare t text; begin
 foreach t in array array['universities','majors','subjects','topics','profiles','user_subjects','user_topics','user_availability','user_blocks','match_requests','conversations','conversation_participants','messages','study_sessions','session_topics','session_attendance','session_goals','session_resources','session_feedback','notifications'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['universities','majors','subjects','topics'] loop
  execute format('create policy catalog_read on public.%I for select to authenticated using (true)',t);
 end loop;
 foreach t in array array['profiles','user_subjects','user_topics','user_availability'] loop
  execute format('create policy profile_read on public.%I for select to authenticated using (private.profile_visible(%I))',t,case when t='profiles' then 'id' else 'user_id' end);
 end loop;
end $$;
create policy blocks_read on public.user_blocks for select to authenticated using (blocker_id=auth.uid());
create policy blocks_add on public.user_blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy blocks_remove on public.user_blocks for delete to authenticated using(blocker_id=auth.uid());
grant insert,delete on public.user_blocks to authenticated;
create policy requests_read on public.match_requests for select to authenticated using(auth.uid() in (sender_id,recipient_id));
create policy conversations_read on public.conversations for select to authenticated using(private.can_converse(id));
create policy participants_read on public.conversation_participants for select to authenticated using(private.can_converse(conversation_id));
create policy messages_read on public.messages for select to authenticated using(private.can_converse(conversation_id));
create policy sessions_read on public.study_sessions for select to authenticated using(private.is_session_member(id));
do $$ declare t text; begin
 foreach t in array array['session_topics','session_attendance','session_goals','session_resources','session_feedback'] loop
  execute format('create policy session_read on public.%I for select to authenticated using(private.is_session_member(session_id))',t);
 end loop;
end $$;
create policy goals_add on public.session_goals for insert to authenticated with check(private.session_editable(session_id) and not completed);
create policy goals_edit on public.session_goals for update to authenticated using(private.session_editable(session_id)) with check(private.session_editable(session_id));
grant insert(session_id,title),update(completed) on public.session_goals to authenticated;
create policy resources_add on public.session_resources for insert to authenticated with check(uploader_id=auth.uid() and private.session_editable(session_id));
create policy resources_delete on public.session_resources for delete to authenticated using(uploader_id=auth.uid() and private.is_session_member(session_id));
grant insert(session_id,uploader_id,name,storage_path,external_url,mime_type,size_bytes),delete on public.session_resources to authenticated;
create policy feedback_add on public.session_feedback for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.study_sessions where id=session_id and status='completed'));
create policy feedback_edit on public.session_feedback for update to authenticated using(user_id=auth.uid() and private.is_session_member(session_id)) with check(user_id=auth.uid() and private.is_session_member(session_id));
grant insert(session_id,user_id,rating,comment),update(rating,comment) on public.session_feedback to authenticated;
create policy notifications_read on public.notifications for select to authenticated using(user_id=auth.uid());

create function public.save_learning_profile(profile jsonb,subjects jsonb,availability jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); s jsonb; a jsonb; topic text; tz text:=profile->>'timezone';
begin
 if me is null then raise exception 'Authentication required'; end if;
 -- Serialize replacements so concurrent saves cannot merge partial profile data.
 perform pg_advisory_xact_lock(hashtextextended(me::text,0));
 if coalesce(jsonb_typeof(subjects),'null')<>'array' or coalesce(jsonb_typeof(availability),'null')<>'array' or coalesce(jsonb_typeof(profile->'goals'),'null')<>'array' or coalesce(jsonb_typeof(profile->'styles'),'null')<>'array' then raise exception 'Arrays required'; end if;
 if not exists(select 1 from pg_timezone_names where name=tz) then raise exception 'Invalid IANA timezone'; end if;
 if coalesce((profile->>'onboarding_completed')::boolean,false) and
  (jsonb_array_length(subjects)=0 or jsonb_array_length(availability)=0 or jsonb_array_length(coalesce(profile->'goals','[]'))=0 or jsonb_array_length(coalesce(profile->'styles','[]'))=0 or profile->>'university_id' is null or profile->>'major_id' is null)
 then raise exception 'Complete university, major, subjects, goals, styles and availability'; end if;
 insert into public.profiles(id,display_name,avatar_url,university_id,major_id,bio,goals,styles,timezone,onboarding_completed)
 values(me,trim(profile->>'display_name'),nullif(profile->>'avatar_url',''),(profile->>'university_id')::uuid,(profile->>'major_id')::uuid,
 coalesce(profile->>'bio',''),array(select jsonb_array_elements_text(profile->'goals')),array(select jsonb_array_elements_text(profile->'styles')),tz,coalesce((profile->>'onboarding_completed')::boolean,false))
 on conflict(id) do update set display_name=excluded.display_name,avatar_url=excluded.avatar_url,university_id=excluded.university_id,major_id=excluded.major_id,bio=excluded.bio,goals=excluded.goals,styles=excluded.styles,timezone=excluded.timezone,onboarding_completed=excluded.onboarding_completed;
 delete from public.user_subjects where user_id=me;
 delete from public.user_availability where user_id=me;
 for s in select * from jsonb_array_elements(subjects) loop
  insert into public.user_subjects values(me,(s->>'subject_id')::uuid,(s->>'proficiency')::smallint);
  for topic in select jsonb_array_elements_text(s->'strong') loop
   insert into public.user_topics values(me,(s->>'subject_id')::uuid,topic::uuid,'strong');
  end loop;
  for topic in select jsonb_array_elements_text(s->'weak') loop
   insert into public.user_topics values(me,(s->>'subject_id')::uuid,topic::uuid,'weak');
  end loop;
 end loop;
 for a in select * from jsonb_array_elements(availability) loop
  insert into public.user_availability(user_id,day,start_minute,end_minute) values(me,(a->>'day')::smallint,(a->>'start_minute')::smallint,(a->>'end_minute')::smallint);
 end loop;
end $$;

create function public.send_invitation(recipient uuid,subject uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid(); result uuid;
begin
 if me is null or me=recipient then raise exception 'Invalid invitation'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(me,recipient)::text || greatest(me,recipient)::text,0));
 if private.is_blocked(me,recipient) then raise exception 'Blocked relationship'; end if;
 if not exists(select 1 from public.user_subjects where user_id=me and subject_id=subject) or not exists(select 1 from public.user_subjects where user_id=recipient and subject_id=subject) then raise exception 'Shared subject required'; end if;
 insert into public.match_requests(sender_id,recipient_id,subject_id) values(me,recipient,subject) returning id into result;
 insert into public.notifications(user_id,kind,entity_id) values(recipient,'invitation',result);
 return result;
end $$;
create function public.respond_invitation(request_id uuid,next_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.match_requests; conv uuid; me uuid:=auth.uid();
begin
 select * into r from public.match_requests where id=request_id for update;
 if me is null or r.id is null or r.status<>'pending' or
 not ((me=r.sender_id and next_status='cancelled') or (me=r.recipient_id and next_status in ('accepted','rejected'))) then raise exception 'Invalid invitation transition'; end if;
 if next_status='accepted' and private.is_blocked(r.sender_id,r.recipient_id) then raise exception 'Blocked relationship'; end if;
 update public.match_requests set status=next_status where id=r.id;
 if next_status='accepted' then
  insert into public.conversations(user_low,user_high) values(least(r.sender_id,r.recipient_id),greatest(r.sender_id,r.recipient_id)) on conflict(user_low,user_high) do update set user_low=excluded.user_low returning id into conv;
  insert into public.conversation_participants(conversation_id,user_id) values(conv,r.sender_id),(conv,r.recipient_id) on conflict do nothing;
  insert into public.notifications(user_id,kind,entity_id) values(r.sender_id,'invitation_accepted',r.id);
 end if;
 return conv;
end $$;
create function public.send_message(conversation uuid,content text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not private.can_converse(conversation) then raise exception 'Participant access required'; end if;
 insert into public.messages(conversation_id,sender_id,body) values(conversation,auth.uid(),trim(content)) returning id into result;
 insert into public.notifications(user_id,kind,entity_id) select user_id,'message',result from public.conversation_participants where conversation_id=conversation and user_id<>auth.uid();
 return result;
end $$;
create function public.mark_conversation_read(conversation uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.can_converse(conversation) then raise exception 'Participant access required'; end if;
 update public.conversation_participants set last_read_at=now() where conversation_id=conversation and user_id=auth.uid();
end $$;

create function public.propose_session(partner uuid,subject uuid,starts timestamptz,ends timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; me uuid:=auth.uid();
begin
 if me is null or me=partner or starts<=now() or ends<=starts or ends-starts>interval '8 hours' or private.is_blocked(me,partner) then raise exception 'Invalid session proposal'; end if;
 if not exists(select 1 from public.conversations where user_low=least(me,partner) and user_high=greatest(me,partner)) then raise exception 'Accepted connection required'; end if;
 if not exists(select 1 from public.user_subjects where user_id=me and subject_id=subject) or not exists(select 1 from public.user_subjects where user_id=partner and subject_id=subject) then raise exception 'Shared subject required'; end if;
 insert into public.study_sessions(creator_id,partner_id,subject_id,starts_at,ends_at) values(me,partner,subject,starts,ends) returning id into result;
 insert into public.notifications(user_id,kind,entity_id) values(partner,'session_proposed',result);
 return result;
end $$;
create function public.confirm_attendance(session uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 perform 1 from public.study_sessions where id=session and status in ('scheduled','in_progress') and auth.uid() in (creator_id,partner_id) for update;
 if not found then raise exception 'Scheduled participant access required'; end if;
 insert into public.session_attendance(session_id,user_id) values(session,auth.uid()) on conflict do nothing;
end $$;
create function public.transition_session(session uuid,next_status text) returns void language plpgsql security definer set search_path='' as $$
declare s public.study_sessions; me uuid:=auth.uid();
begin
 select * into s from public.study_sessions where id=session for update;
 if me is null or s.id is null or me not in (s.creator_id,s.partner_id) then raise exception 'Participant access required'; end if;
 if not ((s.status='proposed' and next_status in ('scheduled','rejected','cancelled')) or (s.status='scheduled' and next_status in ('in_progress','cancelled','missed')) or (s.status='in_progress' and next_status in ('completed','cancelled'))) then raise exception 'Invalid session transition'; end if;
 if next_status in ('scheduled','rejected') and me<>s.partner_id then raise exception 'Only invited partner may respond'; end if;
 if next_status='scheduled' and (s.starts_at<=now() or private.is_blocked(s.creator_id,s.partner_id)) then raise exception 'Proposal expired or blocked'; end if;
 if next_status='in_progress' and (now()<s.starts_at or now()>=s.ends_at or (select count(*) from public.session_attendance where session_id=session)<>2) then raise exception 'Both participants must confirm attendance during the session'; end if;
 if next_status='missed' and (now()<s.ends_at or (select count(*) from public.session_attendance where session_id=session)=2) then raise exception 'Session not missed'; end if;
 if next_status='completed' and (s.started_at is null or now()<=s.started_at) then raise exception 'Session has no elapsed study time'; end if;
 update public.study_sessions set status=next_status, started_at=case when next_status='in_progress' then now() else started_at end,
 completed_at=case when next_status='completed' then least(now(),ends_at) else completed_at end where id=session;
 if next_status in ('scheduled','cancelled') then
  insert into public.notifications(user_id,kind,entity_id) values(case when me=s.creator_id then s.partner_id else s.creator_id end,case when next_status='scheduled' then 'session_confirmed' else 'session_cancelled' end,session);
 end if;
end $$;
create function public.reschedule_session(session uuid,starts timestamptz,ends timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare s public.study_sessions;
begin
 select * into s from public.study_sessions where id=session for update;
 if auth.uid() is null or s.id is null or auth.uid()<>s.creator_id or s.status not in ('proposed','scheduled') or starts<=now() or ends<=starts or ends-starts>interval '8 hours' or private.is_blocked(s.creator_id,s.partner_id) then raise exception 'Invalid reschedule; only proposer can reschedule'; end if;
 update public.study_sessions set starts_at=starts,ends_at=ends,status='proposed' where id=session;
 delete from public.session_attendance where session_id=session;
 insert into public.notifications(user_id,kind,entity_id) values(s.partner_id,'session_proposed',session);
end $$;
create function public.set_meet_link(session uuid,link text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not private.session_editable(session) then raise exception 'Editable participant access required'; end if;
 update public.study_sessions set meet_link=link where id=session;
end $$;
create function public.mark_notification_read(notification uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 update public.notifications set read_at=coalesce(read_at,now()) where id=notification and user_id=auth.uid();
end $$;

-- Explicit execution grants, including helpers used by RLS; no anonymous definer RPCs.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.can_converse(uuid),private.is_session_member(uuid),private.session_editable(uuid),private.profile_visible(uuid) to authenticated;
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname in ('save_learning_profile','send_invitation','respond_invitation','send_message','mark_conversation_read','propose_session','confirm_attendance','transition_session','reschedule_session','set_meet_link','mark_notification_read') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;

-- Private Storage: every object is scoped as session_id/uploader_id/random_uuid.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('session-materials','session-materials',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp']);
create function private.can_read_material(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.study_sessions s where s.id::text=split_part(path,'/',1) and auth.uid() in (s.creator_id,s.partner_id));
$$;
create function private.can_upload_material(path text) returns boolean language sql stable security definer set search_path='' as $$
 select split_part(path,'/',2)=auth.uid()::text and exists(select 1 from public.study_sessions s where s.id::text=split_part(path,'/',1) and auth.uid() in (s.creator_id,s.partner_id) and s.status in ('proposed','scheduled','in_progress'));
$$;
revoke all on function private.can_read_material(text),private.can_upload_material(text) from public,anon,authenticated;
grant execute on function private.can_read_material(text),private.can_upload_material(text) to authenticated;
create policy materials_read on storage.objects for select to authenticated using(bucket_id='session-materials' and private.can_read_material(name));
create policy materials_upload on storage.objects for insert to authenticated with check(bucket_id='session-materials' and private.can_upload_material(name) and array_length(string_to_array(name,'/'),1)=3);
create policy materials_delete on storage.objects for delete to authenticated using(bucket_id='session-materials' and split_part(name,'/',2)=auth.uid()::text and private.can_read_material(name));

-- Supabase project normally already has this publication. Enable message/notification change events.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.messages,public.notifications;
 end if;
end $$;
commit;
