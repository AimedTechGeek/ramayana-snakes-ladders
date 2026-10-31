// Bridge runtime rules (T42.9, spec 6.4 and 6.6). Pure, no Phaser: segment fading, deck interpolation, the crossing
// timeline and the depth of a token on a bridge. The sprites and tweens live in BridgeActor.ts.

import { toScreen } from '../iso/boardIso';
import {
  facingOf,
  gaitFor,
  leapMs,
  longLeapBeats,
  stepLeapBeats,
  type Facing,
  type LeapBeats,
  type Motion,
} from '../iso/locomotion';
import { HOP_HEIGHT, type TokenPose } from '../iso/tokenPose';
import { CELL, SIZE, TOP_Z } from '../iso/world';
import { BAND } from './boardBands';

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

/** One frame of the bridges sheet sidecar (`<id>.r<row>`). */
export interface BridgeFrameMeta {
  bridge: string;
  row: number;
  order: number;
  world: Vec2;
  depthKey: number;
  crossed: readonly number[];
}

/** One entry of the sidecar's `bridges` table. `deck[i]` and `route[i]` share the arc length `deck[i][0]`. */
export interface BridgeMeta {
  from: number;
  to: number;
  length: number;
  segments: readonly string[];
  crossed: readonly number[];
  deck: readonly Vec2[];
  route: readonly Vec2[];
}

/** A built segment: its frame plus its draw depth (`standingDepth(depthKey)`, spec 6.4 rule 2). */
export interface BridgeSegment extends BridgeFrameMeta {
  name: string;
  depth: number;
}

/** Spec 6.6 timings (ms): one hop of the walk. */
export const HOP_MS = 140;
export const FAST_HOP_MS = 50;
/** Deck distance one crossing hop covers. */
export const HOP_LENGTH = 28;
/** Apex of a crossing hop over the deck, world units. */
export const CROSS_HOP_HEIGHT = 8;
/** Segments fade to this alpha while a token rests on a square they cover, over FADE_MS. */
export const BEHIND_ALPHA = 0.35;
export const FADE_MS = 150;
/** The crossing token draws this far in front of the segment whose band it is in. */
export const TOKEN_OVER_SEGMENT = 0.5;

export function segmentsOf(
  bridge: BridgeMeta,
  frames: Readonly<Record<string, BridgeFrameMeta>>,
): BridgeSegment[] {
  return bridge.segments.map((name) => {
    const frame = frames[name];
    if (!frame) throw new Error(`Bridge sheet has no frame ${name}`);
    return { ...frame, name, depth: BAND.standing + frame.depthKey };
  });
}

/** Names of the segments that must be faded: those whose `crossed` holds a square a token rests on (rule 3). */
export function fadedSegments(
  segments: readonly BridgeSegment[],
  tokenSquares: readonly number[],
): Set<string> {
  const faded = new Set<string>();
  for (const segment of segments) {
    if (segment.crossed.some((square) => tokenSquares.includes(square))) faded.add(segment.name);
  }
  return faded;
}

function between(bridge: BridgeMeta, s: number): { i: number; t: number } {
  const { deck } = bridge;
  let i = 0;
  while (i < deck.length - 2 && deck[i + 1]![0] <= s) i++;
  const s0 = deck[i]![0];
  const s1 = deck[i + 1]![0];
  return { i, t: Math.min(1, Math.max(0, (s - s0) / (s1 - s0))) };
}

/** Deck height `z(s)` at arc length `s` along the route, interpolated from the manifest samples. */
export function deckHeight(bridge: BridgeMeta, s: number): number {
  const { i, t } = between(bridge, s);
  const z0 = bridge.deck[i]![1];
  const z1 = bridge.deck[i + 1]![1];
  return z0 + (z1 - z0) * t;
}

