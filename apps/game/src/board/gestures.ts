/**
 * Turns pointer events into taps, pans and pinches. Pure: the caller passes
 * positions in stage pixels and a clock, and gets actions back. One finger (or
 * the mouse) taps or, past the slop, drags; two fingers pinch and pan together.
 */
export type GestureAction =
  | {
      readonly kind: 'tap';
      readonly x: number;
      readonly y: number;
      /** A second tap close in time and space to the previous one. */
      readonly double: boolean;
    }
  | { readonly kind: 'pan'; readonly dx: number; readonly dy: number }
  /**
   * Two fingers, measured from the start of the pinch: what was under
   * (fromX, fromY) when it started goes under (x, y), at the starting scale
   * times `factor`. Apply it to the view as it was when the pinch started.
   */
  | {
      readonly kind: 'pinch';
      readonly factor: number;
      readonly fromX: number;
      readonly fromY: number;
      readonly x: number;
      readonly y: number;
    }
  /** The pinch is over; the next one starts from the view as it is then. */
  | { readonly kind: 'pinchEnd' };

export interface GestureOptions {
  /** Movement in pixels before a press becomes a drag. */
  readonly slop: number;
  /** A press held longer than this is not a tap. */
  readonly tapMaxMs: number;
  readonly doubleTapMs: number;
  readonly doubleTapDistance: number;
}

export const DEFAULT_GESTURES: GestureOptions = {
  slop: 8,
  tapMaxMs: 500,
  doubleTapMs: 320,
  doubleTapDistance: 32,
};

interface Position {
  x: number;
  y: number;
}

interface Stamp extends Position {
  readonly t: number;
}

export class GestureTracker {
  private readonly pointers = new Map<number, Position>();
  private start: Stamp | null = null;
  /** The press has moved past the slop, or a second finger joined: not a tap. */
  private dragging = false;
  private lastTap: Stamp | null = null;
  private pinchStart: Pinch | null = null;
  private readonly options: GestureOptions;

  constructor(options: GestureOptions = DEFAULT_GESTURES) {
    this.options = options;
  }

  get activePointers(): number {
    return this.pointers.size;
  }

  down(id: number, x: number, y: number, t: number): GestureAction[] {
    this.pointers.set(id, { x, y });
    if (this.pointers.size === 1) {
      this.start = { x, y, t };
      this.dragging = false;
      return [];
    }
    this.dragging = true;
    // A finger joining starts a new pinch from the first two fingers.
    const ended = this.pinchStart !== null;
    this.pinchStart = this.currentPinch();
    return ended ? [{ kind: 'pinchEnd' }] : [];
  }

  private currentPinch(): Pinch {
    const [a, b] = [...this.pointers.values()];
    return pinch(a!, b!);
  }

  move(id: number, x: number, y: number): GestureAction[] {
    const pointer = this.pointers.get(id);
    if (pointer === undefined) return [];

    if (this.pointers.size >= 2) {
      pointer.x = x;
      pointer.y = y;
      const begin = (this.pinchStart ??= this.currentPinch());
      const now = this.currentPinch();
      return [
        {
          kind: 'pinch',
          factor: begin.distance > 0 && now.distance > 0 ? now.distance / begin.distance : 1,
          fromX: begin.x,
          fromY: begin.y,
          x: now.x,
          y: now.y,
        },
      ];
    }

    const dx = x - pointer.x;
    const dy = y - pointer.y;
    pointer.x = x;
    pointer.y = y;
    if (this.dragging) return [{ kind: 'pan', dx, dy }];
    const start = this.start;
    if (start === null || Math.hypot(x - start.x, y - start.y) < this.options.slop) return [];
    // Past the slop: the board catches up with the finger in one step.
    this.dragging = true;
    return [{ kind: 'pan', dx: x - start.x, dy: y - start.y }];
  }

  up(id: number, t: number): GestureAction[] {
    if (!this.pointers.delete(id)) return [];
    if (this.pointers.size > 0) return this.endPinch();
    const start = this.start;
    const dragging = this.dragging;
    this.start = null;
    this.dragging = false;
    if (dragging || start === null || t - start.t > this.options.tapMaxMs) return [];
    const last = this.lastTap;
    const double =
      last !== null &&
      t - last.t <= this.options.doubleTapMs &&
      Math.hypot(start.x - last.x, start.y - last.y) <= this.options.doubleTapDistance;
    // A double tap does not start another one.
    this.lastTap = double ? null : { x: start.x, y: start.y, t };
    return [{ kind: 'tap', x: start.x, y: start.y, double }];
  }

  cancel(id: number): GestureAction[] {
    if (!this.pointers.delete(id)) return [];
    if (this.pointers.size > 0) return this.endPinch();
    this.start = null;
    this.dragging = false;
    return [];
  }

  /** A finger left during a pinch: end it, and restart it if two fingers remain. */
  private endPinch(): GestureAction[] {
    if (this.pinchStart === null) return [];
    this.pinchStart = this.pointers.size >= 2 ? this.currentPinch() : null;
    return [{ kind: 'pinchEnd' }];
  }
}

interface Pinch {
  readonly x: number;
  readonly y: number;
  readonly distance: number;
}

function pinch(a: Position, b: Position): Pinch {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}
