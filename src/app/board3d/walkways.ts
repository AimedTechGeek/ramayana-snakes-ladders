// Walkways (T45.2): the reserved lane along every square-to-square step of a walk (`pathOf` in
// src/game/iso/locomotion.ts runs from a field centre to the next field centre, then to the fan slot), and the plain 2D
// geometry that keeps scenery out of it. Units are board units (three-space x, z; 1 u = one block pitch, z toward the
// viewer). No three, no React.

import { fieldCentre, type Vec2 } from '../../game/iso/boardIso';
import { FAN_BLEND } from '../../game/iso/locomotion';
import { FAN_WORLD } from '../../game/iso/world';
import { HALF, UNIT } from './coords';

/** A lane is this wide (u): a hero at `HERO_SCALE` is about 0.2 u across the shoulders; the owner asked for >= 0.22. */
export const LANE_WIDTH = 0.22;
/** A hero's footprint radius for collisions: half a lane. */
export const HERO_RADIUS = LANE_WIDTH / 2;
/** Scenery stays this much (u) further than the lane's edge. */
export const LANE_MARGIN = 0.004;

export type Point = readonly [number, number];
export interface Lane {
  a: Point;
  b: Point;
}
export type Polygon = readonly Point[];
/** A solid part of a prop, relative to its origin, three-space axes (x right, z toward the viewer), u. */
export interface Rect {
  x: readonly [number, number];
  z: readonly [number, number];
}

const toU = (world: Vec2): Point => [(world[0] - HALF) * UNIT, (world[1] - HALF) * UNIT];

/** Field centre of a square, board units. */
export function fieldCentreU(square: number): Point {
  return toU(fieldCentre(square));
}

/** Every distinct fan slot offset from a field centre (1..4 tokens on a square), board units. */
export const FAN_OFFSETS: readonly Point[] = (() => {
  const seen = new Map<string, Point>();
  for (const count of [1, 2, 3, 4] as const)
    for (const [dx, dy] of FAN_WORLD[count]) seen.set(`${dx},${dy}`, [dx * UNIT, dy * UNIT]);
  return [...seen.values()];
})();

/** The step lane between two neighbouring squares. */
export function stepLane(from: number, to: number): Lane {
  return { a: fieldCentreU(from), b: fieldCentreU(to) };
}

/** Spokes from a square's field centre to each fan slot: where a walker ends up. */
export function fanLanes(square: number): Lane[] {
  const centre = fieldCentreU(square);
  return FAN_OFFSETS.filter(([dx, dz]) => dx !== 0 || dz !== 0).map(([dx, dz]) => ({
    a: centre,
    b: [centre[0] + dx, centre[1] + dz],
  }));
}

/**
 * Every line a walker can take through this square, to or from a neighbour in the numbering (a walk only ever goes to
 * the next or the previous square: the bounce at 144 walks back): the step lanes, the fan spokes, and the real legs of
 * `pathOf` that end or start at a fan slot. A walk starts on its square's fan slot and heads for the next field centre;
 * it arrives along the line from the previous point, stops `FAN_BLEND` short of the field centre and turns to the slot.
 */
export function lanesOfSquare(square: number): Lane[] {
  const centre = fieldCentreU(square);
  const out: Lane[] = fanLanes(square);
  const blend = FAN_BLEND * UNIT;
  for (const other of [square - 1, square + 1]) {
    if (other < 1 || other > 144) continue;
    const there = fieldCentreU(other);
    out.push({ a: centre, b: there });
    for (const [dx, dz] of FAN_OFFSETS) {
      // departing from this square's slot toward the neighbour
      out.push({ a: [centre[0] + dx, centre[1] + dz], b: there });
      // arriving from the neighbour's slot: along that line to the blend point, then to each of this square's slots
      const from: Point = [there[0] + dx, there[1] + dz];
      const run = Math.hypot(centre[0] - from[0], centre[1] - from[1]);
      const back = Math.min(blend, run) / run;
      const turn: Point = [centre[0] - (centre[0] - from[0]) * back, centre[1] - (centre[1] - from[1]) * back];
      out.push({ a: from, b: centre });
      for (const [sx, sz] of FAN_OFFSETS) out.push({ a: turn, b: [centre[0] + sx, centre[1] + sz] });
    }
  }
  return out;
}

// ---------------------------------------------------------------- 2D geometry

function cross(o: Point, a: Point, b: Point): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length2 = dx * dx + dz * dz;
  const t = length2 === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(a, b, c);
  const d2 = cross(a, b, d);
  const d3 = cross(c, d, a);
  const d4 = cross(c, d, b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function insideConvex(p: Point, polygon: Polygon): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const side = cross(polygon[i]!, polygon[(i + 1) % polygon.length]!, p);
    if (side === 0) continue;
    if (sign !== 0 && Math.sign(side) !== sign) return false;
    sign = Math.sign(side);
  }
  return true;
}

/** Shortest distance between a segment and a convex polygon (0 when they touch or overlap). */
export function segmentPolygonDistance(a: Point, b: Point, polygon: Polygon): number {
  if (insideConvex(a, polygon) || insideConvex(b, polygon)) return 0;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i]!;
    const d = polygon[(i + 1) % polygon.length]!;
    if (segmentsCross(a, b, c, d)) return 0;
    best = Math.min(best, pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d));
    best = Math.min(best, pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
  }
  return best;
}

/**
 * The corners of a solid part placed on the board: scaled, turned about the vertical axis by `yaw` (three.js
 * rotation.y: x' = x cos + z sin, z' = -x sin + z cos) and moved to `at`.
 */
export function placeRect(rect: Rect, at: Point, yaw: number, scale: number): Polygon {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const corner = (x: number, z: number): Point => [
    at[0] + (x * cos + z * sin) * scale,
    at[1] + (-x * sin + z * cos) * scale,
  ];
  return [
    corner(rect.x[0], rect.z[0]),
    corner(rect.x[1], rect.z[0]),
    corner(rect.x[1], rect.z[1]),
    corner(rect.x[0], rect.z[1]),
  ];
}

/** True when a polygon is closer to the lane's centre line than half a lane (plus the margin). */
export function blocksLane(polygon: Polygon, lane: Lane, halfWidth = HERO_RADIUS): boolean {
  const reach = halfWidth + LANE_MARGIN;
  const box = bounds(polygon);
  // quick reject: the lane's box, grown by the reach, misses the polygon's box
  if (
    Math.max(lane.a[0], lane.b[0]) + reach < box.x0 ||
    Math.min(lane.a[0], lane.b[0]) - reach > box.x1 ||
    Math.max(lane.a[1], lane.b[1]) + reach < box.z0 ||
    Math.min(lane.a[1], lane.b[1]) - reach > box.z1
  )
    return false;
  return segmentPolygonDistance(lane.a, lane.b, polygon) < reach;
}

export function bounds(polygon: Polygon): { x0: number; x1: number; z0: number; z1: number } {
  const xs = polygon.map((p) => p[0]);
  const zs = polygon.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
