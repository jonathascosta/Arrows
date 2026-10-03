import { defineConfig } from '@playwright/test';
import base from './playwright.config.ts';

/**
 * The App Store screenshots (docs/STORE.md): `pnpm store:screenshots` takes each
 * screen of the production build at the size of the biggest iPhones, 1290 × 2796
 * (430 × 932 points at 3×), in English and Portuguese, into
 * ios/App/fastlane/screenshots, where the App Store listing workflow uploads them from.
 */
const PORT = Number(process.env.ARROWS_STORE_PORT ?? 4337);

export default defineConfig({
  ...base,
  testDir: 'store',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: {
    ...base.use,
    baseURL: `http://127.0.0.1:${PORT}/`,
  },
  projects: [
    {
      name: 'iphone',
      use: {
        browserName: 'chromium',
        viewport: { width: 430, height: 932 },
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
