-- Standalone library. Apply after 202611100001_product.sql; room-sync migrations are optional.
-- Existing session_resources, Storage policies and room RPCs are preserved for older clients.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

create table public.library_resources (
 id uuid primary key default gen_random_uuid(), uploader_id uuid not null,
 name text not null check(length(trim(name)) between 1 and 255),
 kind text not null default 'doc' check(kind in ('doc','quiz')),
 subject_name text not null default '' check(length(subject_name)<=200),
 visibility text not null default 'restricted' check(visibility in ('restricted','public')),
 storage_path text unique, external_url text,
 mime_type text, size_bytes bigint,
 created_at timestamptz not null default clock_timestamp(), deleted_at timestamptz,
 check((storage_path is not null and external_url is null and mime_type is not null and size_bytes is not null and size_bytes between 1 and 10485760
   and mime_type in ('application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain'))
  or (storage_path is null and external_url is not null and external_url ~ '^https://' and mime_type is null and size_bytes is null)),
 check(storage_path is null or storage_path=uploader_id::text||'/'||id::text)
);
create index library_by_owner on public.library_resources(uploader_id,created_at desc);
create index library_public on public.library_resources(created_at desc) where visibility='public' and deleted_at is null;
create table public.library_grants (
 resource_id uuid not null references public.library_resources on delete cascade,
 user_id uuid not null, created_at timestamptz not null default clock_timestamp(), primary key(resource_id,user_id)
);
create index library_grants_user on public.library_grants(user_id,resource_id);
create table public.library_attachments (
 resource_id uuid not null references public.library_resources on delete cascade,
 session_id uuid not null, attached_by uuid not null,
 created_at timestamptz not null default clock_timestamp(), primary key(resource_id,session_id)
);
create index library_attachments_session on public.library_attachments(session_id,resource_id);
-- Legacy-table FKs are deliberately avoided to keep rollout DDL off live profile/session tables.
-- All actor/target/session relationships are validated by the only allowed write APIs below.

create function private.can_read_library_resource(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.library_resources r where r.id=target and r.deleted_at is null and
 (r.uploader_id=auth.uid() or r.visibility='public' or exists(select 1 from public.library_grants g where g.resource_id=r.id and g.user_id=auth.uid())
 or exists(select 1 from public.library_attachments a join public.study_sessions s on s.id=a.session_id where a.resource_id=r.id and auth.uid() in (s.creator_id,s.partner_id))));
