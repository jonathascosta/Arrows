// @ts-check
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture rules live here so they are enforced, not just documented:
 *  - no Math.random anywhere: every random draw goes through a seeded Rng, so a
 *    level number or a date always produces the same puzzle on every phone;
 *  - the engine is pure: no DOM/browser globals, no UI or rendering imports.
 */
const BROWSER_GLOBALS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage'];

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    '**/node_modules/',
    '**/ios/',
    '**/android/',
    '**/test-results/',
    '**/playwright-report/',
    '.claude/worktrees/',
  ]),

  js.configs.recommended,

  {
    name: 'repo/typescript',
    files: ['**/*.ts'],
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // noUncheckedIndexedAccess is on; a local, obvious `!` beats defensive noise.
      '@typescript-eslint/no-non-null-assertion': 'off',
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    name: 'repo/no-math-random',
    files: ['**/*.{ts,js,mjs}'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Math.random is banned: draw from a seeded Rng (see packages/engine/src/rng).',
        },
      ],
    },
  },

  {
    name: 'repo/engine-purity',
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...BROWSER_GLOBALS.map((name) => ({
          name,
          message: 'The engine is platform-agnostic: no DOM or browser globals.',
        })),
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@arrows/game', '@arrows/game/*'],
              message: 'The engine must not depend on UI or rendering code.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'repo/browser',
    files: ['apps/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },

  {
    // The web build never loads the native plugins: only the iOS platform module
    // (loaded on demand, in the app) and tests may import them.
    name: 'repo/native-plugins',
    files: ['apps/game/src/**/*.ts'],
    ignores: ['apps/game/src/platform/native.ts', 'apps/game/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@capacitor/*', '!@capacitor/core', '@capacitor-community/*'],
              message: 'Capacitor plugins load only in the app: import them in platform/native.ts.',
            },
          ],
        },
      ],
    },
  },

  {
    // Colours come from the theme object, so a theme is data (docs/PLAN.md).
    // styles.css is held to the same rule by src/styles.test.ts.
    name: 'repo/theme-colours',
    files: ['apps/game/src/**/*.ts'],
    ignores: ['apps/game/src/theme/**', 'apps/game/src/**/*.test.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]',
          message: 'Colour literal outside the theme: add it to src/theme and read it from there.',
        },
        {
          selector: 'Literal[value=/^(?:rgb|hsl|oklch|oklab)a?\\(/]',
          message: 'Colour literal outside the theme: add it to src/theme and read it from there.',
        },
      ],
    },
  },

  {
    name: 'repo/javascript',
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  prettier,
]);
