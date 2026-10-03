import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource-variable/geist/wght.css';
import './styles.css';
import { boardSizeForLevel, DRAWINGS, renderAscii, TIER_ORDER, tierForLevel } from '@arrows/engine';
import type { Tier } from '@arrows/engine';
import { loadPuzzle, tierLabel } from './puzzles.ts';
import type { PuzzleRef } from './route.ts';
import { localDateKey, routeSearch } from './route.ts';
import { DEFAULT_THEME } from './theme/default.ts';
import { applyTheme } from './theme/theme.ts';
import { el } from './ui/dom.ts';

/**
 * The puzzle picker for development: open any level, any day's daily or any
 * drawing by its seed, and see what the solver measured. The home screen's
 * menu button leads here.
 */
applyTheme(DEFAULT_THEME, document.documentElement);

const root = document.getElementById('dev');
if (root === null) throw new Error('dev.html has no #dev element');

const preview = el(document, 'section', { class: 'dev-preview', 'aria-live': 'polite' });

function showPreview(ref: PuzzleRef): void {
  const started = performance.now();
  const { puzzle, analysis, tier, title } = loadPuzzle(ref);
  const ms = performance.now() - started;
  const rows: [string, string][] = [
    ['Puzzle', `${title} (${tierLabel(tier)})`],
    ['Board', `${puzzle.width} × ${puzzle.height}, ray rule ${puzzle.rayMode}`],
    ['Seed', puzzle.seed],
    ['Arrows', String(analysis.arrowCount)],
    ['Cells', String(analysis.cellCount)],
    ['Average path length', analysis.avgPathLength.toFixed(2)],
    ['Free over remaining', analysis.avgFreeRatio.toFixed(3)],
    ['Free arrows per step', `${analysis.avgFree.toFixed(1)} (min ${analysis.minFree})`],
    ['Average ray length', analysis.avgRayLength.toFixed(2)],
    ['Near misses per step', analysis.avgNearMiss.toFixed(2)],
    ['Difficulty score', String(analysis.difficulty)],
    ['Generated in', `${ms.toFixed(0)} ms`],
  ];
  preview.replaceChildren(
    el(document, 'h2', {}, ['Preview']),
    el(
      document,
      'dl',
      {},
      rows.flatMap(([term, value]) => [
        el(document, 'dt', {}, [term]),
        el(document, 'dd', {}, [value]),
      ]),
    ),
    el(document, 'pre', { class: 'ascii' }, [renderAscii(puzzle)]),
  );
}

function section(
  title: string,
  controls: readonly HTMLElement[],
  current: () => PuzzleRef,
  name: string,
): HTMLElement {
  const open = el(document, 'a', { class: 'button', 'data-open': name }, ['Play']);
  const analyze = el(document, 'button', { class: 'button secondary', type: 'button' }, [
    'Preview',
  ]);
  const update = (): void => {
    open.setAttribute('href', `./${routeSearch(current())}`);
  };
  for (const control of controls) control.addEventListener('input', update);
  analyze.addEventListener('click', () => showPreview(current()));
  update();
  return el(document, 'section', { class: 'dev-card' }, [
    el(document, 'h2', {}, [title]),
    ...controls,
    el(document, 'div', { class: 'dev-actions' }, [open, analyze]),
  ]);
}

function labelled(text: string, control: HTMLElement): HTMLLabelElement {
  return el(document, 'label', {}, [el(document, 'span', {}, [text]), control]);
}

// Level.
const levelInput = el(document, 'input', {
  type: 'number',
  min: '1',
  step: '1',
  value: '1',
  name: 'level',
});
const levelInfo = el(document, 'p', { class: 'dev-note' });
const levelRef = (): PuzzleRef => ({
  kind: 'level',
  level: Math.max(1, Math.floor(Number(levelInput.value)) || 1),
});
const describeLevel = (): void => {
  const ref = levelRef();
  if (ref.kind !== 'level') return;
  const tier = tierForLevel(ref.level);
  const [width, height] = boardSizeForLevel(ref.level, tier);
  levelInfo.textContent = `${tierLabel(tier)}, ${width} × ${height}`;
};
levelInput.addEventListener('input', describeLevel);
describeLevel();

// Daily.
const dailyInput = el(document, 'input', { type: 'date', value: localDateKey(), name: 'daily' });
const dailyRef = (): PuzzleRef => ({ kind: 'daily', dateKey: dailyInput.value || localDateKey() });

// Drawing.
const drawingSelect = el(
  document,
  'select',
  { name: 'drawing' },
  DRAWINGS.map((drawing) => el(document, 'option', { value: drawing.id }, [drawing.name])),
);
const tierSelect = el(
  document,
  'select',
  { name: 'tier' },
  TIER_ORDER.map((tier) => el(document, 'option', { value: tier }, [tierLabel(tier)])),
);
tierSelect.value = 'medium';
const drawingRef = (): PuzzleRef => ({
  kind: 'drawing',
  drawingId: drawingSelect.value,
  tier: tierSelect.value as Tier,
});

root.replaceChildren(
  el(document, 'main', { class: 'dev' }, [
    el(document, 'h1', {}, ['Arrows · puzzles']),
    el(document, 'p', { class: 'dev-note' }, [
      'Every puzzle is a seed: the same level, day or drawing is the same board on every device.',
    ]),
    section('Level', [labelled('Level number', levelInput), levelInfo], levelRef, 'level'),
    section('Daily challenge', [labelled('Date', dailyInput)], dailyRef, 'daily'),
    section(
      'Drawing',
      [labelled('Drawing', drawingSelect), labelled('Tier', tierSelect)],
      drawingRef,
      'drawing',
    ),
    preview,
  ]),
);
