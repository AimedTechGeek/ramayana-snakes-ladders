// The snake's choreography as data (T44 5.4, T42 5.4 timings): which beats a bite has, how long each lasts, where the
// coil stands on its block and where the mouth is while the head strikes. Pure: no three, no React, no DOM.
// The geometry facts (mouth points, footprint, clip frames) come from snakesManifest.json, written by
// scripts/blender/snakes.py, so nothing here repeats a Blender number.

import manifest from './snakesManifest.json';
import { blockTopY, squareCentre } from './boardLayout';

export type SnakeClip = 'rise' | 'idle' | 'hold' | 'strike' | 'swallow' | 'settle';
export const SNAKE_CLIPS: readonly SnakeClip[] = ['rise', 'idle', 'hold', 'strike', 'swallow', 'settle'];

export interface SnakeMeta {
  id: string;
  clips: Record<SnakeClip, number>;
  /** Mouth point relative to the coil centre (glTF axes, board units): head at rest, turned to the token, struck. */
  mouth: { idle: Vec3; hold: Vec3; strike: Vec3 };
  head_top_u: number;
  coil_outer_u: number;
  footprint_u: { x: [number, number]; z: [number, number] };
  triangles: number;
  bytes: number;
  [more: string]: unknown;
}
export type Vec3 = [number, number, number];

export const SNAKE_FPS: number = manifest.fps;
export const SNAKE_META = manifest.snakes as unknown as Record<string, SnakeMeta>;
/** The coil's centre sits this far behind its block's centre (5.2 placement); the token stands at the block centre. */
export const ANCHOR_BACK: number = manifest.anchorBack;

/**
 * Beats of a bite. The classic bite (T44 5.4) is rise, hold, strike, swallow, settle, reappear. The cinematic bite
 * (T45.4, "Bite close-ups") adds `focus` (the camera glides to the head block while the board dims), `grow` (the coil
 * swells to BITE_GROW, in place of `hold`), `toTail` (the camera glides to the tail square) and `restore` (it eases
 * back to the pose the player had).
 */
export type BiteStepName =
  | 'focus'
  | 'rise'
  | 'grow'
  | 'hold'
  | 'strike'
  | 'swallow'
  | 'settle'
  | 'toTail'
  | 'reappear'
  | 'restore';
export interface BiteStep {
  name: BiteStepName;
  ms: number;
}

/** Spec 5.4, normal and Fast (Fast is not always half: hold and settle vanish; T44.14 halved spec 5.4's Fast again). */
const NORMAL_MS: Record<BiteStepName, number> = {
  focus: 0,
  rise: 380,
  grow: 0,
  hold: 260,
  strike: 180,
  swallow: 320,
  settle: 220,
  toTail: 0,
  reappear: 260,
  restore: 0,
};
const FAST_MS: Record<BiteStepName, number> = {
  focus: 0,
  rise: 60,
  grow: 0,
  hold: 0,
  strike: 50,
  swallow: 80,
  settle: 0,
  toTail: 0,
  reappear: 60,
  restore: 0,
};
/**
 * T45.4 close-ups, normal speed, about 4.2 s: focus 0.7 (the first-time rise plays inside the glide), grow 0.7,
 * strike 0.3, swallow 0.6, settle 0.6 (shrink, sway, puff), to the tail 0.4, reappear 0.3, restore 0.6.
 */
const CINEMA_MS: Record<BiteStepName, number> = {
  focus: 700,
  rise: 380,
  grow: 700,
  hold: 0,
  strike: 300,
  swallow: 600,
  settle: 600,
  toTail: 400,
  reappear: 300,
  restore: 600,
};
/** Close-ups under reduced motion: no camera, no growth, the beats are instant; the board's dim fades in and out. */
export const CINEMA_FADE_MS = 350;

/** The coil swells to this multiple of its base scale during a close-up bite (T45.4; R9 exception, see Snake.tsx). */
export const BITE_GROW = 1.6;
/** Share of the close-up swallow beat the token takes to reach the mouth; the jaw closes over the rest. */
export const SWALLOW_IN = 0.55;

