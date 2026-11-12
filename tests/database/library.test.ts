import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const A = '00000000-0000-0000-0000-000000000001',
  B = '00000000-0000-0000-0000-000000000002',
  C = '00000000-0000-0000-0000-000000000003',
  D = '00000000-0000-0000-0000-000000000004'
const SUBJECT = '10000000-0000-0000-0000-000000000001',
  AB = '20000000-0000-0000-0000-000000000001',
  BC = '20000000-0000-0000-0000-000000000002',
  DOC = '40000000-0000-0000-0000-000000000001'
let db: PGlite, oldRoom: string
const as = async (id: string) =>
  db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
const list = async () =>
  (await db.query<{ value: { id: string }[] }>('select public.get_library_resources() value')).rows[0].value
const create = async (visibility = 'restricted') =>
  db.query(
    `select public.create_library_resource('${DOC}','Independent document','doc','Math','${visibility}',null,'https://example.com/document')`
  )
const upload = async () => {
  await db.query(`insert into storage.objects(bucket_id,name) values('library-materials','${A}/${DOC}')`)
  await db.query(
    `select public.create_library_resource('${DOC}','Actual PDF','doc','','restricted','${A}/${DOC}',null,'application/pdf',20)`
  )
}
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
  oldRoom = (
    await db.query<{ definition: string }>(
      "select pg_get_functiondef('public.get_room(uuid)'::regprocedure) definition"
    )
  ).rows[0].definition
  await migrate('202611120001_library.sql')
  await db.exec(
    `insert into auth.users values('${A}'),('${B}'),('${C}'),('${D}');insert into public.subjects(id,code,name) values('${SUBJECT}','LIB','Math');`
  )
}, 30_000)
beforeEach(async () => {
  await db.exec(`reset role;truncate public.library_resources cascade;truncate public.profiles cascade;delete from storage.objects;
 insert into public.profiles(id,display_name) values('${A}','Learner A'),('${B}','Learner B'),('${C}','Learner C'),('${D}','Learner D');
 insert into public.study_sessions(id,creator_id,partner_id,subject_id,status,starts_at,ends_at) values
 ('${AB}','${A}','${B}','${SUBJECT}','scheduled',now()+interval '1 hour',now()+interval '2 hours'),
 ('${BC}','${B}','${C}','${SUBJECT}','scheduled',now()+interval '1 hour',now()+interval '2 hours');`)
})
afterAll(async () => {
  await db?.close()
})
describe('standalone library and inherited access', () => {
  it('uploads without any meeting and keeps restricted files private', async () => {
    await db.exec('delete from public.study_sessions')
    await as(A)
    await upload()
    expect(await list()).toHaveLength(1)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    await as(B)
    expect(await list()).toEqual([])
    expect((await db.query('select * from storage.objects')).rows).toEqual([])
  })
  it('grants a reader access and lets them share into a meeting the owner does not attend', async () => {
    await as(A)
    await upload()
    await db.query(`select public.set_library_grant('${DOC}','${B}',true)`)
    await as(B)
    expect(await list()).toHaveLength(1)
    await db.query(`select public.attach_library_resource('${DOC}','${BC}')`)
    await as(C)
    expect(await list()).toHaveLength(1)
    expect((await db.query('select * from storage.objects')).rows).toHaveLength(1)
    await as(D)
    expect(await list()).toEqual([])
    expect((await db.query('select * from storage.objects')).rows).toEqual([])
  })
  it('keeps session-derived access after a direct grant is revoked, until attachment is removed', async () => {
    await as(A)
    await upload()
    await db.query(`select public.set_library_grant('${DOC}','${B}',true)`)
    await as(B)
    await db.query(`select public.attach_library_resource('${DOC}','${BC}')`)
    await as(A)
    await db.query(`select public.set_library_grant('${DOC}','${B}',false)`)
    await as(B)
    expect(await list()).toHaveLength(1)
    await as(C)
    expect(await list()).toHaveLength(1)
    await as(A)
    await db.query(`select public.clear_library_attachments('${DOC}')`)
    await as(B)
    expect(await list()).toEqual([])
    await as(C)
    expect(await list()).toEqual([])
    expect((await db.query('select * from storage.objects')).rows).toEqual([])
  })
  it('allows public documents to signed-in users and revokes access on restricting them', async () => {
    await as(A)
    await create('public')
    await as(D)
    expect(await list()).toHaveLength(1)
    await as(A)
    await db.query(`select public.set_library_visibility('${DOC}','restricted')`)
    await as(D)
    expect(await list()).toEqual([])
    await db.exec('set role anon')
    await expect(db.query('select public.get_library_resources()')).rejects.toThrow()
    await expect(db.query('select * from public.library_resources')).rejects.toThrow()
  })
  it('prevents readers from editing ACLs/deleting and outsiders from attaching', async () => {
    await as(A)
    await create('public')
    await as(B)
    for (const sql of [
      `select public.set_library_visibility('${DOC}','restricted')`,
      `select public.set_library_grant('${DOC}','${D}',true)`,
      `select public.clear_library_attachments('${DOC}')`,
      `select public.remove_library_resource('${DOC}')`,
    ])
      await expect(db.query(sql)).rejects.toThrow()
    await as(D)
    await expect(db.query(`select public.attach_library_resource('${DOC}','${AB}')`)).rejects.toThrow()
    await as(A)
    await db.query(`select public.set_library_visibility('${DOC}','restricted')`)
    await as(B)
    await expect(db.query(`select public.attach_library_resource('${DOC}','${BC}')`)).rejects.toThrow()
  })
  it('requires a real owned upload, valid payload, MIME and size', async () => {
    await as(A)
    await expect(
      db.query(
        `select public.create_library_resource('${DOC}','Fake','doc','','restricted','${A}/${DOC}',null,'application/pdf',1)`
      )
    ).rejects.toThrow()
    await db.query(`insert into storage.objects(bucket_id,name) values('library-materials','${A}/${DOC}')`)
    for (const [mime, size] of [
      ['text/html', 20],
      ['application/pdf', 0],
      ['application/pdf', 10485761],
      ['application/pdf', null],
    ] as const)
      await expect(
        db.query('select public.create_library_resource($1,$2,$3,$4,$5,$6,null,$7,$8)', [
          DOC,
          'Invalid',
          'doc',
          '',
          'restricted',
          `${A}/${DOC}`,
          mime,
          size,
        ])
      ).rejects.toThrow()
    await expect(
      db.query(`select public.create_library_resource('${DOC}','Empty','doc','','restricted')`)
    ).rejects.toThrow()
    await expect(
      db.query(
        `select public.create_library_resource('${DOC}','Unsafe','doc','','restricted',null,'javascript:alert(1)')`
      )
    ).rejects.toThrow()
    await as(B)
    await expect(
      db.query(
        `select public.create_library_resource('${DOC}','Spoof','doc','','restricted','${A}/${DOC}',null,'application/pdf',20)`
      )
    ).rejects.toThrow()
  })
  it('does not permit direct writes, forged grants or non-owner file deletion', async () => {
    await as(A)
    await upload()
    await db.query(`select public.set_library_grant('${DOC}','${B}',true)`)
    await as(B)
    await expect(
      db.query(`insert into public.library_grants(resource_id,user_id) values('${DOC}','${C}')`)
    ).rejects.toThrow()
    await expect(
      db.query(`update public.library_resources set visibility='public' where id='${DOC}'`)
    ).rejects.toThrow()
    expect(
      (await db.query("delete from storage.objects where bucket_id='library-materials' returning id")).rows
    ).toEqual([])
  })
  it('detaches a document and drops inherited access while preserving the owner copy', async () => {
    await as(A)
    await create()
    await db.query(`select public.set_library_grant('${DOC}','${B}',true)`)
    await as(B)
    await db.query(`select public.attach_library_resource('${DOC}','${BC}')`)
    await as(C)
    await db.query(`select public.detach_library_resource('${DOC}','${BC}')`)
    expect(await list()).toEqual([])
    await as(A)
    expect(await list()).toHaveLength(1)
  })
  it('soft-deletes a public/shared file and revokes everyone else while allowing cleanup retry', async () => {
    await as(A)
    await upload()
    await db.query(`select public.set_library_visibility('${DOC}','public')`)
    const removed = (await db.query<{ path: string }>(`select public.remove_library_resource('${DOC}') path`))
      .rows[0].path
    expect(removed).toBe(`${A}/${DOC}`)
    expect(await list()).toEqual([])
    await db.query(`select public.remove_library_resource('${DOC}')`)
    await as(B)
    expect(await list()).toEqual([])
    expect((await db.query('select * from storage.objects')).rows).toEqual([])
  })
  it('preserves old room APIs and material visibility', async () => {
    expect(
      (
        await db.query<{ definition: string }>(
          "select pg_get_functiondef('public.get_room(uuid)'::regprocedure) definition"
        )
      ).rows[0].definition
    ).toBe(oldRoom)
    await as(A)
    await db.query(
      `insert into public.session_resources(session_id,uploader_id,name,external_url) values('${AB}','${A}','Legacy notes','https://example.com/legacy')`
    )
    await as(B)
    const old = (
      await db.query<{ value: { resources: { name: string }[] } }>(`select public.get_room('${AB}') value`)
    ).rows[0].value
    expect(old.resources[0].name).toBe('Legacy notes')
    expect(await list()).toEqual([])
  })
  it('returns private sharing details only to the owner and finds users without exposing email', async () => {
    await as(A)
    await create()
    await db.query(`select public.set_library_grant('${DOC}','${B}',true)`)
    const result = (
      await db.query<{ value: { grants: { id: string; name: string }[] } }>(
        `select public.get_library_sharing('${DOC}') value`
      )
    ).rows[0].value
    expect(result.grants).toEqual([{ id: B, name: 'Learner B' }])
    const users = (
      await db.query<{ value: Record<string, unknown>[] }>(
        "select public.search_library_users('Learner B') value"
      )
    ).rows[0].value
    expect(users).toEqual([{ id: B, name: 'Learner B' }])
    await as(B)
    await expect(db.query(`select public.get_library_sharing('${DOC}')`)).rejects.toThrow()
  })
  it('rejects expired meetings and rolls back a create-and-attach transaction on invalid session', async () => {
    await as(A)
    await expect(
      db.query(
        `select public.create_library_resource('${DOC}','No target','doc','','restricted',null,'https://example.com/doc',null,null,'${BC}')`
      )
    ).rejects.toThrow()
    expect(await list()).toEqual([])
    await create('public')
    await db.exec(
      `reset role;update public.study_sessions set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id='${AB}'`
    )
    await as(A)
    await expect(db.query(`select public.attach_library_resource('${DOC}','${AB}')`)).rejects.toThrow()
  })
})
