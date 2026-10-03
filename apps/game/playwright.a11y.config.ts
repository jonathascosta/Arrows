import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

/**
 * Lighthouse's accessibility audit on every screen of the web build
 * (docs/PLAN.md, T9): `pnpm test:a11y`. Playwright brings each screen to the
 * state to audit; Lighthouse audits that page over Chrome's debugging port.
 */
const PORT = Number(process.env.ARROWS_A11Y_PORT ?? 4327);
export const DEBUG_PORT = Number(process.env.ARROWS_A11Y_DEBUG_PORT ?? 9327);

export default defineConfig({
  ...base,
  testDir: 'a11y',
  // One browser, one debugging port.
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: {
    ...base.use,
    baseURL: `http://127.0.0.1:${PORT}/`,
    launchOptions: {
      ...base.use?.launchOptions,
      args: [`--remote-debugging-port=${DEBUG_PORT}`],
    },
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
  ],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
