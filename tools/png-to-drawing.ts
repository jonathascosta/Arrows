/**
 * Converts the PNG art in art/drawings to the engine's drawings
 * (packages/engine/src/drawings/art.ts).
 *
 *   pnpm drawings          writes the module
 *   pnpm drawings:check    fails if the module is not what the art makes (CI)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Drawing } from '@arrows/engine';
import { drawingFromPng, drawingsModule, parseManifest } from './drawings.ts';

const root = resolve(import.meta.dirname, '..');
const artDir = join(root, 'art/drawings');
const target = join(root, 'packages/engine/src/drawings/art.ts');

let drawings: Drawing[];
let source: string;
try {
  const manifest = parseManifest(readFileSync(join(artDir, 'drawings.json'), 'utf8'));
  drawings = manifest.drawings.map((entry) =>
    drawingFromPng(readFileSync(join(artDir, entry.file)), entry, manifest.palette),
  );
  source = await drawingsModule(drawings, target);
} catch (error) {
  // The art's mistakes read as one line, without a stack.
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

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
