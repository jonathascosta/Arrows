import { cellIndex } from '../board/mask.ts';
import type { Puzzle } from '../board/types.ts';
import { head } from '../board/types.ts';
import { clearArrow, createOccupancy, rayBlockers, rayStatus } from '../solver/occupancy.ts';
import type { Occupancy } from '../solver/occupancy.ts';

export type GameStatus = 'playing' | 'won' | 'lost';

/** One board in play. Immutable: every move returns a new state. */
export interface GameState {
  readonly puzzle: Puzzle;
  readonly occupancy: Occupancy;
  readonly remaining: ReadonlySet<number>;
  readonly lives: number;
  readonly livesAtStart: number;
  readonly mistakes: number;
  /** Ids of the arrows removed, in order. */
  readonly moves: readonly number[];
  readonly status: GameStatus;
}

export interface GameOptions {
  readonly lives?: number;
}

export const DEFAULT_LIVES = 3;

export function createGame(puzzle: Puzzle, options: GameOptions = {}): GameState {
  const lives = options.lives ?? DEFAULT_LIVES;
  return {
    puzzle,
    occupancy: createOccupancy(puzzle),
    remaining: new Set(puzzle.arrows.map((arrow) => arrow.id)),
    lives,
    livesAtStart: lives,
    mistakes: 0,
    moves: [],
    status: puzzle.arrows.length === 0 ? 'won' : 'playing',
  };
}

export type TapOutcome =
  | { readonly kind: 'removed'; readonly arrowId: number; readonly rayLength: number }
  | { readonly kind: 'blocked'; readonly arrowId: number; readonly blockedBy: readonly number[] }
  /** The board is over, or the arrow is already gone. */
  | { readonly kind: 'ignored' };

export interface TapResult {
  readonly state: GameState;
  readonly outcome: TapOutcome;
}

export function tap(state: GameState, arrowId: number): TapResult {
  if (state.status !== 'playing' || !state.remaining.has(arrowId)) {
    return { state, outcome: { kind: 'ignored' } };
  }
  const { puzzle } = state;
  const arrow = puzzle.arrows[arrowId]!;
  const status = rayStatus(
    puzzle.mask,
    state.occupancy,
    head(arrow),
    arrow.direction,
    puzzle.rayMode,
  );
  if (status.blockers > 0) {
    const lives = state.lives - 1;
    return {
      state: {
        ...state,
        lives,
        mistakes: state.mistakes + 1,
        status: lives <= 0 ? 'lost' : 'playing',
      },
      outcome: {
        kind: 'blocked',
        arrowId,
        blockedBy: rayBlockers(
          puzzle.mask,
          state.occupancy,
          head(arrow),
          arrow.direction,
          puzzle.rayMode,
        ),
      },
    };
  }
  const occupancy = new Int32Array(state.occupancy);
  clearArrow(occupancy, puzzle.mask, arrow);
  const remaining = new Set(state.remaining);
  remaining.delete(arrowId);
  return {
    state: {
      ...state,
      occupancy,
      remaining,
      moves: [...state.moves, arrowId],
      status: remaining.size === 0 ? 'won' : 'playing',
    },
    outcome: { kind: 'removed', arrowId, rayLength: status.length },
  };
}

/** Every arrow that can be removed now. */
export function freeArrows(state: GameState): number[] {
  const { puzzle } = state;
  const free: number[] = [];
  for (const id of state.remaining) {
    const arrow = puzzle.arrows[id]!;
    if (
      rayStatus(puzzle.mask, state.occupancy, head(arrow), arrow.direction, puzzle.rayMode)
        .blockers === 0
    ) {
      free.push(id);
    }
  }
  return free;
}

/** The free arrow with the shortest ray (the most visible move), or null when the board is over. */
export function hint(state: GameState): number | null {
  if (state.status !== 'playing') return null;
  const { puzzle } = state;
  let best: number | null = null;
  let bestRay = Number.POSITIVE_INFINITY;
  for (const id of freeArrows(state)) {
    const arrow = puzzle.arrows[id]!;
    const { length } = rayStatus(
      puzzle.mask,
      state.occupancy,
      head(arrow),
      arrow.direction,
      puzzle.rayMode,
    );
    if (length < bestRay) {
      best = id;
      bestRay = length;
    }
  }
  return best;
}

/** The arrow occupying a cell, or null. Hit testing is by cell, never by distance to the stroke. */
export function arrowAt(state: GameState, x: number, y: number): number | null {
  const { puzzle } = state;
  if (x < 0 || y < 0 || x >= puzzle.width || y >= puzzle.height) return null;
  const id = state.occupancy[cellIndex(puzzle.mask, x, y)]!;
  return id === -1 ? null : id;
}
