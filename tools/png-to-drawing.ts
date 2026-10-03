/**
 * Converts the PNG art in art/drawings to the engine's drawings
 * (packages/engine/src/drawings/art.ts).
 *
 *   pnpm drawings          writes the module
 *   pnpm drawings:check    fails if the module is not what the art makes (CI)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { drawingFromPng, drawingsModule, parseManifest } from './drawings.ts';

const root = resolve(import.meta.dirname, '..');
const artDir = join(root, 'art/drawings');
const target = join(root, 'packages/engine/src/drawings/art.ts');

const manifest = parseManifest(readFileSync(join(artDir, 'drawings.json'), 'utf8'));
const drawings = manifest.drawings.map((entry) =>
  drawingFromPng(readFileSync(join(artDir, entry.file)), entry, manifest.palette),
);
const source = await drawingsModule(drawings, target);

if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== source) {
    console.error(
      'packages/engine/src/drawings/art.ts is not what art/drawings makes: run `pnpm drawings`.',
    );
    process.exit(1);
  }
  process.stdout.write(`Drawings up to date (${drawings.length}).\n`);
} else {
  writeFileSync(target, source);
  process.stdout.write(
    `Wrote ${drawings.length} drawings to packages/engine/src/drawings/art.ts.\n`,
  );
}
