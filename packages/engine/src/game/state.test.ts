import { describe, expect, it } from 'vitest';
import { rectangleMask } from '../board/mask.ts';
import type { Puzzle } from '../board/types.ts';
import { generateLevel } from '../levels/levels.ts';
import { arrowAt, createGame, freeArrows, hint, tap } from './state.ts';

const puzzle: Puzzle = {
  width: 3,
  height: 2,
  mask: rectangleMask(3, 2),
  rayMode: 'bounds',
  seed: 'state',
  arrows: [
    {
      id: 0,
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      direction: 'right',
      color: 0,
    },
    {
      id: 1,
      cells: [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      direction: 'right',
      color: 0,
    },
    { id: 2, cells: [{ x: 2, y: 1 }], direction: 'up', color: 0 },
  ],
};

describe('game state', () => {
  it('removes a free arrow and leaves the previous state untouched', () => {
    const start = createGame(puzzle);
    expect(start.status).toBe('playing');
    expect(freeArrows(start)).toEqual([0]);
    const { state, outcome } = tap(start, 0);
    expect(outcome).toEqual({ kind: 'removed', arrowId: 0, rayLength: 0 });
    expect(state.remaining.has(0)).toBe(false);
    expect(state.moves).toEqual([0]);
    expect(start.remaining.has(0)).toBe(true);
    expect(arrowAt(start, 1, 0)).toBe(0);
    expect(arrowAt(state, 1, 0)).toBeNull();
    expect(arrowAt(state, 9, 9)).toBeNull();
  });

  it('costs a drop for a blocked arrow and names the blockers', () => {
    const start = createGame(puzzle);
    const { state, outcome } = tap(start, 2);
    expect(outcome).toEqual({ kind: 'blocked', arrowId: 2, blockedBy: [0] });
    expect(state.lives).toBe(2);
    expect(state.mistakes).toBe(1);
    expect(state.status).toBe('playing');
    expect(state.remaining.has(2)).toBe(true);
  });

  it('loses at zero drops and ignores taps afterwards', () => {
    let state = createGame(puzzle, { lives: 2 });
    state = tap(state, 2).state;
    state = tap(state, 2).state;
    expect(state.status).toBe('lost');
    expect(state.lives).toBe(0);
    expect(tap(state, 0).outcome).toEqual({ kind: 'ignored' });
    expect(hint(state)).toBeNull();
  });

  it('wins when the board is empty and ignores taps on gone arrows', () => {
    let state = createGame(puzzle);
    state = tap(state, 0).state;
    expect(tap(state, 0).outcome).toEqual({ kind: 'ignored' });
    state = tap(state, 2).state;
    state = tap(state, 1).state;
    expect(state.status).toBe('won');
    expect(state.moves).toEqual([0, 2, 1]);
  });

  it('hints the free arrow with the shortest ray', () => {
    const start = createGame(puzzle);
    expect(hint(start)).toBe(0);
    const after = tap(start, 0).state;
    expect(hint(after)).toBe(2);
  });

  it('plays a generated level to the end by following hints', () => {
    const { puzzle: level } = generateLevel(25);
    let state = createGame(level);
    let guard = level.arrows.length + 1;
    while (state.status === 'playing' && guard-- > 0) {
      const id = hint(state);
      expect(id).not.toBeNull();
      const result = tap(state, id!);
      expect(result.outcome.kind).toBe('removed');
      state = result.state;
    }
    expect(state.status).toBe('won');
    expect(state.lives).toBe(3);
  });
});
