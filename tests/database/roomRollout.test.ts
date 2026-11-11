import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const A = '00000000-0000-0000-0000-000000000001',
  B = '00000000-0000-0000-0000-000000000002',
  C = '00000000-0000-0000-0000-000000000003'
const SUBJECT = '10000000-0000-0000-0000-000000000001',
  OLD = '20000000-0000-0000-0000-000000000001',
  NEW = '20000000-0000-0000-0000-000000000002'
describe.each([false, true])('isolated room rollout (previous optional migration: %s)', (previous) => {
  let db: PGlite
  let oldDefinition: string
  const as = async (id: string) =>
    db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
  const room = async (id = NEW) =>
    (await db.query<{ value: any }>(`select public.get_room_v2('${id}') value`)).rows[0].value
  beforeAll(async () => {
    db = new PGlite()
    const migrate = (name: string) =>
      db.exec(readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8'))
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
    if (previous) await migrate('202611110001_room_sync.sql')
    oldDefinition = (
      await db.query<{ definition: string }>(
        "select pg_get_functiondef('public.get_room(uuid)'::regprocedure) definition"
      )
    ).rows[0].definition
    await migrate('202611110002_room_sync_rollout.sql')
    await db.exec(
      `insert into auth.users values('${A}'),('${B}'),('${C}');insert into public.subjects(id,code,name) values('${SUBJECT}','ROLLOUT','Rollout');`
    )
  }, 30_000)
  beforeEach(async () => {
    await db.exec(`reset role;truncate public.room_sync_state;truncate public.profiles cascade;
   update public.room_sync_rollout set enabled=false,starts_at=clock_timestamp();
   insert into public.profiles(id,display_name) values('${A}','A'),('${B}','B'),('${C}','C');
   insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at,started_at,created_at,meet_link)
   values('${OLD}','${A}','${B}','${SUBJECT}','in_progress',now()-interval '1 minute',now()+interval '1 hour',now()-interval '1 minute',now()-interval '1 day','https://meet.google.com/abc-defg-hij');`)
  })
  afterAll(async () => {
    await db?.close()
  })
  const enableNewRoom = async () => {
    await db.exec(`reset role;update public.room_sync_rollout set enabled=true,starts_at=clock_timestamp()`)
    await db.exec(`insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at,started_at)
   values('${NEW}','${A}','${B}','${SUBJECT}','in_progress',now()-interval '1 minute',now()+interval '1 hour',now()-interval '1 minute');`)
  }
  it('leaves the legacy API unchanged and keeps existing rooms local across activation', async () => {
    expect(
      (
        await db.query<{ definition: string }>(
          "select pg_get_functiondef('public.get_room(uuid)'::regprocedure) definition"
        )
      ).rows[0].definition
    ).toBe(oldDefinition)
    const before = (await db.query('select * from public.study_sessions')).rows
    await as(A)
    expect((await room(OLD)).roomSync).toMatchObject({ eligible: false, ready: false, timer: null })
    await enableNewRoom()
    await as(A)
    await db.query(`select public.join_room_sync('${OLD}')`)
    await as(B)
    await db.query(`select public.join_room_sync('${OLD}')`)
    expect((await room(OLD)).roomSync.ready).toBe(false)
    expect((await db.query('select * from public.room_sync_state')).rows).toHaveLength(0)
    expect((await db.query(`select * from public.study_sessions where id='${OLD}'`)).rows).toEqual(before)
    await db.query(`select public.set_meet_link('${OLD}','https://meet.google.com/xyz-abcd-efg')`)
    expect((await room(OLD)).session.meet_link).toBe('https://meet.google.com/xyz-abcd-efg')
  })
  it('requires both new clients and shares controls without modifying the legacy session row', async () => {
    await enableNewRoom()
    const before = (await db.query(`select * from public.study_sessions where id='${NEW}'`)).rows
    await as(A)
    await db.query(`select public.join_room_sync('${NEW}')`)
    expect((await room()).roomSync).toMatchObject({ eligible: true, ready: false })
    await expect(db.query(`select public.control_pomodoro_v2('${NEW}','start',0)`)).rejects.toThrow()
    await as(B)
    await db.query(`select public.join_room_sync('${NEW}')`)
    expect((await room()).roomSync).toMatchObject({
      ready: true,
      timer: { duration_minutes: 25, revision: 0 },
    })
    await db.query(`select public.control_pomodoro_v2('${NEW}','start',0)`)
    await as(A)
    expect((await room()).roomSync.timer.started_at).not.toBeNull()
    await db.query(`select public.control_pomodoro_v2('${NEW}','pause',1)`)
    expect((await room()).roomSync.timer.started_at).toBeNull()
    await expect(db.query(`select public.control_pomodoro_v2('${NEW}','reset',1,50)`)).rejects.toThrow()
    await db.query(`select public.control_pomodoro_v2('${NEW}','reset',2,50)`)
    expect((await room()).roomSync.timer).toMatchObject({ duration_minutes: 50, elapsed_ms: 0, revision: 3 })
    expect((await db.query(`select * from public.study_sessions where id='${NEW}'`)).rows).toEqual(before)
  })
  it('denies outsiders, anonymous callers, direct timer writes and client feature-flag changes', async () => {
    await enableNewRoom()
    await as(C)
    await expect(db.query(`select public.join_room_sync('${NEW}')`)).rejects.toThrow()
    await expect(db.query(`select public.get_room_v2('${NEW}')`)).rejects.toThrow()
    await expect(db.query(`select public.control_pomodoro_v2('${NEW}','start',0)`)).rejects.toThrow()
    await as(A)
    await expect(db.query('update public.room_sync_rollout set enabled=true')).rejects.toThrow()
    await expect(
      db.query(
        `insert into public.room_sync_state(session_id,creator_joined,partner_joined,activated_at) values('${NEW}',true,true,now())`
      )
    ).rejects.toThrow()
    await db.query(`select public.join_room_sync('${NEW}')`)
    await as(C)
    expect((await db.query('select * from public.room_sync_state')).rows).toHaveLength(0)
    await db.exec('set role anon')
    await expect(db.query(`select public.get_room_v2('${NEW}')`)).rejects.toThrow()
  })
  it('stops new enrollments without resetting active shared timers and freezes terminal displays', async () => {
    await enableNewRoom()
    await as(A)
    await db.query(`select public.join_room_sync('${NEW}')`)
    await as(B)
    await db.query(`select public.join_room_sync('${NEW}')`)
    await db.query(`select public.control_pomodoro_v2('${NEW}','start',0)`)
    await db.exec(
      `reset role;update public.room_sync_rollout set enabled=false;update public.room_sync_state set started_at=clock_timestamp()-interval '10 seconds' where session_id='${NEW}'`
    )
    await as(A)
    expect((await room()).roomSync.ready).toBe(true)
    await db.query(`select public.control_pomodoro_v2('${NEW}','pause',1)`)
    expect((await room()).roomSync.timer.elapsed_ms).toBeGreaterThanOrEqual(10000)
    await db.query(`select public.control_pomodoro_v2('${NEW}','start',2)`)
    await db.query(`select public.transition_session('${NEW}','cancelled')`)
    expect((await room()).roomSync.timer.started_at).toBeNull()
    await expect(db.query(`select public.control_pomodoro_v2('${NEW}','reset',3,25)`)).rejects.toThrow()
  })
})
