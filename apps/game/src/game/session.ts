import { arrowAt, createGame, hint, tap } from '@arrows/engine';
import type { GameOptions, GameState, Puzzle } from '@arrows/engine';
import { Stopwatch } from './stopwatch.ts';

export type CellTap =
  /** No arrow in that cell: not a mistake. */
  | { readonly kind: 'empty' }
  /** The board is over. */
  | { readonly kind: 'ignored' }
  | { readonly kind: 'removed'; readonly arrowId: number; readonly rayLength: number }
  | { readonly kind: 'blocked'; readonly arrowId: number; readonly blockedBy: readonly number[] };

/**
 * One board being played: the engine's game state plus the timer and the hint
 * count. The screen talks to this, never to the engine's `tap` directly, so
 * the rules about when the timer runs live in one place.
 */
export class PlaySession {
  private game: GameState;
  private watch = new Stopwatch();
  private hints = 0;
  readonly puzzle: Puzzle;
  private readonly options: GameOptions;

  constructor(puzzle: Puzzle, options: GameOptions = {}) {
    this.puzzle = puzzle;
    this.options = options;
    this.game = createGame(puzzle, options);
  }

  get state(): GameState {
    return this.game;
  }

  get hintsUsed(): number {
    return this.hints;
  }

  get timerStarted(): boolean {
    return this.watch.started;
  }

  /** A tap on a cell. The timer starts with the first tap that lands on an arrow. */
  tapCell(x: number, y: number, now: number): CellTap {
    if (this.game.status !== 'playing') return { kind: 'ignored' };
    const id = arrowAt(this.game, x, y);
    if (id === null) return { kind: 'empty' };
    this.watch.start(now);
    const { state, outcome } = tap(this.game, id);
    this.game = state;
    if (state.status !== 'playing') this.watch.stop(now);
    switch (outcome.kind) {
      case 'removed':
        return { kind: 'removed', arrowId: outcome.arrowId, rayLength: outcome.rayLength };
      case 'blocked':
        return { kind: 'blocked', arrowId: outcome.arrowId, blockedBy: outcome.blockedBy };
      case 'ignored':
        return { kind: 'ignored' };
    }
  }

  /** A free arrow to try, or null when the board is over. */
  hint(): number | null {
    const id = hint(this.game);
    if (id !== null) this.hints++;
    return id;
  }

  elapsedMs(now: number): number {
    return this.watch.elapsed(now);
  }

  pause(now: number): void {
    this.watch.pause(now);
  }

  resume(now: number): void {
    this.watch.resume(now);
  }

  /** The same puzzle again, with fresh drops and timer (docs/PRODUCT.md: a lost board is retried). */
  retry(): void {
    this.game = createGame(this.puzzle, this.options);
    this.watch = new Stopwatch();
    this.hints = 0;
  }
}
