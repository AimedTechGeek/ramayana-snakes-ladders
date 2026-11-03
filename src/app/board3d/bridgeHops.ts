// T45.3 Bridge hops: where a walk's path crosses the footprint of a risen bridge the hero is not using, the walk hops
// over the deck and parapets and lands back on the path. Pure (no three, no React). The footprint and the heights come
// from bridgeGeometry at runtime, so the hops follow whatever the terraces do to the decks.

import type { Hero } from '../../core/types';
import type { Vec2 } from '../../game/iso/boardIso';
import {
  distanceAt,
  durationOf,
  sampleAt,
  stepLeapBeats,
  type Gait,
  type LeapBeats,
  type Polyline,
} from '../../game/iso/locomotion';
import { groundHeightAt } from './boardLayout';
import { DECK_WIDTH, PARAPET_WIDTH, type Bridge, type DeckPoint } from './bridgeGeometry';
import { HALF, UNIT } from './coords';
import { leapProgress } from './crossing';

/** Highest point of a parapet post and its cap above the deck surface (bridges.py: post 0.105 + cap 0.014), rounded up. */
export const PARAPET_TOP = 0.12;
/** The feet clear the highest deck / parapet point under the path by at least this much (u). */
export const HOP_CLEARANCE = 0.06;
/** A bridge footprint reaches this far (u) from the deck centre line: half walkway + parapet + post outer edge (0.17 + 0.03). */
export const FOOTPRINT_HALF = DECK_WIDTH / 2 + PARAPET_WIDTH + 0.01;
/** Run-up and landing room before and after the footprint (u). */
export const HOP_PAD = 0.12;
/** Hanuman flies a little higher than the bridge strictly needs (u). */
export const HANUMAN_FLOURISH = 0.1;
/** One hop at normal speed, ms (at most 500): Hanuman a full leap, the others a lower, calmer bound. */
export const HOP_MS = { full: 500, calm: 440 } as const;
/** Lift shape over a hop at horizontal progress p (0..1): flat on top, 0 at take-off and landing. */
export function hopShape(p: number): number {
  return 1 - (2 * p - 1) ** 4;
}

/** Path sampling step for the footprint test, world units. */
const STEP = 0.5;
/** Finer step for the apex search, and a hair of margin for what falls between its samples (u). */
const APEX_STEP = 0.1;
const APEX_MARGIN = 0.01;

export interface Hop {
  /** Path distances (world units) where the hero takes off and lands. */
  d0: number;
  d1: number;
  /** Apex of the lift over the ground, three units. */
  apex: number;
  ms: number;
  beats: LeapBeats;
}

export interface HopPlan {
  hops: readonly Hop[];
  /** Total move time, ms: the walk (without the hop spans) plus every hop. */
  totalMs: number;
}

/** Duration of one hop: Fast halves it. */
export function hopMsFor(hero: Hero, fast: boolean): number {
  const ms = hero === 'hanuman' ? HOP_MS.full : HOP_MS.calm;
  return fast ? ms / 2 : ms;
}

/** The step-leap beats stretched to `ms`. */
function beatsFor(ms: number): LeapBeats {
  const base = stepLeapBeats(false);
  const scale = ms / (base[0] + base[1] + base[2] + base[3]);
  return [base[0] * scale, base[1] * scale, base[2] * scale, base[3] * scale];
}

function toThreeXZ(point: Vec2): [number, number] {
  return [(point[0] - HALF) * UNIT, (point[1] - HALF) * UNIT];
}

/** Horizontal distance from (px, pz) to the deck segment a-b, and the deck height at the nearest point of it. */
function underSegment(px: number, pz: number, a: DeckPoint, b: DeckPoint): [number, number] {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - a.x) * dx + (pz - a.z) * dz) / len2));
  return [Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t)), a.y + (b.y - a.y) * t];
}

const boxes = new WeakMap<Bridge['deck'], readonly [number, number, number, number]>();

/** Cheap reject: is (x, z) within the footprint distance of the deck's bounding box? */
function nearBox(x: number, z: number, deck: Bridge['deck']): boolean {
  let box = boxes.get(deck);
  if (!box) {
    box = [
      Math.min(...deck.map((p) => p.x)),
      Math.max(...deck.map((p) => p.x)),
      Math.min(...deck.map((p) => p.z)),
      Math.max(...deck.map((p) => p.z)),
    ];
    boxes.set(deck, box);
  }
  return (
    x > box[0] - FOOTPRINT_HALF && x < box[1] + FOOTPRINT_HALF && z > box[2] - FOOTPRINT_HALF && z < box[3] + FOOTPRINT_HALF
  );
}

/**
 * Height the feet must reach at three-space point (x, z): the highest deck + parapet point directly under it (the
 * deck height at the nearest point of every bridge whose footprint holds it), plus the clearance; -Infinity when no bridge is under the point.
 */
export function requiredHeightAt(x: number, z: number, risen: readonly Bridge[]): number {
  let need = -Infinity;
  for (const bridge of risen) {
    const deck = bridge.deck;
    if (!nearBox(x, z, deck)) continue;
    for (let i = 1; i < deck.length; i++) {
      const [distance, y] = underSegment(x, z, deck[i - 1]!, deck[i]!);
      if (distance < FOOTPRINT_HALF) need = Math.max(need, y + PARAPET_TOP + HOP_CLEARANCE);
    }
  }
  return need;
}

