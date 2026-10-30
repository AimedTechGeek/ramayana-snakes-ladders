// Node twin of src/game/iso/jumps.ts (T40 spec section 3). Keep the two identical.
// Run through tsx (npm run art:iso): jump data comes straight from src/core/boards.ts, the single source.
// World units; x right, y toward the viewer, z up. See jumps.ts for the contract.

import { boardFor } from '../../../src/core/boards.ts';
import { squareWorld } from '../iso-board.mjs';
import { CELL, FIELD_C_OFFSET, TOP_Z } from './world.mjs';

/** Spacing of the sampled centreline points. */
export const STEP = 1;
/** Relief above TOP_Z that nothing on the field may exceed (spec section 3, hard cap). */
export const HARD_CAP = 12;
/** A hump clears the lower item by this much. */
export const HUMP_MARGIN = 0.6;

/** Body radius R per snake (spec 3.3); the radius tapers to 0.45 R at the tail. */
export const SNAKE_RADIUS = {
  tataka: 2.8,
  manthara: 2.2,
  kaikeyi: 2.8,
  viradha: 3.0,
  shurpanakha: 2.8,
  'golden-deer': 2.8,
  abduction: 3.0,
  kabandha: 3.0,
  'indrajit-arrows': 2.6,
  prahasta: 3.0,
  kumbhakarna: 3.4,
  brahmastra: 2.2,
  ravana: 4.0,
};

/** Tallest part of each ladder a snake can cross (rails, knots, tee balls, blocks), spec 3 and 3.2. */
export const LADDER_RELIEF = {
  vishwamitra: 1.0,
  'shiva-bow': 2.0,
  wedding: 2.6,
  guha: 2.6,
  shabari: 2.0,
  'hanuman-meeting': 2.6,
  sugriva: 2.0,
  'hanuman-leap': 3.2,
  'rama-setu': 1.4,
};

/** Centre of the standing field of a square: tile centre shifted by FIELD_C_OFFSET. [x, y] */
export function fieldCentre(square) {
  const [x, y] = squareWorld(square);
  return [x + FIELD_C_OFFSET[0], y + FIELD_C_OFFSET[1]];
}

/** The cubic the runtime uses (BoardScene.snakeCurve): control points at the midpoint pushed sideways by +-swing. */
export function snakeBezier(head, tail) {
  const dx = tail[0] - head[0];
  const dy = tail[1] - head[1];
  const distance = Math.hypot(dx, dy);
  const swing = Math.min(distance * 0.25, CELL * 0.66);
  const sideX = distance > 0 ? (-dy / distance) * swing : 0;
  const sideY = distance > 0 ? (dx / distance) * swing : 0;
  const midX = (head[0] + tail[0]) / 2;
  const midY = (head[1] + tail[1]) / 2;
  return [head, [midX + sideX, midY + sideY], [midX - sideX, midY - sideY], tail];
}

