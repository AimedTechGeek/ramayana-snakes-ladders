// Isometric board projection shared with scripts/art/iso-board.mjs (keep the two identical). Pure, no Phaser.
// World: x to the right along a row, y toward the viewer (row 0 is the nearest row), z up.

import { gridOf } from '../layout';
import camera from './camera.json';
import { boxCorners, depthOf, fitProjection, iso, type Point3, type Projection } from './isoKit';

export interface Screen {
  x: number;
  y: number;
}

const SIZE = camera.cell * camera.columns;
const { rect } = camera;

/** Centre of a square's top face, at z = topZ. */
export function squareWorld(square: number): Point3 {
  const { row, column } = gridOf(square);
  return [column * camera.cell + camera.cell / 2, SIZE - row * camera.cell - camera.cell / 2, camera.topZ];
}

let projection: Projection | undefined;

/** Projection fitted once over the whole board box into the screen rect. */
export function boardProjection(): Projection {
  projection ??= fitProjection(
    boxCorners({ x: 0, y: 0, w: SIZE, d: SIZE, r: 0 }, 0, camera.topZ + camera.headroom),
    rect.width,
    rect.height,
    { pad: camera.pad, headroom: camera.headroom, azimuth: camera.azimuth, elevation: camera.elevation },
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
