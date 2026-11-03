// The named stages of the board (T46.5): which part of the Ramayana each square belongs to. One stage per board region
// in story order (the regions of blockRules.regionOf; the Dandaka stage spans the forest and the Ganga squares inside
// it), plus the start block (square 1, the Ayodhya gate) and the throne (square 144) as stages of their own.
// Names, Kandas and one-line stories are i18n strings: `ui.stage.<id>.name|kanda|line` (the Hindi ones are marked for a
// native check in docs/design/T46-brothers-and-stages.md). No DOM, no three.

import { FINAL_SQUARE, type RegionName } from './board/blockRules';
import type { GameState } from '../core/types';

export type StageId = 'start' | 'mithila' | 'ayodhya' | 'dandaka' | 'kishkindha' | 'sea' | 'lanka' | 'throne';

export interface Stage {
  id: StageId;
  /** First and last square of the stage, inclusive. */
  from: number;
  to: number;
  /** The board regions (`regionOf`) the stage spans. */
  regions: readonly RegionName[];
}

/** The stages in board order; together they cover squares 1..144 exactly once. */
export const STAGES: readonly Stage[] = [
  { id: 'start', from: 1, to: 1, regions: ['mithila'] },
  { id: 'mithila', from: 2, to: 36, regions: ['mithila'] },
  { id: 'ayodhya', from: 37, to: 48, regions: ['ayodhya'] },
  { id: 'dandaka', from: 49, to: 84, regions: ['dandaka', 'ganga'] },
  { id: 'kishkindha', from: 85, to: 108, regions: ['kishkindha'] },
  { id: 'sea', from: 109, to: 120, regions: ['sea'] },
  { id: 'lanka', from: 121, to: FINAL_SQUARE - 1, regions: ['lanka'] },
  { id: 'throne', from: FINAL_SQUARE, to: FINAL_SQUARE, regions: ['lanka'] },
];

export const STAGE_IDS: readonly StageId[] = STAGES.map((stage) => stage.id);

export function isStageId(value: unknown): value is StageId {
  return typeof value === 'string' && (STAGE_IDS as readonly string[]).includes(value);
}

export function stageOf(square: number): StageId {
  const stage = STAGES.find((candidate) => square >= candidate.from && square <= candidate.to);
  if (!stage) throw new Error(`square out of range: ${square}`);
  return stage.id;
}

/** i18n key of a stage's name, Kanda or one-line story. */
export function stageKey(id: StageId, part: 'name' | 'kanda' | 'line'): string {
  return `ui.stage.${id}.${part}`;
}

/**
 * The stages a game in `state` has been through, for a save made before stages were recorded: the start and every
 * stage that begins at or before the furthest token (the throne only once it has been won, so a resumed game still
 * gets its coronation card).
 */
export function seedStages(state: GameState): StageId[] {
  const furthest = Math.max(0, ...state.players.map((player) => player.position));
  const won = state.players.some((player) => player.rank !== null);
  return STAGES.filter(
    (stage) => stage.id === 'start' || (stage.from <= furthest && (stage.id !== 'throne' || won)),
  ).map((stage) => stage.id);
}
