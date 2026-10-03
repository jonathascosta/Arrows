import type { Cue, CuePlayer } from './cues.ts';

/** One tone of a cue: when it starts and how long it lasts, in seconds. */
interface Tone {
  readonly at: number;
  readonly duration: number;
  readonly frequency: number;
  /** Where the pitch glides to by the end, if it moves. */
  readonly to?: number;
  readonly wave: OscillatorType;
  /** Peak volume, 0 to 1, before the master volume. */
  readonly level: number;
}

const note = (at: number, frequency: number, duration = 0.16, level = 0.5): Tone => ({
  at,
  duration,
  frequency,
  wave: 'sine',
  level,
});

/**
 * The cues as short synthesised sounds, quiet and dry, until a designer makes
 * real ones: a light tick, a dull knock, a rising arpeggio, a falling one, a
 * fanfare. Frequencies are the equal-tempered notes they are named after.
 */
const CUES: Readonly<Record<Cue, readonly Tone[]>> = {
  remove: [{ at: 0, duration: 0.07, frequency: 880, to: 1320, wave: 'sine', level: 0.35 }],
  block: [{ at: 0, duration: 0.16, frequency: 180, to: 110, wave: 'triangle', level: 0.8 }],
  // C5 E5 G5 C6.
  win: [note(0, 523.25), note(0.1, 659.25), note(0.2, 783.99), note(0.3, 1046.5, 0.3)],
  // G4 Eb4 C4.
  lose: [392, 311.13, 261.63].map((frequency, i): Tone => ({
    at: i * 0.15,
    duration: 0.22,
    frequency,
    wave: 'triangle',
    level: 0.6,
  })),
  // C5 E5 G5, then C6 and E6 held together.
  promote: [
    note(0, 523.25, 0.12),
    note(0.1, 659.25, 0.12),
    note(0.2, 783.99, 0.12),
    note(0.32, 1046.5, 0.5),
    note(0.32, 1318.51, 0.5, 0.35),
  ],
};

/** How loud the game is at most: quiet, next to the phone's own sounds. */
const MASTER = 0.18;

/**
 * How late a cue may still sound while the audio starts. A browser starts audio
 * only after a tap: a cue before any tap waits, and must not sound with a later one.
 */
const LATE_MS = 250;

type AudioContextClass = new () => AudioContext;

/**
 * The cues through Web Audio, in the browser and in the iOS app's web view
 * (where the silent switch mutes them). The audio context starts on the first
 * cue. A browser lets it start only after a tap, so a cue before any tap (a
 * promotion as the page opens) is silent there; the app's web view plays it.
 * Where Web Audio is missing or fails, the cue is silent.
 */
export class WebAudioSounds implements CuePlayer {
  private readonly create: AudioContextClass | undefined;
  private readonly now: () => number;
  private context: AudioContext | null = null;
  private master: GainNode | null = null;

  constructor(
    create: AudioContextClass | undefined = globalThis.AudioContext,
    now: () => number = () => Date.now(),
  ) {
    this.create = create;
    this.now = now;
  }

  play(cue: Cue): void {
    const context = this.ready();
    if (context === null) return;
    if (context.state === 'running') {
      this.schedule(context, cue);
      return;
    }
    // Starting: the cue sounds once the audio runs, unless that is too late.
    const asked = this.now();
    context.resume().then(
      () => {
        if (this.now() - asked <= LATE_MS) this.schedule(context, cue);
      },
      () => undefined,
    );
  }

  private schedule(context: AudioContext, cue: Cue): void {
    if (this.master === null) return;
    try {
      const start = context.currentTime + 0.01;
      for (const tone of CUES[cue]) this.tone(context, this.master, start, tone);
    } catch {
      // A sound is never worth an error.
    }
  }

  private ready(): AudioContext | null {
    if (this.create === undefined) return null;
    try {
      if (this.context === null) {
        this.context = new this.create();
        this.master = this.context.createGain();
        this.master.gain.value = MASTER;
        this.master.connect(this.context.destination);
      }
      return this.context;
    } catch {
      return null;
    }
  }

  private tone(context: AudioContext, out: AudioNode, start: number, tone: Tone): void {
    const at = start + tone.at;
    const end = at + tone.duration;
    const oscillator = context.createOscillator();
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.frequency, at);
    if (tone.to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(tone.to, end);
    // A quick rise and an exponential fall: no clicks at either end.
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(tone.level, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(out);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gain.disconnect();
    });
    oscillator.start(at);
    oscillator.stop(end + 0.02);
  }
}
