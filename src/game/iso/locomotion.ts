// How Hanuman walks (T43 spec sections 2, 4 and 6.1). Pure, no Phaser: facing from a move vector, the gait of a move,
// the polyline a token follows, the distance-over-time profile and the clip phase (the frame index comes from the
// distance walked, so the feet do not slide), plus the time-driven beats of a leap.

import { TIMING } from '../../characters/reactions';
import { fieldCentre, type Vec2 } from './boardIso';

/** World directions: SE +x, SW +y, NW -x, NE -y (spec 2). SW is the rest facing. */
export type Facing = 'SE' | 'SW' | 'NW' | 'NE';
export type ClipName = 'idle' | 'walk' | 'run' | 'leap' | 'happy' | 'excited' | 'scared' | 'sad';
/** What a token is doing this frame; absent on a pose means rest (SW, the current emotion). */
export interface Motion {
  facing: Facing;
  clip: ClipName;
  /** 0..1 of the cycle (walk, run) or of the beat sequence (leap, see `leapPhaseAt`). */
  phase: number;
}

const AXES: readonly (readonly [Facing, number, number])[] = [
  ['SE', 1, 0],
  ['SW', 0, 1],
  ['NW', -1, 0],
  ['NE', 0, -1],
];
const TIE = 1e-9;

/** The facing of a move vector: the axis with the largest dot product; a tie keeps `previous`. */
export function facingOf(dir: Vec2, previous: Facing): Facing {
  const length = Math.hypot(dir[0], dir[1]);
  if (length === 0) return previous;
  const scored = AXES.map(([facing, ax, ay]) => ({ facing, score: (dir[0] * ax + dir[1] * ay) / length }));
  const best = Math.max(...scored.map((s) => s.score));
  const tied = scored.filter((s) => best - s.score <= TIE);
  return tied.find((s) => s.facing === previous)?.facing ?? tied[0]!.facing;
}

export interface Gait {
  clip: 'walk' | 'run';
  /** World units per second at cruise. */
  speed: number;
  /** World units of one full cycle of the clip. */
  cycle: number;
  /** Frames in the clip. */
  frames: number;
  /** Extra time the ease-in and ease-out add over cruising the whole way (spec 4: 120 ms walk, 100 ms run). */
  rampMs: number;
}

const WALK_FRAMES = 8;
const WALK_CYCLE = 32;
const RUN_FRAMES = 6;
const RUN_CYCLE = 56;
const WALK_RAMP_MS = 120;
const RUN_RAMP_MS = 100;
/** Spec 4: ease in over the first 12 units and out over the last 16 at run speed; the walk keeps the same 12:16 ratio. */
const RAMP_IN_SHARE = 12 / 28;

/** One gait per move: walk up to `walkMaxSquares` squares at 80 u/s, run beyond at 280; Fast always runs at 560. */
export function gaitFor(squares: number, fast: boolean): Gait {
  if (fast) {
    return { clip: 'run', speed: TIMING.fastRunUnitsPerS, cycle: RUN_CYCLE, frames: RUN_FRAMES, rampMs: 0 };
  }
  if (squares <= TIMING.walkMaxSquares) {
    return {
      clip: 'walk',
      speed: TIMING.walkUnitsPerS,
      cycle: WALK_CYCLE,
      frames: WALK_FRAMES,
      rampMs: WALK_RAMP_MS,
    };
  }
  return {
    clip: 'run',
    speed: TIMING.runUnitsPerS,
    cycle: RUN_CYCLE,
    frames: RUN_FRAMES,
    rampMs: RUN_RAMP_MS,
  };
}

export interface Polyline {
  points: readonly Vec2[];
  /** Distance along the polyline at each point. */
  at: readonly number[];
  length: number;
  /** Distance at which each square's field centre is reached (the last one: the end of the path). */
  centreAt: readonly number[];
}

/** The fan slot is blended in over this many units before the last square's centre. */
const FAN_BLEND = 20;

/** The polyline from `from` through the field centre of every square, ending at the resting spot of the last square. */
export function pathOf(from: Vec2, squares: readonly number[], finalSpot: Vec2): Polyline {
  const points: Vec2[] = [from];
  const at: number[] = [0];
  const centreAt: number[] = [];
  const push = (point: Vec2): void => {
    const last = points[points.length - 1]!;
    const step = Math.hypot(point[0] - last[0], point[1] - last[1]);
    if (step === 0) return;
    points.push(point);
    at.push(at[at.length - 1]! + step);
  };
  squares.forEach((square, i) => {
    const centre = fieldCentre(square);
    if (i < squares.length - 1) {
      push(centre);
      centreAt.push(at[at.length - 1]!);
      return;
    }
    const last = points[points.length - 1]!;
    const run = Math.hypot(centre[0] - last[0], centre[1] - last[1]);
    if (run > 0) {
      const back = Math.min(FAN_BLEND, run) / run;
      push([centre[0] - (centre[0] - last[0]) * back, centre[1] - (centre[1] - last[1]) * back]);
    }
    push(finalSpot);
    centreAt.push(at[at.length - 1]!);
  });
  if (squares.length === 0) push(finalSpot);
  return { points, at, length: at[at.length - 1]!, centreAt };
}

