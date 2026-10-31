// Depth bands of the living board (T42 spec 1.4) and the ambient culling rule (spec 1.6). Pure, no Phaser.
// Every board object is a sprite in the `board` camera layer; its depth is `band + key`, where `key` is the depth key of
// its floor point (T40 boardIso `depthKey([x, y, TOP_Z])`, 27..578 over the field).

import { depthKey } from '../iso/boardIso';
import { TOP_Z } from '../iso/world';

/** Band base depths. HUD objects live in the hud layer and are not part of these bands. */
export const BAND = { floor: 0, standing: 1000, air: 2900, numerals: 3000 } as const;

/** Offsets within the floor band: the tile is `key`, then fog, shimmer, mist and the token shadow. */
export const FLOOR_OFFSET = { tile: 0, fog: 0.2, shimmer: 0.3, mist: 0.4, shadow: 0.6 } as const;
export type FloorPart = keyof typeof FLOOR_OFFSET;

/** The depth key of a floor point (world x, y) on the tile plane. */
export function floorKey(x: number, y: number): number {
  return depthKey([x, y, TOP_Z]);
}

export function floorDepth(key: number, part: FloorPart = 'tile'): number {
  return BAND.floor + key + FLOOR_OFFSET[part];
}

/** Props, snake coils, bridge segments, tokens, FX, gate and parasol: sorted by where they stand. */
export function standingDepth(key: number): number {
  return BAND.standing + key;
}

/** A snake head sits half a unit over its coil so it sorts in front of it. */
export function snakeHeadDepth(coilKey: number): number {
  return standingDepth(coilKey) + 0.5;
}

/** Frame module depth (spec 1.4 and the frame.meta.json schema): `key(depthAt) + bias`; gate and parasol stand (1000 band). */
export function frameDepth(placement: {
  frame: string;
  depthAt: readonly [number, number];
  depthBias: number;
}): number {
  const standing = placement.frame === 'gate' || placement.frame === 'parasol';
  const key = floorKey(placement.depthAt[0], placement.depthAt[1]);
  return (standing ? BAND.standing : BAND.floor) + key + placement.depthBias;
}

/** Birds. */
export function airDepth(key: number): number {
  return BAND.air + key;
}

/** Every numeral glyph shares one depth: above fog, props, snakes, bridges and tokens. */
export const NUMERAL_DEPTH = BAND.numerals;

// ---------------------------------------------------------------- ambient culling

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A thing that animates while it is on screen: a logical-px position and the number of tweens it costs. */
export interface AmbientSource {
  id: number;
  x: number;
  y: number;
  cost: number;
}

/** Hard limit of live ambient tweens (spec 1.6). */
export const AMBIENT_LIMIT = 120;
/** One tile of margin around the view rect, in logical px (a block is about 60 px wide). */
export const CULL_MARGIN = 60;

/**
 * Ids of the sources that should animate: those inside `view` grown by `margin`, nearest the view centre first, as many
 * as fit in `limit` tween slots (so the farthest blocks pause first).
 */
export function selectAmbient(
  sources: readonly AmbientSource[],
  view: Rect,
  margin = CULL_MARGIN,
  limit = AMBIENT_LIMIT,
): Set<number> {
  const cx = view.x + view.width / 2;
  const cy = view.y + view.height / 2;
  const inside = sources.filter(
    (s) =>
      s.x >= view.x - margin &&
      s.x <= view.x + view.width + margin &&
      s.y >= view.y - margin &&
      s.y <= view.y + view.height + margin,
  );
  inside.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  const chosen = new Set<number>();
  let used = 0;
  for (const source of inside) {
    if (used + source.cost > limit) continue;
    used += source.cost;
    chosen.add(source.id);
  }
  return chosen;
}
