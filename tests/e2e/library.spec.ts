import { test, expect } from '@playwright/test'
import { LocalBackend, A, B, C } from './localBackend'

test('standalone upload, direct grants, inherited room access and public visibility persist', async ({
  browser,
}) => {
  const backend = new LocalBackend()
  await backend.init()
  await backend.db.query(
    "insert into public.profiles(id,display_name,onboarding_completed) values($1,'Người học C',true) on conflict(id) do update set display_name=excluded.display_name,onboarding_completed=true",
    [C]
  )
  const ca = await backend.context(browser, A),
    cb = await backend.context(browser, B),
    cc = await backend.context(browser, C)
  try {
    const a = await ca.newPage(),
      b = await cb.newPage(),
      c = await cc.newPage(),
      errors: string[] = []
    for (const page of [a, b, c]) page.on('pageerror', (e) => errors.push(e.message))
    const title = 'Tài liệu độc lập kiểm thử'
    const content = 'Nội dung tài liệu được lưu online'
    await a.goto('/library')
    await a.getByRole('button', { name: '+ Tải lên', exact: true }).click()
    await expect(
      a.getByRole('dialog').getByText('Gắn vào buổi học (không bắt buộc)', { exact: true })
    ).toHaveCount(0)
    await a
      .locator('input[type=file]')
      .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from(content) })
    await a.getByLabel('Tên hiển thị', { exact: true }).fill(title)
    await a.getByRole('button', { name: 'Lưu vào ngân hàng', exact: true }).click()
    await expect(a.getByRole('dialog')).toHaveCount(0)
    await expect(a.getByText(title, { exact: true })).toBeVisible()
    expect((await backend.db.query('select * from public.study_sessions')).rows).toHaveLength(0)
    await a.reload()
    const card = a.locator('[data-resource-id]').filter({ hasText: title })
    await expect(card).toBeVisible()
    await a.route('**/rest/v1/rpc/get_library_resources', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'PGRST202', message: 'get_library_resources temporarily unavailable' }),
      })
    )
    await a.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(
      a.getByRole('alert').filter({ hasText: 'get_library_resources temporarily unavailable' })
    ).toBeVisible()
    await expect(card).toBeVisible()
    await a.unroute('**/rest/v1/rpc/get_library_resources')
    await a.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(
      a.getByRole('alert').filter({ hasText: 'get_library_resources temporarily unavailable' })
    ).toHaveCount(0)
    await card.getByRole('button', { name: 'Mở', exact: true }).click()
    const href = await a.getByRole('link', { name: 'Mở / tải xuống', exact: true }).getAttribute('href')
    expect(href).toContain('/library-materials/')
    expect(await a.evaluate(async (url) => fetch(url!).then((response) => response.text()), href)).toBe(
      content
    )
    await a.getByRole('button', { name: 'Đóng', exact: true }).click()
    await b.goto('/library')
    await c.goto('/library')
    await expect(b.getByText(title, { exact: true })).toHaveCount(0)
    await expect(c.getByText(title, { exact: true })).toHaveCount(0)
    await card.getByRole('button', { name: 'Chia sẻ', exact: true }).click()
    const friends = a.getByRole('combobox', { name: 'Bạn bè đã kết nối', exact: true })
    await expect(friends).toBeDisabled()
    await expect(a.getByText('Bạn chưa có bạn bè đã kết nối để chọn.', { exact: true })).toBeVisible()
    const subject = (await backend.db.query<{ id: string }>('select id from public.subjects limit 1')).rows[0]
      .id
    const invitation = await backend.as(A, (tx) =>
      tx.query<{ id: string }>('select public.send_invitation($1,$2) id', [B, subject])
    )
    await backend.as(B, (tx) =>
      tx.query("select public.respond_invitation($1,'accepted')", [invitation.rows[0].id])
    )
    await a.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(friends).toBeEnabled()
    await expect(friends.locator(`option[value="${C}"]`)).toHaveCount(0)
    await friends.selectOption(B)
    await a.getByRole('button', { name: 'Cấp quyền cho Người học B', exact: true }).click()
    await expect(a.getByRole('button', { name: 'Thu hồi quyền của Người học B', exact: true })).toBeVisible()
    await expect(friends.locator(`option[value="${B}"]`)).toHaveCount(0)
    await b.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(b.getByText(title, { exact: true })).toBeVisible()
    const session = (
      await backend.db.query<{
        id: string
      }>(`insert into public.study_sessions(creator_id,partner_id,subject_id,status,starts_at,ends_at)
   select '${B}','${C}',id,'scheduled',now()+interval '1 hour',now()+interval '2 hours' from public.subjects limit 1 returning id`)
    ).rows[0].id
    await b.goto(`/sessions/${session}`)
    await b.getByRole('button', { name: '+ Gắn từ ngân hàng', exact: true }).click()
    await b.getByRole('dialog').getByRole('button').filter({ hasText: title }).click()
    await b.getByRole('button', { name: 'Xong', exact: true }).click()
    await c.goto(`/sessions/${session}`)
    await expect(c.getByText(title, { exact: true })).toBeVisible()
    expect(
      (await backend.db.query('select * from public.library_grants where user_id=$1', [C])).rows
    ).toHaveLength(0)
    await c
      .getByText(title, { exact: true })
      .locator('..')
      .getByRole('button', { name: 'Mở', exact: true })
      .click()
    await expect(c.getByRole('link', { name: 'Mở / tải xuống', exact: true })).toHaveAttribute(
      'href',
      /object\/sign\/library-materials/
    )
    await c.getByRole('button', { name: 'Đóng', exact: true }).click()
    await a.getByRole('button', { name: 'Đóng', exact: true }).click()
    await card.getByRole('button', { name: 'Chia sẻ', exact: true }).click()
    await a.getByRole('button', { name: 'Thu hồi quyền của Người học B', exact: true }).click()
    await expect(friends.locator(`option[value="${B}"]`)).toHaveCount(1)
    await expect(a.getByText('Đã gắn vào 1 buổi học.', { exact: false })).toBeVisible()
    await a.getByRole('button', { name: 'Gỡ khỏi mọi buổi học', exact: true }).click()
    await expect(b.getByText(title, { exact: true })).toHaveCount(0)
    await expect(c.getByText(title, { exact: true })).toHaveCount(0)
    await a.getByLabel('Quyền truy cập', { exact: true }).selectOption('public')
    await a.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }).click()
    await c.goto('/library')
    await expect(c.getByText(title, { exact: true })).toBeVisible()
    await a.getByLabel('Quyền truy cập', { exact: true }).selectOption('restricted')
    await a.getByRole('button', { name: 'Lưu quyền truy cập', exact: true }).click()
    await c.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(c.getByText(title, { exact: true })).toHaveCount(0)
    await backend.as(A, (tx) => tx.query('select public.block_user($1)', [B]))
    await backend.as(A, (tx) => tx.query('select public.unblock_user($1)', [B]))
    await a.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(friends.locator(`option[value="${B}"]`)).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    await ca.close()
    await cb.close()
    await cc.close()
    await backend.db.close()
  }
})

