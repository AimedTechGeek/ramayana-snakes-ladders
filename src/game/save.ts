import { MAX_PLAYERS, MIN_PLAYERS } from '../core/game';
import type { GameState, Hero, Level } from '../core/types';
import { HERO_ORDER } from './heroes';

const SAVE_KEY = 'rsl.save.v1';
const SAVE_VERSION = 1;
const LEVELS: readonly Level[] = ['easy', 'medium', 'hard'];

interface SaveFile {
  version: number;
  state: GameState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlayer(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    HERO_ORDER.includes(value.hero as Hero) &&
    (value.controller === 'human' || value.controller === 'bot') &&
    typeof value.name === 'string' &&
    typeof value.position === 'number' &&
    (value.rank === null || typeof value.rank === 'number')
  );
}

function isGameState(value: unknown): value is GameState {
  if (!isRecord(value)) return false;
  const players = value.players;
  const current = value.current;
  return (
    LEVELS.includes(value.level as Level) &&
    typeof value.playOn === 'boolean' &&
    typeof value.over === 'boolean' &&
    Array.isArray(players) &&
    players.length >= MIN_PLAYERS &&
    players.length <= MAX_PLAYERS &&
    players.every(isPlayer) &&
    typeof current === 'number' &&
    Number.isInteger(current) &&
    current >= 0 &&
    current < players.length &&
    typeof value.sixesThisTurn === 'number' &&
    typeof value.turnStartPosition === 'number'
  );
}

/** Writes the game to localStorage. Returns false when storage is unavailable or full. */
export function saveGame(state: GameState): boolean {
  const file: SaveFile = { version: SAVE_VERSION, state };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
    return true;
  } catch {
    // Storage can throw (private mode, quota, blocked site data); the game simply is not saved.
    return false;
  }
}

/** Returns the saved game, or null when there is none, the JSON is corrupt, the version differs or the shape is invalid. */
export function loadGame(): GameState | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    // Storage can throw; treat it as having no save.
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON is treated as no save.
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== SAVE_VERSION || !isGameState(parsed.state)) return null;
  return parsed.state;
}

/** Removes the save. Returns false when storage is unavailable. */
export function clearSave(): boolean {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch {
    // Storage can throw; nothing was removed.
    return false;
  }
}
