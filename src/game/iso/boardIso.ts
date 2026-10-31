// Isometric board projection shared with scripts/art/iso-board.mjs (keep the two identical). Pure, no Phaser.
// Geometry comes from ./world; the camera comes from ./camera.json.

import { gridOf } from '../layout';
import camera from './camera.json';
import { boxCorners, depthOf, fitProjection, iso, type Point3, type Projection } from './isoKit';
import { BASE_H, CELL, FIELD_C_OFFSET, FOOT_H, HEADROOM, RIM, SIZE, TOP_Z } from './world';

export interface Screen {
  x: number;
  y: number;
}

export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

const { rect } = camera;

/** Centre of a square's top face, at TOP_Z. */
export function squareWorld(square: number): Point3 {
  const { row, column } = gridOf(square);
  return [column * CELL + CELL / 2, SIZE - row * CELL - CELL / 2, TOP_Z];
}

/** Centre of the standing field of a square: tile centre shifted by FIELD_C_OFFSET. [x, y] */
export function fieldCentre(square: number): Vec2 {
  const [x, y] = squareWorld(square);
  return [x + FIELD_C_OFFSET[0], y + FIELD_C_OFFSET[1]];
}

let projection: Projection | undefined;

/** Projection fitted once over the plinth box (rim included, feet to the headroom top) into the screen rect. */
export function boardProjection(): Projection {
  projection ??= fitProjection(
    boxCorners(
      { x: -RIM, y: -RIM, w: SIZE + 2 * RIM, d: SIZE + 2 * RIM, r: 0 },
      -(BASE_H + FOOT_H),
      TOP_Z + HEADROOM,
    ),
    rect.width,
    rect.height,
    { pad: camera.pad, azimuth: camera.azimuth, elevation: camera.elevation },
  );
  return projection;
}

export function toScreen(point: Point3): Screen {
  const [x, y] = iso(point, boardProjection());
  return { x: x + rect.x, y: y + rect.y };
}

export function squareScreen(square: number): Screen {
  return toScreen(squareWorld(square));
}

/** Screen point of a square's top offset by (dx, dy) world units, for fanned tokens. */
export function worldOffsetScreen(square: number, dx: number, dy: number): Screen {
  const [x, y, z] = squareWorld(square);
  return toScreen([x + dx, y + dy, z]);
}

/** Larger is nearer the viewer; sort ascending to draw far things first. */
export function depthKey(point: Point3): number {
  return depthOf(point, boardProjection());
}
