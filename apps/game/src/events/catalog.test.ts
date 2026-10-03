import { findDrawing } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { BoardRenderer } from '../board/renderer.ts';
import { loadPuzzle } from '../puzzles.ts';
import { DEFAULT_THEME } from '../theme/default.ts';
import type { GameEvent } from './catalog.ts';
import { AUTUMN_2026, daysLeft, eventOn, eventState, EVENTS, findEvent } from './catalog.ts';

describe('the event catalog', () => {
  it('has the Autumn event: six boards, a maple leaf and an acorn at three tiers', () => {
    expect(findEvent('autumn-2026')).toBe(AUTUMN_2026);
    expect(findEvent('nope')).toBeUndefined();
    expect(AUTUMN_2026.boards.map((board) => `${board.drawingId}:${board.tier}`)).toEqual([
      'maple-leaf:medium',
      'acorn:medium',
      'maple-leaf:hard',
      'acorn:hard',
      'maple-leaf:superHard',
      'acorn:superHard',
    ]);
    for (const event of EVENTS) {
      expect(event.start <= event.end, event.id).toBe(true);
      for (const board of event.boards)
        expect(findDrawing(board.drawingId), event.id).toBeDefined();
    }
  });

  it('runs from its first to its last day, both included', () => {
    expect(eventState(AUTUMN_2026, '2026-09-30')).toBe('upcoming');
    expect(eventState(AUTUMN_2026, '2026-10-01')).toBe('running');
    expect(eventState(AUTUMN_2026, '2026-11-30')).toBe('running');
    expect(eventState(AUTUMN_2026, '2026-12-01')).toBe('ended');
    expect(daysLeft(AUTUMN_2026, '2026-10-03')).toBe(59);
    expect(daysLeft(AUTUMN_2026, '2026-11-30')).toBe(1);
  });

  it('shows the running event, else the one that ended last, else none', () => {
    const winter: GameEvent = {
      ...AUTUMN_2026,
      id: 'winter',
      start: '2026-12-10',
      end: '2026-12-31',
    };
    const events = [AUTUMN_2026, winter];
    expect(eventOn('2026-09-01', events)).toBeNull();
    expect(eventOn('2026-10-14', events)).toBe(AUTUMN_2026);
    // Between the two: the one that ended.
    expect(eventOn('2026-12-05', events)).toBe(AUTUMN_2026);
    expect(eventOn('2026-12-20', events)).toBe(winter);
    expect(eventOn('2027-02-01', events)).toBe(winter);
  });
});

describe('event boards', () => {
  it('each has its own seed, its drawing, the bounds ray rule and where it stands', () => {
    const boards = AUTUMN_2026.boards.map((_, i) =>
      loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: i + 1 }),
    );
    expect(new Set(boards.map((board) => board.puzzle.seed)).size).toBe(6);
    expect(boards[0]!.puzzle.seed).toMatch(/^board:event:autumn-2026:1#/);
    expect(boards.map((board) => board.title)).toEqual([
      'Maple Leaf',
      'Acorn',
      'Maple Leaf',
      'Acorn',
      'Maple Leaf',
      'Acorn',
    ]);
    expect(boards.map((board) => board.tier)).toEqual([
      'medium',
      'medium',
      'hard',
      'hard',
      'superHard',
      'superHard',
    ]);
    expect(boards.every((board) => board.puzzle.rayMode === 'bounds')).toBe(true);
    expect(boards[4]!.subtitle).toBe('Autumn · 5 of 6');
    // The same board twice is the same puzzle.
    expect(loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: 1 }).puzzle.arrows).toEqual(
      boards[0]!.puzzle.arrows,
    );
  });

  it('are drawn in the drawing’s colours, cell by cell', () => {
    for (let board = 1; board <= AUTUMN_2026.boards.length; board++) {
      const spec = AUTUMN_2026.boards[board - 1]!;
      const drawing = findDrawing(spec.drawingId)!;
      const { puzzle } = loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board });
      const container = document.createElement('div');
      const renderer = new BoardRenderer(container, DEFAULT_THEME, () => true);
      renderer.render(puzzle);
      for (const arrow of puzzle.arrows) {
        const drawn = container
          .querySelector<SVGGElement>(`[data-arrow="${arrow.id}"]`)!
          .style.getPropertyValue('--arrow-color');
        for (const cell of arrow.cells) {
          const name = drawing.legend[drawing.rows[cell.y]!.charAt(cell.x)]!;
          expect(drawn, `${spec.drawingId} (${cell.x}, ${cell.y})`).toBe(
            DEFAULT_THEME.drawingPalette[name],
          );
        }
      }
    }
  });

  it('refuses a board the event does not have', () => {
    expect(() => loadPuzzle({ kind: 'event', eventId: 'autumn-2026', board: 7 })).toThrow(
      RangeError,
    );
    expect(() => loadPuzzle({ kind: 'event', eventId: 'nope', board: 1 })).toThrow(RangeError);
  });
});
