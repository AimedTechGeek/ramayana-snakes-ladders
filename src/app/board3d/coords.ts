// World units (src/game/iso/world.ts: x along a row, y toward the viewer, 56 per square, board 672) to three units
// (one square = 1, board centred on the origin, y up, field plate at y = 0). Animations sample in world units because
// the locomotion speeds are world units per second; only rendering converts. A point's height is the ground under
// it (block tops, see boardLayout.groundHeightAt) plus `lift`, so tokens stand on the block tops.

import { CELL, SIZE } from '../../game/iso/world';
import type { Vec2 } from '../../game/iso/boardIso';
import { groundHeightAt } from './boardLayout';

export const UNIT = 1 / CELL;
export const HALF = SIZE / 2;

export function toThree(world: Vec2, lift = 0): [number, number, number] {
  const x = (world[0] - HALF) * UNIT;
  const z = (world[1] - HALF) * UNIT;
  return [x, groundHeightAt(x, z) + lift, z];
}

/** World (x, y) of a three-space point's ground position: the inverse of `toThree` on the board plane. */
export function toWorld(x: number, z: number): Vec2 {
  return [x / UNIT + HALF, z / UNIT + HALF];
}

/** Where seat `seat`'s token waits before its first move: on the front rim strip, east of the gate. */
export function waitingSpot(seat: number): Vec2 {
  return [HALF + (-3 + seat * 0.5) * CELL, SIZE + 0.15 * CELL];
}