$$;
create function private.owns_library_resource(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.library_resources where id=target and uploader_id=auth.uid() and deleted_at is null);
$$;
create function private.can_read_library_file(path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (split_part(path,'/',1)=auth.uid()::text or exists(
 select 1 from public.library_resources r where r.storage_path=path and private.can_read_library_resource(r.id)));
$$;
revoke all on function private.can_read_library_resource(uuid),private.owns_library_resource(uuid),private.can_read_library_file(text) from public,anon;
grant execute on function private.can_read_library_resource(uuid),private.owns_library_resource(uuid),private.can_read_library_file(text) to authenticated;

alter table public.library_resources enable row level security;
alter table public.library_grants enable row level security;
alter table public.library_attachments enable row level security;
revoke all on public.library_resources,public.library_grants,public.library_attachments from public,anon,authenticated;
grant select on public.library_resources,public.library_grants,public.library_attachments to authenticated;
create policy library_read on public.library_resources for select to authenticated using(private.can_read_library_resource(id));
create policy library_grant_read on public.library_grants for select to authenticated using(user_id=auth.uid() or private.owns_library_resource(resource_id));
create policy library_attachment_read on public.library_attachments for select to authenticated using(private.is_session_member(session_id) or private.owns_library_resource(resource_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('library-materials','library-materials',false,10485760,
 array['application/pdf','image/png','image/jpeg','image/webp','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','text/plain']);
create policy library_files_read on storage.objects for select to authenticated using(bucket_id='library-materials' and private.can_read_library_file(name));
create policy library_files_upload on storage.objects for insert to authenticated with check(bucket_id='library-materials' and split_part(name,'/',1)=auth.uid()::text and array_length(string_to_array(name,'/'),1)=2);
create policy library_files_delete on storage.objects for delete to authenticated using(bucket_id='library-materials' and split_part(name,'/',1)=auth.uid()::text);

create function public.create_library_resource(resource uuid,title text,resource_kind text,subject text,access text,
 path text default null,link text default null,mime text default null,bytes bigint default null,attach_to uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare me uuid:=auth.uid();
begin
 if me is null or not exists(select 1 from public.profiles where id=me) then raise exception 'Authentication required'; end if;
 if resource is null or title is null or resource_kind is null or access is null then raise exception 'Invalid document metadata'; end if;
 if path is not null and (path<>me::text||'/'||resource::text or not exists(select 1 from storage.objects where bucket_id='library-materials' and name=path)) then raise exception 'Upload must exist and belong to the uploader'; end if;
 if attach_to is not null then
  perform 1 from public.study_sessions where id=attach_to for update;
  if not private.session_editable(attach_to) then raise exception 'Editable session participant access required'; end if;
 end if;
 insert into public.library_resources(id,uploader_id,name,kind,subject_name,visibility,storage_path,external_url,mime_type,size_bytes)
 values(resource,me,trim(title),resource_kind,trim(coalesce(subject,'')),access,path,link,mime,bytes);
 if attach_to is not null then insert into public.library_attachments(resource_id,session_id,attached_by) values(resource,attach_to,me); end if;
 return resource;
end $$;

create function public.get_library_resources(session uuid default null) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if session is not null and not private.is_session_member(session) then raise exception 'Session participant access required'; end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('scope','library','subjectName',r.subject_name,
  'uploaderName',coalesce(p.display_name,'Người dùng StudyMatch'),'session_id',session,
  'session_ids',coalesce((select jsonb_agg(a.session_id) from public.library_attachments a where a.resource_id=r.id and private.is_session_member(a.session_id)),'[]'::jsonb),
  'attached',session is not null and exists(select 1 from public.library_attachments a where a.resource_id=r.id and a.session_id=session)) order by r.created_at desc,r.id),'[]'::jsonb)
 into result from public.library_resources r left join public.profiles p on p.id=r.uploader_id;
 return result;
end $$;

create function public.attach_library_resource(resource uuid,session uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.study_sessions where id=session for update;
 perform 1 from public.library_resources where id=resource for share;
 if not private.session_editable(session) or not private.can_read_library_resource(resource) then raise exception 'Readable material and editable participant access required'; end if;
 insert into public.library_attachments(resource_id,session_id,attached_by) values(resource,session,auth.uid()) on conflict do nothing;
end $$;
create function public.detach_library_resource(resource uuid,session uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.study_sessions where id=session for update;
 perform 1 from public.library_resources where id=resource for update;
 if not private.owns_library_resource(resource) and not private.session_editable(session) then raise exception 'Owner or editable session participant access required'; end if;
 delete from public.library_attachments where resource_id=resource and session_id=session;
end $$;
create function public.clear_library_attachments(resource uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.library_resources where id=resource for update;
 if not private.owns_library_resource(resource) then raise exception 'Uploader access required'; end if;
 delete from public.library_attachments where resource_id=resource;
end $$;

create function public.set_library_visibility(resource uuid,access text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.library_resources where id=resource for update;
 if not private.owns_library_resource(resource) then raise exception 'Uploader access required'; end if;
 if access is null or access not in ('restricted','public') then raise exception 'Invalid visibility'; end if;
 update public.library_resources set visibility=access where id=resource;
end $$;
create function public.set_library_grant(resource uuid,recipient uuid,allowed boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.library_resources where id=resource for update;
 if not private.owns_library_resource(resource) then raise exception 'Uploader access required'; end if;
 if allowed is null or recipient is null or recipient=auth.uid() or not exists(select 1 from public.profiles where id=recipient) then raise exception 'Invalid recipient'; end if;
 if allowed then insert into public.library_grants(resource_id,user_id) values(resource,recipient) on conflict do nothing;
 else delete from public.library_grants where resource_id=resource and user_id=recipient; end if;
end $$;
create function public.get_library_sharing(resource uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not private.owns_library_resource(resource) then raise exception 'Uploader access required'; end if;
 return jsonb_build_object('visibility',(select visibility from public.library_resources where id=resource),
 'grants',coalesce((select jsonb_agg(jsonb_build_object('id',g.user_id,'name',coalesce(p.display_name,'Người dùng StudyMatch'))) from public.library_grants g left join public.profiles p on p.id=g.user_id where g.resource_id=resource),'[]'::jsonb),
 'attachmentCount',(select count(*) from public.library_attachments where resource_id=resource));
end $$;
create function public.search_library_users(query text) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if query is null or length(trim(query))<2 or length(query)>100 then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name)) from
  (select id,display_name from public.profiles where id<>auth.uid() and position(lower(trim(query)) in lower(display_name))>0 order by display_name,id limit 20) p),'[]'::jsonb);
end $$;
create function public.remove_library_resource(resource uuid) returns text language plpgsql security definer set search_path='' as $$
declare path text;
begin
 select storage_path into path from public.library_resources where id=resource and uploader_id=auth.uid() for update;
 if not found then raise exception 'Uploader access required'; end if;
 update public.library_resources set deleted_at=coalesce(deleted_at,clock_timestamp()) where id=resource;
 return path;
end $$;

do $$ declare f record; t text; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
 ('create_library_resource','get_library_resources','attach_library_resource','detach_library_resource','clear_library_attachments','set_library_visibility','set_library_grant','get_library_sharing','search_library_users','remove_library_resource') loop
  execute format('revoke all on function %s from public,anon',f.signature);
  execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  foreach t in array array['library_resources','library_grants','library_attachments'] loop
   if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t); end if;
  end loop;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
