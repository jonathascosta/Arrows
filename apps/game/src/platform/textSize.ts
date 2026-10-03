/**
 * The phone's text size (Dynamic Type) for the text screens (docs/PRODUCT.md,
 * Accessibility). WebKit sizes its `-apple-system-body` font from the setting:
 * 17 px at the default size. Elsewhere the font is unknown, and the scale is 1.
 */

/** The body font's size at iOS's default text size. */
const DEFAULT_BODY_PX = 17;
/** From a little smaller to one and a half times: beyond, the screens stop fitting a phone. */
export const TEXT_SCALE_RANGE = { min: 0.85, max: 1.5 } as const;

/** How much larger than the default the player wants text, within `TEXT_SCALE_RANGE`. */
export function preferredTextScale(doc: Document): number {
  const view = doc.defaultView;
  // Some engines have no CSS object at all.
  const css = view?.CSS;
  if (view === null || css?.supports('font', '-apple-system-body') !== true) return 1;
  const probe = doc.createElement('span');
  probe.style.font = '-apple-system-body';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  doc.body.append(probe);
  const size = Number.parseFloat(view.getComputedStyle(probe).fontSize);
  probe.remove();
  if (!Number.isFinite(size) || size <= 0) return 1;
  const scale = size / DEFAULT_BODY_PX;
  return Math.min(TEXT_SCALE_RANGE.max, Math.max(TEXT_SCALE_RANGE.min, scale));
}

/** Scales the text screens' type (the root font size, see styles.css) by `scale`. */
export function applyTextScale(doc: Document, scale: number): void {
  doc.documentElement.style.setProperty('--text-scale', String(scale));
}
