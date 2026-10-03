import { readJson, RecordSlot } from './record.ts';
import type { KeyValueStore } from './store.ts';

export const SETTINGS_KEY = 'arrows.settings';
export const SETTINGS_VERSION = 1;

/** The player's choices in Settings (docs/PRODUCT.md, Sound, haptics and settings). */
export interface Settings {
  readonly version: typeof SETTINGS_VERSION;
  readonly sound: boolean;
  readonly haptics: boolean;
}

/** Both on, until the player says otherwise. */
export const INITIAL_SETTINGS: Settings = { version: SETTINGS_VERSION, sound: true, haptics: true };

/** Reads stored settings field by field; anything missing or broken is on. */
export function parseSettings(raw: string | null): Settings {
  const record = readJson(raw);
  if (record?.version !== SETTINGS_VERSION) return INITIAL_SETTINGS;
  return {
    version: SETTINGS_VERSION,
    sound: typeof record.sound === 'boolean' ? record.sound : true,
    haptics: typeof record.haptics === 'boolean' ? record.haptics : true,
  };
}

export class SettingsStore {
  private readonly slot: RecordSlot<Settings>;

  constructor(store: KeyValueStore) {
    this.slot = new RecordSlot(
      store,
      SETTINGS_KEY,
      SETTINGS_VERSION,
      parseSettings,
      INITIAL_SETTINGS,
    );
  }

  get settings(): Settings {
    return this.slot.read();
  }

  set(change: Partial<Pick<Settings, 'sound' | 'haptics'>>): Settings {
    const next = { ...this.slot.read(), ...change };
    this.slot.write(next);
    return next;
  }
}
