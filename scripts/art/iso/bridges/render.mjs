// Cuts a built bridge into per-row-band segment sprites (spec 6.4 rules 1 and 2) and writes their SVG.
// Items keep the depth order settled for the whole bridge; each segment is the items whose centre lies in one row band,
// translated so its box starts on a quarter pixel (factor 4 = one device pixel), so neighbouring segments rasterise on
// the same device pixel grid and a joint between bands is seamless.
import * as A from '../../anatomy/audit.mjs';
import { exportSvg } from '../common.mjs';
import { depthKey, toScreen } from '../../iso-board.mjs';
import { TOP_Z } from '../world.mjs';
import { bandOfY, polygonsOverlap, tileRect } from './geometry.mjs';
import { materialCss } from './materials.mjs';

const QUARTER = 0.25;
const PAD = 1;
const floorQ = (v) => Math.floor(v / QUARTER) * QUARTER;
const ceilQ = (v) => Math.ceil(v / QUARTER) * QUARTER;
const round = (v) => Math.round(v * 1000) / 1000;

/** Route point at the middle of a row band (spec 6.4 rule 2): y = 672 - 56 (n + 0.5). */
export function bandMiddle(geo, band) {
  const y = 672 - 56 * (band + 0.5);
  let lo = 0;
  let hi = geo.Lp;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (geo.sample(m).y > y) lo = m;
    else hi = m;
  }
  const p = geo.sample((lo + hi) / 2);
  return [p.x, p.y];
}

/** Where a segment's sprite stands and its depth key (spec 6.4 rule 2): end bands use the abutment centre. */
export function segmentAnchor(geo, band) {
  const footBand = bandOfY(geo.F[1]);
  const topBand = bandOfY(geo.T[1]);
  const at = band === footBand ? geo.F : band === topBand ? geo.T : bandMiddle(geo, band);
  return { at, depthKey: depthKey([at[0], at[1], TOP_Z]) };
}

/**
 * Parts belong to the row band of their centre (an arch ring is one unit), but a row cut is not a constant-depth cut, so
 * across a joint a part of the farther band can be in front of one of the nearer. Greedy search, one move at a time, of
 * a part into the band on the other side of a violated overlap (never more than two bands from its own), until the sort
 * by segment depth key draws every overlapping pair of parts in the painter's order, or no move helps.
 */
export function assignBands(built) {
  const { geo, R } = built;
  const footBand = bandOfY(geo.F[1]);
  const topBand = bandOfY(geo.T[1]);
  const clamp = (b) => Math.min(topBand, Math.max(footBand, b));
  const key = new Map();
  for (let b = footBand; b <= topBand; b++) key.set(b, segmentAnchor(geo, b).depthKey);
  const items = R.items;
  const home = items.map((item) => clamp(bandOfY(item.centre[1])));
  const band = [...home];
  const { pairs, least } = A.overlapsOf(items, built.P, {});
  const edges = [];
  for (const pair of pairs) {
    const aFront = pair.front[0].area >= least;
    const bFront = pair.front[1].area >= least;
    if (aFront === bFront) continue;
    edges.push({
      front: aFront ? pair.a : pair.b,
      back: aFront ? pair.b : pair.a,
      w: Math.max(pair.front[0].area, pair.front[1].area),
    });
  }
  const bad = (e) => band[e.front] !== band[e.back] && key.get(band[e.front]) <= key.get(band[e.back]);
  const cost = () => edges.reduce((sum, e) => sum + (bad(e) ? e.w : 0), 0);
  let best = cost();
  for (let round = 0; round < 40 && best > 0; round++) {
    let move = null;
    for (const e of edges.filter(bad)) {
      for (const [i, to] of [
        [e.front, band[e.back]],
        [e.back, band[e.front]],
      ]) {
        if (Math.abs(to - home[i]) > 2) continue;
        const from = band[i];
        band[i] = to;
        const c = cost();
        band[i] = from;
        if (c < best - 1e-9 && (!move || c < move.c)) move = { i, to, c };
      }
    }
    if (!move) break;
    band[move.i] = move.to;
    best = move.c;
  }
  items.forEach((item, i) => (item.band = band[i]));
  return { remaining: best, moved: band.filter((b, i) => b !== home[i]).length };
}

