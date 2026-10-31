import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSave, loadGame, saveGame } from '../src/game/save';
import type { GameState } from '../src/core/types';
import { createRevealState } from '../src/game/reveal';

const reveal = { terrain: [1, 2, 7, 42], jumps: [17] };

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

  it('Save_ThenLoad_Should_RoundTripStateAndReveal', () => {
    expect(saveGame(state, reveal)).toBe(true);
    expect(loadGame()).toEqual({ state, reveal });
  });

  it('Load_CorruptJson_Should_ReturnNull', () => {
    localStorage.setItem('rsl.save.v1', '{not json');
    expect(loadGame()).toBeNull();
  });

  it('Load_V1Save_Should_MigrateBySeedingRevealFromPlayerPositions', () => {
    localStorage.setItem('rsl.save.v1', JSON.stringify({ version: 1, state }));
    expect(loadGame()).toEqual({ state, reveal: { terrain: [42, 7], jumps: [] } });
  });

  it('Load_V2SaveWithCorruptRevealShape_Should_ReturnNull', () => {
    const badShapes = [
      undefined,
      null,
      { terrain: 'x', jumps: [] },
      { terrain: [1], jumps: [1.5] },
      { terrain: [999], jumps: [] },
    ];
    for (const bad of badShapes) {
      localStorage.setItem('rsl.save.v1', JSON.stringify({ version: 2, state, reveal: bad }));
      expect(loadGame()).toBeNull();
    }
  });

  it('Load_WrongVersion_Should_ReturnNull', () => {
    localStorage.setItem('rsl.save.v1', JSON.stringify({ version: 3, state, reveal }));
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
    expect(saveGame(state, createRevealState())).toBe(false);
    expect(loadGame()).toBeNull();
    expect(clearSave()).toBe(false);
  });

  it('Clear_Should_RemoveSave', () => {
    saveGame(state, reveal);
    expect(clearSave()).toBe(true);
    expect(loadGame()).toBeNull();
  });
});
