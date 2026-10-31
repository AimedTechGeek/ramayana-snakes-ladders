// The pure parts of how a bridge looks over time (T44 6.4): the rise of its chunks, the thud of an already standing
// bridge, and the fade-when-behind that keeps a token readable under a deck. No three, no React.

import { fieldCentre, type Vec2 } from '../../game/iso/boardIso';
import { CELL } from '../../game/iso/world';

/** Each chunk (pier + arch + deck, foot to top) rises over this long, ms. */
export const CHUNK_RISE_MS = 360;
/** Stagger between chunks, ms. */
export const CHUNK_STAGGER_MS = 70;
/** Rise depth before a chunk settles (u) and its starting height scale (6.4). */
export const RISE_DEPTH = 0.25;
export const RISE_SQUASH = 0.9;
/** Opacity of a bridge while a token stands under its deck, and the time to get there (6.4). */
export const BEHIND_OPACITY = 0.35;
export const FADE_MS = 150;
/** A token counts as standing on a square within this distance of its field centre (u). */
export const UNDER_RADIUS = 0.4;
/** Already-revealed bridge: scale 1.0 -> 1.03 -> 1.0 over this long (6.4). */
export const THUD_MS = 120;
export const THUD_SCALE = 0.03;

/** Back.easeOut (overshoot 1.70158), 0..1 in, 0..~1.1 out. */
export function backOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (c - 1) ** 3 + c1 * (c - 1) ** 2;
}

/** The view eases its jump rise with easeInOut(u) = 0.5 - cos(pi u) / 2; this returns u (the linear clock). */
export function riseClock(eased: number): number {
  const c = Math.min(1, Math.max(0, eased));
  return Math.acos(1 - 2 * c) / Math.PI;
}

/** Total rise time at normal speed for a bridge of `openings` chunks, ms (360 + 70 per extra chunk, at most 570). */
export function riseTotalMs(openings: number): number {
  return CHUNK_RISE_MS + CHUNK_STAGGER_MS * (openings - 1);
}

/** Progress 0..1 of chunk `index` when the rise is `u` (0..1) of its `openings`-chunk timeline. */
export function chunkProgress(u: number, index: number, openings: number): number {
  const total = riseTotalMs(openings);
  const ms = u * total;
  return Math.min(1, Math.max(0, (ms - index * CHUNK_STAGGER_MS) / CHUNK_RISE_MS));
}

/** Scale of a standing bridge `ms` after the thud began: 1 -> 1.03 -> 1 (a sine hump). */
export function thudScale(ms: number): number {
  if (ms <= 0 || ms >= THUD_MS) return 1;
  return 1 + THUD_SCALE * Math.sin((ms / THUD_MS) * Math.PI);
}

/** True when any token (world spot, px) stands within UNDER_RADIUS of the field centre of one of `crossed`. */
export function tokenUnder(crossed: readonly number[], spots: readonly Vec2[]): boolean {
  const radius = UNDER_RADIUS * CELL;
  return crossed.some((square) => {
    const [cx, cy] = fieldCentre(square);
    return spots.some(([x, y]) => Math.hypot(x - cx, y - cy) < radius);
  });
}

/** Opacity target of a bridge: 0.35 while a token stands under the deck, else 1. */
export function fadeTarget(crossed: readonly number[], spots: readonly Vec2[]): number {
  return tokenUnder(crossed, spots) ? BEHIND_OPACITY : 1;
}

/** Moves `current` toward `target` at the fade rate (full swing 1 -> 0.35 in FADE_MS). */
export function stepOpacity(current: number, target: number, dtMs: number): number {
  const step = ((1 - BEHIND_OPACITY) * dtMs) / FADE_MS;
  return current < target ? Math.min(target, current + step) : Math.max(target, current - step);
}
