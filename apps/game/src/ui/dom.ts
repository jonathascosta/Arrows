type Child = Node | string;

/** Creates an element with attributes and children. Attributes with `undefined` are skipped. */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  attributes: Readonly<Record<string, string | undefined>> = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const element = doc.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) element.setAttribute(key, value);
  }
  element.append(...children);
  return element;
}

/** An element holding trusted inline SVG markup from the theme. */
export function iconSpan(doc: Document, markup: string, className: string): HTMLSpanElement {
  const span = el(doc, 'span', { class: className, 'aria-hidden': 'true' });
  span.innerHTML = markup;
  return span;
}
