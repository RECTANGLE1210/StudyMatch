import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const A = '00000000-0000-0000-0000-000000000001', B = '00000000-0000-0000-0000-000000000002', C = '00000000-0000-0000-0000-000000000003'
const SUBJECT = '10000000-0000-0000-0000-000000000001', SESSION = '20000000-0000-0000-0000-000000000001', CONV = '30000000-0000-0000-0000-000000000001'
let db: PGlite
async function asUser(id: string) { await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`) }
beforeAll(async () => {
 db = new PGlite()
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null);
 alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`)
 await db.exec(readFileSync(new URL('../../supabase/migrations/202611040001_foundation.sql', import.meta.url), 'utf8'))
 await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}'); insert into public.subjects(id,code,name) values('${SUBJECT}','MATH','Math');`)
}, 30_000)
beforeEach(async () => {
 await db.exec(`reset role; truncate public.profiles cascade; delete from storage.objects;
 insert into public.profiles(id,display_name) values('${A}','A'),('${B}','B'),('${C}','C');
 insert into public.user_subjects values('${A}','${SUBJECT}',1),('${B}','${SUBJECT}',1),('${C}','${SUBJECT}',1);
 insert into public.conversations(id,user_low,user_high) values('${CONV}','${A}','${B}');
 insert into public.conversation_participants(conversation_id,user_id) values('${CONV}','${A}'),('${CONV}','${B}');
 insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at) values('${SESSION}','${A}','${B}','${SUBJECT}','scheduled',now()+interval '1 hour',now()+interval '2 hours');`)
})
afterAll(async () => { await db?.close() })
describe('migrated PostgreSQL authorization', () => {
 it('enables RLS on every application table', async () => { const result = await db.query<{ relname: string }>(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`); expect(result.rows).toEqual([]) })
 it('prevents anonymous profile reads and RPC calls', async () => { await db.exec('set role anon'); await expect(db.query('select * from public.profiles')).rejects.toThrow(); await expect(db.query(`select public.send_invitation('${B}','${SUBJECT}')`)).rejects.toThrow() })
 it('prevents direct profile impersonation and forged session progress', async () => { await asUser(A); await expect(db.query(`update public.profiles set display_name='Imposter' where id='${B}'`)).rejects.toThrow(); await expect(db.query(`update public.study_sessions set status='completed',completed_at=now() where id='${SESSION}'`)).rejects.toThrow() })
 it('hides sessions and messages from outsiders', async () => { await asUser(A); await db.query(`select public.send_message('${CONV}','Hello')`); await asUser(C); expect((await db.query('select * from public.study_sessions')).rows).toEqual([]); expect((await db.query('select * from public.messages')).rows).toEqual([]); await expect(db.query(`select public.send_message('${CONV}','Intrusion')`)).rejects.toThrow() })
 it('creates genuine messages and notifications for participants', async () => { await asUser(A); await db.query(`select public.send_message('${CONV}','Hello')`); await asUser(B); expect((await db.query('select * from public.messages')).rows).toHaveLength(1); expect((await db.query('select * from public.notifications')).rows).toHaveLength(1) })
 it('rejects self invitations, duplicates, and sender acceptance', async () => { await asUser(A); await expect(db.query(`select public.send_invitation('${A}','${SUBJECT}')`)).rejects.toThrow(); const r = await db.query<{ id: string }>(`select public.send_invitation('${B}','${SUBJECT}') as id`); await expect(db.query(`select public.send_invitation('${B}','${SUBJECT}')`)).rejects.toThrow(); await expect(db.query(`select public.respond_invitation('${r.rows[0].id}','accepted')`)).rejects.toThrow(); await asUser(B); await db.query(`select public.respond_invitation('${r.rows[0].id}','accepted')`); expect((await db.query('select * from public.conversation_participants')).rows).toHaveLength(2) })
 it('enforces blocking in the database for invitations and messages', async () => { await asUser(B); await db.query(`insert into public.user_blocks values('${B}','${A}',now())`); await asUser(A); await expect(db.query(`select public.send_invitation('${B}','${SUBJECT}')`)).rejects.toThrow(); await expect(db.query(`select public.send_message('${CONV}','Blocked')`)).rejects.toThrow(); expect((await db.query('select * from public.messages')).rows).toEqual([]) })
 it('rejects completion without start and starting before the scheduled time', async () => { await asUser(A); await expect(db.query(`select public.transition_session('${SESSION}','completed')`)).rejects.toThrow(); await db.query(`select public.confirm_attendance('${SESSION}')`); await asUser(B); await db.query(`select public.confirm_attendance('${SESSION}')`); await expect(db.query(`select public.transition_session('${SESSION}','in_progress')`)).rejects.toThrow() })
 it('requires both attendances and records server-owned progress', async () => { await db.query(`update public.study_sessions set starts_at=now()-interval '1 minute' where id='${SESSION}'`); await asUser(A); await db.query(`select public.confirm_attendance('${SESSION}')`); await expect(db.query(`select public.transition_session('${SESSION}','in_progress')`)).rejects.toThrow(); await asUser(B); await db.query(`select public.confirm_attendance('${SESSION}')`); await db.query(`select public.transition_session('${SESSION}','in_progress')`); await db.query(`select public.transition_session('${SESSION}','completed')`); const r = await db.query<{ started_at: string; completed_at: string }>('select started_at,completed_at from public.study_sessions'); expect(r.rows[0].started_at).toBeTruthy(); expect(r.rows[0].completed_at).toBeTruthy(); await expect(db.query(`select public.transition_session('${SESSION}','cancelled')`)).rejects.toThrow() })
 it('restricts private materials to participants and uploader deletion', async () => { const path = `${SESSION}/${A}/document`; await asUser(A); await db.query(`insert into storage.objects(bucket_id,name) values('session-materials','${path}')`); await db.query(`insert into public.session_resources(session_id,uploader_id,name,storage_path,mime_type,size_bytes) values('${SESSION}','${A}','PDF','${path}','application/pdf',10)`); await asUser(B); expect((await db.query('select * from storage.objects')).rows).toHaveLength(1); await db.query(`delete from storage.objects where name='${path}'`); expect((await db.query('select * from storage.objects')).rows).toHaveLength(1); await asUser(C); expect((await db.query('select * from storage.objects')).rows).toEqual([]); expect((await db.query('select * from public.session_resources')).rows).toEqual([]); await expect(db.query(`insert into storage.objects(bucket_id,name) values('session-materials','${SESSION}/${C}/attack')`)).rejects.toThrow(); await asUser(A); await db.query(`delete from storage.objects where name='${path}'`); expect((await db.query('select * from storage.objects')).rows).toHaveLength(0) })
 it('rejects incomplete file metadata', async () => { await asUser(A); await expect(db.query(`insert into public.session_resources(session_id,uploader_id,name,storage_path) values('${SESSION}','${A}','Bad','${SESSION}/${A}/bad')`)).rejects.toThrow() })
 it('validates full profile replacement and rejects missing arrays', async () => { await asUser(A); await expect(db.query(`select public.save_learning_profile('{"display_name":"A","timezone":"Invalid/Zone","goals":[],"styles":[]}', '[]','[]')`)).rejects.toThrow(); await expect(db.query(`select public.save_learning_profile('{"display_name":"A","timezone":"UTC","goals":[],"styles":[]}',null,null)`)).rejects.toThrow(); await db.query(`select public.save_learning_profile('{"display_name":"Changed","timezone":"UTC","goals":[],"styles":[]}', '[]','[]')`); expect((await db.query<{ display_name: string }>(`select display_name from public.profiles where id='${A}'`)).rows[0].display_name).toBe('Changed') })
 it('saves a complete normalized profile and rolls back invalid knowledge updates', async () => {
  const uni = '40000000-0000-0000-0000-000000000001', major = '50000000-0000-0000-0000-000000000001', topic = '60000000-0000-0000-0000-000000000001'
  await db.query(`insert into public.universities(id,name) values('${uni}','University') on conflict do nothing;`)
  await db.query(`insert into public.majors(id,name) values('${major}','Major') on conflict do nothing;`)
  await db.query(`insert into public.topics(id,subject_id,name) values('${topic}','${SUBJECT}','Limits') on conflict do nothing;`)
  await asUser(A)
  const profile = { display_name: 'Learner', university_id: uni, major_id: major, timezone: 'Asia/Ho_Chi_Minh', goals: ['exam'], styles: ['quiet'], onboarding_completed: true }
  const subjects = [{ subject_id: SUBJECT, proficiency: 2, strong: [topic], weak: [] }]
  const availability = [{ day: 1, start_minute: 1140, end_minute: 1200 }]
  await db.query('select public.save_learning_profile($1,$2,$3)', [JSON.stringify(profile), JSON.stringify(subjects), JSON.stringify(availability)])
  expect((await db.query<{ onboarding_completed: boolean }>(`select onboarding_completed from public.profiles where id='${A}'`)).rows[0].onboarding_completed).toBe(true)
  expect((await db.query(`select * from public.user_topics where user_id='${A}'`)).rows).toHaveLength(1)
  const invalid = [{ ...subjects[0], weak: [topic] }]
  await expect(db.query('select public.save_learning_profile($1,$2,$3)', [JSON.stringify({ ...profile, display_name: 'Must roll back' }), JSON.stringify(invalid), JSON.stringify(availability)])).rejects.toThrow()
  expect((await db.query<{ display_name: string }>(`select display_name from public.profiles where id='${A}'`)).rows[0].display_name).toBe('Learner')
 })
 it('requires the invited partner to accept and renews confirmation on reschedule', async () => {
  await asUser(A)
  const result = await db.query<{ id: string }>(`select public.propose_session('${B}','${SUBJECT}',now()+interval '2 hours',now()+interval '3 hours') as id`)
  const id = result.rows[0].id
  await expect(db.query(`select public.transition_session('${id}','scheduled')`)).rejects.toThrow()
  await asUser(B); await db.query(`select public.transition_session('${id}','scheduled')`)
  await expect(db.query(`select public.reschedule_session('${id}',now()+interval '3 hours',now()+interval '4 hours')`)).rejects.toThrow()
  await asUser(A); await db.query(`select public.reschedule_session('${id}',now()+interval '3 hours',now()+interval '4 hours')`)
  expect((await db.query<{ status: string }>(`select status from public.study_sessions where id='${id}'`)).rows[0].status).toBe('proposed')
 })
 it('allows only the owner to read and mark notifications', async () => {
  await asUser(A); await db.query(`select public.send_message('${CONV}','Unread')`)
  await asUser(B); const r = await db.query<{ id: string }>('select id from public.notifications'); const id = r.rows[0].id
  await asUser(C); await db.query(`select public.mark_notification_read('${id}')`)
  await asUser(B); expect((await db.query<{ read_at: string | null }>('select read_at from public.notifications')).rows[0].read_at).toBeNull()
  await db.query(`select public.mark_notification_read('${id}')`)
  expect((await db.query<{ read_at: string | null }>('select read_at from public.notifications')).rows[0].read_at).toBeTruthy()
 })

})