/**
 * Crossed squares per segment (spec 6.4 rule 3), from the parts themselves: a segment lists a crossed square when any of
 * its parts lies over that tile, so the fade follows the sprite that really covers a token even after assignBands moved
 * a deck chunk to the next band. Returns Map<band, number[]> (sorted).
 */
export function crossedBySegment(built) {
  const squares = built.geo.crossed;
  const rects = squares.map((sq) => {
    const r = tileRect(sq);
    return [
      [r.x0, r.y0],
      [r.x1, r.y0],
      [r.x1, r.y1],
      [r.x0, r.y1],
    ];
  });
  const planOf = (shape) => {
    if (shape.kind === 'prism') {
      const us = shape.poly.map((p) => p[0]);
      const [u0, u1] = [Math.min(...us), Math.max(...us)];
      const { F } = shape;
      return [
        [u0, shape.s0],
        [u1, shape.s0],
        [u1, shape.s1],
        [u0, shape.s1],
      ].map(([u, t]) => [F.o[0] + F.u[0] * u + F.a[0] * t, F.o[1] + F.u[1] * u + F.a[1] * t]);
    }
    const { min, max } = A.boundsOf(shape);
    return [
      [min[0], min[1]],
      [max[0], min[1]],
      [max[0], max[1]],
      [min[0], max[1]],
    ];
  };
  const out = new Map();
  for (const item of built.R.items) {
    const band = built.band(item);
    for (const shape of item.shapes ?? []) {
      const plan = planOf(shape);
      rects.forEach((rect, i) => {
        if (!polygonsOverlap(plan, rect)) return;
        if (!out.has(band)) out.set(band, new Set());
        out.get(band).add(squares[i]);
      });
    }
  }
  return new Map([...out].map(([band, set]) => [band, [...set].sort((a, b) => a - b)]));
}

export function renderSegments(built) {
  const { id, geo, R } = built;
  const footBand = bandOfY(geo.F[1]);
  const topBand = bandOfY(geo.T[1]);
  assignBands(built);
  const crossed = crossedBySegment(built);
  const groups = new Map();
  for (const item of R.items) {
    const band = Math.min(topBand, Math.max(footBand, built.band(item)));
    if (!groups.has(band)) groups.set(band, []);
    groups.get(band).push(item);
  }
  const bands = [...groups.keys()].sort((a, b) => a - b);
  const css = materialCss();
  const segments = [];
  for (const band of bands) {
    const items = groups.get(band);
    const shade = built.shadows
      .filter((s) => Math.min(topBand, Math.max(footBand, bandOfY(s.centre[1]))) === band)
      .map((s) => s.d)
      .join('');
    const decal = shade ? `<path fill="#2A1A0F" fill-opacity=".17" stroke="none" d="${shade}"/>` : '';
    const body = decal + items.map((item) => item.svg).join('');
    const [x0, y0, x1, y1] = A.markupBox(body);
    const gx = floorQ(x0) - PAD;
    const gy = floorQ(y0) - PAD;
    const width = ceilQ(x1 + PAD - gx);
    const height = ceilQ(y1 + PAD - gy);
    const wrapped = `<g transform="translate(${-gx} ${-gy})">${body}</g>`;
    const svg = exportSvg({ width, height, label: `${id} bridge, row ${band + 1}`, body: wrapped }).replace(
      '</style>',
      `${css}\n</style>`,
    );
    const { at, depthKey: key } = segmentAnchor(geo, band);
    const screen = toScreen([at[0], at[1], TOP_Z]);
    segments.push({
      name: `${id}.r${band + 1}`,
      band,
      row: band + 1,
      svg,
      width,
      height,
      anchor: { x: round(screen.x - gx), y: round(screen.y - gy) },
      world: [round(at[0]), round(at[1])],
      depthKey: round(key),
      origin: [gx, gy],
      items: items.length,
      crossed: crossed.get(band) ?? [],
    });
  }
  return segments;
}
