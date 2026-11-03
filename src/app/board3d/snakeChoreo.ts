// The snake's choreography as data (T44 5.4, T42 5.4 timings): which beats a bite has, how long each lasts, where the
// coil stands on its block and where the mouth is while the head strikes. Pure: no three, no React, no DOM.
// The geometry facts (mouth points, footprint, clip frames) come from snakesManifest.json, written by
// scripts/blender/snakes.py, so nothing here repeats a Blender number.

import manifest from './snakesManifest.json';
import { blockTopY, squareCentre } from './boardLayout';
import { SNAKE_SCALE } from './figureScale';

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

export type BiteStepName = 'rise' | 'hold' | 'strike' | 'swallow' | 'settle' | 'reappear';
export interface BiteStep {
  name: BiteStepName;
  ms: number;
}

/** Spec 5.4, normal and Fast (Fast is not always half: hold and settle vanish; T44.14 halved spec 5.4's Fast again). */
const NORMAL_MS: Record<BiteStepName, number> = { rise: 380, hold: 260, strike: 180, swallow: 320, settle: 220, reappear: 260 };
const FAST_MS: Record<BiteStepName, number> = { rise: 60, hold: 0, strike: 50, swallow: 80, settle: 0, reappear: 60 };

export function biteTimeline(options: { fast: boolean; reducedMotion: boolean; firstTime: boolean }): BiteStep[] {
  const table = options.fast ? FAST_MS : NORMAL_MS;
  const names: BiteStepName[] = ['hold', 'strike', 'swallow', 'settle', 'reappear'];
  if (options.firstTime) names.unshift('rise');
  // Reduced motion keeps the three static beats: the snake is there, the token vanishes, the token appears at the tail.
  return names.map((name) => ({ name, ms: options.reducedMotion ? 0 : table[name] }));
}

/** Coil centre, three units: the head block's centre pushed back, standing on the block top. */
export function snakeAnchor(square: number, id?: string): Vec3 {
  const [x, z] = squareCentre(square);
  const back = (id !== undefined ? (SNAKE_META[id]?.anchorBack as number | undefined) : undefined) ?? ANCHOR_BACK;
  return [x, blockTopY(square), z - back];
}

/**
 * Where the mouth is in three units. The manifest's offsets are for the authored snake; the snake root is drawn at
 * `scale` (default `SNAKE_SCALE`, about the coil centre), so the offsets scale with it. A growing snake (T45.4) passes
 * `SNAKE_SCALE * growth`.
 */
export function mouthPoint(
  square: number,
  id: string,
  phase: 'idle' | 'hold' | 'strike',
  scale: number = SNAKE_SCALE,
): Vec3 {
  const a = snakeAnchor(square, id);
  const m = SNAKE_META[id]?.mouth[phase] ?? [0, 0.5, 0];
  return [a[0] + m[0] * scale, a[1] + m[1] * scale, a[2] + m[2] * scale];
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
