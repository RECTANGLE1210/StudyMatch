import { test, expect } from '@playwright/test'
import { LocalBackend, A, B } from './localBackend'

for (const source of ['bell', 'match'] as const) {
  test(`sender sees a persistent rejection notification when recipient declines from ${source}`, async ({
    browser,
  }) => {
    const backend = new LocalBackend()
    await backend.init()
    const ca = await backend.context(browser, A),
      cb = await backend.context(browser, B)
    try {
      const a = await ca.newPage(),
        b = await cb.newPage()
      await b.goto('/match')
      await b.getByRole('button', { name: 'Gửi lời mời', exact: true }).click()
      await expect(b.getByRole('button', { name: 'Hủy lời mời', exact: true })).toBeVisible()
      await a.goto(source === 'bell' ? '/' : '/match')
      if (source === 'bell') await a.getByRole('button', { name: 'Thông báo', exact: true }).click()
      await a.getByRole('button', { name: 'Từ chối', exact: true }).click()
      await expect
        .poll(
          async () =>
            (await backend.db.query<{ status: string }>('select status from public.match_requests')).rows[0]
              ?.status
        )
        .toBe('rejected')
      // Exercise the existing focus fallback; this fixture does not simulate Realtime WebSockets.
      await b.evaluate(() => window.dispatchEvent(new Event('focus')))
      const bell = b.getByRole('button', { name: 'Thông báo', exact: true })
      await expect(bell).toHaveText('1')
      await bell.click()
      const label = 'Người học A đã từ chối lời mời học cùng của bạn'
      const note = b.getByRole('button').filter({ hasText: label })
      await expect(note).toHaveCount(1)
      await expect(note.locator('.bg-caramel')).toHaveCount(1)
      await note.click()
      await expect(b).toHaveURL(/\/match$/)
      await expect(bell).toHaveText('')
      await b.reload()
      await bell.click()
      await expect(b.getByRole('button').filter({ hasText: label })).toHaveCount(1)
      await expect(b.getByRole('button').filter({ hasText: label }).locator('.bg-caramel')).toHaveCount(0)
      if (source === 'match') await a.getByRole('button', { name: 'Thông báo', exact: true }).click()
      await expect(a.getByText(label, { exact: true })).toHaveCount(0)
      const notices = await backend.db.query<{ user_id: string; read_at: string | null }>(
        "select user_id,read_at from public.notifications where kind='invitation_rejected'"
      )
      expect(notices.rows).toHaveLength(1)
      expect(notices.rows[0].user_id).toBe(B)
      expect(notices.rows[0].read_at).not.toBeNull()
    } finally {
      await ca.close()
      await cb.close()
      await backend.db.close()
    }
  })
}
