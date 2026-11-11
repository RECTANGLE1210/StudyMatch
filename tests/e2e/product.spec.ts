import { test, expect } from '@playwright/test'
import { LocalBackend, A, B, C } from './localBackend'
const backend = new LocalBackend()
function pdfFixture() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ]
  let text = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(text))
    text += `${i + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(text)
  text +=
    'xref\n0 5\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(text)
}
test.beforeAll(async () => {
  await backend.init()
  await backend.db.exec('update public.room_sync_rollout set enabled=true,starts_at=clock_timestamp()')
})
test.afterAll(async () => {
  await backend.db.close()
})
test('anonymous visitors receive the original login and no default identity', async ({ browser }) => {
  const context = await backend.context(browser),
    page = await context.newPage()
  await page.goto('/match')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('button', { name: 'LOGIN WITH GOOGLE' })).toBeVisible()
  await expect(page.getByText('DEMO ·', { exact: false })).toHaveCount(0)
  await expect(page.getByText('Lan Phương', { exact: false })).toHaveCount(0)
  await context.close()
})
test('two learners persist invitations, chat, a session, materials, feedback and progress', async ({
  browser,
}) => {
  const ca = await backend.context(browser, A),
    cb = await backend.context(browser, B),
    a = await ca.newPage(),
    b = await cb.newPage(),
    errors: string[] = []
  a.on('pageerror', (e) => errors.push(e.message))
  b.on('pageerror', (e) => errors.push(e.message))
  await a.goto('/')
  await expect(a.getByRole('heading', { name: 'Chào Người học A ☀️' })).toBeVisible()
  await a.locator('.app-sidebar').getByRole('button', { name: 'Smart Match', exact: true }).click()
  await expect(a.getByText('Người học B', { exact: true })).toBeVisible()
  await a.getByRole('button', { name: 'Xem hồ sơ', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Thứ 2 Tối', exact: true })).toHaveClass(/bg-caramel/)
  await expect(a.getByRole('button', { name: 'Thứ 3 Tối', exact: true })).toHaveClass(/bg-matcha /)
  await expect(a.getByRole('button', { name: 'Thứ 2 Tối', exact: true })).toHaveCSS(
    'background-color',
    'rgb(216, 156, 87)'
  )
  await a.getByRole('button', { name: 'Đóng', exact: true }).click()
  await a.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Hủy lời mời', exact: true })).toBeVisible()
  await b.goto('/')
  await b.getByRole('button', { name: 'Thông báo', exact: true }).click()
  await b.getByRole('button', { name: 'Chấp nhận', exact: true }).click()
  await expect
    .poll(async () =>
      backend.db
        .query<{ status: string }>('select status from public.match_requests')
        .then((r) => r.rows[0]?.status)
    )
    .toBe('accepted')
  await b.goto('/messages')
  await b.getByRole('textbox', { name: 'Tin nhắn', exact: true }).fill('Tin nhắn được lưu thật')
  await b.getByRole('button', { name: 'Gửi', exact: true }).click()
  await expect(b.getByText('Tin nhắn được lưu thật', { exact: true }).last()).toBeVisible()
  await a.goto('/messages')
  await expect(a.getByText('Tin nhắn được lưu thật', { exact: true }).last()).toBeVisible()
  await a.getByRole('button', { name: 'Hẹn buổi học', exact: true }).click()
  await expect(a.getByRole('dialog')).toBeVisible()
  await a.getByPlaceholder('Mục tiêu: làm xong 10 bài tập…').fill('Mục tiêu kiểm thử')
  await a.getByRole('button', { name: 'Gửi đề xuất', exact: true }).click()
  await expect(a.getByRole('dialog')).toHaveCount(0)
  const proposed = await backend.db.query<{ id: string }>('select id from public.study_sessions')
  const id = proposed.rows[0].id
  expect(id).toBeTruthy()
  await b.goto('/sessions')
  await b.getByRole('button', { name: 'Chấp nhận', exact: true }).click()
  await expect
    .poll(async () =>
      backend.db
        .query<{ status: string }>('select status from public.study_sessions where id=$1', [id])
        .then((r) => r.rows[0].status)
    )
    .toBe('scheduled')
  await backend.db.query("update public.study_sessions set starts_at=now()-interval '1 minute' where id=$1", [
    id,
  ])
  await a.goto(`/sessions/${id}`)
  await a.getByRole('button', { name: 'Xác nhận tham gia', exact: true }).click()
  // Deliberately skew the second browser's wall clock; the shared timer uses server time.
  await b.addInitScript(() => {
    const realNow = Date.now.bind(Date)
    Date.now = () => realNow() + 5 * 60_000
  })
  await b.goto(`/sessions/${id}`)
  await b.getByRole('button', { name: 'Xác nhận tham gia', exact: true }).click()
  await a.reload()
  await a.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click()
  await expect(a.getByRole('timer', { name: 'Pomodoro chung' })).toHaveText('25:00')
  await expect(b.getByRole('timer', { name: 'Pomodoro chung' })).toHaveText('25:00')
  await a.getByRole('button', { name: 'Bắt đầu', exact: true }).click()
  await expect(b.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  await b.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Bắt đầu', exact: true })).toBeVisible()
  await expect(a.getByRole('timer')).toHaveText(await b.getByRole('timer').innerText())
  await b.getByRole('button', { name: '50 phút', exact: true }).click()
  await expect(a.getByRole('timer')).toHaveText('50:00')
  await a.getByRole('button', { name: 'Bắt đầu', exact: true }).click()
  await expect(b.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  await b.reload()
  await expect(b.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  const seconds = (text: string) => text.split(':').reduce((total, n) => total * 60 + Number(n), 0)
  await expect
    .poll(async () =>
      Math.abs(
        seconds(await a.getByRole('timer').innerText()) - seconds(await b.getByRole('timer').innerText())
      )
    )
    .toBeLessThanOrEqual(1)
  await b.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Bắt đầu', exact: true })).toBeVisible()
  await expect(a.getByRole('timer')).toHaveText(await b.getByRole('timer').innerText())
  await a.getByRole('button', { name: '25 phút', exact: true }).click()
  await expect(b.getByRole('timer')).toHaveText('25:00')
  // Losing the versioned endpoint must not silently switch an active shared room to local mode.
  await a.route('**/rest/v1/rpc/get_room_v2', (route) =>
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'PGRST202', message: 'get_room_v2 temporarily unavailable' }),
    })
  )
  await expect(a.getByRole('alert').filter({ hasText: 'get_room_v2 temporarily unavailable' })).toBeVisible()
  await expect(a.getByRole('timer', { name: 'Pomodoro chung' })).toHaveText('25:00')
  await a.unroute('**/rest/v1/rpc/get_room_v2')
  await expect(a.getByRole('alert').filter({ hasText: 'get_room_v2 temporarily unavailable' })).toHaveCount(0)
  await a.getByLabel('Mục tiêu kiểm thử', { exact: true }).click()
  await expect(a.getByLabel('Mục tiêu kiểm thử', { exact: true })).toBeChecked()
  await a
    .getByRole('textbox', { name: 'Google Meet', exact: true })
    .fill('https://meet.google.com/abc-defg-hij')
  await a.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Mở', exact: true })).toBeEnabled()
  await expect(b.getByRole('textbox', { name: 'Google Meet', exact: true })).toHaveValue(
    'https://meet.google.com/abc-defg-hij'
  )
  await expect(b.getByRole('button', { name: 'Mở', exact: true })).toBeEnabled()
  await b
    .getByRole('textbox', { name: 'Google Meet', exact: true })
    .fill('https://meet.google.com/xyz-abcd-efg')
  await b.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(a.getByRole('textbox', { name: 'Google Meet', exact: true })).toHaveValue(
    'https://meet.google.com/xyz-abcd-efg'
  )
  await a.getByRole('button', { name: '+ Gắn từ ngân hàng', exact: true }).click()
  await a.getByRole('button', { name: 'Tải lên mục mới', exact: true }).click()
  await a
    .locator('input[type=file]')
    .setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: pdfFixture() })
  await a.getByRole('button', { name: 'Lưu vào ngân hàng', exact: true }).click()
  await expect(a.getByRole('dialog')).toHaveCount(0)
  await expect(a.getByText('notes', { exact: true })).toBeVisible()
  expect((await backend.db.query('select * from public.session_resources')).rows).toHaveLength(1)
  await a
    .getByText('notes', { exact: true })
    .locator('..')
    .getByRole('button', { name: 'Mở', exact: true })
    .click()
  await expect(a.getByTitle('notes', { exact: true })).toBeVisible()
  await expect(a.getByTitle('notes', { exact: true })).toHaveAttribute('src', /\/object\/sign\//)
  await a.getByRole('button', { name: 'Đóng', exact: true }).click()
  await a.getByRole('button', { name: 'Kết thúc & xác nhận hoàn thành', exact: true }).click()
  await expect(a.getByRole('heading', { name: 'Hoàn thành 1/1 mục tiêu', exact: true })).toBeVisible()
  await a.getByRole('button', { name: 'Đánh giá 5 sao', exact: true }).click()
  await a.getByPlaceholder('Một chút cảm nhận về buổi học…').fill('Phiên học hữu ích')
  await a.getByRole('button', { name: 'Lưu phản hồi', exact: true }).click()
  await expect
    .poll(async () => backend.db.query('select * from public.session_feedback').then((r) => r.rows.length))
    .toBe(1)
  await a.goto('/progress')
  await expect(a.getByText('Đã hoàn thành 1 mục tiêu học tập.', { exact: true })).toBeVisible()
  const stats = await backend.as(A, (tx) =>
    tx.query<{ value: { completedSessions: number; partnerCount: number; completedGoals: number } }>(
      'select public.get_progress() value'
    )
  )
  expect(stats.rows[0].value).toMatchObject({ completedSessions: 1, partnerCount: 1, completedGoals: 1 })
  await a.goto('/profile')
  await a.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click()
  await a.getByLabel('Tên hiển thị', { exact: true }).fill('Tên đã chỉnh sửa')
  await a.locator('.app-sidebar').getByRole('button', { name: 'Trang chủ', exact: true }).click()
  await expect(a.getByRole('heading', { name: 'Bỏ các thay đổi chưa lưu?', exact: true })).toBeVisible()
  await a.getByRole('button', { name: 'Ở lại chỉnh sửa', exact: true }).click()
  await a.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click()
  await expect(a.getByRole('heading', { name: 'Tên đã chỉnh sửa', exact: true })).toBeVisible()
  await a.setViewportSize({ width: 390, height: 844 })
  await expect(a.locator('.mobile-nav')).toBeVisible()
  await a.screenshot({ path: test.info().outputPath('mobile-profile.png'), fullPage: true })
  expect(errors).toEqual([])
  await ca.close()
  await cb.close()
})
test('a new account completes the original five-step onboarding with real data', async ({ browser }) => {
  const context = await backend.context(browser, C),
    page = await context.newPage()
  await page.goto('/')
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByPlaceholder('Tên các bạn học sẽ thấy').fill('Người học C')
  await page.getByPlaceholder('Tìm trường của bạn…').fill('Trường kiểm thử')
  await page.getByRole('button', { name: 'Trường kiểm thử', exact: true }).click()
  await page.getByPlaceholder('Tìm ngành hoặc tự nhập…').fill('Ngành kiểm thử')
  await page.getByRole('button', { name: 'Ngành kiểm thử', exact: true }).click()
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'Thêm môn đầu tiên', exact: true }).click()
  await page.getByRole('button', { name: /Toán kiểm thử/ }).click()
  await page.getByRole('button', { name: 'Giới hạn', exact: true }).first().click()
  await page.getByRole('button', { name: 'Thêm môn', exact: true }).click()
  await expect(page.getByText('Toán kiểm thử', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'Cùng giải bài tập', exact: false }).click()
  await page.getByRole('button', { name: 'Pomodoro yên tĩnh', exact: false }).click()
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'Thứ 2 Tối', exact: true }).click()
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  await page.getByRole('button', { name: 'Bắt đầu tìm bạn học', exact: true }).click()
  await expect(page).toHaveURL(/5352\/$/)
  await expect(page.getByRole('heading', { name: 'Chào Người học C ☀️', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Chào Người học C ☀️', exact: true })).toBeVisible()
  await context.close()
})

for (const legacyOnly of [true, false]) {
  test(`existing room keeps its local timer (original backend: ${legacyOnly})`, async ({ browser }) => {
    const old = new LocalBackend()
    await old.init({ legacyOnly })
    let context: Awaited<ReturnType<typeof old.context>> | undefined
    try {
      const result = await old.db.query<{
        id: string
      }>(`insert into public.study_sessions(creator_id,partner_id,subject_id,status,starts_at,ends_at,started_at)
        select '${A}','${B}',id,'in_progress',now()-interval '1 minute',now()+interval '1 hour',now()-interval '1 minute' from public.subjects limit 1 returning id`)
      context = await old.context(browser, A)
      const page = await context.newPage()
      const errors: string[] = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.goto(`/sessions/${result.rows[0].id}`)
      await expect(page.getByRole('timer', { name: 'Pomodoro cá nhân' })).toHaveText('25:00')
      await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
      if (!legacyOnly)
        await old.db.exec('update public.room_sync_rollout set enabled=true,starts_at=clock_timestamp()')
      await expect.poll(async () => page.getByRole('timer').innerText()).not.toBe('25:00')
      await expect(page.getByRole('timer', { name: 'Pomodoro cá nhân' })).toBeVisible()
      await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
      await page
        .getByRole('textbox', { name: 'Google Meet', exact: true })
        .fill('https://meet.google.com/old-room-aaa')
      await page.getByRole('button', { name: 'Lưu', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Mở', exact: true })).toBeEnabled()
      await expect(page.getByRole('timer')).not.toHaveText(/NaN/)
      expect(errors).toEqual([])
    } finally {
      await context?.close()
      await old.db.close()
    }
  })
}

test('profile subject editor stays above cards and saves on desktop and mobile', async ({ browser }) => {
  const context = await backend.context(browser, B)
  try {
    const subject = (await backend.db.query<{ id: string }>('select id from public.subjects limit 1')).rows[0]
      .id
    // A tall editor must scroll within the viewport, independently of the cards behind it.
    for (let i = 0; i < 28; i++)
      await backend.db.query('insert into public.topics(subject_id,name) values($1,$2)', [
        subject,
        `Chủ đề mở rộng ${i}`,
      ])
    const page = await context.newPage()
    for (const [viewport, level] of [
      [{ width: 1440, height: 900 }, 'Nâng cao'],
      [{ width: 390, height: 844 }, 'Trung bình'],
    ] as const) {
      await page.setViewportSize(viewport)
      await page.goto('/profile')
      await page.getByRole('button', { name: /Toán kiểm thử/ }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      expect(await dialog.evaluate((el) => el.parentElement?.parentElement === document.body)).toBe(true)
      await dialog.getByRole('button', { name: level, exact: true }).click()
      const save = dialog.getByRole('button', { name: 'Lưu', exact: true })
      await save.scrollIntoViewIfNeeded()
      expect(
        await save.evaluate((el) => {
          const rect = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
        })
      ).toBe(true)
      await save.click()
      await expect(dialog).toHaveCount(0)
      const saved = await backend.as(B, (tx) =>
        tx.query<{ value: { subjects: { level: string }[] } }>(
          'select public.get_profile_snapshot($1) value',
          [B]
        )
      )
      expect(saved.rows[0].value.subjects[0].level).toBe(level)
    }
  } finally {
    await context.close()
  }
})
