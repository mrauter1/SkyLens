import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'mobile-small',
      testMatch: /responsive-audit\.spec\.ts/,
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 640 },
      },
    },
    {
      name: 'pixel-7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'tablet-portrait',
      testMatch: /responsive-audit\.spec\.ts/,
      use: {
        // Keep the audited tablet geometry/touch capabilities on the installed
        // Chromium engine. Desktop WebKit remains a separate optional check;
        // it is not a substitute for physical Mobile Safari validation.
        ...devices['Pixel 7'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'short-laptop',
      testMatch: /responsive-audit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
      },
    },
    {
      name: 'desktop',
      testMatch: /responsive-audit\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 960 },
      },
    },
    ...(process.env.PLAYWRIGHT_WEBKIT === '1'
      ? [
          {
            name: 'desktop-webkit',
            testMatch: /responsive-audit\.spec\.ts/,
            use: {
              ...devices['Desktop Safari'],
              viewport: { width: 1440, height: 960 },
            },
          },
        ]
      : []),
  ],
})
