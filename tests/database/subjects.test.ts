import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
const A = '00000000-0000-0000-0000-000000000001',
  B = '00000000-0000-0000-0000-000000000002'
const FIRST = '10000000-0000-0000-0000-000000000001',
  LEGACY = '10000000-0000-0000-0000-000000000002'
let db: PGlite
let preserved: boolean
const as = async (id: string) =>
  db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`)
const create = (name: string, code: string | null = null) =>
  db.query<{ subject: { id: string; name: string; code: string; topics: unknown[] } }>(
    'select public.create_subject($1,$2) subject',
    [name, code]
  )
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
  await db.exec(`insert into auth.users values('${A}'),('${B}');insert into public.profiles(id,display_name) values('${A}','A');
 insert into public.subjects(id,name,code) values('${FIRST}','Toán học','IT1000'),('${LEGACY}','  TOÁN   HỌC  ','IT1001');
 insert into public.user_subjects(user_id,subject_id,proficiency) values('${A}','${LEGACY}',1);`)
  const before = JSON.stringify((await db.query('select * from public.subjects order by id')).rows)
  await migrate('202611120002_subject_catalog.sql')
  preserved =
    before === JSON.stringify((await db.query('select * from public.subjects order by id')).rows) &&
    (await db.query(`select * from public.user_subjects where subject_id='${LEGACY}'`)).rows.length === 1
}, 30_000)
beforeEach(async () => {
  await db.exec(
    `reset role;truncate public.profiles cascade;delete from public.subjects where id not in ('${FIRST}','${LEGACY}');insert into public.profiles(id,display_name) values('${A}','A');`
  )
})
afterAll(async () => {
  await db?.close()
})
describe('manual subject catalog', () => {
  it('preserves existing IDs, spelling variants and profile references', () => {
    expect(preserved).toBe(true)
  })
  it('creates an actual catalog subject accessible to another signed-in user', async () => {
    await as(A)
    const value = (await create('  Hệ thống   phân tán  ', ' it 7000 ')).rows[0].subject
    expect(value).toMatchObject({ name: 'Hệ thống phân tán', code: 'IT7000', topics: [] })
    await as(B)
    expect((await db.query('select name from public.subjects where id=$1', [value.id])).rows[0]).toEqual({
      name: value.name,
    })
  })
  it('generates a unique code when no manual code was supplied and supports onboarding', async () => {
    await as(B)
    const value = (await create('Phương pháp học mới')).rows[0].subject
    expect(value.code).toMatch(/^SM-/)
    expect(value.id).toBeTruthy()
  })
  it('rejects existing names despite case, whitespace or Unicode normalization', async () => {
    await as(A)
    for (const name of [
      'Toán học',
      ' TOÁN  HỌC ',
      'Toán học'.normalize('NFD'),
      'Toán\thọc',
      'Toán\u00a0học',
      'Toán\u202fhọc',
    ])
      await expect(create(name)).rejects.toThrow('đã tồn tại')
  })
  it('rejects a duplicate code even under a different course name and releases rolled-back reservations', async () => {
    await as(A)
    await expect(create('Chuyên đề mới', ' it 1000 ')).rejects.toThrow('Mã môn học đã tồn tại')
    expect((await create('Chuyên đề mới', 'IT2000')).rows[0].subject.code).toBe('IT2000')
  })
  it('does not expose direct catalog writes or identity reservations to a client or anonymous caller', async () => {
    await as(A)
    await expect(db.query("insert into public.subjects(name,code) values('Spoof','SPOOF')")).rejects.toThrow()
    await expect(db.query('select * from private.subject_catalog_keys')).rejects.toThrow()
    await db.exec('set role anon')
    await expect(create('Anonymous')).rejects.toThrow()
  })
  it('rejects blanks and oversized names/codes', async () => {
    await as(A)
    for (const name of ['', '   ', 'a'.repeat(201)]) await expect(create(name)).rejects.toThrow()
    await expect(create('Valid name', 'a'.repeat(81))).rejects.toThrow()
  })
  it('prevents duplicates through the older profile-save route and leaves the profile unchanged', async () => {
    await as(A)
    const profile = {
      name: 'Should roll back',
      uni: 'School',
      major: 'Major',
      bio: '',
      avatar: null,
      avatarPath: null,
      subjects: [{ name: 'TOÁN  HỌC', code: '', level: 'Trung bình', strong: [], weak: [] }],
      goals: ['Exam'],
      styles: ['Quiet'],
      avail: ['T2-Tối'],
      timezone: 'UTC',
    }
    await expect(
      db.query('select public.save_profile_view($1,true)', [JSON.stringify(profile)])
    ).rejects.toThrow('đã tồn tại')
    expect((await db.query('select display_name from public.profiles where id=$1', [A])).rows[0]).toEqual({
      display_name: 'A',
    })
  })
  it('preserves normal saves using a subject that already exists', async () => {
    await as(A)
    const profile = {
      name: 'A',
      uni: 'School',
      major: 'Major',
      bio: '',
      avatar: null,
      avatarPath: null,
      subjects: [{ name: 'Toán học', code: 'IT1000', level: 'Trung bình', strong: [], weak: [] }],
      goals: ['Exam'],
      styles: ['Quiet'],
      avail: ['T2-Tối'],
      timezone: 'UTC',
    }
    await db.query('select public.save_profile_view($1,true)', [JSON.stringify(profile)])
    expect(
      (await db.query('select subject_id from public.user_subjects where user_id=$1', [A])).rows[0]
    ).toEqual({ subject_id: FIRST })
  })
  it('allows only one successful insertion among normalized duplicate requests', async () => {
    await as(A)
    const attempts = await Promise.allSettled([
      create('Chuyên đề song song', 'PAR-A'),
      create('  CHUYÊN ĐỀ   SONG SONG ', 'PAR-B'),
      create('Chuyên đề song song'.normalize('NFD'), 'PAR-C'),
    ])
    expect(attempts.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  })
  it('guards renames, releases old names on rename/delete, and does not leave orphaned reservations', async () => {
    await as(A)
    const value = (await create('Tên cũ', 'NEW3000')).rows[0].subject
    await db.exec('reset role')
    await expect(
      db.query("update public.subjects set name='TOÁN HỌC' where id=$1", [value.id])
    ).rejects.toThrow('đã tồn tại')
    await db.query("update public.subjects set name='Tên mới' where id=$1", [value.id])
    await as(A)
    await create('Tên cũ', 'NEW3001')
    await db.exec('reset role')
    await db.query('delete from public.subjects where id=$1', [value.id])
    await as(A)
    expect((await create('Tên mới', 'NEW3000')).rows[0].subject.name).toBe('Tên mới')
  })
})
