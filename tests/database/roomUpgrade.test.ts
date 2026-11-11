import { expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

it('upgrades populated rooms without breaking existing room/Meet/attendance APIs', async () => {
  const db = new PGlite()
  const a = '00000000-0000-0000-0000-000000000001'
  const b = '00000000-0000-0000-0000-000000000002'
  const subject = '10000000-0000-0000-0000-000000000001'
  const session = '20000000-0000-0000-0000-000000000001'
  const migrate = (name: string) =>
    db.exec(readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null);
      alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
      grant select,insert,delete on storage.objects to authenticated;`)
    await migrate('202611040001_foundation.sql')
    await migrate('202611100001_product.sql')
    await db.exec(`insert into auth.users values('${a}'),('${b}');
      insert into public.profiles(id,display_name) values('${a}','Existing learner A'),('${b}','Existing learner B');
      insert into public.subjects(id,code,name) values('${subject}','EXISTING','Existing subject');
      insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at,meet_link)
      values('${session}','${a}','${b}','${subject}','scheduled',now()+interval '1 hour',now()+interval '2 hours','https://meet.google.com/abc-defg-hij');
      insert into public.session_goals(session_id,title) values('${session}','Existing goal');`)
    const before = (
      await db.query<{ value: Record<string, unknown> }>(
        'select to_jsonb(s) value from public.study_sessions s'
      )
    ).rows[0].value
    await migrate('202611110001_room_sync.sql')
    const after = (
      await db.query<{ value: Record<string, unknown> }>(
        'select to_jsonb(s) value from public.study_sessions s'
      )
    ).rows[0].value
    for (const [key, value] of Object.entries(before)) expect(after[key]).toEqual(value)
    expect(after).toMatchObject({
      pomodoro_minutes: 25,
      pomodoro_elapsed_ms: 0,
      pomodoro_started_at: null,
      pomodoro_revision: 0,
    })
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false)`)
    const room = (
      await db.query<{ value: { session: { meet_link: string }; goals: { title: string }[] } }>(
        `select public.get_room('${session}') value`
      )
    ).rows[0].value
    expect(room.session.meet_link).toBe('https://meet.google.com/abc-defg-hij')
    expect(room.goals[0].title).toBe('Existing goal')
    await db.query(`select public.set_meet_link('${session}','https://meet.google.com/xyz-abcd-efg')`)
    await db.query(`select public.confirm_attendance('${session}')`)
    const workspace = (
      await db.query<{ value: { sessions: { meet_link: string; attendance: string[] }[] } }>(
        'select public.get_workspace() value'
      )
    ).rows[0].value
    expect(workspace.sessions[0]).toMatchObject({
      meet_link: 'https://meet.google.com/xyz-abcd-efg',
      attendance: [a],
    })
  } finally {
    await db.close()
  }
}, 30_000)
