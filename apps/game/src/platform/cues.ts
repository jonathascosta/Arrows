/**
 * The moments the game marks with a sound and a haptic (docs/PRODUCT.md,
 * Sound, haptics and settings): an arrow leaving, a blocked tap, a board won,
 * a board lost, a promotion in the league.
 */
export type Cue = 'remove' | 'block' | 'win' | 'lose' | 'promote';

/** Plays cues: the sounds, the haptics, or both as the settings allow. */
export interface CuePlayer {
  /** Plays the cue and returns at once; a cue that cannot play is silent. */
  play(cue: Cue): void;
}

/** Nothing: the web's haptics, and anything turned off. */
export const SILENT: CuePlayer = {
  play: () => undefined,
};

/** Which of the two the player has on (Settings). */
export interface CueSettings {
  readonly sound: boolean;
  readonly haptics: boolean;
}

/** Sounds and haptics together, each only while the player's settings have it on. */
export function cuePlayer(
  sounds: CuePlayer,
  haptics: CuePlayer,
  settings: () => CueSettings,
): CuePlayer {
  return {
    play: (cue) => {
      const { sound, haptics: feel } = settings();
      if (sound) sounds.play(cue);
      if (feel) haptics.play(cue);
    },
  };
}