/** A walk shortened by hops can be shorter than its own ease-in and ease-out: it then walks at a steady pace. */
function walkGaitFor(gait: Gait, length: number): Gait {
  const rampUnits = (gait.rampMs / 1000) * gait.speed;
  return length < 2 * rampUnits ? { ...gait, rampMs: 0 } : gait;
}

/** The hops of a walk along `path` over the `risen` bridges (hidden ones must not be passed in). `stride` in world units. */
export function planHops(
  path: Polyline,
  risen: readonly Bridge[],
  hero: Hero,
  gait: Gait,
  fast: boolean,
  stride: number,
): HopPlan {
  const spans: { d0: number; d1: number }[] = [];
  if (risen.length > 0) {
    const pad = HOP_PAD / UNIT;
    let open: number | null = null;
    let lastInside = 0;
    // A footprint that begins or ends within one pad of the path's ends leaves no room to take off or land: the hero
    // rests beside that abutment (its fan slot) and walks on, as before T45.3.
    const close = (): void => {
      if (open !== null && open - pad >= 0 && lastInside + pad <= path.length) {
        spans.push({ d0: open - pad, d1: lastInside + pad });
      }
      open = null;
    };
    for (let d = 0; d <= path.length + STEP; d += STEP) {
      const at = Math.min(d, path.length);
      const [x, z] = toThreeXZ(sampleAt(path, at).point);
      if (requiredHeightAt(x, z, risen) > -Infinity) {
        open ??= at;
        lastInside = at;
      } else close();
      if (at === path.length) break;
    }
    close();
  }
  const merged: { d0: number; d1: number }[] = [];
  for (const span of spans) {
    const prev = merged[merged.length - 1];
    if (prev && span.d0 - prev.d1 < stride) prev.d1 = Math.max(prev.d1, span.d1);
    else merged.push({ ...span });
  }
  const ms = hopMsFor(hero, fast);
  const hops = merged.map(({ d0, d1 }): Hop => {
    let apex = 0;
    for (let d = d0; d <= d1 + 1e-9; d += APEX_STEP) {
      const p = Math.min(1, (d - d0) / (d1 - d0));
      const [x, z] = toThreeXZ(sampleAt(path, Math.min(d, path.length)).point);
      const need = requiredHeightAt(x, z, risen);
      if (need === -Infinity) continue;
      apex = Math.max(apex, (need - groundHeightAt(x, z)) / Math.max(hopShape(p), 0.05));
    }
    return { d0, d1, apex: apex + APEX_MARGIN + (hero === 'hanuman' ? HANUMAN_FLOURISH : 0), ms, beats: beatsFor(ms) };
  });
  const hopSpan = hops.reduce((sum, hop) => sum + (hop.d1 - hop.d0), 0);
  const walkLength = path.length - hopSpan;
  const hopTime = hops.reduce((sum, hop) => sum + hop.ms, 0);
  return { hops, totalMs: durationOf(walkLength, walkGaitFor(gait, walkLength), fast) + hopTime };
}

export interface HopSample {
  /** Distance along the path, world units. */
  d: number;
  /** Walking distance without the hop spans: drives the gait phase. */
  walked: number;
  /** Extra height above the ground, three units (0 when walking). */
  lift: number;
  /** Set while hopping: `ms` into the hop's beats. */
  leap: { ms: number; beats: LeapBeats } | null;
}

/** Smallest walking-clock fraction u at which `distanceAt` reaches `target`. */
function timeFractionOf(target: number, length: number, gait: Gait, fast: boolean): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (distanceAt(mid, length, gait, fast) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Where the hero is `ms` into a walk with hops: the walk's ease runs on the walking clock, which stops during a hop. */
export function sampleHopWalk(plan: HopPlan, pathLength: number, walkGait: Gait, fast: boolean, ms: number): HopSample {
  const hopSpan = plan.hops.reduce((sum, hop) => sum + (hop.d1 - hop.d0), 0);
  const walkLength = pathLength - hopSpan;
  const gait = walkGaitFor(walkGait, walkLength);
  const walkMs = durationOf(walkLength, gait, fast);
  let hopsBefore = 0; // time of the finished hops
  let spanBefore = 0; // path distance they covered
  for (const hop of plan.hops) {
    const walkedAtTakeoff = hop.d0 - spanBefore;
    const start = timeFractionOf(walkedAtTakeoff, walkLength, gait, fast) * walkMs + hopsBefore;
    if (ms < start) break;
    if (ms < start + hop.ms) {
      const into = ms - start;
      const p = leapProgress(into, hop.beats);
      return {
        d: hop.d0 + (hop.d1 - hop.d0) * p,
        walked: walkedAtTakeoff,
        lift: hop.apex * hopShape(p),
        leap: { ms: into, beats: hop.beats },
      };
    }
    hopsBefore += hop.ms;
    spanBefore += hop.d1 - hop.d0;
  }
  const clock = Math.min(walkMs, Math.max(0, ms - hopsBefore));
  const walked = walkMs === 0 ? walkLength : distanceAt(clock / walkMs, walkLength, gait, fast);
  return { d: walked + spanBefore, walked, lift: 0, leap: null };
}

/** Reduced motion glides at constant speed: no leap clip, only the lift over each hop span. */
export function glideLift(plan: HopPlan, d: number): number {
  for (const hop of plan.hops) {
    if (d >= hop.d0 && d <= hop.d1) return hop.apex * hopShape((d - hop.d0) / (hop.d1 - hop.d0));
  }
  return 0;
}
