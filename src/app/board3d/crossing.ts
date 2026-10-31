// How a token crosses a bridge (T44 6.5): leap onto the deck, run along it, leap off; one leap for a short bridge;
// Hanuman alone takes `hanuman-leap` (95 -> 122) in a single long leap. Pure timing, no three: the view samples the
// path by arc length `t` (0 = foot square, 1 = top square: field centre, deck, field centre) and adds the hop height.

import type { Hero } from '../../core/types';
import type { Beats } from './heroClips';

/** Leap beats in ms: anticipation, takeoff, flight, land (T43 / T44 6.5). */
export const STEP_BEATS: Beats = [160, 80, 180, 120];
export const STEP_BEATS_FAST: Beats = [30, 20, 40, 30];
export const LONG_LEAP_BEATS: Beats = [200, 80, 700, 120];
export const LONG_LEAP_BEATS_FAST: Beats = [40, 20, 130, 30];
/** Step-on and step-off cover this much ground (u), each, when the caller does not measure it. */
export const STEP_LENGTH = 0.25;
/** Apex of a step leap above the deck (u). */
export const STEP_HOP = 0.14;
/** The long leap clears the deck apex by this much (u). */
export const LONG_LEAP_CLEARANCE = 0.25;
/** Bridges shorter than this are one leap, foot to top (shabari). */
export const SHORT_BRIDGE = 0.5;
/** Deck run speed, u/s (T44 4.6: 5.0; Fast 20 since T44.14, so a 4-bot Fast game fits a minute). */
export const RUN_SPEED = 5;
export const RUN_SPEED_FAST = 20;

export interface LeapSegment {
  kind: 'leap';
  /** Arc-length fractions of the bridge curve the leap starts and lands at. */
  t0: number;
  t1: number;
  beats: Beats;
  /** Extra height at mid-flight over the straight line between the two points (u). */
  hop: number;
  ms: number;
}

export interface RunSegment {
  kind: 'run';
  t0: number;
  t1: number;
  ms: number;
}

export type CrossingSegment = LeapSegment | RunSegment;

export interface CrossingInput {
  /** Story id of the bridge (`hanuman-leap`, `shabari`, ...). */
  id: string;
  hero: Hero;
  /** Deck arc length, abutment to abutment, u (the run covers all of it). */
  length: number;
  /** Ground the step-on and step-off leaps cover before and after the deck (field centre to abutment), u. */
  leadIn?: number;
  leadOut?: number;
  /** How far the deck apex rises above the straight foot-to-top line, u. */
  apexRise: number;
  fast: boolean;
}

function leap(t0: number, t1: number, beats: Beats, hop: number): LeapSegment {
  return { kind: 'leap', t0, t1, beats, hop, ms: beats[0] + beats[1] + beats[2] + beats[3] };
}

/** The segments of one crossing, in order; their `ms` add up to the crossing time. */
export function crossingPlan({
  id,
  hero,
  length,
  leadIn = STEP_LENGTH,
  leadOut = STEP_LENGTH,
  apexRise,
  fast,
}: CrossingInput): CrossingSegment[] {
  const step = fast ? STEP_BEATS_FAST : STEP_BEATS;
  if (hero === 'hanuman' && id === 'hanuman-leap') {
    return [leap(0, 1, fast ? LONG_LEAP_BEATS_FAST : LONG_LEAP_BEATS, apexRise + LONG_LEAP_CLEARANCE)];
  }
  if (length < SHORT_BRIDGE) return [leap(0, 1, step, STEP_HOP)];
  // t runs over the whole path: step-on ground, the deck, step-off ground
  const total = leadIn + length + leadOut;
  const on = leadIn / total;
  const off = 1 - leadOut / total;
  return [
    leap(0, on, step, STEP_HOP),
    { kind: 'run', t0: on, t1: off, ms: (length / (fast ? RUN_SPEED_FAST : RUN_SPEED)) * 1000 },
    leap(off, 1, step, STEP_HOP),
  ];
}

/** Total crossing time, ms. */
export function crossingMs(plan: readonly CrossingSegment[]): number {
  return plan.reduce((sum, segment) => sum + segment.ms, 0);
}

/**
 * Horizontal progress 0..1 of a leap `ms` into its beats: still through the anticipation, moving through takeoff and
 * flight, landed for the last beat.
 */
export function leapProgress(ms: number, beats: Beats): number {
  const moving = beats[1] + beats[2];
  if (moving <= 0) return ms >= beats[0] ? 1 : 0;
  return Math.min(1, Math.max(0, (ms - beats[0]) / moving));
}

/** Height over the straight line at progress `p` of a leap with apex `hop`. */
export function hopHeight(p: number, hop: number): number {
  return hop * 4 * p * (1 - p);
}
