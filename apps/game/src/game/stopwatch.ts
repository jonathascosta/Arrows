/**
 * The board timer. It starts on the first tap, pauses while the app is hidden
 * and stops when the board is won or lost. Times are whatever clock the caller
 * passes (performance.now in the app, plain numbers in tests).
 */
export class Stopwatch {
  private accumulated = 0;
  private since: number | null = null;
  private phase: 'idle' | 'running' | 'paused' | 'stopped' = 'idle';

  get started(): boolean {
    return this.phase !== 'idle';
  }

  get running(): boolean {
    return this.phase === 'running';
  }

  start(now: number): void {
    if (this.phase !== 'idle') return;
    this.phase = 'running';
    this.since = now;
  }

  pause(now: number): void {
    if (this.phase !== 'running') return;
    this.accumulated += now - this.since!;
    this.since = null;
    this.phase = 'paused';
  }

  resume(now: number): void {
    if (this.phase !== 'paused') return;
    this.phase = 'running';
    this.since = now;
  }

  stop(now: number): void {
    if (this.phase === 'running') this.accumulated += now - this.since!;
    if (this.phase !== 'idle') this.phase = 'stopped';
    this.since = null;
  }

  elapsed(now: number): number {
    return this.accumulated + (this.phase === 'running' ? now - this.since! : 0);
  }
}
