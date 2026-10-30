// Node twin of src/game/iso/boardIso.ts: same camera.json, same projection. Keep the two identical.

import { readFileSync } from 'node:fs';
import { boxCorners, depthOf, fitProjection, iso } from './anatomy/iso-kit.mjs';

export const camera = JSON.parse(
  readFileSync(new URL('../../src/game/iso/camera.json', import.meta.url), 'utf8'),
);

const SIZE = camera.cell * camera.columns;
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
  return [column * camera.cell + camera.cell / 2, SIZE - row * camera.cell - camera.cell / 2, camera.topZ];
}

let projection;

export function boardProjection() {
  projection ??= fitProjection(
    boxCorners({ x: 0, y: 0, w: SIZE, d: SIZE, r: 0 }, 0, camera.topZ + camera.headroom),
    rect.width,
    rect.height,
    { pad: camera.pad, headroom: camera.headroom, azimuth: camera.azimuth, elevation: camera.elevation },
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
