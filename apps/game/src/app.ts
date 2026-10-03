import type { KeyValueStore } from './persistence/store.ts';
import { ProgressStore } from './persistence/progress.ts';
import type { PuzzleRef } from './route.ts';
import { HOME_HREF, parseRoute, routeSearch } from './route.ts';
import { HomeScreen } from './screens/home.ts';
import { PlayScreen } from './screens/play.ts';
import type { BoardResult, ResultNote } from './screens/play.ts';
import type { Theme } from './theme/theme.ts';

export interface AppOptions {
  readonly theme: Theme;
  readonly store: KeyValueStore;
  readonly now: () => number;
  readonly reducedMotion: () => boolean;
  /** Today's date key in the device's local time. */
  readonly today: () => string;
  /** Pushes an address onto the browser history (no reload). */
  readonly pushUrl: (url: string) => void;
  readonly pickerHref: string;
}

/**
 * The app shell: shows the home screen or a puzzle for an address, and keeps
 * the player's progress. Only it talks to the progress store.
 */
export class App {
  private readonly root: HTMLElement;
  private readonly options: AppOptions;
  private readonly progress: ProgressStore;
  private home: HomeScreen | null = null;
  private play: PlayScreen | null = null;

  constructor(root: HTMLElement, options: AppOptions) {
    this.root = root;
    this.options = options;
    this.progress = new ProgressStore(options.store);
  }

  /** Shows what an address names: a puzzle, or the home screen. */
  show(search: string): void {
    const ref = parseRoute(search);
    if (ref === null) this.showHome();
    else this.showPuzzle(ref);
  }

  /**
   * Draws the home screen again from the stored progress, when it is showing:
   * after the browser restores the page from its back-forward cache, or when
   * another tab has saved progress. A board in play is left as it is.
   */
  refresh(): void {
    if (this.home !== null) this.showHome();
  }

  private showHome(): void {
    this.play?.destroy();
    this.play = null;
    this.home?.destroy();
    this.home = new HomeScreen(this.root, {
      theme: this.options.theme,
      progress: this.progress.progress,
      today: this.options.today(),
      pickerHref: this.options.pickerHref,
      reducedMotion: this.options.reducedMotion,
    });
  }

  private showPuzzle(ref: PuzzleRef): void {
    this.home?.destroy();
    this.home = null;
    this.play ??= new PlayScreen(this.root, {
      theme: this.options.theme,
      now: this.options.now,
      reducedMotion: this.options.reducedMotion,
      homeHref: HOME_HREF,
      navigate: (next) => {
        this.options.pushUrl(routeSearch(next));
        this.showPuzzle(next);
      },
      record: (result) => this.record(result),
    });
    this.play.open(ref);
  }

  /**
   * Levels move the path and the streak; dailies and events do not, and a
   * replay of a level already won only keeps its best time (docs/PRODUCT.md).
   */
  private record(result: BoardResult): ResultNote | undefined {
    if (result.ref.kind !== 'level') return undefined;
    if (result.outcome === 'lost') {
      this.progress.recordLoss(result.ref.level);
      return undefined;
    }
    const win = this.progress.recordWin({
      level: result.ref.level,
      elapsedMs: result.elapsedMs,
      firstTry: result.firstTry,
    });
    // A first win has no earlier best to compare with: the sheet shows only its time.
    if (!win.replay) return { streak: win.streak };
    return { bestMs: win.bestMs, newBest: win.newBest };
  }
}
