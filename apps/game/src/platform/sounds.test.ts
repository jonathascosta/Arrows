import { describe, expect, it } from 'vitest';
import { WebAudioSounds } from './sounds.ts';

/** Just enough of Web Audio to count the tones a cue plays. */
class FakeContext {
  static made = 0;
  state: AudioContextState = 'suspended';
  currentTime = 1;
  readonly destination = {};
  readonly tones: { type: string; start: number; frequency: number }[] = [];
  resumed = 0;

  constructor() {
    FakeContext.made++;
  }

  resume(): Promise<void> {
    this.resumed++;
    this.state = 'running';
    return Promise.resolve();
  }

  createGain(): unknown {
    const param = {
      value: 0,
      setValueAtTime: () => param,
      linearRampToValueAtTime: () => param,
      exponentialRampToValueAtTime: () => param,
    };
    return { gain: param, connect: (node: unknown) => node };
  }

  createOscillator(): unknown {
    let frequency = 0;
    const oscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: (value: number) => (frequency = value),
        exponentialRampToValueAtTime: () => undefined,
      },
      connect: (node: unknown) => node,
      start: (at: number) => this.tones.push({ type: oscillator.type, start: at, frequency }),
      stop: () => undefined,
    };
    return oscillator;
  }
}

describe('WebAudioSounds', () => {
  it('plays each cue as its tones, starting the audio on the first cue', () => {
    FakeContext.made = 0;
    const sounds = new WebAudioSounds(FakeContext as unknown as new () => AudioContext);
    expect(FakeContext.made).toBe(0);
    sounds.play('remove');
    sounds.play('win');
    sounds.play('promote');
    expect(FakeContext.made).toBe(1);
    const context = (sounds as unknown as { context: FakeContext }).context;
    expect(context.resumed).toBe(1);
    // One tick, four notes up, five for the fanfare.
    expect(context.tones).toHaveLength(1 + 4 + 5);
    expect(context.tones[0]).toMatchObject({ frequency: 880 });
    expect(context.tones.slice(1, 5).map((tone) => tone.frequency)).toEqual([
      523.25, 659.25, 783.99, 1046.5,
    ]);
  });

  it('is silent where Web Audio is missing or refuses to start', () => {
    expect(() => new WebAudioSounds(undefined).play('lose')).not.toThrow();
    const refusing = function (): never {
      throw new Error('not allowed');
    };
    expect(() =>
      new WebAudioSounds(refusing as unknown as new () => AudioContext).play('block'),
    ).not.toThrow();
  });
});
