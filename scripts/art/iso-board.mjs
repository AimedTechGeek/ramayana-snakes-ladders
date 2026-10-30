// Node twin of src/game/iso/boardIso.ts: same camera.json, same world, same projection. Keep the two identical.

import { readFileSync } from 'node:fs';
import { boxCorners, depthOf, fitProjection, iso } from './anatomy/iso-kit.mjs';
import { BASE_H, CELL, FOOT_H, HEADROOM, RIM, SIZE, TOP_Z } from './iso/world.mjs';

export const camera = JSON.parse(
  readFileSync(new URL('../../src/game/iso/camera.json', import.meta.url), 'utf8'),
);

const { rect } = camera;

/** Same serpentine rule as gridOf in src/game/layout.ts. */
function gridOf(square) {
  const index = square - 1;
  const row = Math.floor(index / camera.columns);
  const offset = index % camera.columns;
  return { row, column: row % 2 === 0 ? offset : camera.columns - 1 - offset };
}

export function squareWorld(square) {
  const { row, column } = gridOf(square);
  return [column * CELL + CELL / 2, SIZE - row * CELL - CELL / 2, TOP_Z];
}

let projection;

export function boardProjection() {
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

export function toScreen(point) {
  const [x, y] = iso(point, boardProjection());
  return { x: x + rect.x, y: y + rect.y };
}

export function squareScreen(square) {
  return toScreen(squareWorld(square));
}

export function worldOffsetScreen(square, dx, dy) {
  const [x, y, z] = squareWorld(square);
  return toScreen([x + dx, y + dy, z]);
}

export function depthKey(point) {
  return depthOf(point, boardProjection());
}
