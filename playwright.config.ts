import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
const chrome =
  process.env.CHROME_EXECUTABLE ??
  (process.platform === 'win32' && existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : undefined)
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:5352',
    viewport: { width: 1440, height: 1000 },
    headless: true,
    actionTimeout: 15_000,
    launchOptions: chrome ? { executablePath: chrome } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5352 --strictPort',
    url: 'http://127.0.0.1:5352',
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54329',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e_test_only',
    },
  },
})
