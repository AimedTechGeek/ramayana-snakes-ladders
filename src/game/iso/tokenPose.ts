// Where a token is drawn on the isometric board (T40 spec section 5). Pure, no Phaser.

import { depthKey, fieldCentre, toScreen, type Screen, type Vec2, type Vec3 } from './boardIso';
import { FAN_WORLD, TOP_Z } from './world';

/** Tokens draw at 1000 + depth key (1027..1585): always above the board texture (0) and the shadows (500). */
export const TOKEN_DEPTH_BASE = 1000;
export const SHADOW_DEPTH = 500;
/** Floor-band offset of a token shadow over its tile (boardBands FLOOR_OFFSET.shadow). */
const SHADOW_OFFSET = 0.6;
/** A token's shadow is a floor decal: it sorts at the tile key of the ground point + 0.6 (spec 1.4), under the token. */
export function shadowDepthOf(pose: TokenPose): number {
  return pose.depth - TOKEN_DEPTH_BASE + SHADOW_OFFSET;
}

/** A step hop rises this many world units at its apex. */
export const HOP_HEIGHT = 14;
/** The entry from the seat plate arcs this many world units (as screen pixels at the board scale). */
export const ENTRY_ARC_PX = 30;

export interface TokenPose {
  /** The feet point on screen. */
  feet: Screen;
  /** The point on the tile under the feet, where the shadow sits. */
  ground: Screen;
  /** Phaser depth of the token. */
  depth: number;
  /** 0 on the tile, 1 at the top of a hop: the shadow shrinks to 70 % at 1. */
  lift: number;
  /** Drawn size factor, default 1; above 1 while a token crosses the HUD on its way to a zoomed board camera. */
  scale?: number;
}

/** Resting point of the `slot`-th of `count` tokens sharing a square: the field centre plus its fan offset (world x, y). */
export function restingSpot(square: number, slot: number, count: number): Vec2 {
  const [x, y] = fieldCentre(square);
  const fan = FAN_WORLD[Math.min(4, Math.max(1, count)) as 1 | 2 | 3 | 4];
  const [dx, dy] = fan[slot] ?? [0, 0];
  return [x + dx, y + dy];
}

/** The pose of a token at world (x, y) and height z (TOP_Z = standing on the tile). */
export function worldPose(x: number, y: number, z: number = TOP_Z): TokenPose {
  return {
    feet: toScreen([x, y, z]),
    ground: toScreen([x, y, TOP_Z]),
    depth: TOKEN_DEPTH_BASE + depthKey([x, y, TOP_Z]),
    lift: Math.min(1, Math.max(0, (z - TOP_Z) / HOP_HEIGHT)),
  };
}

/** A pose from screen points (the seat plate), drawn at the given depth. */
export function screenPose(feet: Screen, depth: number): TokenPose {
  return { feet, ground: feet, depth, lift: 0 };
}

/** The world point of a step hop at progress u in 0..1: x/y ease out along a sine, z follows a parabola of height HOP_HEIGHT. */
export function hopPoint(from: Vec2, to: Vec2, u: number): Vec3 {
  const e = Math.sin((u * Math.PI) / 2);
  return [
    from[0] + (to[0] - from[0]) * e,
    from[1] + (to[1] - from[1]) * e,
    TOP_Z + HOP_HEIGHT * 4 * u * (1 - u),
  ];
}

/** The pose from a seat plate point to a square's resting spot at progress u: a straight screen line with an arc. */
export function entryPose(seat: Screen, to: Vec2, u: number): TokenPose {
  return entryPoseTo(seat, worldPose(to[0], to[1]), u);
}

/** Same arc towards any target pose (the HUD-space image of a board spot while the board camera is zoomed); size eases to the target's. */
export function entryPoseTo(seat: Screen, target: TokenPose, u: number): TokenPose {
  const arc = ENTRY_ARC_PX * 4 * u * (1 - u);
  const feet = {
    x: seat.x + (target.feet.x - seat.x) * u,
    y: seat.y + (target.feet.y - seat.y) * u - arc,
  };
  const ground = { x: feet.x, y: feet.y + arc };
  return {
    feet,
    ground,
    depth: target.depth,
    lift: arc / ENTRY_ARC_PX,
    scale: 1 + ((target.scale ?? 1) - 1) * u,
  };
}
