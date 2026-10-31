// Pure rules of the clay heroes (T44 4.5 and 4.6): the nine GLB clips, tween and emotion to clip, distance to clip
// phase, leap beats to clip time, facing and the face atlas frames. No three.js and no React, so Vitest covers it.

import type { Emotion, TweenName } from '../../characters/reactions';
import { facingOf, type Facing } from '../../game/iso/locomotion';
import type { Vec2 } from '../../game/iso/boardIso';

export const CLIP_FPS = 24;
export type HeroClip = 'idle' | 'walk' | 'run' | 'leap' | 'happy' | 'excited' | 'scared' | 'sad' | 'cheer';

/** Frames per clip as baked by scripts/blender/heroes (T44 4.5). Duration = frames / CLIP_FPS. */
export const CLIP_FRAMES: Readonly<Record<HeroClip, number>> = {
  idle: 48,
  walk: 24,
  run: 16,
  leap: 22,
  happy: 36,
  excited: 36,
  scared: 30,
  sad: 36,
  cheer: 60,
};
export const HERO_CLIPS = Object.keys(CLIP_FRAMES) as HeroClip[];

export function clipSeconds(clip: HeroClip): number {
  return CLIP_FRAMES[clip] / CLIP_FPS;
}

/** idle, walk, run and cheer loop; leap plays once; the four emotions play once and hold their last pose. */
export function isLooping(clip: HeroClip): boolean {
  return clip === 'idle' || clip === 'walk' || clip === 'run' || clip === 'cheer';
}

/** Walk and run are driven by distance, the leap by its beats; nothing else may free-run during a move. */
export function isDistanceDriven(clip: HeroClip): boolean {
  return clip === 'walk' || clip === 'run';
}

/** T44 4.5: walk <-> run never crossfade (one gait per move); everything else blends over 150 ms. */
export const CROSSFADE_MS = 150;
export function fadeBetween(from: HeroClip | null, to: HeroClip, requestedMs = CROSSFADE_MS): number {
  if (from && isDistanceDriven(from) && isDistanceDriven(to) && from !== to) return 0;
  return requestedMs;
}

// ---- reactions

/** T44 4.6: T05 tween -> clip. `stomp` is positive or negative by the reaction's emotion. */
export function clipForTween(tween: TweenName, emotion: Emotion): HeroClip {
  switch (tween) {
    case 'bounce':
    case 'clap':
    case 'nod':
    case 'bless':
    case 'salute':
      return 'happy';
    case 'leap':
    case 'somersault':
      return 'excited';
    case 'stomp':
      return emotion === 'happy' || emotion === 'excited' ? 'excited' : 'sad';
    case 'cower':
    case 'shake':
      return 'scared';
    case 'slump':
    case 'sigh':
    case 'fidget':
      return 'sad';
    case 'none':
      return 'idle';
  }
}

/** Intensity 0..1 -> weight of the emotion clip blended over idle: 0.5 + 0.5 i. */
export function clipWeight(intensity: number): number {
  return 0.5 + 0.5 * Math.min(1, Math.max(0, intensity));
}

/** Face atlas columns (T44 4.2): idle, blink, happy, excited, scared, sad. */
export const FACE_FRAMES = ['idle', 'blink', 'happy', 'excited', 'scared', 'sad'] as const;

export function faceFrameOf(emotion: Emotion, blinking: boolean): number {
  if (blinking && emotion === 'idle') return FACE_FRAMES.indexOf('blink');
  return FACE_FRAMES.indexOf(emotion);
}

/** Next blink in 3-5 s (T44 4.2): `random` in [0, 1). */
export function nextBlinkInMs(random: number): number {
  return 3000 + 2000 * random;
}
export const BLINK_MS = 120;

// ---- locomotion

/**
 * Cycle fraction 0..1 after walking `distance` of a gait whose cycle is `cycle` long (same unit: the GLB's `stride_m`
 * for walk and `run_stride_m` for run, board units). Frame 0 is a contact, so a move starts on a contact.
 */
export function phaseFromDistance(distance: number, cycle: number): number {
  const turns = distance / cycle;
  return turns - Math.floor(turns);
}

/** Mixer time (seconds) that shows `phase` of a looping clip. */
export function clipTimeAtPhase(clip: HeroClip, phase: number): number {
  return phase * clipSeconds(clip);
}

/** Leap beats (ms): anticipation, takeoff, flight, land; the frame where each starts in the 22-frame clip. */
export type Beats = readonly [number, number, number, number];
export const LEAP_BANDS = [0, 4, 6, 16, 22] as const;

/** Mixer time of the leap clip `ms` into the beats: each beat spans its band of frames (flight is stretched). */
export function leapClipTime(ms: number, beats: Beats): number {
  let start = 0;
  for (let beat = 0; beat < 4; beat++) {
    const end = start + beats[beat]!;
    if (ms < end || beat === 3) {
      const from = LEAP_BANDS[beat]!;
      const to = LEAP_BANDS[beat + 1]!;
      const within = beats[beat]! === 0 ? 1 : Math.min(1, Math.max(0, (ms - start) / beats[beat]!));
      return (from + (to - from) * within) / CLIP_FPS;
    }
    start = end;
  }
  return CLIP_FRAMES.leap / CLIP_FPS;
}

// ---- facing

/** Heading of a move vector (world x, y) in the view's convention: 0 faces the viewer (+z), as DioramaView sets it. */
export function yawOfMove(dir: Vec2, previous: number): number {
  if (dir[0] === 0 && dir[1] === 0) return previous;
  return Math.atan2(dir[0], dir[1]);
}

const FACING_YAW: Readonly<Record<Facing, number>> = {
  SE: Math.PI / 2,
  SW: 0,
  NW: -Math.PI / 2,
  NE: Math.PI,
};
/** Rest yaw: toward the default camera azimuth (+22 degrees, the "SW" of T43). */
export const REST_YAW = (22 * Math.PI) / 180;

/** The axis facing a move vector picks (T43 2, reused from locomotion.ts) as a yaw; ties keep the previous one. */
export function axisYawOf(dir: Vec2, previous: Facing): { facing: Facing; yaw: number } {
  const facing = facingOf(dir, previous);
  return { facing, yaw: FACING_YAW[facing] };
}

/** Shortest signed angle from `from` to `to`. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Yaw eased toward `target` with a time constant (T44 4.6: 120 ms); `snap` jumps (reduced motion). */
export function easeYaw(current: number, target: number, dtMs: number, snap = false, tauMs = 120): number {
  if (snap) return target;
  return current + angleDelta(current, target) * (1 - Math.exp(-dtMs / tauMs));
}
