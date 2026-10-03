import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * A port nothing else defaults to (vite preview uses 4173), and never reuse a
 * running server: the tests must run against the build they just made.
 */
const PORT = Number(process.env.ARROWS_E2E_PORT ?? 4317);

/**
 * Claude Code cloud sessions ship a Chromium at this path, possibly of another
 * Playwright release, and must never run `playwright install`. CI installs
 * the matching browser and leaves this unset.
 */
const CLOUD_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (existsSync(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    {
      name: 'phone',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // The tests run against the production build, as players get it.
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
