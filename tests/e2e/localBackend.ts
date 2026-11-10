// Test-only PostgREST/Storage transport over real PGlite migrations and RLS.
// This module is never imported into src or deployed. It does not test Google OAuth or Supabase Realtime delivery.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Browser, BrowserContext, Route } from '@playwright/test'
export const A = '00000000-0000-0000-0000-000000000001',
  B = '00000000-0000-0000-0000-000000000002',
  C = '00000000-0000-0000-0000-000000000003'
export const users = {
  [A]: {
    id: A,
    email: 'learner-a@example.test',
    user_metadata: { full_name: 'Người học A' },
    app_metadata: { provider: 'google' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
  [B]: {
    id: B,
    email: 'learner-b@example.test',
    user_metadata: { full_name: 'Người học B' },
    app_metadata: { provider: 'google' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
  [C]: {
    id: C,
    email: 'learner-c@example.test',
    user_metadata: { full_name: 'Người học C' },
    app_metadata: { provider: 'google' },
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  },
}
export class LocalBackend {
  db = new PGlite()
  files = new Map<string, { body: Buffer; type: string }>()
  signed = new Map<string, { key: string; expires: number }>()
  async init() {
    await this.db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text not null,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`
    )
    const folder = resolve('supabase/migrations')
    for (const name of readdirSync(folder)
      .filter((n) => n.endsWith('.sql'))
      .sort())
      await this.db.exec(readFileSync(resolve(folder, name), 'utf8'))
    await this.db.query('insert into auth.users values($1),($2),($3)', [A, B, C])
    for (const id of [A, B] as const)
      await this.as(id, (tx) =>
        tx.query('select public.save_profile_view($1,true)', [
          JSON.stringify({
            name: users[id].user_metadata.full_name,
            uni: 'Trường kiểm thử',
            major: 'Ngành kiểm thử',
            avatar: null,
            avatarPath: null,
            bio: 'Hồ sơ fixture chỉ dùng trong kiểm thử',
            subjects: [
              {
                name: 'Toán kiểm thử',
                code: '',
                level: 'Trung bình',
                strong: [id === A ? 'Giới hạn' : 'Tích phân'],
                weak: [id === A ? 'Tích phân' : 'Giới hạn'],
              },
            ],
            goals: ['Cùng giải bài tập'],
            styles: ['Pomodoro yên tĩnh'],
            avail: ['T2-Tối'],
            timezone: 'Asia/Ho_Chi_Minh',
          }),
        ])
      )
  }
  async as<T>(id: string, work: (tx: Pick<PGlite, 'query' | 'exec'>) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.exec('set local role authenticated')
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [id])
      return work(tx)
    })
  }
  async context(browser: Browser, id?: keyof typeof users): Promise<BrowserContext> {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    if (id) {
      const now = Math.floor(Date.now() / 1000),
        encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.test_signature`
      const session = {
        access_token: token,
        refresh_token: 'test_refresh_only',
        expires_in: 3600,
        expires_at: now + 3600,
        token_type: 'bearer',
        user: users[id],
      }
      await context.addInitScript(
        ({ session }) => {
          if (location.origin === 'http://127.0.0.1:5352')
            localStorage.setItem('sb-localhost-auth-token', JSON.stringify(session))
        },
        { session }
      )
    }
    await context.route('http://localhost:54329/**', (route) => this.handle(route, id))
    return context
  }
  async handle(route: Route, id?: keyof typeof users) {
    const request = route.request(),
      url = new URL(request.url()),
      method = request.method(),
      headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      }
    const reply = (status: number, value: unknown) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) })
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname.includes('/logout')) return reply(200, {})
      return id ? reply(200, users[id]) : reply(401, { message: 'Authentication required' })
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/') && method === 'GET') {
      const token = this.signed.get(url.searchParams.get('token') ?? ''),
        file = token && token.expires > Date.now() ? this.files.get(token.key) : null
      return file
        ? route.fulfill({ status: 200, headers, contentType: file.type, body: file.body })
        : reply(403, { message: 'Expired private URL' })
    }
    if (!id) return reply(401, { message: 'Authentication required' })
    const bearer = request.headers().authorization?.replace(/^Bearer /, '')
    let subject = ''
    try {
      subject = JSON.parse(Buffer.from(bearer?.split('.')[1] ?? '', 'base64url').toString()).sub
    } catch {}
    if (subject !== id)
      return reply(401, { message: 'Test transport requires the authenticated session token' })
    try {
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').at(-1)!,
          args = request.postDataJSON() ?? {}
        if (!/^[a-z_]+$/.test(name)) throw new Error('Invalid RPC')
        const names = Object.keys(args)
        if (names.some((n) => !/^[a-z_]+$/.test(n))) throw new Error('Invalid argument')
        const values = names.map((n) =>
          Array.isArray(args[n]) && n === 'topic_ids'
            ? `{${args[n].join(',')}}`
            : typeof args[n] === 'object' && args[n] !== null
              ? JSON.stringify(args[n])
              : args[n]
        )
        const result = await this.as(id, (tx) =>
          tx.query<{ value: unknown }>(
            `select public.${name}(${names.map((n, i) => `"${n}"=>$${i + 1}`).join(',')}) value`,
            values
          )
        )
        return reply(200, result.rows[0]?.value ?? null)
      }
      if (url.pathname.startsWith('/rest/v1/')) {
        const table = url.pathname.split('/').at(-1)!
        if (
          ![
            'universities',
            'majors',
            'subjects',
            'topics',
            'profiles',
            'session_goals',
            'session_resources',
            'session_feedback',
            'messages',
          ].includes(table)
        )
          throw new Error('Unexpected test table')
        const params: unknown[] = [],
          where: string[] = []
        for (const [key, value] of url.searchParams) {
          if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key)) continue
          if (!/^[a-z_]+$/.test(key) || !value.startsWith('eq.')) throw new Error('Unsupported filter')
          params.push(value.slice(3))
          where.push(`"${key}"=$${params.length}`)
        }
        let sql = ''
        if (method === 'GET') {
          sql =
            table === 'subjects' && (url.searchParams.get('select') ?? '').includes('topics(')
              ? `select s.*,coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)) from public.topics t where t.subject_id=s.id),'[]'::jsonb) topics from public.subjects s`
              : `select * from public.${table}`
          if (where.length) sql += ' where ' + where.join(' and ')
          const order = url.searchParams.get('order')
          if (order) {
            const parts = order.split(',').map((part) => {
              const [column, direction] = part.split('.')
              if (!/^[a-z_]+$/.test(column)) throw new Error('Invalid order')
              return `"${column}" ${direction === 'desc' ? 'desc' : 'asc'}`
            })
            sql += ' order by ' + parts.join(',')
          }
        } else if (method === 'POST') {
          const body = request.postDataJSON(),
            fields = Object.keys(body)
          if (fields.some((k) => !/^[a-z_]+$/.test(k))) throw new Error('Invalid columns')
          params.push(...fields.map((k) => body[k]))
          sql = `insert into public.${table}(${fields.map((k) => `"${k}"`).join(',')}) values(${fields.map((_, i) => `$${i + 1}`).join(',')})`
          if (table === 'session_feedback')
            sql +=
              ' on conflict(session_id,user_id) do update set rating=excluded.rating,comment=excluded.comment'
          sql += ' returning *'
        } else if (method === 'PATCH') {
          const body = request.postDataJSON(),
            fields = Object.keys(body)
          if (fields.some((k) => !/^[a-z_]+$/.test(k))) throw new Error('Invalid columns')
          const changes = fields.map((k) => {
            params.push(body[k])
            return `"${k}"=$${params.length}`
          })
          sql = `update public.${table} set ${changes.join(',')} where ${where.length ? where.join(' and ') : 'false'} returning *`
        } else if (method === 'DELETE')
          sql = `delete from public.${table} where ${where.length ? where.join(' and ') : 'false'} returning *`
        else throw new Error('Unsupported operation')
        const result = await this.as(id, (tx) => tx.query(sql, params))
        const single = request.headers().accept?.includes('vnd.pgrst.object+json')
        if (single && result.rows.length !== 1)
          return reply(406, { code: 'PGRST116', message: 'Row unavailable' })
        return reply(method === 'POST' ? 201 : 200, single ? result.rows[0] : result.rows)
      }
      if (url.pathname.startsWith('/storage/v1/object/')) {
        const parts = decodeURIComponent(url.pathname.slice('/storage/v1/object/'.length)).split('/'),
          isSign = parts[0] === 'sign',
          bucket = parts[isSign ? 1 : 0],
          name = parts.slice(isSign ? 2 : 1).join('/'),
          key = `${bucket}/${name}`
        if (isSign) {
          const result = await this.as(id, (tx) =>
            tx.query('select id from storage.objects where bucket_id=$1 and name=$2', [bucket, name])
          )
          if (!result.rows.length) return reply(404, { message: 'Private file unavailable' })
          const token = randomUUID()
          this.signed.set(token, {
            key,
            expires: Date.now() + (request.postDataJSON().expiresIn ?? 60) * 1000,
          })
          return reply(200, { signedURL: `/object/sign/${bucket}/${name}?token=${token}` })
        }
        if (method === 'POST') {
          const form = await new Request('http://localhost', {
              method: 'POST',
              headers: request.headers(),
              body: Uint8Array.from(request.postDataBuffer()!).buffer,
            }).formData(),
            file = [...form.values()].find((v) => typeof v !== 'string')
          if (!file || typeof file === 'string') throw new Error('No uploaded file')
          const bucketRows = await this.db.query<{ file_size_limit: number; allowed_mime_types: string[] }>(
            'select file_size_limit,allowed_mime_types from storage.buckets where id=$1',
            [bucket]
          )
          const policy = bucketRows.rows[0]
          if (!policy || file.size > policy.file_size_limit || !policy.allowed_mime_types.includes(file.type))
            throw new Error('Invalid upload')
          await this.as(id, (tx) =>
            tx.query('insert into storage.objects(bucket_id,name) values($1,$2)', [bucket, name])
          )
          this.files.set(key, { body: Buffer.from(await file.arrayBuffer()), type: file.type })
          return reply(200, { Key: key, Id: randomUUID() })
        }
        if (method === 'DELETE') {
          const deleted = []
          for (const prefix of request.postDataJSON().prefixes) {
            const result = await this.as(id, (tx) =>
              tx.query('delete from storage.objects where bucket_id=$1 and name=$2 returning name', [
                bucket,
                prefix,
              ])
            )
            if (result.rows.length) {
              this.files.delete(`${bucket}/${prefix}`)
              deleted.push({ name: prefix })
            }
          }
          return reply(200, deleted)
        }
      }
      throw new Error(`Unhandled test endpoint ${method} ${url.pathname}`)
    } catch (error) {
      const e = error as { message: string; code?: string }
      return reply(e.code === '42501' ? 403 : 400, { message: e.message, code: e.code ?? 'TEST_BACKEND' })
    }
  }
}
