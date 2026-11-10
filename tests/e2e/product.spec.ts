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
  await b.goto(`/sessions/${id}`)
  await b.getByRole('button', { name: 'Xác nhận tham gia', exact: true }).click()
  await a.reload()
  await a.getByRole('button', { name: 'Bắt đầu phiên học', exact: true }).click()
  await expect(a.getByText('25:00', { exact: true })).toBeVisible()
  await a.getByLabel('Mục tiêu kiểm thử', { exact: true }).click()
  await expect(a.getByLabel('Mục tiêu kiểm thử', { exact: true })).toBeChecked()
  await a
    .getByRole('textbox', { name: 'Google Meet', exact: true })
    .fill('https://meet.google.com/abc-defg-hij')
  await a.getByRole('button', { name: 'Lưu', exact: true }).click()
  await expect(a.getByRole('button', { name: 'Mở', exact: true })).toBeEnabled()
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
