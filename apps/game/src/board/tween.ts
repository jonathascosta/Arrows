/**
 * Runs `frame(progress)` on animation frames for `durationMs`, progress going
 * from 0 to 1, and resolves when done. With `instant` (reduced motion, or no
 * animation frames, as in tests) it runs the last frame at once.
 */
export function tween(
  durationMs: number,
  frame: (progress: number) => void,
  instant: boolean,
): Promise<void> {
  const raf = globalThis.requestAnimationFrame as typeof requestAnimationFrame | undefined;
  if (instant || durationMs <= 0 || raf === undefined) {
    frame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let start: number | null = null;
    const step = (now: number): void => {
      start ??= now;
      const progress = Math.min(1, (now - start) / durationMs);
      frame(progress);
      if (progress < 1) raf(step);
      else resolve();
    };
    raf(step);
  });
}

export const easeInQuad = (t: number): number => t * t;
