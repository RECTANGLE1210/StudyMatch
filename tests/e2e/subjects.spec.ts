import { test, expect } from '@playwright/test'
import { LocalBackend, A, B } from './localBackend'

test('users add a manual subject, others select it, and duplicate names/codes are rejected', async ({
  browser,
}) => {
  const backend = new LocalBackend()
  await backend.init()
  const ca = await backend.context(browser, A),
    cb = await backend.context(browser, B)
  try {
    const a = await ca.newPage(),
      b = await cb.newPage(),
      name = 'Hệ thống phân tán thử nghiệm',
      code = 'IT-CUSTOM-2026'
    await a.goto('/profile')
    await a.getByRole('button', { name: '+ Thêm môn học', exact: true }).click()
    await a.getByRole('button', { name: '+ Tự bổ sung môn học', exact: true }).click()
    await a.getByLabel('Tên môn học', { exact: true }).fill(name)
    await a.getByLabel('Mã môn học (không bắt buộc)', { exact: true }).fill(code)
    await a.getByRole('button', { name: 'Tạo môn mới', exact: true }).click()
    await expect(a.getByRole('dialog').getByRole('heading', { name, exact: true })).toBeVisible()
    await a.getByPlaceholder('Thêm chủ đề khác…').fill('Nhất quán phân tán')
    await a.getByRole('button', { name: 'Thêm', exact: true }).click()
    await a.getByRole('button', { name: 'Nhất quán phân tán', exact: true }).first().click()
    await a.getByRole('button', { name: 'Thêm môn', exact: true }).click()
    await expect(a.getByRole('dialog')).toHaveCount(0)
    await a.reload()
    await expect(a.getByText(name, { exact: true })).toBeVisible()
    await b.goto('/profile')
    await b.getByRole('button', { name: '+ Thêm môn học', exact: true }).click()
    await b.getByPlaceholder('Tìm theo tên hoặc mã môn…').fill(name)
    await b.getByRole('dialog').getByRole('button').filter({ hasText: name }).click()
    await b.getByRole('button', { name: 'Thêm môn', exact: true }).click()
    await expect(b.getByRole('dialog')).toHaveCount(0)
    const subject = (
      await backend.db.query<{ id: string }>('select id from public.subjects where name=$1', [name])
    ).rows[0].id
    expect(
      (await backend.db.query('select * from public.user_subjects where subject_id=$1', [subject])).rows
    ).toHaveLength(2)
    await a.getByRole('button', { name: '+ Thêm môn học', exact: true }).click()
    await a.getByRole('button', { name: '+ Tự bổ sung môn học', exact: true }).click()
    await a
      .getByLabel('Tên môn học', { exact: true })
      .fill('  HỆ THỐNG   PHÂN TÁN THỬ NGHIỆM  '.normalize('NFD'))
    await a.getByRole('button', { name: 'Tạo môn mới', exact: true }).click()
    await expect(a.getByRole('alert')).toContainText('đã tồn tại')
    await expect(a.getByText('Môn này đã có trong hồ sơ của bạn.', { exact: true })).toBeVisible()
    await a.getByLabel('Tên môn học', { exact: true }).fill('Tên khác nhưng cùng mã')
    await a.getByLabel('Mã môn học (không bắt buộc)', { exact: true }).fill('it-custom-2026')
    await a.getByRole('button', { name: 'Tạo môn mới', exact: true }).click()
    await expect(a.getByRole('alert')).toContainText('đã tồn tại')
    expect((await backend.db.query('select * from public.subjects where code=$1', [code])).rows).toHaveLength(
      1
    )
    expect(
      (await backend.db.query('select * from public.subjects where name=$1', ['Tên khác nhưng cùng mã'])).rows
    ).toHaveLength(0)
  } finally {
    await ca.close()
    await cb.close()
    await backend.db.close()
  }
})

test('two clients trying normalized variants create only one subject', async ({ browser }) => {
  const backend = new LocalBackend()
  await backend.init()
  const ca = await backend.context(browser, A),
    cb = await backend.context(browser, B)
  try {
    const pages = [await ca.newPage(), await cb.newPage()],
      name = 'Chuyên đề dữ liệu đồng thời'
    for (const [index, page] of pages.entries()) {
      await page.goto('/profile')
      await page.getByRole('button', { name: '+ Thêm môn học', exact: true }).click()
      await page.getByRole('button', { name: '+ Tự bổ sung môn học', exact: true }).click()
      await page
        .getByLabel('Tên môn học', { exact: true })
        .fill(index ? `  ${name.toUpperCase().normalize('NFD')}  ` : name)
      await page.getByLabel('Mã môn học (không bắt buộc)', { exact: true }).fill(`RACE-${index}`)
    }
    await Promise.all(
      pages.map((page) => page.getByRole('button', { name: 'Tạo môn mới', exact: true }).click())
    )
    await expect
      .poll(async () => {
        const rows = await backend.db.query<{ count: number }>(
          'select count(*)::integer count from public.subjects where private.subject_identity(name)=private.subject_identity($1)',
          [name]
        )
        return rows.rows[0].count
      })
      .toBe(1)
    await expect
      .poll(async () =>
        (
          await Promise.all(
            pages.map((page) => page.getByRole('alert').filter({ hasText: 'đã tồn tại' }).count())
          )
        ).reduce((a, b) => a + b, 0)
      )
      .toBe(1)
  } finally {
    await ca.close()
    await cb.close()
    await backend.db.close()
  }
})
