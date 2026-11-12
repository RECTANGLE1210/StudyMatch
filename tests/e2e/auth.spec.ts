import { test, expect, type Browser, type BrowserContext } from '@playwright/test'
import { createHash } from 'node:crypto'
import { LocalBackend, A, C, users } from './localBackend'

// Test-only Auth protocol fixture. The real SDK handles storage, PKCE and auth events;
// real Supabase delivery/provider configuration still requires a staging smoke test.
async function authFixture(browser: Browser) {
  const backend = new LocalBackend()
  await backend.init()
  const context = await backend.context(browser)
  let id: typeof A | typeof C | undefined,
    registeredPassword = 'old-password-fixture'
  let callback = '',
    challenge = '',
    attempts = 0,
    recoverFails = false,
    updateFails = false
  const requests: { path: string; body: Record<string, any>; url: string }[] = []
  const user = () => ({
    ...users[id ?? C],
    app_metadata: { provider: 'email', providers: ['email'] },
    email_confirmed_at: new Date().toISOString(),
  })
  function token() {
    const now = Math.floor(Date.now() / 1000)
    const encode = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
    return {
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, aud: 'authenticated', role: 'authenticated', exp: now + 3600, iat: now })}.test_only`,
      refresh_token: 'fixture_refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: user(),
    }
  }
  await context.route('http://localhost:54329/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url())
    if (!url.pathname.startsWith('/auth/v1/')) return backend.handle(route, id)
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-expose-headers': 'X-Supabase-Api-Version',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'x-supabase-api-version': '2024-01-01',
    }
    const reply = (status: number, value: unknown) =>
      route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(value) })
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    const body = request.postData() ? request.postDataJSON() : {}
    requests.push({ path: url.pathname, body, url: url.toString() })
    if (
      url.pathname.endsWith('/signup') ||
      url.pathname.endsWith('/recover') ||
      url.pathname.endsWith('/resend')
    ) {
      if (url.pathname.endsWith('/recover') && recoverFails)
        return reply(429, { code: 'over_email_send_rate_limit', message: 'Rate limited' })
      callback = url.searchParams.get('redirect_to') ?? ''
      if (body.code_challenge) challenge = body.code_challenge
      if (url.pathname.endsWith('/signup')) registeredPassword = body.password
      return reply(200, url.pathname.endsWith('/signup') ? { user: user(), session: null } : {})
    }
    if (url.pathname.endsWith('/token')) {
      if (url.searchParams.get('grant_type') === 'pkce') {
        const expected = createHash('sha256').update(body.code_verifier).digest('base64url')
        if (body.auth_code === 'expired' || expected !== challenge)
          return reply(400, { code: 'otp_expired', message: 'Expired link' })
        id = body.auth_code === 'signup-confirmation' ? C : A
      } else {
        attempts++
        if (body.password === 'unconfirmed-fixture')
          return reply(400, { code: 'email_not_confirmed', message: 'Email not confirmed' })
        if (body.password !== registeredPassword)
          return reply(400, { code: 'invalid_credentials', message: 'Invalid login credentials' })
        id = A
      }
      return reply(200, token())
    }
    if (url.pathname.endsWith('/user')) {
      if (!id) return reply(401, { message: 'Authentication required' })
      if (request.method() === 'PUT') {
        if (updateFails) return reply(422, { code: 'weak_password', message: 'Choose a stronger password' })
        registeredPassword = body.password
      }
      return reply(200, user())
    }
    if (url.pathname.endsWith('/logout')) {
      id = undefined
      return reply(200, {})
    }
    if (url.pathname.endsWith('/authorize'))
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<h1>Google redirect fixture</h1>',
      })
    return reply(404, { message: 'Unimplemented test Auth endpoint' })
  })
  return {
    backend,
    context,
    requests,
    callback: () => callback,
    attempts: () => attempts,
    failRecovery: (value: boolean) => {
      recoverFails = value
    },
    failUpdate: (value: boolean) => {
      updateFails = value
    },
    async close() {
      await context.close()
      await backend.db.close()
    },
  }
}
async function assertNoPasswordStored(context: BrowserContext, secrets: string[]) {
  const page = context.pages()[0]
  const stored = await page.evaluate(() =>
    JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)])
  )
  for (const secret of secrets) expect(stored).not.toContain(secret)
}

test('Create Account uses email signup, confirmation/resend and PKCE onboarding instead of Google', async ({
  browser,
}) => {
  const f = await authFixture(browser)
  try {
    const page = await f.context.newPage()
    await page.goto('/login')
    await page.getByRole('link', { name: 'Create Account', exact: true }).click()
    await expect(page).toHaveURL(/\/signup$/)
    await page.screenshot({ path: test.info().outputPath('signup.png') })
    await page.getByLabel('Email', { exact: true }).fill('new-learner@example.test')
    await page.getByLabel('Password', { exact: true }).fill('new-password-fixture')
    await page.getByLabel('Confirm password', { exact: true }).fill('mismatch-fixture')
    await page.getByRole('button', { name: 'CREATE ACCOUNT', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('chưa khớp')
    expect(f.requests.filter((r) => r.path.endsWith('/signup'))).toHaveLength(0)
    await page.getByLabel('Confirm password', { exact: true }).fill('new-password-fixture')
    await page.getByRole('button', { name: 'CREATE ACCOUNT', exact: true }).click()
    await expect(page.getByRole('status')).toContainText('liên kết xác nhận')
    await expect(page).toHaveURL(/\/signup$/)
    const signup = f.requests.find((r) => r.path.endsWith('/signup'))!
    expect(signup.body).toMatchObject({
      email: 'new-learner@example.test',
      password: 'new-password-fixture',
      code_challenge_method: 's256',
    })
    expect(new URL(signup.url).searchParams.get('redirect_to')).toContain('/login')
    expect(f.requests.some((r) => r.path.endsWith('/authorize'))).toBe(false)
    await page.getByRole('button', { name: 'Gửi lại email xác nhận' }).click()
    await expect(page.getByRole('status')).toContainText('một liên kết xác nhận mới')
    expect(f.requests.find((r) => r.path.endsWith('/resend'))?.body).toMatchObject({
      type: 'signup',
      email: 'new-learner@example.test',
    })
    const callback = new URL(f.callback())
    callback.searchParams.set('code', 'signup-confirmation')
    await page.goto(callback.toString())
    await expect(page).toHaveURL(/\/onboarding$/)
    await expect(page.getByRole('heading', { name: 'Một chút về bạn nhé' })).toBeVisible()
    await assertNoPasswordStored(f.context, ['new-password-fixture', 'mismatch-fixture'])
  } finally {
    await f.close()
  }
})

test('email login reports errors, resends confirmation and respects Remember without altering profiles', async ({
  browser,
}) => {
  const f = await authFixture(browser)
  try {
    const page = await f.context.newPage()
    await page.goto('/login')
    await page.getByLabel('Email', { exact: true }).fill(users[A].email)
    await page.getByLabel('Password', { exact: true }).fill('wrong-password-fixture')
    await page.getByRole('button', { name: 'LOGIN WITH EMAIL' }).click()
    await expect(page.getByRole('alert')).toContainText('Email hoặc mật khẩu chưa đúng')
    await page.getByLabel('Password', { exact: true }).fill('unconfirmed-fixture')
    await page.getByRole('button', { name: 'LOGIN WITH EMAIL' }).click()
    await expect(page.getByRole('alert')).toContainText('cần xác nhận email')
    await page.getByRole('button', { name: 'Gửi lại email xác nhận' }).click()
    await expect(page.getByRole('status')).toContainText('liên kết xác nhận mới')
    await page.getByLabel('Password', { exact: true }).fill('old-password-fixture')
    await page.getByLabel('Remember', { exact: true }).uncheck()
    await page.getByRole('button', { name: 'LOGIN WITH EMAIL' }).click()
    await expect(page).toHaveURL('http://127.0.0.1:5352/')
    expect(f.attempts()).toBe(3)
    const stored = await page.evaluate(() => ({
      local: localStorage.getItem('sb-localhost-auth-token'),
      session: sessionStorage.getItem('sb-localhost-auth-token'),
    }))
    expect(stored.local).toBeNull()
    expect(stored.session).toContain(A)
    await page.reload()
    await page.goto('/profile')
    await expect(page.getByText('Người học A', { exact: true }).first()).toBeVisible()
    await assertNoPasswordStored(f.context, [
      'old-password-fixture',
      'wrong-password-fixture',
      'unconfirmed-fixture',
    ])
  } finally {
    await f.close()
  }
})

test('password recovery uses PKCE, handles errors, updates password and keeps the existing account', async ({
  browser,
}) => {
  const f = await authFixture(browser)
  try {
    const page = await f.context.newPage()
    await page.goto('/login')
    await page.getByRole('link', { name: 'Forgot password?' }).click()
    await page.getByLabel('Email', { exact: true }).fill(users[A].email)
    f.failRecovery(true)
    await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()
    await expect(page.getByRole('alert')).toContainText('chờ rồi thử lại')
    f.failRecovery(false)
    await page.getByRole('button', { name: 'Gửi liên kết đặt lại' }).click()
    await expect(page.getByRole('status')).toContainText('Nếu tài khoản tồn tại')
    expect(new URL(f.callback()).pathname).toBe('/reset-password')
    const callback = new URL(f.callback())
    callback.searchParams.set('code', 'password-recovery')
    await page.goto(callback.toString())
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password/)
    await expect(page.getByText(users[A].email, { exact: true })).toBeVisible()
    await page.getByLabel('Password', { exact: true }).fill('replacement-password-fixture')
    await page.getByLabel('Confirm password', { exact: true }).fill('replacement-password-fixture')
    f.failUpdate(true)
    await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(page.getByRole('alert')).toContainText('stronger password')
    f.failUpdate(false)
    await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click()
    await expect(page.getByRole('status')).toContainText('Đã lưu mật khẩu mới')
    await assertNoPasswordStored(f.context, ['replacement-password-fixture'])
    await page.getByRole('link', { name: 'Tiếp tục vào StudyMatch' }).click()
    await expect(page).toHaveURL('http://127.0.0.1:5352/')
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Email', { exact: true }).fill(users[A].email)
    await page.getByLabel('Password', { exact: true }).fill('replacement-password-fixture')
    await page.getByRole('button', { name: 'LOGIN WITH EMAIL' }).click()
    await expect(page).toHaveURL('http://127.0.0.1:5352/')
    expect((await f.backend.db.query('select id from public.profiles where id=$1', [A])).rows).toHaveLength(1)
    // A stored ordinary session must never make an expired recovery link actionable.
    await page.goto('/reset-password?error=access_denied&error_code=otp_expired')
    await expect(page.getByRole('alert')).toContainText('không hợp lệ hoặc đã hết hạn')
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0)
  } finally {
    await f.close()
  }
})

test('Google sign-in still sends the Google OAuth request with PKCE', async ({ browser }) => {
  const f = await authFixture(browser)
  try {
    const page = await f.context.newPage()
    await page.goto('/login')
    await page.getByRole('button', { name: 'LOGIN WITH GOOGLE' }).click()
    await expect(page.getByRole('heading', { name: 'Google redirect fixture' })).toBeVisible()
    const request = f.requests.find((r) => r.path.endsWith('/authorize'))!
    const url = new URL(request.url)
    expect(url.searchParams.get('provider')).toBe('google')
    expect(url.searchParams.get('redirect_to')).toContain('/login')
    expect(url.searchParams.get('code_challenge_method')).toBe('s256')
  } finally {
    await f.close()
  }
})
