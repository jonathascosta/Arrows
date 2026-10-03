/**
 * What a tap did, as the phone's haptics play it (docs/PRODUCT.md, iOS): an
 * arrow leaving, a blocked arrow costing a chance, the board won, the board lost.
 */
export type HapticCue = 'remove' | 'block' | 'win' | 'lose';

export interface Haptics {
  /** Plays the cue and returns at once; a phone without haptics feels nothing. */
  play(cue: HapticCue): void;
}

/** The web: no haptics. */
export const NO_HAPTICS: Haptics = {
  play: () => undefined,
};