export function biteTimeline(options: {
  fast: boolean;
  reducedMotion: boolean;
  firstTime: boolean;
  /** The "Bite close-ups" setting (T45.4): the cinematic beats. Fast keeps the short bite whatever the setting. */
  closeUps?: boolean;
}): BiteStep[] {
  const cinema = options.closeUps === true && !options.fast;
  const table = options.fast ? FAST_MS : cinema ? CINEMA_MS : NORMAL_MS;
  const names: BiteStepName[] = cinema
    ? ['focus', 'grow', 'strike', 'swallow', 'settle', 'toTail', 'reappear', 'restore']
    : ['hold', 'strike', 'swallow', 'settle', 'reappear'];
  // the first-time rise sits inside the focus glide: the coil uncoils as the camera arrives
  if (options.firstTime) names.splice(cinema ? 1 : 0, 0, 'rise');
  const ms = (name: BiteStepName): number => {
    if (options.reducedMotion) {
      // Reduced motion keeps the three static beats: the snake is there, the token vanishes, the token appears at the
      // tail; close-ups add only a fade of the board's dim (an opacity change, no movement).
      return cinema && (name === 'focus' || name === 'restore') ? CINEMA_FADE_MS : 0;
    }
    // the focus glide keeps its length when the rise plays inside it: focus + rise = CINEMA_MS.focus
    return name === 'focus' && options.firstTime ? table.focus - table.rise : table[name];
  };
  return names.map((name) => ({ name, ms: ms(name) }));
}

/** Growth multiplier at progress u of the grow beat (1 -> BITE_GROW) or of the settle beat (BITE_GROW -> 1), eased. */
export function growAt(u: number, direction: 'grow' | 'shrink'): number {
  const e = 0.5 - Math.cos(Math.max(0, Math.min(1, u)) * Math.PI) / 2;
  return direction === 'grow' ? 1 + (BITE_GROW - 1) * e : BITE_GROW + (1 - BITE_GROW) * e;
}

/** The satisfied sway of the settle beat: a roll about the coil's axis that fades out, radians at progress u. */
export function swayAt(u: number): number {
  const t = Math.max(0, Math.min(1, u));
  return Math.sin(t * Math.PI * 2) * 0.07 * (1 - t);
}

/** Coil centre, three units: the head block's centre pushed back, standing on the block top. */
export function snakeAnchor(square: number, id?: string): Vec3 {
  const [x, z] = squareCentre(square);
  const back = (id !== undefined ? (SNAKE_META[id]?.anchorBack as number | undefined) : undefined) ?? ANCHOR_BACK;
  return [x, blockTopY(square), z - back];
}

export function mouthPoint(square: number, id: string, phase: 'idle' | 'hold' | 'strike'): Vec3 {
  const a = snakeAnchor(square, id);
  const m = SNAKE_META[id]?.mouth[phase] ?? [0, 0.5, 0];
  return [a[0] + m[0], a[1] + m[1], a[2] + m[2]];
}

/** The mouth point of a coil grown by `grow` about its anchor (a multiplier on whatever scale `mouthPoint` has). */
export function grownMouthPoint(square: number, id: string, phase: 'idle' | 'hold' | 'strike', grow: number): Vec3 {
  const a = snakeAnchor(square, id);
  const m = mouthPoint(square, id, phase);
  return [a[0] + (m[0] - a[0]) * grow, a[1] + (m[1] - a[1]) * grow, a[2] + (m[2] - a[2]) * grow];
}

/** Seconds into `clip` at progress u (0..1) of the beat it is stretched over. */
export function clipSeconds(meta: SnakeMeta, clip: SnakeClip, u: number): number {
  return (Math.max(0, Math.min(1, u)) * meta.clips[clip]) / SNAKE_FPS;
}

/** Tongue flick (T42 5.3): 70 ms out, 90 ms held, 70 ms back; returns the tongue scale at `ms` after the flick began. */
export function tongueScale(ms: number): number {
  if (ms < 0 || ms > 230) return 0;
  if (ms < 70) return ms / 70;
  if (ms < 160) return 1;
  return 1 - (ms - 160) / 70;
}

/** Back.easeOut (token reappears 0.1 -> 1). */
export function backOut(u: number, c = 1.70158): number {
  const t = Math.max(0, Math.min(1, u)) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
}