/** Where a walker is at distance `d` along a path, which way it faces, and how many square centres it has passed. */
export function sampleAt(path: Polyline, d: number): { point: Vec2; dir: Vec2; squareIndex: number } {
  const { points, at } = path;
  if (points.length < 2) return { point: points[0]!, dir: [0, 0], squareIndex: path.centreAt.length };
  const clamped = Math.min(path.length, Math.max(0, d));
  let i = 0;
  while (i < points.length - 2 && at[i + 1]! <= clamped) i++;
  const a = points[i]!;
  const b = points[i + 1]!;
  const span = at[i + 1]! - at[i]!;
  const t = (clamped - at[i]!) / span;
  return {
    point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
    dir: [(b[0] - a[0]) / span, (b[1] - a[1]) / span],
    squareIndex: path.centreAt.filter((c) => c <= clamped).length,
  };
}

/** Length of the ease-in and the ease-out in units: together they add `rampMs` of time at `speed`. */
function rampUnits(gait: Gait): { inUnits: number; outUnits: number } {
  const total = (gait.rampMs / 1000) * gait.speed;
  return { inUnits: total * RAMP_IN_SHARE, outUnits: total * (1 - RAMP_IN_SHARE) };
}

/** Total time of a move of `length` units: cruising the length plus the ramps (Fast has none). */
export function durationOf(length: number, gait: Gait, fast: boolean): number {
  return (length / gait.speed) * 1000 + (fast ? 0 : gait.rampMs);
}

/**
 * Distance walked at time fraction `u` (0..1) of a move: quadratic ease-in, constant speed, quadratic ease-out.
 * Monotone, 0 at u = 0 and `length` at u = 1.
 */
export function distanceAt(u: number, length: number, gait: Gait, fast: boolean): number {
  const clamped = Math.min(1, Math.max(0, u));
  if (fast || gait.rampMs === 0) return length * clamped;
  const { inUnits, outUnits } = rampUnits(gait);
  const t = (clamped * durationOf(length, gait, fast)) / 1000;
  const tIn = (2 * inUnits) / gait.speed;
  const tOut = (2 * outUnits) / gait.speed;
  const total = durationOf(length, gait, fast) / 1000;
  if (t < tIn) return inUnits * (t / tIn) ** 2;
  if (t > total - tOut) return length - outUnits * ((total - t) / tOut) ** 2;
  return inUnits + (t - tIn) * gait.speed;
}

/** Position in the clip's cycle (0..1) at distance `d`; `d0` shifts the start (0: the move starts on frame 0, contact). */
export function phaseAt(d: number, cycle: number, d0 = 0): number {
  const turns = (d + d0) / cycle;
  return turns - Math.floor(turns);
}

/** Frame index of a cyclic clip of `frames` frames at `phase`. */
export function frameIndexOf(phase: number, frames: number): number {
  return Math.min(frames - 1, Math.floor(phase * frames));
}

// ---- Leaps: time-driven beats (anticipation, takeoff, flight, land), spec 3.1 and 4.

export type LeapBeats = readonly [number, number, number, number];
/** A bridge step on or off (spec 4): 160 / 80 / 180 / 120 ms, Fast 60 / 40 / 80 / 60. */
export function stepLeapBeats(fast: boolean): LeapBeats {
  return fast ? [60, 40, 80, 60] : [160, 80, 180, 120];
}
/** `hanuman-leap`: anticipation 200, flight 700, land 120 (Fast 80 / 250 / 60); takeoff keeps the clip's 80 (Fast 40). */
export function longLeapBeats(fast: boolean): LeapBeats {
  return fast ? [80, 40, 250, 60] : [200, 80, 700, 120];
}
export function leapMs(beats: LeapBeats): number {
  return beats[0] + beats[1] + beats[2] + beats[3];
}

/** Clip phase at which each leap frame starts: anticipation, takeoff, air, land (Figurine maps these back to frames). */
export const LEAP_PHASE_STARTS = [0, 0.25, 0.4, 0.8] as const;

/** Leap phase (0..1) at `ms` into the beats: each beat spans its band of `LEAP_PHASE_STARTS`. */
export function leapPhaseAt(ms: number, beats: LeapBeats): number {
  let start = 0;
  for (let beat = 0; beat < 4; beat++) {
    const end = start + beats[beat]!;
    if (ms < end || beat === 3) {
      const from = LEAP_PHASE_STARTS[beat]!;
      const to = beat === 3 ? 1 : LEAP_PHASE_STARTS[beat + 1]!;
      const within = beats[beat]! === 0 ? 1 : Math.min(1, Math.max(0, (ms - start) / beats[beat]!));
      return from + (to - from) * within;
    }
    start = end;
  }
  return 1;
}

/** Index (0..3) of the leap frame at `phase`. */
export function leapFrameOf(phase: number): number {
  let frame = 0;
  LEAP_PHASE_STARTS.forEach((from, i) => {
    if (phase >= from) frame = i;
  });
  return frame;
}

/** Progress (0..1) of the airborne part of a leap (takeoff and flight beats) `ms` into the beats. */
export function leapAirProgress(ms: number, beats: LeapBeats): number {
  const air = beats[1] + beats[2];
  return Math.min(1, Math.max(0, (ms - beats[0]) / air));
}
