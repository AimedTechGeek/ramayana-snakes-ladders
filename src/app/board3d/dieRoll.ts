// Pure math for the 3D die: which clip plays, how the clip's end orientation is corrected so the rolled value
// faces up, the floor height that keeps the die from sinking while it is corrected, and the tap-vs-drag test.

import { Quaternion, Vector3 } from 'three';

export type DieValue = 1 | 2 | 3 | 4 | 5 | 6;
export const DIE_VALUES: readonly DieValue[] = [1, 2, 3, 4, 5, 6];

/** Face normals in the die's own frame (glTF space, +Y up); opposite faces sum to 7. Matches scripts/blender/die.py. */
export const FACE_NORMALS: Readonly<Record<DieValue, readonly [number, number, number]>> = {
  1: [0, 1, 0],
  2: [0, 0, 1],
  3: [1, 0, 0],
  4: [-1, 0, 0],
  5: [0, 0, -1],
  6: [0, -1, 0],
};

export const CLIP_COUNT = 3;
export const CLIP_FPS = 24;
export const CLIP_FRAMES = 24;
/** Floor contacts at these clip frames (the clatter ticks). */
export const CONTACT_FRAMES: readonly number[] = [6, 12, 18];
/** The orientation correction blends in over the last 6 frames. */
export const CORRECTION_FRAMES = 6;
export const FAST_FACTOR = 7;
export const DIE_HALF_EDGE = 0.21;

export const TAP_MAX_PX = 8;
export const TAP_MAX_MS = 300;

/** Seconds a roll takes: the clip is 1.0 s, Fast plays it at 7x (0.14 s; T44.14, was 2.5x). */
export function rollSeconds(fast: boolean): number {
  return CLIP_FRAMES / CLIP_FPS / (fast ? FAST_FACTOR : 1);
}

/** The clip is chosen by `(value + turn) mod 3`. */
export function clipIndex(value: number, turn: number): number {
  return (((value + turn) % CLIP_COUNT) + CLIP_COUNT) % CLIP_COUNT;
}

function normal(value: DieValue): Vector3 {
  const [x, y, z] = FACE_NORMALS[value];
  return new Vector3(x, y, z);
}

/** The value whose face points most nearly up when the die has orientation `q`. */
export function topFace(q: Quaternion): DieValue {
  let best: DieValue = 1;
  let bestY = -Infinity;
  for (const value of DIE_VALUES) {
    const y = normal(value).applyQuaternion(q).y;
    if (y > bestY) {
      bestY = y;
      best = value;
    }
  }
  return best;
}

/** The die-local rotation that carries face `to` into the place face `from` occupies (shortest arc). */
export function faceToValueRotation(from: DieValue, to: DieValue): Quaternion {
  return new Quaternion().setFromUnitVectors(normal(to), normal(from));
}

/** The clip's end orientation times the face-to-value rotation: `value` ends face up. */
export function finalOrientation(clipEnd: Quaternion, value: DieValue): Quaternion {
  return clipEnd.clone().multiply(faceToValueRotation(topFace(clipEnd), value));
}

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/**
 * The die's orientation at clip frame `frame`: the clip's own pose, with the correction blended in over the last
 * CORRECTION_FRAMES frames. At the final frame this equals `finalOrientation`.
 */
export function correctedOrientation(
  clipPose: Quaternion,
  clipEnd: Quaternion,
  value: DieValue,
  frame: number,
): Quaternion {
  const blend = smoothstep((frame - (CLIP_FRAMES - CORRECTION_FRAMES)) / CORRECTION_FRAMES);
  const correction = new Quaternion().slerp(faceToValueRotation(topFace(clipEnd), value), blend);
  return clipPose.clone().multiply(correction);
}

/** Height of the die's centre above the floor so its lowest corner just touches it, at orientation `q`. */
export function restHeight(q: Quaternion): number {
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)];
  return axes.reduce((sum, axis) => sum + Math.abs(axis.applyQuaternion(q).y), 0) * DIE_HALF_EDGE;
}

export interface PointerSample {
  x: number;
  y: number;
  /** Milliseconds. */
  t: number;
}

/** A tap is pointer down then up within 300 ms and 8 CSS px; anything longer or farther is a drag (camera). */
export function isTap(down: PointerSample, up: PointerSample): boolean {
  return Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_PX && up.t - down.t <= TAP_MAX_MS;
}
