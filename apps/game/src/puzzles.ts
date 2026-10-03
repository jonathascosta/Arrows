import {
  drawingMask,
  findDrawing,
  generateBoard,
  generateDaily,
  generateLevel,
} from '@arrows/engine';
import type { Analysis, Puzzle, Tier } from '@arrows/engine';
import type { PuzzleRef } from './route.ts';
import { formatDateKey, t } from './strings.ts';

export interface LoadedPuzzle {
  readonly ref: PuzzleRef;
  readonly puzzle: Puzzle;
  readonly analysis: Analysis;
  readonly tier: Tier;
  readonly title: string;
}

/** Generates the puzzle a reference names. Same reference, same puzzle, on every device. */
export function loadPuzzle(ref: PuzzleRef): LoadedPuzzle {
  switch (ref.kind) {
    case 'level': {
      const { puzzle, analysis, tier } = generateLevel(ref.level);
      return { ref, puzzle, analysis, tier, title: t('title.level', { n: ref.level }) };
    }
    case 'daily': {
      const { puzzle, analysis, tier } = generateDaily(ref.dateKey);
      return {
        ref,
        puzzle,
        analysis,
        tier,
        title: t('title.daily', { date: formatDateKey(ref.dateKey) }),
      };
    }
    case 'drawing': {
      const drawing = findDrawing(ref.drawingId);
      if (drawing === undefined) throw new RangeError(`Unknown drawing "${ref.drawingId}"`);
      const { puzzle, analysis, tier } = generateBoard({
        id: `drawing:${drawing.id}:${ref.tier}`,
        mask: drawingMask(drawing),
        tier: ref.tier,
        rayMode: 'bounds',
      });
      return { ref, puzzle, analysis, tier, title: drawing.name };
    }
  }
}

export function tierLabel(tier: Tier): string {
  return t(`tier.${tier}`);
}
