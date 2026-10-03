import { describe, expect, it } from 'vitest';
import { Stopwatch } from './stopwatch.ts';

describe('Stopwatch', () => {
  it('reads zero until started and counts while running', () => {
    const watch = new Stopwatch();
    expect(watch.started).toBe(false);
    expect(watch.elapsed(500)).toBe(0);
    watch.start(1000);
    expect(watch.running).toBe(true);
    expect(watch.elapsed(1600)).toBe(600);
    watch.start(5000); // starting again changes nothing
    expect(watch.elapsed(1600)).toBe(600);
  });

  it('does not count while paused', () => {
    const watch = new Stopwatch();
    watch.start(0);
    watch.pause(1000);
    expect(watch.elapsed(9000)).toBe(1000);
    watch.resume(10_000);
    expect(watch.elapsed(10_500)).toBe(1500);
  });

  it('freezes when stopped, running or paused', () => {
    const running = new Stopwatch();
    running.start(0);
    running.stop(2000);
    expect(running.elapsed(99_999)).toBe(2000);
    running.resume(3000);
    expect(running.elapsed(99_999)).toBe(2000);

    const paused = new Stopwatch();
    paused.start(0);
    paused.pause(700);
    paused.stop(5000);
    expect(paused.elapsed(99_999)).toBe(700);
  });

  it('ignores pause and resume out of order', () => {
    const watch = new Stopwatch();
    watch.pause(10);
    watch.resume(20);
    expect(watch.started).toBe(false);
  });
});
