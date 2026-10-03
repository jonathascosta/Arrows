import {
  drawingMask,
  findDrawing,
  generateBoard,
  generateDaily,
  generateLevel,
} from '@arrows/engine';
import type { Analysis, Puzzle, Tier } from '@arrows/engine';
import type { PuzzleRef } from './route.ts';
import { findEvent } from './events/catalog.ts';
import { drawingTitle, formatDateKey, t } from './strings.ts';

export interface LoadedPuzzle {
  readonly ref: PuzzleRef;
  readonly puzzle: Puzzle;
  readonly analysis: Analysis;
  readonly tier: Tier;
  readonly title: string;
  /** The line under the title: the tier, or for an event board where it stands. */
  readonly subtitle: string;
}

function drawingBoard(
  drawingId: string,
  tier: Tier,
  id: string,
): Omit<LoadedPuzzle, 'ref' | 'subtitle'> {
  const drawing = findDrawing(drawingId);
  if (drawing === undefined) throw new RangeError(`Unknown drawing "${drawingId}"`);
  const { puzzle, analysis } = generateBoard({
    id,
    mask: drawingMask(drawing),
    tier,
    rayMode: 'bounds',
  });
  return { puzzle, analysis, tier, title: drawingTitle(drawing.id, drawing.name) };
}

/** Generates the puzzle a reference names. Same reference, same puzzle, on every device. */
export function loadPuzzle(ref: PuzzleRef): LoadedPuzzle {
  switch (ref.kind) {
    case 'level': {
      const { puzzle, analysis, tier } = generateLevel(ref.level);
      return {
        ref,
        puzzle,
        analysis,
        tier,
        title: t('title.level', { n: ref.level }),
        subtitle: tierLabel(tier),
      };
    }
    case 'daily': {
      const { puzzle, analysis, tier } = generateDaily(ref.dateKey);
      return {
        ref,
        puzzle,
        analysis,
        tier,
        title: t('title.daily', { date: formatDateKey(ref.dateKey) }),
        subtitle: tierLabel(tier),
      };
    }
    case 'drawing': {
      const board = drawingBoard(ref.drawingId, ref.tier, `drawing:${ref.drawingId}:${ref.tier}`);
      return { ref, ...board, subtitle: tierLabel(board.tier) };
    }
    case 'event': {
      const event = findEvent(ref.eventId);
      const spec = event?.boards[ref.board - 1];
      if (event === undefined || spec === undefined) {
        throw new RangeError(`Unknown event board "${ref.eventId}" ${ref.board}`);
      }
      // Each board its own seed: the same drawing at two tiers is two boards.
      const board = drawingBoard(spec.drawingId, spec.tier, `event:${event.id}:${ref.board}`);
      const subtitle = t('event.boardOf', {
        event: t(event.short),
        n: ref.board,
        total: event.boards.length,
      });
      return { ref, ...board, subtitle };
    }
  }
}

export function tierLabel(tier: Tier): string {
  return t(`tier.${tier}`);
}
