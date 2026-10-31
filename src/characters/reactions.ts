import type { Hero } from '../core/types';
import table from './reactions.json';

export type Emotion = 'idle' | 'happy' | 'excited' | 'scared' | 'sad';
export type TweenName =
  | 'none'
  | 'bounce'
  | 'leap'
  | 'somersault'
  | 'cower'
  | 'shake'
  | 'slump'
  | 'nod'
  | 'clap'
  | 'stomp'
  | 'fidget'
  | 'bless'
  | 'salute'
  | 'sigh';
export type ReactionEvent =
  | 'roll6'
  | 'ladder'
  | 'ladderBig'
  | 'snake'
  | 'snakeBig'
  | 'overtake'
  | 'overtaken'
  | 'nearMiss'
  | 'waiting'
  | 'tripleSix'
  | 'win'
  | 'lose';
export type Role = 'self' | 'other';

export interface Reaction {
  emotion: Emotion;
  intensity: number;
  tween: TweenName;
  durationMs: number;
}

export interface Timing {
  stepMs: number;
  fastStepMs: number;
  walkUnitsPerS: number;
  runUnitsPerS: number;
  fastRunUnitsPerS: number;
  walkMaxSquares: number;
  botDelayMs: number;
  bystanderStaggerMs: [number, number];
  bubbleMs: number;
  faceHoldMs: number;
}

type Table = { timing: Timing } & Record<Hero, Record<Role, Record<ReactionEvent, Reaction>>>;
const REACTIONS = table as unknown as Table;

export const TIMING: Timing = REACTIONS.timing;

export function reactionFor(hero: Hero, role: Role, event: ReactionEvent): Reaction {
  return REACTIONS[hero][role][event];
}

/** Fast mode halves every reaction and the face hold (T05 section 2). */
export function scaled(reaction: Reaction, fast: boolean): Reaction {
  return fast ? { ...reaction, durationMs: Math.round(reaction.durationMs / 2) } : reaction;
}

export function faceHoldMs(reaction: Reaction, fast: boolean): number {
  const hold = Math.max(reaction.durationMs, TIMING.faceHoldMs);
  return fast ? Math.round(hold / 2) : hold;
}
