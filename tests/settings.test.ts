// The remembered player settings (T45.4 "Bite close-ups"): on by default, round-trip through storage, and a
// corrupt or missing store falls back to the defaults.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/game/settings';

function fakeStorage(store: Record<string, string>) {
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
}

describe('settings', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', fakeStorage(store));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Settings_(Fresh)_ShouldHaveBiteCloseUpsOn', () => {
    expect(DEFAULT_SETTINGS.biteCloseUps).toBe(true);
    expect(loadSettings()).toEqual({ biteCloseUps: true });
  });

  it('Settings_(Saved)_ShouldRoundTripThroughStorage', () => {
    saveSettings({ biteCloseUps: false });
    expect(Object.keys(store)).toEqual(['rsl.settings.v1']);
    expect(loadSettings()).toEqual({ biteCloseUps: false });
  });

  it('Settings_(CorruptOrPartial)_ShouldFallBackToTheDefaults', () => {
    store['rsl.settings.v1'] = '{not json';
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    store['rsl.settings.v1'] = '{"biteCloseUps":"yes"}';
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('Settings_(StorageThrows)_ShouldNotThrow', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings({ biteCloseUps: false })).not.toThrow();
  });
});
