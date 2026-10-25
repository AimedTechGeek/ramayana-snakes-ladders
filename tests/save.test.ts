import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave, loadGame, saveGame } from '../src/game/save';
import type { GameState } from '../src/core/types';

const state: GameState = {
  level: 'medium',
  playOn: false,
  players: [
    { hero: 'rama', controller: 'human', name: 'Asha', position: 42, rank: null },
    { hero: 'hanuman', controller: 'bot', name: 'Hanuman', position: 7, rank: null },
  ],
  current: 1,
  sixesThisTurn: 0,
  turnStartPosition: 7,
  over: false,
};

function fakeStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, String(value));
    },
  };
}

describe('save', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Save_ThenLoad_Should_RoundTripState', () => {
    expect(saveGame(state)).toBe(true);
    expect(loadGame()).toEqual(state);
  });

  it('Load_CorruptJson_Should_ReturnNull', () => {
    localStorage.setItem('rsl.save.v1', '{not json');
    expect(loadGame()).toBeNull();
  });

  it('Load_WrongVersion_Should_ReturnNull', () => {
    localStorage.setItem('rsl.save.v1', JSON.stringify({ version: 2, state }));
    expect(loadGame()).toBeNull();
  });

  it('Storage_Throwing_Should_NotCrash', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', broken);
    expect(saveGame(state)).toBe(false);
    expect(loadGame()).toBeNull();
    expect(clearSave()).toBe(false);
  });

  it('Clear_Should_RemoveSave', () => {
    saveGame(state);
    expect(clearSave()).toBe(true);
    expect(loadGame()).toBeNull();
  });
});
