import { describe, expect, it } from 'vitest';
import { WebAudioSounds } from './sounds.ts';

/** Just enough of Web Audio to count the tones a cue plays. */
class FakeContext {
  static made = 0;
  /** Makes `resume` wait until the test calls the function it is given. */
  static holdResume: ((start: () => void) => void) | null = null;
  state: AudioContextState = 'suspended';
  currentTime = 1;
  readonly destination = {};
  readonly tones: { type: string; start: number; frequency: number }[] = [];
  resumed = 0;
  disconnected = 0;

  constructor() {
    FakeContext.made++;
  }

  resume(): Promise<void> {
    this.resumed++;
    return new Promise((resolve) => {
      const start = (): void => {
        this.state = 'running';
        resolve();
      };
      if (FakeContext.holdResume === null) start();
      else FakeContext.holdResume(start);
    });
  }

  createGain(): unknown {
    const param = {
      value: 0,
      setValueAtTime: () => param,
      linearRampToValueAtTime: () => param,
      exponentialRampToValueAtTime: () => param,
    };
    return {
      gain: param,
      connect: (node: unknown) => node,
      disconnect: () => this.disconnected++,
    };
  }

  createOscillator(): unknown {
    let frequency = 0;
    let ended = (): void => undefined;
    const oscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: (value: number) => (frequency = value),
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: (node: unknown) => node,
      disconnect: () => this.disconnected++,
      addEventListener: (_type: 'ended', listener: () => void) => (ended = listener),
      start: (at: number) => this.tones.push({ type: oscillator.type, start: at, frequency }),
      // The tone ends at once here: what matters is that its nodes are let go.
      stop: () => ended(),
    };
    return oscillator;
  }
}

const Fake = FakeContext as unknown as new () => AudioContext;

function contextOf(sounds: WebAudioSounds): FakeContext {
  return (sounds as unknown as { context: FakeContext }).context;
}

describe('WebAudioSounds', () => {
  it('plays each cue as its tones, starting the audio on the first cue', async () => {
    FakeContext.made = 0;
    FakeContext.holdResume = null;
    const sounds = new WebAudioSounds(Fake);
    expect(FakeContext.made).toBe(0);
    sounds.play('remove');
    expect(FakeContext.made).toBe(1);
    const context = contextOf(sounds);
    // The first cue sounds once the audio has started.
    await Promise.resolve();
    expect(context.tones).toHaveLength(1);
    sounds.play('win');
    sounds.play('promote');
    expect(context.resumed).toBe(1);
    // One tick, four notes up, five for the fanfare.
    expect(context.tones).toHaveLength(1 + 4 + 5);
    expect(context.tones[0]).toMatchObject({ frequency: 880 });
    expect(context.tones.slice(1, 5).map((tone) => tone.frequency)).toEqual([
      523.25, 659.25, 783.99, 1046.5,
    ]);
    // Every tone lets go of its two nodes when it ends.
    expect(context.disconnected).toBe(2 * context.tones.length);
  });

  it('drops a cue the browser held until a later tap', async () => {
    let now = 0;
    let start = (): void => undefined;
    FakeContext.holdResume = (go) => (start = go);
    const sounds = new WebAudioSounds(Fake, () => now);
    // A promotion as the page opens: the browser keeps the audio from starting.
    sounds.play('promote');
    now += 300;
    // The first tap lets it start; only the tap's own cue sounds.
    FakeContext.holdResume = null;
    sounds.play('remove');
    start();
    await Promise.resolve();
    await Promise.resolve();
    expect(contextOf(sounds).tones.map((tone) => tone.frequency)).toEqual([880]);
  });

  it('plays a cue whose audio takes a moment to start, and none that starts too late', async () => {
    let now = 0;
    let start = (): void => undefined;
    FakeContext.holdResume = (go) => (start = go);
    // The app's web view after a cold launch: no tap needed, only a little time.
    const app = new WebAudioSounds(Fake, () => now);
    app.play('promote');
    now += 600;
    start();
    await Promise.resolve();
    expect(contextOf(app).tones).toHaveLength(5);

    const slow = new WebAudioSounds(Fake, () => now);
    slow.play('promote');
    now += 5_000;
    start();
    await Promise.resolve();
    expect(contextOf(slow).tones).toHaveLength(0);
    FakeContext.holdResume = null;
  });

  it('is silent where Web Audio is missing or refuses to start', () => {
    FakeContext.holdResume = null;
    expect(() => new WebAudioSounds(undefined).play('lose')).not.toThrow();
    const refusing = function (): never {
      throw new Error('not allowed');
    };
    expect(() =>
      new WebAudioSounds(refusing as unknown as new () => AudioContext).play('block'),
    ).not.toThrow();
  });
});