/** Point on a cubic Bezier at parameter u (the runtime's curve.getPoint(u)). */
export function bezierPoint(bezier, u) {
  const v = 1 - u;
  const a = v * v * v;
  const b = 3 * v * v * u;
  const c = 3 * v * u * u;
  const d = u * u * u;
  const [p0, p1, p2, p3] = bezier;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Snake body radius at arc fraction t (0 head, 1 tail). */
export function snakeRadiusAt(radius, t) {
  return radius * (1 - 0.55 * t);
}

const CURVE_SAMPLES = 1024;

/** Samples evenly spaced by arc length (about STEP apart, endpoints included). */
function resample(pointAt) {
  const fine = [];
  const along = [0];
  for (let i = 0; i <= CURVE_SAMPLES; i++) {
    fine.push(pointAt(i / CURVE_SAMPLES));
    if (i > 0) {
      const a = fine[i - 1];
      const b = fine[i];
      along.push(along[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
  }
  const length = along[CURVE_SAMPLES];
  const count = Math.max(1, Math.ceil(length / STEP));
  const points = [];
  let at = 0;
  for (let k = 0; k <= count; k++) {
    const target = (length * k) / count;
    while (at < CURVE_SAMPLES - 1 && along[at + 1] < target) at++;
    const span = along[at + 1] - along[at] || 1;
    const f = Math.min(1, Math.max(0, (target - along[at]) / span));
    points.push([
      fine[at][0] + (fine[at + 1][0] - fine[at][0]) * f,
      fine[at][1] + (fine[at + 1][1] - fine[at][1]) * f,
    ]);
  }
  return { points, length, count };
}

/** Intersection of segments ab and cd as [fractionOnAB, fractionOnCD], half-open [0, 1) on both, or null. */
function crossAt(a, b, c, d) {
  const rx = b[0] - a[0];
  const ry = b[1] - a[1];
  const sx = d[0] - c[0];
  const sy = d[1] - c[1];
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return null;
  const qx = c[0] - a[0];
  const qy = c[1] - a[1];
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  return t >= 0 && t < 1 && u >= 0 && u < 1 ? [t, u] : null;
}

/** Every crossing of upper with lower: { s: arc position on upper, lowerT: arc fraction on lower }. */
function crossings(upper, lower) {
  const found = [];
  const u = upper.points;
  const l = lower.points;
  for (let i = 0; i + 1 < u.length; i++) {
    const minX = Math.min(u[i][0], u[i + 1][0]);
    const maxX = Math.max(u[i][0], u[i + 1][0]);
    const minY = Math.min(u[i][1], u[i + 1][1]);
    const maxY = Math.max(u[i][1], u[i + 1][1]);
    for (let j = 0; j + 1 < l.length; j++) {
      if (Math.max(l[j][0], l[j + 1][0]) < minX || Math.min(l[j][0], l[j + 1][0]) > maxX) continue;
      if (Math.max(l[j][1], l[j + 1][1]) < minY || Math.min(l[j][1], l[j + 1][1]) > maxY) continue;
      const hit = crossAt(u[i], u[i + 1], l[j], l[j + 1]);
      if (hit) {
        found.push({
          s: ((i + hit[0]) / upper.count) * upper.length,
          lowerT: (j + hit[1]) / lower.count,
        });
      }
    }
  }
  return found;
}

function baseOf(jump) {
  const from = fieldCentre(jump.from);
  const to = fieldCentre(jump.to);
  if (jump.kind === 'ladder') {
    const relief = LADDER_RELIEF[jump.id];
    if (relief === undefined) throw new Error(`No ladder relief for ${jump.id}`);
    const sampled = resample((u) => [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u]);
    return { jump, radius: 0, relief, control: null, ...sampled };
  }
  const radius = SNAKE_RADIUS[jump.id];
  if (radius === undefined) throw new Error(`No snake radius for ${jump.id}`);
  const control = snakeBezier(from, to);
  const sampled = resample((u) => bezierPoint(control, u));
  return { jump, radius, relief: 0, control, ...sampled };
}

function humpsOf(upper, lowers) {
  const humps = [];
  for (const lower of lowers) {
    const lowerRelief = lower.jump.kind === 'ladder' ? lower.relief : undefined;
    for (const hit of crossings(upper, lower)) {
      const relief = lowerRelief ?? 2 * snakeRadiusAt(lower.radius, hit.lowerT);
      humps.push({
        s: hit.s,
        half: 4 * snakeRadiusAt(upper.radius, hit.s / upper.length),
        height: relief + HUMP_MARGIN,
        over: lower.jump.id,
      });
    }
  }
  return humps.sort((a, b) => a.s - b.s);
}

/** Added centreline z at arc position s: the highest of the cosine humps covering it. */
function humpZ(humps, s) {
  let z = 0;
  for (const h of humps) {
    const d = Math.abs(s - h.s);
    if (d < h.half) z = Math.max(z, h.height * 0.5 * (1 + Math.cos((Math.PI * d) / h.half)));
  }
  return z;
}

function finish(base, humps) {
  const { jump, radius, relief, control, length, count } = base;
  const points = base.points.map(([x, y], k) => {
    if (jump.kind === 'ladder') return [x, y, TOP_Z];
    const s = (length * k) / count;
    const r = snakeRadiusAt(radius, s / length);
    // Clip the hump so the body top never passes the hard cap (Ravana over kumbhakarna would reach 12.1).
    const lift = Math.min(humpZ(humps, s), Math.max(0, HARD_CAP - 2 * r));
    return [x, y, TOP_Z + r + lift];
  });
  const along3 = [0];
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    along3.push(along3[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const arcAt = (s) => {
    const k = (s / length) * count;
    const lo = Math.min(count - 1, Math.floor(k));
    return along3[lo] + (along3[lo + 1] - along3[lo]) * (k - lo);
  };
  let reliefTop = relief;
  if (jump.kind === 'snake') {
    reliefTop = Math.max(...points.map(([, , z], k) => z - TOP_Z + snakeRadiusAt(radius, k / count)));
  }
  return {
    id: jump.id,
    kind: jump.kind,
    from: jump.from,
    to: jump.to,
    radius,
    control,
    length,
    points,
    humps: humps.map((h) => ({ at: arcAt(h.s), half: h.half, height: h.height, over: h.over })),
    breaks: humps.map((h) => arcAt(h.s)),
    reliefTop,
  };
}

/**
 * Every jump of a level in draw order: ladders first, then snakes by square drop (from - to) ascending, as
 * BoardScene does, so Ravana (drop 60) is drawn last, on top. The sort is stable over the board's from-order.
 * Snakes carry their crossing humps over the shorter snakes and over every ladder.
 */
export function jumpPaths(level) {
  const board = boardFor(level);
  const ladders = board.ladders.map(baseOf);
  const snakes = board.snakes.map(baseOf).sort((a, b) => a.jump.from - a.jump.to - (b.jump.from - b.jump.to));
  const out = ladders.map((ladder) => finish(ladder, []));
  snakes.forEach((snake, index) => {
    out.push(finish(snake, humpsOf(snake, [...ladders, ...snakes.slice(0, index)])));
  });
  return out;
}

/** One jump's path on a level, or undefined when the jump is not on that level. */
export function jumpPath(level, id) {
  return jumpPaths(level).find((p) => p.id === id);
}

/** Where a token glides at progress u in 0..1 (spec 5): snake = the Bezier at z TOP_Z + 2 r(u), ladder = the line at TOP_Z + 2.2. */
export function glidePoint(path, u) {
  if (path.control === null) {
    const a = path.points[0];
    const b = path.points[path.points.length - 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, TOP_Z + 2.2];
  }
  const [x, y] = bezierPoint(path.control, u);
  return [x, y, TOP_Z + 2 * snakeRadiusAt(path.radius, u)];
}
