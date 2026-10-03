import { describe, expect, it } from 'vitest';
import { INITIAL_SETTINGS, parseSettings, SETTINGS_KEY, SettingsStore } from './settings.ts';
import { MemoryStore } from './store.ts';

describe('settings', () => {
  it('starts with sound and haptics on, and keeps a change', () => {
    const store = new MemoryStore();
    const settings = new SettingsStore(store);
    expect(settings.settings).toEqual({ version: 1, sound: true, haptics: true });
    settings.set({ sound: false });
    expect(JSON.parse(store.getItem(SETTINGS_KEY)!)).toEqual({
      version: 1,
      sound: false,
      haptics: true,
    });
    expect(new SettingsStore(store).settings.sound).toBe(false);
  });

  it('reads what it cannot trust as on', () => {
    expect(parseSettings(null)).toEqual(INITIAL_SETTINGS);
    expect(parseSettings('not json')).toEqual(INITIAL_SETTINGS);
    expect(parseSettings('{"version":2,"sound":false}')).toEqual(INITIAL_SETTINGS);
    expect(parseSettings('{"version":1,"sound":"no","haptics":false}')).toEqual({
      version: 1,
      sound: true,
      haptics: false,
    });
  });
});
