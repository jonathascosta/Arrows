import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { defineConfig, type Logger, type Plugin } from 'vite';

/** The whole web build, gzipped, must stay under this (docs/PLAN.md, T2). */
export const BUDGET_BYTES = 300 * 1024;

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

/** Fails the build when the gzipped output grows past the budget. */
function sizeBudget(limit: number): Plugin {
  let outDir = 'dist';
  let logger: Logger | undefined;
  return {
    name: 'arrows:size-budget',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      logger = config.logger;
    },
    closeBundle() {
      const total = filesUnder(outDir).reduce(
        (sum, file) => sum + gzipSync(readFileSync(file)).length,
        0,
      );
      const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`;
      if (total > limit) {
        throw new Error(`Build is ${kb(total)} gzipped, over the ${kb(limit)} budget`);
      }
      logger?.info(`size budget: ${kb(total)} gzipped of ${kb(limit)}`);
    },
  };
}

/**
 * BASE_PATH lets a static host serve the app from a sub-path ("/<repo>/");
 * locally and in the iOS wrapper it is served from the root. The iOS build
 * (`vite build --mode ios`, `pnpm build:ios`) leaves out the puzzle picker,
 * a tool for testing that the app does not ship (docs/PRODUCT.md, Settings).
 * Being its own mode, it reads `.env.ios` files, not `.env.production`.
 */
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? './',
  plugins: [sizeBudget(BUDGET_BYTES)],
  build: {
    target: 'es2022',
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...(mode === 'ios' ? {} : { dev: resolve(import.meta.dirname, 'dev.html') }),
        privacy: resolve(import.meta.dirname, 'privacy.html'),
      },
    },
  },
}));