test('legacy bank remains readable before the library migration is installed', async ({ browser }) => {
  const backend = new LocalBackend()
  await backend.init({ legacyOnly: true })
  const context = await backend.context(browser, A)
  try {
    const id = (
      await backend.db.query<{
        id: string
      }>(`insert into public.study_sessions(creator_id,partner_id,subject_id,status,starts_at,ends_at)
   select '${A}','${B}',id,'scheduled',now()+interval '1 hour',now()+interval '2 hours' from public.subjects limit 1 returning id`)
    ).rows[0].id
    await backend.db.query(
      "insert into public.session_resources(session_id,uploader_id,name,external_url) values($1,$2,'Tài liệu buổi học cũ','https://example.com/legacy')",
      [id, A]
    )
    const page = await context.newPage()
    await page.goto('/library')
    const card = page.locator('[data-resource-id]').filter({ hasText: 'Tài liệu buổi học cũ' })
    await card.getByRole('button', { name: 'Mở', exact: true }).click()
    await expect(page.getByRole('link', { name: 'Mở liên kết', exact: true })).toHaveAttribute(
      'href',
      'https://example.com/legacy'
    )
  } finally {
    await context.close()
    await backend.db.close()
  }
})

test('an uploader can copy an old session file into the independent bank without deleting it', async ({
  browser,
}) => {
  const backend = new LocalBackend()
  await backend.init()
  const context = await backend.context(browser, A)
  try {
    const session = (
      await backend.db.query<{
        id: string
      }>(`insert into public.study_sessions(creator_id,partner_id,subject_id,status,starts_at,ends_at)
   select '${A}','${B}',id,'scheduled',now()+interval '1 hour',now()+interval '2 hours' from public.subjects limit 1 returning id`)
    ).rows[0].id
    const path = `${session}/${A}/legacy-notes`
    const text = 'Original online notes'
    backend.files.set(`session-materials/${path}`, { body: Buffer.from(text), type: 'text/plain' })
    await backend.db.query("insert into storage.objects(bucket_id,name) values('session-materials',$1)", [
      path,
    ])
    await backend.db.query(
      "insert into public.session_resources(session_id,uploader_id,name,storage_path,mime_type,size_bytes) values($1,$2,'Ghi chú cũ',$3,'text/plain',$4)",
      [session, A, path, Buffer.byteLength(text)]
    )
    const page = await context.newPage()
    await page.goto('/library')
    await page.getByRole('button', { name: 'Sao chép vào ngân hàng', exact: true }).click()
    const copy = page
      .locator('[data-resource-id]')
      .filter({ hasText: 'Ghi chú cũ' })
      .filter({ hasText: 'Chỉ người có quyền' })
    await expect(copy).toBeVisible()
    expect((await backend.db.query('select * from public.session_resources')).rows).toHaveLength(1)
    expect((await backend.db.query('select * from public.library_resources')).rows).toHaveLength(1)
    await copy.getByRole('button', { name: 'Mở', exact: true }).click()
    const href = await page.getByRole('link', { name: 'Mở / tải xuống', exact: true }).getAttribute('href')
    expect(href).toContain('/library-materials/')
    expect(await page.evaluate(async (url) => fetch(url!).then((response) => response.text()), href)).toBe(
      text
    )
    const peer = await backend.as(B, (tx) =>
      tx.query<{ value: unknown[] }>('select public.get_library_resources() value')
    )
    expect(peer.rows[0].value).toEqual([])
  } finally {
    await context.close()
    await backend.db.close()
  }
})
