import { tween } from '../board/tween.ts';
import { t } from '../strings.ts';
import type { Theme } from '../theme/theme.ts';
import { el } from './dom.ts';

const SVG = 'http://www.w3.org/2000/svg';

/** How far each half twists, in degrees, and drifts from the axis, in arrowhead lengths. */
const TWIST_DEGREES = 18;
const DRIFT = 0.05;

type ChanceState = 'intact' | 'breaking' | 'lost';

interface Chance {
  readonly svg: SVGSVGElement;
  readonly upper: SVGPathElement;
  readonly lower: SVGPathElement;
  state: ChanceState;
  /** Bumped whenever the chance is placed, so a break in flight knows it was overtaken. */
  generation: number;
}

/**
 * The chances in the header, drawn as the board's own arrowhead (docs/DESIGN.md).
 * A lost chance is the arrowhead split along its axis, both halves twisted
 * apart: it differs from an intact one by shape as well as colour.
 */
export class Chances {
  readonly element: HTMLDivElement;
  private items: Chance[] = [];
  private readonly pending = new Set<Promise<void>>();
  private readonly theme: Theme;
  private readonly reducedMotion: () => boolean;

  constructor(doc: Document, theme: Theme, reducedMotion: () => boolean) {
    this.theme = theme;
    this.reducedMotion = reducedMotion;
    this.element = el(doc, 'div', {
      class: 'chances',
      role: 'img',
      'data-direction': theme.chanceDirection,
    });
  }

  /**
   * Shows `left` of `total` chances intact, the intact ones first. Fewer than
   * before breaks the rightmost intact ones, animated; more (a retry) resets
   * them at once.
   */
  set(left: number, total: number): void {
    if (this.items.length !== total) this.build(total);
    const intact = this.items.filter((item) => item.state === 'intact').length;
    if (left < intact) {
      for (let i = left; i < intact; i++) this.track(this.break(this.items[i]!));
    } else if (left > intact) {
      this.items.forEach((item, i) => this.place(item, i < left ? 'intact' : 'lost'));
    }
    this.element.dataset.chances = String(left);
    this.element.setAttribute('aria-label', t('hud.chances', { n: left, total }));
  }

  /** Resolves when every breaking chance has settled. */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  private build(total: number): void {
    const doc = this.element.ownerDocument;
    const { headDepth: length, headHalfWidth: half } = this.theme.board;
    const pad = 0.08;
    const half2 = (y: number): string => `M0 ${y}L${length} 0L0 0Z`;
    this.items = Array.from({ length: total }, () => {
      const svg = doc.createElementNS(SVG, 'svg');
      svg.setAttribute(
        'viewBox',
        `${-pad} ${-half - pad * 2} ${length + pad * 2} ${(half + pad * 2) * 2}`,
      );
      svg.setAttribute('class', 'chance');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const upper = doc.createElementNS(SVG, 'path');
      upper.setAttribute('d', half2(-half));
      const lower = doc.createElementNS(SVG, 'path');
      lower.setAttribute('d', half2(half));
      svg.append(upper, lower);
      return { svg, upper, lower, state: 'intact', generation: 0 };
    });
    this.element.replaceChildren(...this.items.map((item) => item.svg));
  }

  /** Puts a chance in a state at once, with the pose that goes with it. */
  private place(item: Chance, state: 'intact' | 'lost'): void {
    item.generation++;
    item.state = state;
    item.svg.classList.toggle('lost', state === 'lost');
    item.svg.classList.remove('breaking');
    this.pose(item, state === 'lost' ? 1 : 0);
  }

  private pose(item: Chance, amount: number): void {
    const angle = TWIST_DEGREES * amount;
    const drift = DRIFT * amount;
    if (amount === 0) {
      item.upper.removeAttribute('transform');
      item.lower.removeAttribute('transform');
      return;
    }
    item.upper.setAttribute('transform', `translate(0 ${-drift}) rotate(${-angle})`);
    item.lower.setAttribute('transform', `translate(0 ${drift}) rotate(${angle})`);
  }

  /** Splits, twists apart in the blocked colour, then settles as lost. */
  private async break(item: Chance): Promise<void> {
    const generation = ++item.generation;
    item.state = 'breaking';
    item.svg.classList.add('breaking');
    const { chanceBreakMs } = this.theme.motion;
    const reduced = this.reducedMotion();
    // With reduced motion the pose changes at once and the red is held as long.
    const motion = tween(
      chanceBreakMs,
      (progress) => this.pose(item, 1 - (1 - progress) * (1 - progress)),
      reduced,
    );
    const hold = new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, chanceBreakMs);
    });
    await Promise.all([motion, hold]);
    if (item.generation !== generation) return; // reset meanwhile by a retry
    item.state = 'lost';
    item.svg.classList.remove('breaking');
    item.svg.classList.add('lost');
  }

  private track(done: Promise<void>): void {
    this.pending.add(done);
    void done.finally(() => this.pending.delete(done));
  }
}
