import type { Cell } from '@arrows/engine';
import type { Bounds, Point } from './geometry.ts';

/** Space at the stage's edges that the board fits around, like the grid button's band. */
export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Zoom and pan as plain data. A board point (bx, by) in cell units is drawn
 * at screen point (bx * scale + tx, by * scale + ty), in stage pixels. Every
 * function returns a new, clamped viewport: the board never drifts out of the
 * frame (the stage minus its insets) and never zooms out past the fit. When
 * zoomed in, the board can still pass under the insets.
 */
export interface Viewport {
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly insets: Insets;
  readonly bounds: Bounds;
  /** Pixels per cell when the whole board fits the frame. */
  readonly fitScale: number;
  readonly maxScale: number;
  readonly scale: number;
  readonly tx: number;
  readonly ty: number;
}

export interface ViewportOptions {
  /** Zooming in stops at the larger of this many pixels per cell and `minZoom` times the fit. */
  readonly maxCellPixels?: number;
  readonly minZoom?: number;
  readonly insets?: Insets;
}

export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The part of the stage the board fits in. Never smaller than a pixel. */
export function frameOf(view: Pick<Viewport, 'stageWidth' | 'stageHeight' | 'insets'>): Frame {
  const { insets } = view;
  return {
    x: insets.left,
    y: insets.top,
    width: Math.max(1, view.stageWidth - insets.left - insets.right),
    height: Math.max(1, view.stageHeight - insets.top - insets.bottom),
  };
}

export function createViewport(
  stageWidth: number,
  stageHeight: number,
  bounds: Bounds,
  options: ViewportOptions = {},
): Viewport {
  const base = {
    stageWidth: Math.max(1, stageWidth),
    stageHeight: Math.max(1, stageHeight),
    insets: options.insets ?? NO_INSETS,
  };
  const frame = frameOf(base);
  const fitScale = Math.min(
    frame.width / (bounds.maxX - bounds.minX),
    frame.height / (bounds.maxY - bounds.minY),
  );
  const maxScale = Math.max(fitScale * (options.minZoom ?? 2), options.maxCellPixels ?? 72);
  return clampView({ ...base, bounds, fitScale, maxScale, scale: fitScale, tx: 0, ty: 0 });
}

function clampAxis(
  t: number,
  start: number,
  length: number,
  min: number,
  max: number,
  scale: number,
): number {
  const size = (max - min) * scale;
  if (size <= length) return start + (length - size) / 2 - min * scale;
  return Math.min(start - min * scale, Math.max(start + length - max * scale, t));
}

function clampView(view: Viewport): Viewport {
  const scale = Math.min(view.maxScale, Math.max(view.fitScale, view.scale));
  const { bounds } = view;
  const frame = frameOf(view);
  return {
    ...view,
    scale,
    tx: clampAxis(view.tx, frame.x, frame.width, bounds.minX, bounds.maxX, scale),
    ty: clampAxis(view.ty, frame.y, frame.height, bounds.minY, bounds.maxY, scale),
  };
}

/**
 * One pinch step as a single transform: the board point under (fromX, fromY)
 * ends up under (toX, toY), at the scale times `factor`, then the result is
 * clamped once. Panning and zooming as two clamped steps would lose the pan
 * whenever the board touches an edge, and the board would drift from the fingers.
 */
export function pinchView(
  view: Viewport,
  factor: number,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): Viewport {
  const scale = Math.min(view.maxScale, Math.max(view.fitScale, view.scale * factor));
  const anchor = toBoard(view, fromX, fromY);
  return clampView({ ...view, scale, tx: toX - anchor.x * scale, ty: toY - anchor.y * scale });
}

/** Zooms by `factor` keeping the board point under (px, py) where it is. */
export function zoomAt(view: Viewport, factor: number, px: number, py: number): Viewport {
  return pinchView(view, factor, px, py, px, py);
}

export function panBy(view: Viewport, dx: number, dy: number): Viewport {
  return clampView({ ...view, tx: view.tx + dx, ty: view.ty + dy });
}

export function resetView(view: Viewport): Viewport {
  return clampView({ ...view, scale: view.fitScale });
}

export function isZoomed(view: Viewport): boolean {
  return view.scale > view.fitScale * 1.001;
}

export function toBoard(view: Viewport, px: number, py: number): Point {
  return { x: (px - view.tx) / view.scale, y: (py - view.ty) / view.scale };
}

export function toScreen(view: Viewport, point: Point): Point {
  return { x: point.x * view.scale + view.tx, y: point.y * view.scale + view.ty };
}

/** The cell under a stage point, at the current zoom. May be outside the board. */
export function cellAt(view: Viewport, px: number, py: number): Cell {
  const { x, y } = toBoard(view, px, py);
  return { x: Math.floor(x), y: Math.floor(y) };
}

/** Pans the least needed to bring `point` at least `margin` pixels inside the frame. */
export function ensureVisible(view: Viewport, point: Point, margin: number): Viewport {
  const screen = toScreen(view, point);
  const frame = frameOf(view);
  const shift = (value: number, start: number, size: number): number => {
    const m = Math.min(margin, size / 2);
    if (value < start + m) return start + m - value;
    if (value > start + size - m) return start + size - m - value;
    return 0;
  };
  return panBy(view, shift(screen.x, frame.x, frame.width), shift(screen.y, frame.y, frame.height));
}

export function transformOf(view: Viewport): string {
  const r = (n: number): number => Math.round(n * 100) / 100;
  return `translate(${r(view.tx)} ${r(view.ty)}) scale(${Math.round(view.scale * 10000) / 10000})`;
}
