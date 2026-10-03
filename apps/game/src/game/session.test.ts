import { createGame, freeArrows, generateLevel, head } from '@arrows/engine';
import type { Puzzle } from '@arrows/engine';
import { describe, expect, it } from 'vitest';
import { PlaySession } from './session.ts';

const { puzzle } = generateLevel(1);

function blockedArrow(p: Puzzle): number {
  const free = new Set(freeArrows(createGame(p)));
  return p.arrows.find((arrow) => !free.has(arrow.id))!.id;
}

function emptyCell(p: Puzzle): { x: number; y: number } | null {
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      if (!p.arrows.some((a) => a.cells.some((c) => c.x === x && c.y === y))) return { x, y };
    }
  }
  return null;
}

describe('PlaySession', () => {
  it('starts the timer on the first tap on an arrow, not before', () => {
    const session = new PlaySession(puzzle);
    expect(session.timerStarted).toBe(false);
    expect(session.tapCell(-1, -1, 100)).toEqual({ kind: 'empty' });
    expect(session.timerStarted).toBe(false);
    const id = session.hint()!;
    const { x, y } = head(puzzle.arrows[id]!);
    const result = session.tapCell(x, y, 1000);
    expect(result).toMatchObject({ kind: 'removed', arrowId: id });
    expect(session.elapsedMs(1500)).toBe(500);
  });

  it('costs a drop on a blocked arrow and names the blocker', () => {
    const session = new PlaySession(puzzle);
    const id = blockedArrow(puzzle);
    const { x, y } = puzzle.arrows[id]!.cells[0]!;
    const result = session.tapCell(x, y, 0);
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') expect(result.blockedBy.length).toBeGreaterThan(0);
    expect(session.state.lives).toBe(2);
  });

  it('loses after three blocked taps, stops the timer and ignores further taps', () => {
    const session = new PlaySession(puzzle);
    const { x, y } = puzzle.arrows[blockedArrow(puzzle)]!.cells[0]!;
    session.tapCell(x, y, 0);
    session.tapCell(x, y, 100);
    session.tapCell(x, y, 200);
    expect(session.state.status).toBe('lost');
    expect(session.elapsedMs(10_000)).toBe(200);
    expect(session.tapCell(x, y, 300)).toEqual({ kind: 'ignored' });
    expect(session.hint()).toBeNull();
  });

  it('wins by following hints, counting them', () => {
    const session = new PlaySession(puzzle);
    let guard = puzzle.arrows.length;
    while (session.state.status === 'playing' && guard-- > 0) {
      const { x, y } = head(puzzle.arrows[session.hint()!]!);
      session.tapCell(x, y, 0);
    }
    expect(session.state.status).toBe('won');
    expect(session.hintsUsed).toBe(puzzle.arrows.length);
  });

  it('retries the same puzzle with fresh drops, timer and hint count', () => {
    const session = new PlaySession(puzzle);
    const { x, y } = puzzle.arrows[blockedArrow(puzzle)]!.cells[0]!;
    session.tapCell(x, y, 0);
    session.hint();
    session.retry();
    expect(session.state.lives).toBe(3);
    expect(session.state.remaining.size).toBe(puzzle.arrows.length);
    expect(session.timerStarted).toBe(false);
    expect(session.hintsUsed).toBe(0);
    expect(session.puzzle).toBe(puzzle);
  });

  it('pauses and resumes the timer', () => {
    const session = new PlaySession(puzzle);
    const { x, y } = head(puzzle.arrows[session.hint()!]!);
    session.tapCell(x, y, 0);
    session.pause(1000);
    session.resume(5000);
    expect(session.elapsedMs(6000)).toBe(2000);
  });

  it('treats a tap on an empty cell as nothing', () => {
    const level = generateLevel(1).puzzle;
    const cell = emptyCell(level);
    const session = new PlaySession(level);
    // Level 1 is a full rectangle: there is no empty cell until arrows leave.
    expect(cell).toBeNull();
    expect(session.tapCell(level.width, 0, 0)).toEqual({ kind: 'empty' });
  });
});
