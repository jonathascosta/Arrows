import { DELTA } from '@arrows/engine';
import type { Arrow, Puzzle } from '@arrows/engine';
import type { Theme } from '../theme/theme.ts';
import { arrowColor } from '../theme/theme.ts';
import {
  bodyPoints,
  exitDuration,
  exitTrack,
  gridData,
  headPoints,
  pathData,
  polygonData,
  polylineLength,
} from './geometry.ts';
import { easeInQuad, tween } from './tween.ts';

const SVG = 'http://www.w3.org/2000/svg';

interface ArrowNode {
  readonly arrow: Arrow;
  readonly group: SVGGElement;
  readonly body: SVGPathElement;
  readonly head: SVGPathElement;
}

function svg<K extends keyof SVGElementTagNameMap>(
  doc: Document,
  name: K,
  attributes: Readonly<Record<string, string>> = {},
): SVGElementTagNameMap[K] {
  const element = doc.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

/**
 * Draws a puzzle in SVG, one group per arrow (`data-arrow` is the arrow id),
 * and animates arrows leaving or bumping. It knows nothing of rules or input:
 * the screen tells it what happened.
 */
export class BoardRenderer {
  readonly element: SVGSVGElement;
  private readonly content: SVGGElement;
  private readonly grid: SVGPathElement;
  private readonly layer: SVGGElement;
  private readonly nodes = new Map<number, ArrowNode>();
  private readonly pending = new Set<Promise<void>>();
  private hinted: number | null = null;
  private readonly theme: Theme;
  private readonly reducedMotion: () => boolean;

  constructor(container: HTMLElement, theme: Theme, reducedMotion: () => boolean) {
    this.theme = theme;
    this.reducedMotion = reducedMotion;
    const doc = container.ownerDocument;
    this.element = svg(doc, 'svg', { class: 'board', 'aria-hidden': 'true' });
    this.content = svg(doc, 'g', { class: 'board-content' });
    this.grid = svg(doc, 'path', {
      class: 'grid',
      'stroke-width': String(theme.board.gridWidth),
      visibility: 'hidden',
    });
    this.layer = svg(doc, 'g', {
      class: 'arrows',
      'stroke-width': String(theme.board.strokeWidth),
    });
    this.content.append(this.grid, this.layer);
    this.element.append(this.content);
    container.append(this.element);
  }

  /** Replaces whatever was drawn with the full puzzle. */
  render(puzzle: Puzzle): void {
    this.nodes.clear();
    this.hinted = null;
    this.layer.replaceChildren();
    this.grid.setAttribute('d', gridData(puzzle.mask));
    const doc = this.element.ownerDocument;
    const style = this.theme.board;
    for (const arrow of puzzle.arrows) {
      const group = svg(doc, 'g', { class: 'arrow', 'data-arrow': String(arrow.id) });
      group.style.setProperty(
        '--arrow-color',
        arrowColor(this.theme, puzzle.mask.palette[arrow.color]),
      );
      const body = svg(doc, 'path', { class: 'body', d: pathData(bodyPoints(arrow, style)) });
      const head = svg(doc, 'path', { class: 'head', d: polygonData(headPoints(arrow, style)) });
      group.append(body, head);
      this.layer.append(group);
      this.nodes.set(arrow.id, { arrow, group, body, head });
    }
  }

  get arrowsDrawn(): number {
    return this.nodes.size;
  }

  setStageSize(width: number, height: number): void {
    this.element.setAttribute('viewBox', `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
  }

  setTransform(transform: string): void {
    this.content.setAttribute('transform', transform);
  }

  setGridVisible(visible: boolean): void {
    this.grid.setAttribute('visibility', visible ? 'visible' : 'hidden');
  }

  /** Highlights one arrow, or none. */
  setHint(id: number | null): void {
    if (this.hinted !== null) this.nodes.get(this.hinted)?.group.classList.remove('hinted');
    this.hinted = id;
    if (id !== null) this.nodes.get(id)?.group.classList.add('hinted');
  }

  get hintedArrow(): number | null {
    return this.hinted;
  }

  /** Slides an arrow out along its body and its ray, then removes it. */
  remove(id: number, rayLength: number): Promise<void> {
    const node = this.nodes.get(id);
    if (node === undefined) return Promise.resolve();
    // Clear the hint while the node is still known, so the leaving arrow loses its highlight.
    if (this.hinted === id) this.setHint(null);
    this.nodes.delete(id);
    const { arrow, group, body, head } = node;
    group.classList.add('leaving');
    group.dataset.state = 'leaving';
    const track = exitTrack(arrow, this.theme.board, rayLength);
    const trackLength = polylineLength(track.points);
    body.setAttribute('d', pathData(track.points));
    body.setAttribute('stroke-dasharray', `${track.bodyLength} ${trackLength + track.bodyLength}`);
    const { dx, dy } = DELTA[arrow.direction];
    const done = tween(
      exitDuration(track.travel, this.theme.motion),
      (progress) => {
        const s = track.travel * easeInQuad(progress);
        body.setAttribute('stroke-dashoffset', String(-s));
        head.setAttribute('transform', `translate(${dx * s} ${dy * s})`);
        group.setAttribute('opacity', String(progress < 0.7 ? 1 : (1 - progress) / 0.3));
      },
      this.reducedMotion(),
    ).then(() => {
      group.remove();
    });
    return this.track(done);
  }

  /** A blocked tap: the arrow bumps towards what blocks it, and both flash. */
  bump(id: number, blockedBy: readonly number[]): Promise<void> {
    const node = this.nodes.get(id);
    if (node === undefined) return Promise.resolve();
    const blocker = blockedBy[0] === undefined ? undefined : this.nodes.get(blockedBy[0]);
    node.group.classList.add('blocked');
    blocker?.group.classList.add('blocker');
    const { dx, dy } = DELTA[node.arrow.direction];
    const { shakeMs } = this.theme.motion;
    const motion = tween(
      shakeMs,
      (progress) => {
        const amount = Math.sin(progress * Math.PI * 3) * (1 - progress) * 0.16;
        node.group.setAttribute('transform', `translate(${dx * amount} ${dy * amount})`);
      },
      this.reducedMotion(),
    );
    // The colour flash stays for the same time with or without motion.
    const flash = new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, shakeMs);
    });
    const done = Promise.all([motion, flash]).then(() => {
      node.group.removeAttribute('transform');
      node.group.classList.remove('blocked');
      blocker?.group.classList.remove('blocker');
    });
    return this.track(done);
  }

  /** Resolves when every running animation has finished. */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  private track(done: Promise<void>): Promise<void> {
    this.pending.add(done);
    void done.finally(() => this.pending.delete(done));
    return done;
  }
}