/** World (x, y) of the route at arc length `s`. */
export function routeAt(bridge: BridgeMeta, s: number): Vec2 {
  const { i, t } = between(bridge, s);
  const a = bridge.route[i]!;
  const b = bridge.route[i + 1]!;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The 1-based row band of a world y (`floor((672 - y) / 56) + 1`, the frame names' `r<row>`). */
export function rowOfY(y: number): number {
  return Math.floor((SIZE - y) / CELL) + 1;
}

/** Draw depth of a token on the bridge at world y: the segment of its band + 0.5 (rule 4). */
export function crossingDepth(segments: readonly BridgeSegment[], y: number): number {
  const rows = segments.map((segment) => segment.row);
  const row = Math.min(Math.max(...rows), Math.max(Math.min(...rows), rowOfY(y)));
  const segment = segments.find((candidate) => candidate.row === row);
  if (!segment) throw new Error(`No segment in row ${row}`);
  return segment.depth + TOKEN_OVER_SEGMENT;
}

export type HopKind = 'on' | 'cross' | 'off';

/** One hop of the walk: step onto the foot abutment, `ceil(L / 28)` hops along the deck, step off to the top square. */
export interface WalkHop {
  kind: HopKind;
  /** Arc lengths the hop spans (the step on is 0..0, the step off L..L). */
  sFrom: number;
  sTo: number;
  /** Ground (x, y) the hop starts and ends at. */
  from: Vec2;
  to: Vec2;
}

export function crossingHopCount(bridge: BridgeMeta): number {
  return Math.ceil(bridge.length / HOP_LENGTH);
}

/** The full walk from the token's resting spot `start` on the foot to its resting spot `end` on the top square. */
export function walkHops(bridge: BridgeMeta, start: Vec2, end: Vec2): WalkHop[] {
  const count = crossingHopCount(bridge);
  const at = (k: number) => (bridge.length * k) / count;
  const hops: WalkHop[] = [{ kind: 'on', sFrom: 0, sTo: 0, from: start, to: routeAt(bridge, 0) }];
  for (let k = 0; k < count; k++) {
    hops.push({
      kind: 'cross',
      sFrom: at(k),
      sTo: at(k + 1),
      from: routeAt(bridge, at(k)),
      to: routeAt(bridge, at(k + 1)),
    });
  }
  hops.push({
    kind: 'off',
    sFrom: bridge.length,
    sTo: bridge.length,
    from: routeAt(bridge, bridge.length),
    to: end,
  });
  return hops;
}

/**
 * Which hop of a walk of `count` equal hops is under way at overall progress `u` (0..1), and how far through it.
 * One tween drives the whole walk, so the hops run back to back by the clock (no frame lost between hops).
 */
export function hopAtProgress(count: number, u: number): { index: number; u: number } {
  const scaled = Math.min(count, Math.max(0, u * count));
  const index = Math.min(count - 1, Math.floor(scaled));
  return { index, u: scaled - index };
}

export function hopMs(fast: boolean): number {
  return fast ? FAST_HOP_MS : HOP_MS;
}

/** Duration of the crossing itself (the deck hops, spec 6.6 step 3): vishwamitra 7 hops = 980 ms. */
export function crossingMs(bridge: BridgeMeta, fast: boolean): number {
  return crossingHopCount(bridge) * hopMs(fast);
}

/** Duration of the whole walk: step on, the crossing and step off. */
export function walkMs(bridge: BridgeMeta, fast: boolean): number {
  return (crossingHopCount(bridge) + 2) * hopMs(fast);
}

/** Feet point (world) of a hop at progress `u`: along the route with `z = deck z(s) + 8 * 4u(1 - u)` on the deck. */
export function hopPoint(bridge: BridgeMeta, hop: WalkHop, u: number): Vec3 {
  const arc = 4 * u * (1 - u);
  if (hop.kind === 'cross') {
    const s = hop.sFrom + (hop.sTo - hop.sFrom) * u;
    const [x, y] = routeAt(bridge, s);
    return [x, y, deckHeight(bridge, s) + CROSS_HOP_HEIGHT * arc];
  }
  const [x0, y0] = hop.from;
  const [x1, y1] = hop.to;
  const deckZ = deckHeight(bridge, hop.sFrom);
  const [zFrom, zTo] = hop.kind === 'on' ? [TOP_Z, deckZ] : [deckZ, TOP_Z];
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, zFrom + (zTo - zFrom) * u + HOP_HEIGHT * arc];
}

/**
 * The token pose of a hop at progress `u`. The shadow sits at the height the hop started from (no arc), and the depth is
 * the segment of the token's band + 0.5, not its own floor key.
 */
export function bridgePose(
  bridge: BridgeMeta,
  segments: readonly BridgeSegment[],
  hop: WalkHop,
  u: number,
): TokenPose {
  const [x, y, z] = hopPoint(bridge, hop, u);
  const arcHeight = hop.kind === 'cross' ? CROSS_HOP_HEIGHT : HOP_HEIGHT;
  const arc = 4 * u * (1 - u);
  return {
    feet: toScreen([x, y, z]),
    ground: toScreen([x, y, z - arcHeight * arc]),
    depth: crossingDepth(segments, y),
    lift: arc,
  };
}

// ---- T43.2: Hanuman leaps on, runs the deck and leaps off (spec 4). The hop walk above stays for the medallions.

/** A footbridge shorter than this is one leap, not leap-run-leap (spec 4, shabari 15). */
export const SINGLE_LEAP_BELOW = 28;
/** Apex over the chord of a step on or off (spec 4: +8) and of a single leap over a short footbridge. */
export const STEP_LEAP_APEX = 8;
/** `hanuman-leap`: apex z = deck apex 22.4 + 14 (spec 4), as height over the chord between two tile tops. */
export const LONG_LEAP_APEX_Z = 22.4 + 14;

/** The facing the token keeps all the way over the bridge: the route direction (spec 2). */
export function routeFacing(bridge: BridgeMeta): Facing {
  const first = bridge.route[0]!;
  const last = bridge.route[bridge.route.length - 1]!;
  return facingOf([last[0] - first[0], last[1] - first[1]], 'SW');
}

/** `hanuman-leap` (his own story) and any footbridge shorter than 28 units are one leap, no run. */
export function isSingleLeap(bridge: BridgeMeta, id: string): boolean {
  return id === 'hanuman-leap' || bridge.length < SINGLE_LEAP_BELOW;
}

export interface CrossingTimeline {
  single: boolean;
  /** Beats of the one leap, or of the step on. */
  onBeats: LeapBeats;
  /** Time of the run along the deck (0 for a single leap). */
  runMs: number;
  /** Beats of the step off (absent for a single leap). */
  offBeats: LeapBeats | null;
  totalMs: number;
}

/** The three phases of a crossing (leap on, run, leap off) or the one leap; Fast halves the leaps and doubles the run speed. */
export function crossingTimeline(bridge: BridgeMeta, id: string, fast: boolean): CrossingTimeline {
  if (isSingleLeap(bridge, id)) {
    const beats = id === 'hanuman-leap' ? longLeapBeats(fast) : stepLeapBeats(fast);
    return { single: true, onBeats: beats, runMs: 0, offBeats: null, totalMs: leapMs(beats) };
  }
  const beats = stepLeapBeats(fast);
  const runMs = (bridge.length / gaitFor(3, fast).speed) * 1000;
  return { single: false, onBeats: beats, runMs, offBeats: beats, totalMs: leapMs(beats) * 2 + runMs };
}

/** The pose of a leap from `from` to `to` (world x, y, z) at air progress `u`, over a chord apex of `apex` units. */
export function leapPose(
  segments: readonly BridgeSegment[],
  from: Vec3,
  to: Vec3,
  apex: number,
  u: number,
  motion: Motion,
): TokenPose {
  const arc = 4 * u * (1 - u);
  const at = (k: number) => from[k]! + (to[k]! - from[k]!) * u;
  const x = at(0);
  const y = at(1);
  const ground = at(2);
  return {
    feet: toScreen([x, y, ground + apex * arc]),
    ground: toScreen([x, y, ground]),
    depth: crossingDepth(segments, y),
    lift: arc,
    motion,
  };
}

/** The pose of the run along the deck at arc length `s`: on the deck, shadow under the feet. */
export function runPose(
  bridge: BridgeMeta,
  segments: readonly BridgeSegment[],
  s: number,
  motion: Motion,
): TokenPose {
  const [x, y] = routeAt(bridge, s);
  const z = deckHeight(bridge, s);
  return {
    feet: toScreen([x, y, z]),
    ground: toScreen([x, y, z]),
    depth: crossingDepth(segments, y),
    lift: 0,
    motion,
  };
}
