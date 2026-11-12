import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const A = '00000000-0000-0000-0000-000000000001',
  B = '00000000-0000-0000-0000-000000000002',
  C = '00000000-0000-0000-0000-000000000003'
const SUBJECT = '10000000-0000-0000-0000-000000000001',
  SESSION = '20000000-0000-0000-0000-000000000001',
  CONV = '30000000-0000-0000-0000-000000000001'
let db: PGlite
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`
  )
}
beforeAll(async () => {
  db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null);
 alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,delete on storage.objects to authenticated;`)
  await db.exec(
    readFileSync(new URL('../../supabase/migrations/202611040001_foundation.sql', import.meta.url), 'utf8')
  )
  await db.exec(
    readFileSync(new URL('../../supabase/migrations/202611100001_product.sql', import.meta.url), 'utf8')
  )
  await db.exec(
    readFileSync(new URL('../../supabase/migrations/202611110001_room_sync.sql', import.meta.url), 'utf8')
  )
  await db.exec(
    readFileSync(
      new URL('../../supabase/migrations/202611120003_invitation_rejected_notification.sql', import.meta.url),
      'utf8'
    )
  )
  await db.exec(
    `insert into auth.users values('${A}'),('${B}'),('${C}'); insert into public.subjects(id,code,name) values('${SUBJECT}','MATH','Math');`
  )
}, 30_000)
beforeEach(async () => {
  await db.exec(`reset role; truncate public.profiles cascade; delete from storage.objects;
 insert into public.profiles(id,display_name) values('${A}','A'),('${B}','B'),('${C}','C');
 insert into public.user_subjects values('${A}','${SUBJECT}',1),('${B}','${SUBJECT}',1),('${C}','${SUBJECT}',1);
 insert into public.conversations(id,user_low,user_high) values('${CONV}','${A}','${B}');
 insert into public.conversation_participants(conversation_id,user_id) values('${CONV}','${A}'),('${CONV}','${B}');
 insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at) values('${SESSION}','${A}','${B}','${SUBJECT}','scheduled',now()+interval '1 hour',now()+interval '2 hours');`)
})
afterAll(async () => {
  await db?.close()
})
describe('migrated PostgreSQL authorization', () => {
  it('enables RLS on every application table', async () => {
    const result = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`
    )
    expect(result.rows).toEqual([])
  })
  it('prevents anonymous profile reads and RPC calls', async () => {
    await db.exec('set role anon')
    await expect(db.query('select * from public.profiles')).rejects.toThrow()
    await expect(db.query(`select public.send_invitation('${B}','${SUBJECT}')`)).rejects.toThrow()
  })
  it('prevents direct profile impersonation and forged session progress', async () => {
    await asUser(A)
    await expect(
      db.query(`update public.profiles set display_name='Imposter' where id='${B}'`)
    ).rejects.toThrow()
    await expect(
      db.query(`update public.study_sessions set status='completed',completed_at=now() where id='${SESSION}'`)
    ).rejects.toThrow()
  })
  it('hides sessions and messages from outsiders', async () => {
    await asUser(A)
    await db.query(`select public.send_message('${CONV}','Hello')`)
    await asUser(C)
    expect((await db.query('select * from public.study_sessions')).rows).toEqual([])
    expect((await db.query('select * from public.messages')).rows).toEqual([])
    await expect(db.query(`select public.send_message('${CONV}','Intrusion')`)).rejects.toThrow()
  })
  it('creates genuine messages and notifications for participants', async () => {
    await asUser(A)
    await db.query(`select public.send_message('${CONV}','Hello')`)
    await asUser(B)
    expect((await db.query('select * from public.messages')).rows).toHaveLength(1)
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(1)
  })
  it('rejects self invitations, duplicates, and sender acceptance', async () => {
    await asUser(A)
    await expect(db.query(`select public.send_invitation('${A}','${SUBJECT}')`)).rejects.toThrow()
    const r = await db.query<{ id: string }>(`select public.send_invitation('${B}','${SUBJECT}') as id`)
    await expect(db.query(`select public.send_invitation('${B}','${SUBJECT}')`)).rejects.toThrow()
    await expect(db.query(`select public.respond_invitation('${r.rows[0].id}','accepted')`)).rejects.toThrow()
    await asUser(B)
    await db.query(`select public.respond_invitation('${r.rows[0].id}','accepted')`)
    expect((await db.query('select * from public.conversation_participants')).rows).toHaveLength(2)
  })
  it('notifies only the sender once on rejection and supports unread/read persistence', async () => {
    await asUser(B)
    const request = (await db.query<{ id: string }>(`select public.send_invitation('${A}','${SUBJECT}') id`))
      .rows[0].id
    await asUser(A)
    await db.query("select public.respond_invitation($1,'rejected')", [request])
    expect(
      (await db.query("select * from public.notifications where kind='invitation_rejected'")).rows
    ).toHaveLength(0)
    await expect(db.query("select public.respond_invitation($1,'rejected')", [request])).rejects.toThrow()
    await asUser(B)
    const rows = (
      await db.query<{ id: string; entity_id: string; read_at: string | null }>(
        "select * from public.notifications where kind='invitation_rejected'"
      )
    ).rows
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ entity_id: request, read_at: null })
    const workspace = () =>
      db.query<{ unread: number }>("select (public.get_workspace()->>'unreadNotifications')::integer unread")
    expect((await workspace()).rows[0].unread).toBe(1)
    await asUser(C)
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(0)
    await db.query('select public.mark_notification_read($1)', [rows[0].id])
    await asUser(B)
    expect((await workspace()).rows[0].unread).toBe(1)
    await db.query('select public.mark_notification_read($1)', [rows[0].id])
    expect((await workspace()).rows[0].unread).toBe(0)
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(1)
  })
  it('does not notify on unauthorized rejection or sender cancellation', async () => {
    await asUser(B)
    const request = (await db.query<{ id: string }>(`select public.send_invitation('${A}','${SUBJECT}') id`))
      .rows[0].id
    for (const actor of [B, C]) {
      await asUser(actor)
      await expect(db.query("select public.respond_invitation($1,'rejected')", [request])).rejects.toThrow()
    }
    await asUser(B)
    await db.query("select public.respond_invitation($1,'cancelled')", [request])
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(0)
    await asUser(A)
    expect(
      (await db.query("select * from public.notifications where kind='invitation_rejected'")).rows
    ).toHaveLength(0)
  })
  it('preserves acceptance notifications without adding rejection notifications', async () => {
    await asUser(B)
    const request = (await db.query<{ id: string }>(`select public.send_invitation('${A}','${SUBJECT}') id`))
      .rows[0].id
    await asUser(A)
    await db.query("select public.respond_invitation($1,'accepted')", [request])
    await asUser(B)
    expect((await db.query<{ kind: string }>('select kind from public.notifications')).rows).toEqual([
      { kind: 'invitation_accepted' },
    ])
  })
  it('enforces blocking in the database for invitations and messages', async () => {
    await asUser(B)
    await db.query(`insert into public.user_blocks values('${B}','${A}',now())`)
    await asUser(A)
    await expect(db.query(`select public.send_invitation('${B}','${SUBJECT}')`)).rejects.toThrow()
    await expect(db.query(`select public.send_message('${CONV}','Blocked')`)).rejects.toThrow()
    expect((await db.query('select * from public.messages')).rows).toEqual([])
  })
  it('rejects completion without start and starting before the scheduled time', async () => {
    await asUser(A)
    await expect(db.query(`select public.transition_session('${SESSION}','completed')`)).rejects.toThrow()
    await db.query(`select public.confirm_attendance('${SESSION}')`)
    await asUser(B)
    await db.query(`select public.confirm_attendance('${SESSION}')`)
    await expect(db.query(`select public.transition_session('${SESSION}','in_progress')`)).rejects.toThrow()
  })
  it('requires both attendances and records server-owned progress', async () => {
    await db.query(
      `update public.study_sessions set starts_at=now()-interval '1 minute' where id='${SESSION}'`
    )
    await asUser(A)
    await db.query(`select public.confirm_attendance('${SESSION}')`)
    await expect(db.query(`select public.transition_session('${SESSION}','in_progress')`)).rejects.toThrow()
    await asUser(B)
    await db.query(`select public.confirm_attendance('${SESSION}')`)
    await db.query(`select public.transition_session('${SESSION}','in_progress')`)
    await db.exec('reset role')
    await db.query(
      `update public.study_sessions set started_at=now()-interval '1 second' where id='${SESSION}'`
    )
    await asUser(B)
    await db.query(`select public.transition_session('${SESSION}','completed')`)
    const r = await db.query<{ started_at: string; completed_at: string }>(
      'select started_at,completed_at from public.study_sessions'
    )
    expect(r.rows[0].started_at).toBeTruthy()
    expect(r.rows[0].completed_at).toBeTruthy()
    await expect(db.query(`select public.transition_session('${SESSION}','cancelled')`)).rejects.toThrow()
  })
  it('restricts private materials to participants and uploader deletion', async () => {
    const path = `${SESSION}/${A}/document`
    await asUser(A)
    await db.query(`insert into storage.objects(bucket_id,name) values('session-materials','${path}')`)
    await db.query(
      `insert into public.session_resources(session_id,uploader_id,name,storage_path,mime_type,size_bytes) values('${SESSION}','${A}','PDF','${path}','application/pdf',10)`
    )
    await asUser(B)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    await db.query(`delete from storage.objects where name='${path}'`)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    await asUser(C)
    expect((await db.query('select * from storage.objects')).rows).toEqual([])
    expect((await db.query('select * from public.session_resources')).rows).toEqual([])
    await expect(
      db.query(
        `insert into storage.objects(bucket_id,name) values('session-materials','${SESSION}/${C}/attack')`
      )
    ).rejects.toThrow()
    await asUser(A)
    await db.query(`delete from storage.objects where name='${path}'`)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(0)
  })
  it('rejects incomplete file metadata', async () => {
    await asUser(A)
    await expect(
      db.query(
        `insert into public.session_resources(session_id,uploader_id,name,storage_path) values('${SESSION}','${A}','Bad','${SESSION}/${A}/bad')`
      )
    ).rejects.toThrow()
  })
  it('validates full profile replacement and rejects missing arrays', async () => {
    await asUser(A)
    await expect(
      db.query(
        `select public.save_learning_profile('{"display_name":"A","timezone":"Invalid/Zone","goals":[],"styles":[]}', '[]','[]')`
      )
    ).rejects.toThrow()
    await expect(
      db.query(
        `select public.save_learning_profile('{"display_name":"A","timezone":"UTC","goals":[],"styles":[]}',null,null)`
      )
    ).rejects.toThrow()
    await db.query(
      `select public.save_learning_profile('{"display_name":"Changed","timezone":"UTC","goals":[],"styles":[]}', '[]','[]')`
    )
    expect(
      (await db.query<{ display_name: string }>(`select display_name from public.profiles where id='${A}'`))
        .rows[0].display_name
    ).toBe('Changed')
  })
  it('saves a complete normalized profile and rolls back invalid knowledge updates', async () => {
    const uni = '40000000-0000-0000-0000-000000000001',
      major = '50000000-0000-0000-0000-000000000001',
      topic = '60000000-0000-0000-0000-000000000001'
    await db.query(
      `insert into public.universities(id,name) values('${uni}','University') on conflict do nothing;`
    )
    await db.query(`insert into public.majors(id,name) values('${major}','Major') on conflict do nothing;`)
    await db.query(
      `insert into public.topics(id,subject_id,name) values('${topic}','${SUBJECT}','Limits') on conflict do nothing;`
    )
    await asUser(A)
    const profile = {
      display_name: 'Learner',
      university_id: uni,
      major_id: major,
      timezone: 'Asia/Ho_Chi_Minh',
      goals: ['exam'],
      styles: ['quiet'],
      onboarding_completed: true,
    }
    const subjects = [{ subject_id: SUBJECT, proficiency: 2, strong: [topic], weak: [] }]
    const availability = [{ day: 1, start_minute: 1140, end_minute: 1200 }]
    await db.query('select public.save_learning_profile($1,$2,$3)', [
      JSON.stringify(profile),
      JSON.stringify(subjects),
      JSON.stringify(availability),
    ])
    expect(
      (
        await db.query<{ onboarding_completed: boolean }>(
          `select onboarding_completed from public.profiles where id='${A}'`
        )
      ).rows[0].onboarding_completed
    ).toBe(true)
    expect((await db.query(`select * from public.user_topics where user_id='${A}'`)).rows).toHaveLength(1)
    const invalid = [{ ...subjects[0], weak: [topic] }]
    await expect(
      db.query('select public.save_learning_profile($1,$2,$3)', [
        JSON.stringify({ ...profile, display_name: 'Must roll back' }),
        JSON.stringify(invalid),
        JSON.stringify(availability),
      ])
    ).rejects.toThrow()
    expect(
      (await db.query<{ display_name: string }>(`select display_name from public.profiles where id='${A}'`))
        .rows[0].display_name
    ).toBe('Learner')
  })
  it('requires the invited partner to accept and renews confirmation on reschedule', async () => {
    await asUser(A)
    const result = await db.query<{ id: string }>(
      `select public.propose_session('${B}','${SUBJECT}',now()+interval '2 hours',now()+interval '3 hours') as id`
    )
    const id = result.rows[0].id
    await expect(db.query(`select public.transition_session('${id}','scheduled')`)).rejects.toThrow()
    await asUser(B)
    await db.query(`select public.transition_session('${id}','scheduled')`)
    await expect(
      db.query(`select public.reschedule_session('${id}',now()+interval '3 hours',now()+interval '4 hours')`)
    ).rejects.toThrow()
    await asUser(A)
    await db.query(
      `select public.reschedule_session('${id}',now()+interval '3 hours',now()+interval '4 hours')`
    )
    expect(
      (await db.query<{ status: string }>(`select status from public.study_sessions where id='${id}'`))
        .rows[0].status
    ).toBe('proposed')
  })
  it('allows only the owner to read and mark notifications', async () => {
    await asUser(A)
    await db.query(`select public.send_message('${CONV}','Unread')`)
    await asUser(B)
    const r = await db.query<{ id: string }>('select id from public.notifications')
    const id = r.rows[0].id
    await asUser(C)
    await db.query(`select public.mark_notification_read('${id}')`)
    await asUser(B)
    expect(
      (await db.query<{ read_at: string | null }>('select read_at from public.notifications')).rows[0].read_at
    ).toBeNull()
    await db.query(`select public.mark_notification_read('${id}')`)
    expect(
      (await db.query<{ read_at: string | null }>('select read_at from public.notifications')).rows[0].read_at
    ).toBeTruthy()
  })

  it('round-trips the Figma profile model through dynamic catalogs and normalized knowledge', async () => {
    await asUser(A)
    const profile = {
      name: 'Study A',
      uni: 'Test University',
      major: 'Test Major',
      bio: 'Learning together',
      avatar: null,
      avatarPath: null,
      subjects: [
        { name: 'Math', code: 'MATH', level: 'Trung bình', strong: ['Limits'], weak: ['Integrals'] },
      ],
      goals: ['Exam'],
      styles: ['Quiet'],
      avail: ['T2-Tối'],
      timezone: 'Asia/Ho_Chi_Minh',
    }
    await db.query('select public.save_profile_view($1,true)', [JSON.stringify(profile)])
    const result = await db.query<{
      profile: {
        name: string
        subjects: { strong: string[]; weak: string[] }[]
        weeklyAvailability: { day: number; start: number; end: number }[]
        onboardingCompleted: boolean
      }
    }>('select public.get_profile_snapshot($1) profile', [A])
    expect(result.rows[0].profile).toMatchObject({
      name: 'Study A',
      onboardingCompleted: true,
      weeklyAvailability: [{ day: 1, start: 1080, end: 1260 }],
    })
    expect(result.rows[0].profile.subjects[0]).toMatchObject({ strong: ['Limits'], weak: ['Integrals'] })
    expect(result.rows[0].profile).not.toHaveProperty('email')
    await expect(
      db.query('select public.save_profile_view($1,true)', [
        JSON.stringify({
          ...profile,
          name: 'Must roll back',
          subjects: [{ ...profile.subjects[0], weak: ['Limits'] }],
        }),
      ])
    ).rejects.toThrow()
    expect(
      (await db.query<{ name: string }>(`select display_name name from public.profiles where id='${A}'`))
        .rows[0].name
    ).toBe('Study A')
  })
  it('rejects forged avatar ownership and malformed preference values', async () => {
    await asUser(A)
    const profile = {
      name: 'A',
      uni: '',
      major: '',
      subjects: [],
      avail: [],
      goals: [],
      styles: [],
      timezone: 'UTC',
      avatar: null,
      avatarPath: `${B}/photo`,
    }
    await expect(
      db.query('select public.save_profile_view($1,false)', [JSON.stringify(profile)])
    ).rejects.toThrow('avatar ownership')
    await expect(
      db.query('select public.save_profile_view($1,false)', [
        JSON.stringify({ ...profile, avatarPath: null, goals: [{}] }),
      ])
    ).rejects.toThrow('goals/styles')
  })
  it('runs invitation, unread chat, session, goals, feedback and real progress as two users', async () => {
    await asUser(A)
    const invitation = await db.query<{ id: string }>(`select public.send_invitation('${B}','${SUBJECT}') id`)
    await asUser(B)
    await db.query("select public.respond_invitation($1,'accepted')", [invitation.rows[0].id])
    await asUser(A)
    await db.query(`select public.send_message('${CONV}','Actual persisted message')`)
    await asUser(B)
    const inbox = await db.query<{ value: { conversations: { unread: number }[] } }>(
      'select public.get_workspace() value'
    )
    expect(inbox.rows[0].value.conversations[0].unread).toBe(1)
    await db.query(`select public.mark_conversation_read('${CONV}')`)
    expect(
      (
        await db.query<{ value: { conversations: { unread: number }[] } }>(
          'select public.get_workspace() value'
        )
      ).rows[0].value.conversations[0].unread
    ).toBe(0)
    expect(
      (await db.query<{ value: unknown[] }>(`select public.message_page('${CONV}') value`)).rows[0].value
    ).toHaveLength(1)
    await asUser(A)
    const proposed = await db.query<{ id: string }>(
      `select public.propose_study_session('${B}','${SUBJECT}',now()+interval '1 hour',now()+interval '2 hours','{}','Finish exercises') id`
    )
    const id = proposed.rows[0].id
    await asUser(B)
    await db.query(`select public.transition_session('${id}','scheduled')`)
    await db.exec(
      `reset role;update public.study_sessions set starts_at=now()-interval '1 minute' where id='${id}'`
    )
    await asUser(A)
    await db.query(`select public.confirm_attendance('${id}')`)
    await asUser(B)
    await db.query(`select public.confirm_attendance('${id}')`)
    await asUser(A)
    await db.query(`select public.transition_session('${id}','in_progress')`)
    await db.query(`update public.session_goals set completed=true where session_id='${id}'`)
    await asUser(B)
    await db.query(`select public.transition_session('${id}','completed')`)
    await db.query(
      `insert into public.session_feedback(session_id,user_id,rating,comment) values('${id}','${B}',5,'Helpful session')`
    )
    const stats = await db.query<{
      value: { completedSessions: number; completedGoals: number; partnerCount: number; totalMinutes: number }
    }>('select public.get_progress() value')
    expect(stats.rows[0].value).toMatchObject({ completedSessions: 1, completedGoals: 1, partnerCount: 1 })
    expect(stats.rows[0].value.totalMinutes).toBeGreaterThan(0)
    const room = await db.query<{ value: { feedback: { rating: number } } }>(
      `select public.get_room('${id}') value`
    )
    expect(room.rows[0].value.feedback.rating).toBe(5)
    await asUser(C)
    await expect(db.query(`select public.get_room('${id}')`)).rejects.toThrow()
    expect(
      (await db.query<{ value: { completedSessions: number } }>('select public.get_progress() value')).rows[0]
        .value.completedSessions
    ).toBe(0)
  })
  it('rejects foreign-subject session topics without leaving a proposal or notification', async () => {
    const other = '10000000-0000-0000-0000-000000000002',
      topic = '60000000-0000-0000-0000-000000000002'
    await db.exec(
      `insert into public.subjects(id,code,name) values('${other}','PHYSICS','Physics') on conflict do nothing;insert into public.topics(id,subject_id,name) values('${topic}','${other}','Motion') on conflict do nothing`
    )
    await asUser(A)
    await expect(
      db.query(
        `select public.propose_study_session('${B}','${SUBJECT}',now()+interval '1 hour',now()+interval '2 hours',array['${topic}']::uuid[],'Goal')`
      )
    ).rejects.toThrow('another subject')
    expect((await db.query('select * from public.study_sessions')).rows).toHaveLength(1)
    expect((await db.query('select * from public.notifications')).rows).toHaveLength(0)
  })
  it('prevents outsiders from paginated chat and room endpoints', async () => {
    await asUser(C)
    await expect(db.query(`select public.message_page('${CONV}')`)).rejects.toThrow()
    await expect(db.query(`select public.get_room('${SESSION}')`)).rejects.toThrow()
    expect(
      (await db.query<{ value: unknown }>(`select public.get_session_snapshot('${SESSION}') value`)).rows[0]
        .value
    ).toBeNull()
  })
  it('supports private Word resources but rejects ownership impersonation', async () => {
    await asUser(A)
    await db.query(
      `insert into storage.objects(bucket_id,name) values('session-materials','${SESSION}/${A}/word')`
    )
    await db.query(
      `insert into public.session_resources(session_id,uploader_id,name,storage_path,mime_type,size_bytes,kind) values('${SESSION}','${A}','Notes','${SESSION}/${A}/word','application/vnd.openxmlformats-officedocument.wordprocessingml.document',100,'doc')`
    )
    await expect(
      db.query(
        `insert into public.session_resources(session_id,uploader_id,name,external_url) values('${SESSION}','${B}','Forgery','https://example.com')`
      )
    ).rejects.toThrow()
    const resource = await db.query<{ id: string }>('select id from public.session_resources')
    await asUser(B)
    await db.query(`select public.attach_resource('${resource.rows[0].id}',false)`)
    expect(
      (await db.query<{ attached: boolean }>('select attached from public.session_resources')).rows[0]
        .attached
    ).toBe(false)
    await asUser(C)
    await expect(db.query(`select public.attach_resource('${resource.rows[0].id}',true)`)).rejects.toThrow()
  })
  it('reconciles expired sessions only for the caller and never creates fake counters', async () => {
    const outside = '20000000-0000-0000-0000-000000000002'
    await db.query(
      `update public.study_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='${SESSION}'`
    )
    await db.query(
      `insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at) values('${outside}','${B}','${C}','${SUBJECT}','scheduled',now()-interval '2 hours',now()-interval '1 hour')`
    )
    await asUser(A)
    await db.query('select public.refresh_session_statuses()')
    expect(
      (await db.query<{ status: string }>(`select status from public.study_sessions where id='${SESSION}'`))
        .rows[0].status
    ).toBe('missed')
    await db.exec('reset role')
    expect(
      (await db.query<{ status: string }>(`select status from public.study_sessions where id='${outside}'`))
        .rows[0].status
    ).toBe('scheduled')
    await asUser(C)
    await db.query('select public.refresh_session_statuses()')
    expect(
      (await db.query<{ status: string }>(`select status from public.study_sessions where id='${outside}'`))
        .rows[0].status
    ).toBe('missed')
  })
  it('blocking cancels active sessions and pending invitations, and unblocking does not revive them', async () => {
    await asUser(A)
    await db.query(`select public.send_invitation('${B}','${SUBJECT}')`)
    await asUser(B)
    await db.query(`select public.block_user('${A}','Unwanted contact')`)
    expect(
      (await db.query<{ status: string }>(`select status from public.study_sessions where id='${SESSION}'`))
        .rows[0].status
    ).toBe('cancelled')
    expect(
      (await db.query<{ status: string }>('select status from public.match_requests')).rows[0].status
    ).toBe('cancelled')
    expect((await db.query('select * from public.user_reports')).rows).toHaveLength(1)
    await db.query(`select public.unblock_user('${A}')`)
    expect(
      (await db.query<{ status: string }>(`select status from public.study_sessions where id='${SESSION}'`))
        .rows[0].status
    ).toBe('cancelled')
  })
  it('allows the owner to read an uploaded avatar before their first profile save', async () => {
    const user = '00000000-0000-0000-0000-000000000004'
    await db.query(`insert into auth.users values('${user}') on conflict do nothing`)
    await asUser(user)
    await db.query(`insert into storage.objects(bucket_id,name) values('avatars','${user}/initial')`)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    await asUser(A)
    expect((await db.query(`select * from storage.objects where bucket_id='avatars'`)).rows).toHaveLength(0)
  })
  it('does not grant anonymous access to the new live RPCs', async () => {
    await db.exec('set role anon')
    for (const sql of [
      'select public.get_workspace()',
      'select public.get_progress()',
      `select public.get_profile_snapshot('${A}')`,
      `select public.find_candidate_profiles('${SUBJECT}',0)`,
    ])
      await expect(db.query(sql)).rejects.toThrow()
  })
  it('freezes goals immediately at the scheduled end even before lazy reconciliation', async () => {
    await db.query(`insert into public.session_goals(session_id,title) values('${SESSION}','Original goal')`)
    await db.query(
      `update public.study_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='${SESSION}'`
    )
    await asUser(A)
    expect(
      (
        await db.query(
          `update public.session_goals set completed=true where session_id='${SESSION}' returning id`
        )
      ).rows
    ).toHaveLength(0)
    await expect(
      db.query(
        `insert into public.session_goals(session_id,title) values('${SESSION}','Late fabricated goal')`
      )
    ).rejects.toThrow()
  })
  it('shares server-owned Pomodoro controls between both participants', async () => {
    await db.query(
      `update public.study_sessions set status='in_progress',starts_at=now()-interval '2 minutes',started_at=now()-interval '2 minutes' where id='${SESSION}'`
    )
    await asUser(A)
    await db.query(`select public.control_pomodoro('${SESSION}','start',0)`)
    await asUser(B)
    const running = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0]
      .value
    expect(running.session.pomodoro_revision).toBe(1)
    expect(running.session.pomodoro_started_at).not.toBeNull()
    expect(Number.isFinite(Date.parse(running.serverNow))).toBe(true)
    await db.exec('reset role')
    await db.query(
      `update public.study_sessions set pomodoro_started_at=clock_timestamp()-interval '65 seconds' where id='${SESSION}'`
    )
    await asUser(B)
    await db.query(`select public.control_pomodoro('${SESSION}','pause',1)`)
    await asUser(A)
    const paused = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0]
      .value.session
    expect(paused.pomodoro_started_at).toBeNull()
    expect(paused.pomodoro_elapsed_ms).toBeGreaterThanOrEqual(65000)
    expect(paused.pomodoro_elapsed_ms).toBeLessThan(66000)
    await db.query(`select public.control_pomodoro('${SESSION}','start',2)`)
    const resumed = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0]
      .value.session
    expect(resumed.pomodoro_elapsed_ms).toBe(paused.pomodoro_elapsed_ms)
    expect(resumed.pomodoro_revision).toBe(3)
  })
  it('resets shared duration and rejects stale or forged timer controls', async () => {
    await db.query(
      `update public.study_sessions set status='in_progress',starts_at=now()-interval '1 minute',started_at=now()-interval '1 minute' where id='${SESSION}'`
    )
    await asUser(B)
    await db.query(`select public.control_pomodoro('${SESSION}','reset',0,50)`)
    await asUser(A)
    await expect(db.query(`select public.control_pomodoro('${SESSION}','start',0)`)).rejects.toThrow()
    await expect(db.query(`select public.control_pomodoro('${SESSION}','reset',1,99)`)).rejects.toThrow()
    await expect(db.query(`select public.control_pomodoro('${SESSION}','start',null)`)).rejects.toThrow()
    await expect(db.query(`select public.control_pomodoro('${SESSION}','start',1,25)`)).rejects.toThrow()
    await expect(
      db.query(`update public.study_sessions set pomodoro_elapsed_ms=100 where id='${SESSION}'`)
    ).rejects.toThrow()
    await db.query(`select public.control_pomodoro('${SESSION}','start',1)`)
    await db.query(`select public.control_pomodoro('${SESSION}','reset',2,25)`)
    const timer = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0].value
      .session
    expect(timer).toMatchObject({
      pomodoro_minutes: 25,
      pomodoro_elapsed_ms: 0,
      pomodoro_started_at: null,
      pomodoro_revision: 3,
    })
  })
  it('denies scheduled, outsider and anonymous Pomodoro controls', async () => {
    await asUser(A)
    await expect(db.query(`select public.control_pomodoro('${SESSION}','start',0)`)).rejects.toThrow()
    await asUser(C)
    await expect(db.query(`select public.control_pomodoro('${SESSION}','reset',0,50)`)).rejects.toThrow()
    await expect(db.query(`select public.get_room('${SESSION}')`)).rejects.toThrow()
    await db.exec('set role anon')
    await expect(db.query(`select public.control_pomodoro('${SESSION}','start',0)`)).rejects.toThrow()
  })
  it('caps an expired Pomodoro and freezes it when the session is completed', async () => {
    await db.query(
      `update public.study_sessions set status='in_progress',starts_at=now()-interval '2 minutes',ends_at=now()-interval '1 minute',started_at=now()-interval '2 minutes',pomodoro_started_at=now()-interval '2 minutes' where id='${SESSION}'`
    )
    await asUser(A)
    await expect(db.query(`select public.control_pomodoro('${SESSION}','pause',0)`)).rejects.toThrow()
    const ended = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0].value
      .session
    expect(ended).toMatchObject({
      status: 'completed',
      pomodoro_started_at: null,
      pomodoro_elapsed_ms: 60000,
    })
    await expect(db.query(`select public.control_pomodoro('${SESSION}','reset',1,25)`)).rejects.toThrow()
  })
  it('requires reset after Pomodoro expiry and freezes a cancelled timer', async () => {
    await db.query(
      `update public.study_sessions set status='in_progress',starts_at=now()-interval '30 minutes',started_at=now()-interval '30 minutes',pomodoro_elapsed_ms=1500000 where id='${SESSION}'`
    )
    await asUser(A)
    await expect(db.query(`select public.control_pomodoro('${SESSION}','start',0)`)).rejects.toThrow()
    await db.query(`select public.control_pomodoro('${SESSION}','reset',0,50)`)
    await db.query(`select public.control_pomodoro('${SESSION}','start',1)`)
    await asUser(B)
    await db.query(`select public.transition_session('${SESSION}','cancelled')`)
    const cancelled = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0]
      .value.session
    expect(cancelled).toMatchObject({ status: 'cancelled', pomodoro_started_at: null, pomodoro_revision: 3 })
  })
  it('persists Meet links for both participants and prevents outsider or terminal edits', async () => {
    await asUser(A)
    await db.query(`select public.set_meet_link('${SESSION}','https://meet.google.com/abc-defg-hij')`)
    await asUser(B)
    const mine = (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0].value
      .session
    expect(mine.meet_link).toBe('https://meet.google.com/abc-defg-hij')
    await db.query(`select public.set_meet_link('${SESSION}','https://meet.google.com/xyz-abcd-efg')`)
    await asUser(A)
    expect(
      (await db.query<{ value: any }>(`select public.get_room('${SESSION}') value`)).rows[0].value.session
        .meet_link
    ).toBe('https://meet.google.com/xyz-abcd-efg')
    await asUser(C)
    await expect(
      db.query(`select public.set_meet_link('${SESSION}','https://meet.google.com/aaa-bbbb-ccc')`)
    ).rejects.toThrow()
    await asUser(A)
    await db.query(`select public.transition_session('${SESSION}','cancelled')`)
    await expect(
      db.query(`select public.set_meet_link('${SESSION}','https://meet.google.com/aaa-bbbb-ccc')`)
    ).rejects.toThrow()
  })
})
