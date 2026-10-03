import { describe, expect, it } from 'vitest';
import { cuePlayer } from './cues.ts';
import type { Cue, CueSettings } from './cues.ts';

describe('cuePlayer', () => {
  it('plays the sound and the haptic of a cue, each only while its setting is on', () => {
    const heard: Cue[] = [];
    const felt: Cue[] = [];
    const settings: CueSettings = { sound: true, haptics: true };
    const cues = cuePlayer(
      { play: (cue) => heard.push(cue) },
      { play: (cue) => felt.push(cue) },
      () => settings,
    );
    cues.play('remove');
    Object.assign(settings, { sound: false });
    cues.play('block');
    Object.assign(settings, { sound: true, haptics: false });
    cues.play('win');
    expect(heard).toEqual(['remove', 'win']);
    expect(felt).toEqual(['remove', 'block']);
  });
});
