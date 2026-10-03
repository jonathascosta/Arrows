import { defineConfig } from 'vitest/config';

/**
 * One Vitest run, several projects:
 *  - each package, app and the tools contribute a fast unit project (`pnpm test`);
 *  - `calibration` runs the long simulations (`*.calibration.test.ts`,
 *    `pnpm test:calibration`): difficulty distributions per tier and league
 *    promotion rates, kept out of the pre-commit hook.
 */
export default defineConfig({
  test: {
    projects: [
      'packages/*/vitest.config.ts',
      'apps/*/vitest.config.ts',
      'tools/vitest.config.ts',
      {
        test: {
          name: 'calibration',
          root: './packages/engine',
          include: ['src/**/*.calibration.test.ts'],
          testTimeout: 10 * 60_000,
        },
      },
    ],
  },
});
