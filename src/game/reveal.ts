import type { GameEvent } from '../core/events';
import { FINAL_SQUARE, type GameState } from '../core/types';

/** A jump is identified by the square its head or foot sits on; the engine allows one jump per square. */
export type JumpId = number;

/** Serialisable fog-of-war state: squares whose terrain is revealed, and jumps (snakes/ladders) that are revealed. */
export interface RevealState {
  terrain: number[];
  jumps: JumpId[];
}

/** One newly revealed thing, in the order it should be animated. */
export type RevealChange =
  { kind: 'terrain'; square: number } | { kind: 'jump'; jumpId: JumpId; jumpType: 'ladder' | 'snake' };

/** Everything is fogged unless the caller lists squares to reveal up front. */
export function createRevealState(initiallyRevealed: readonly number[] = []): RevealState {
  const state: RevealState = { terrain: [], jumps: [] };
  initiallyRevealed.forEach((square) => revealTerrain(state, square));
  return state;
}

/** Owner decision T42 10.1: the gate (square 1) and the throne (square 144) are known before the first roll. */
export function newGameReveal(): RevealState {
  return createRevealState([1, FINAL_SQUARE]);
}

export function isTerrainRevealed(state: RevealState, square: number): boolean {
  return state.terrain.includes(square);
}

export function isJumpRevealed(state: RevealState, jumpId: JumpId): boolean {
  return state.jumps.includes(jumpId);
}

function revealTerrain(state: RevealState, square: number): RevealChange[] {
  // Square 0 is off-board (tokens have not entered yet).
  if (square < 1 || isTerrainRevealed(state, square)) return [];
  state.terrain.push(square);
  return [{ kind: 'terrain', square }];
}

function revealJump(state: RevealState, jumpId: JumpId, jumpType: 'ladder' | 'snake'): RevealChange[] {
  if (isJumpRevealed(state, jumpId)) return [];
  state.jumps.push(jumpId);
  return [{ kind: 'jump', jumpId, jumpType }];
}

/**
 * Applies one engine event, mutating the state, and returns what became newly revealed (in order).
 * - Moved: terrain of every square passed through or landed on (bounce-back squares are part of the path).
 * - Laddered / Bitten: the jump on the landing square, then the terrain of the square the token arrives on.
 *   A snake never reveals anything between its head and tail.
 * - TripleSixVoid, Bounced and all other events reveal nothing: the token only returns to a square it already stood on.
 */
export function applyEvent(state: RevealState, event: GameEvent): RevealChange[] {
  switch (event.type) {
    case 'Moved':
      return event.path.flatMap((square) => revealTerrain(state, square));
    case 'Laddered':
      return [...revealJump(state, event.jump.from, 'ladder'), ...revealTerrain(state, event.jump.to)];
    case 'Bitten':
      return [...revealJump(state, event.jump.from, 'snake'), ...revealTerrain(state, event.jump.to)];
    default:
      return [];
  }
}

export function applyEvents(state: RevealState, events: readonly GameEvent[]): RevealChange[] {
  return events.flatMap((event) => applyEvent(state, event));
}

/**
 * Rebuilds reveal state for a game that has none (a v1 save). Only what is provable is revealed: the terrain
 * under each player's current square. Squares passed earlier and jumps triggered earlier are unknown, so they
 * stay fogged rather than guessed from positions (a player on square 100 may have got there by a ladder).
 */
export function seedFromGameState(state: GameState): RevealState {
  return createRevealState(state.players.map((player) => player.position));
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

/** Shape check for loaded data: integer arrays, no duplicates, terrain squares on the board. */
export function isRevealState(value: unknown): value is RevealState {
  if (typeof value !== 'object' || value === null) return false;
  const { terrain, jumps } = value as Record<string, unknown>;
  if (!isIntegerArray(terrain) || !isIntegerArray(jumps)) return false;
  return (
    terrain.every((square) => square >= 1 && square <= FINAL_SQUARE) &&
    new Set(terrain).size === terrain.length &&
    new Set(jumps).size === jumps.length
  );
}
