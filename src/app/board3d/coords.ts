// World units (src/game/iso/world.ts: x along a row, y toward the viewer, 56 per square, board 672) to three units
// (one square = 1, board centred on the origin, y up). Animations sample in world units because the locomotion
// speeds are world units per second; only rendering converts.

import { CELL, SIZE } from '../../game/iso/world';
import type { Vec2 } from '../../game/iso/boardIso';

export const UNIT = 1 / CELL;
export const HALF = SIZE / 2;
/** Height of a block's top face in three units; tokens stand here. */
export const BLOCK_TOP = 0;
export const BLOCK_HEIGHT = 0.32;

export function toThree(world: Vec2, lift = 0): [number, number, number] {
  return [(world[0] - HALF) * UNIT, BLOCK_TOP + lift, (world[1] - HALF) * UNIT];
}

/** Where seat `seat`'s token waits before its first move: beside square 1, off the front-left corner. */
export function waitingSpot(seat: number): Vec2 {
  return [-46, SIZE - 120 + seat * 28];
}
