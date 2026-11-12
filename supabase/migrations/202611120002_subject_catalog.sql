-- User-created subjects with atomic normalized duplicate prevention.
-- Apply after product.sql; library/room migrations are optional. Existing subjects/IDs are not rewritten.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';

-- Match the whitespace set used by JavaScript, including copied non-breaking spaces.
create function private.subject_title(value text) returns text language sql immutable set search_path='' as $$
 select normalize(trim(regexp_replace(coalesce(value,''),U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',' ','g')),NFC);
$$;
create function private.subject_identity(value text,is_code boolean default false) returns text language sql immutable set search_path='' as $$
 select case when is_code then upper(replace(private.subject_title(value),' ','')) else lower(private.subject_title(value)) end;
$$;
-- Keep a unique reservation per normalized name/code. Unlike a new unique index on subjects,
-- this preserves pre-existing spelling variants without merging or deleting referenced rows.
create table private.subject_catalog_keys(key text primary key,subject_id uuid not null);
revoke all on private.subject_catalog_keys from public,anon,authenticated;
insert into private.subject_catalog_keys(key,subject_id)
 select distinct on(key) key,id from (
 select 'n:'||private.subject_identity(name) key,id from public.subjects
 union all select 'c:'||private.subject_identity(code,true),id from public.subjects) q order by key,id;

create function private.guard_subject_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare keys text[]; old_keys text[]:='{}'; claim text; owner uuid;
begin
 keys:=array['n:'||private.subject_identity(new.name),'c:'||private.subject_identity(new.code,true)];
 if tg_op='UPDATE' then
  old_keys:=array['n:'||private.subject_identity(old.name),'c:'||private.subject_identity(old.code,true)];
  if keys=old_keys then return new; end if;
 end if;
 if length(trim(new.name)) not between 1 and 200 or length(trim(new.code)) not between 1 and 80 then raise exception 'Tên hoặc mã môn học không hợp lệ'; end if;
 foreach claim in array keys loop
  if claim=any(old_keys) then continue; end if;
  insert into private.subject_catalog_keys as reserved(key,subject_id) values(claim,new.id)
   on conflict(key) do update set subject_id=reserved.subject_id returning subject_id into owner;
  if owner<>new.id or exists(select 1 from public.subjects s where s.id<>new.id and
   case when left(claim,2)='n:' then 'n:'||private.subject_identity(s.name)=claim else 'c:'||private.subject_identity(s.code,true)=claim end) then
   if left(claim,2)='n:' then raise exception using errcode='23505',message='Môn học đã tồn tại trong cơ sở dữ liệu, không thể thêm mới. Hãy chọn môn có sẵn.';
   else raise exception using errcode='23505',message='Mã môn học đã tồn tại trong cơ sở dữ liệu, không thể thêm mới. Hãy chọn môn có sẵn.'; end if;
  end if;
 end loop;
 return new;
end $$;
create trigger subject_identity_guard before insert or update of name,code on public.subjects for each row execute function private.guard_subject_identity();

create function private.release_subject_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare old_keys text[]; new_keys text[]:='{}';
begin
 if tg_op='TRUNCATE' then delete from private.subject_catalog_keys; return null; end if;
 old_keys:=array['n:'||private.subject_identity(old.name),'c:'||private.subject_identity(old.code,true)];
 if tg_op='UPDATE' then new_keys:=array['n:'||private.subject_identity(new.name),'c:'||private.subject_identity(new.code,true)]; end if;
 delete from private.subject_catalog_keys k where k.subject_id=old.id and not(k.key=any(new_keys));
 -- Reassign a released legacy key if another pre-existing variant still uses it.
 insert into private.subject_catalog_keys(key,subject_id)
  select distinct on(key) key,id from (
   select 'n:'||private.subject_identity(name) key,id from public.subjects
   union all select 'c:'||private.subject_identity(code,true),id from public.subjects) q
  where key=any(old_keys) order by key,id on conflict do nothing;
 return null;
end $$;
create trigger subject_identity_release after update of name,code or delete on public.subjects for each row execute function private.release_subject_identity();
create trigger subject_identity_reset after truncate on public.subjects for each statement execute function private.release_subject_identity();
revoke all on function private.subject_title(text),private.subject_identity(text,boolean),private.guard_subject_identity(),private.release_subject_identity() from public,anon,authenticated;

create function public.create_subject(subject_name text,subject_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare title text; code text; created public.subjects;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 title:=private.subject_title(subject_name);
 code:=nullif(private.subject_identity(subject_code,true),'');
 if length(title) not between 1 and 200 or coalesce(length(code),0)>80 then raise exception 'Tên môn cần từ 1–200 ký tự, mã môn tối đa 80 ký tự'; end if;
 insert into public.subjects(name,code) values(title,coalesce(code,'SM-'||gen_random_uuid()::text)) returning * into created;
 return to_jsonb(created)||jsonb_build_object('topics','[]'::jsonb);
end $$;
revoke all on function public.create_subject(text,text) from public,anon;
grant execute on function public.create_subject(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
