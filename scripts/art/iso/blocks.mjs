// T42.2: the living board's block art (T42 spec sections 1.2, 1.3, 2, 3.2-3.5): one tile frame per region pattern
// (`blocks` sheet: 13 base tiles + 7 fog variants), numeral glyphs, mist and the shared FX frames (`shared` sheet).
//
//   node scripts/art/iso/blocks.mjs [outDir] [--svg <dir>]     (npm run art:blocks)
//
// Every frame is an anatomy-kit SVG (solid volumes, four-tone shading from tones(hex), 0.6 px lines that end on
// something) at the board's own azimuth/elevation. Tile frames are 62 x 49 logical px at factor 4; the anchor is the
// projected tile centre at TOP_Z (the floor point of spec 1.4). Each tile frame holds the 56 x 56 field plate cell
// (z 0..1.2, dark teak: the 1-unit groove all round shows it) and the 54 x 54 slab (z 1.2..2.4) with the material.
//
// Deviations from the spec text (also reported in the task notes):
//   - numeral frames are 14 x 12 logical px, not 10 x 12: a sheared 8 x 14 unit glyph is 11.1 px wide; the height
//     (12 logical = 60 device px at factor 5) is the specified one.
//   - digits advance 11.5 units (not T40's 10) so the baked 1 px halo of a digit never cuts its neighbour.
//   - the token shadow is ink coloured (#2A1A0F at .32), not T40's grey halo: grey looks dirty on coloured tiles.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as k from '../anatomy/iso-kit.mjs';
import { boardProjection } from '../iso-board.mjs';
import { buildAtlases, FACTORS } from './atlas.mjs';
import { exportSvg, mixHex, NUMERAL_STROKES } from './common.mjs';
import { INK, tones } from './tones.mjs';
import { FIELD_Z, TOP_Z } from './world.mjs';

// ---------------------------------------------------------------- squares, regions, seed rule (spec 1.3, 2)

/** Knuth hash of the square number: the only seed of the variety rule (identical on every level). */
export const seedOf = (square) => (square * 2654435761) >>> 0;
/** Base pattern a|b = seed & 1. */
export const patternOf = (square) => (seedOf(square) & 1 ? 'b' : 'a');
/** Prop count of a square, 1 + ((seed >>> 1) & 1). */
export const propCountOf = (square) => 1 + ((seedOf(square) >>> 1) & 1);

export const GANGA_SQUARES = [49, 50, 71, 72, 73, 74];

/** Region of a square 1..144 (spec section 2; ganga tiles and the sea row are their own regions). */
export function regionOf(square) {
  if (!Number.isInteger(square) || square < 1 || square > 144) throw new Error(`square out of range: ${square}`);
  if (GANGA_SQUARES.includes(square)) return 'ganga';
  if (square <= 36) return 'mithila';
  if (square <= 48) return 'ayodhya';
  if (square <= 84) return 'dandaka';
  if (square <= 108) return 'kishkindha';
  if (square <= 120) return 'sea';
  return 'lanka';
}

/** Atlas frame of a square's base tile (`ganga` has one pattern). */
export function frameNameOf(square) {
  const region = regionOf(square);
  return region === 'ganga' ? 'ganga' : `${region}-${patternOf(square)}`;
}

export const REGIONS = {
  mithila: { a: '#9CC46B', b: '#A9CC7A', line: '#3F5A2A', ink: 'dark' },
  ayodhya: { a: '#E3C98D', b: '#D9BE82', line: '#5A4420', ink: 'dark' },
  dandaka: { a: '#4F7F3C', b: '#58893F', line: '#1F3A1A', ink: 'dark' },
  ganga: { a: '#4E9BB8', line: '#1E3F55', ink: 'bone' },
  kishkindha: { a: '#CF975B', b: '#C48C52', line: '#5C3B1E', ink: 'dark' },
  sea: { a: '#3F8FB5', b: '#3886AC', line: '#1E3F55', ink: 'bone' },
  lanka: { a: '#2A2E6B', b: '#262A62', line: '#0F1030', ink: 'bone' },
};

const ACCENT = { saffron: '#F39C2B', gold: '#E9C12F', blood: '#8E3B3B', parchment: '#F3E3B8', fog: '#CFCCC4' };
const NUMERAL_INK = { dark: { ink: INK, halo: '#F3E3B8' }, bone: { ink: '#F3E3B8', halo: '#1C1F4D' } };

// ---------------------------------------------------------------- projection and drawing helpers

const BASE = { ...boardProjection(), origin: [0, 0] };
const KS = k.cameraOf(BASE).k;
const COS_E = Math.cos((BASE.elevation * Math.PI) / 180);
const TILE_W = 62;
const TILE_H = 49;
const NUM_W = 14;
const NUM_H = 12;
const MIST_W = 72;
const MIST_H = 56;
const ADVANCE = 11.5;
const PLATE = { x: -28, y: -28, w: 56, d: 56, r: 0.6 };
const SLAB = { x: -27, y: -27, w: 54, d: 54, r: 1 };
const LIM = 27;

const tenth = (v) => String(Math.round(v * 10) / 10);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** A projection with the bbox of `worldPoints` centred in a w x h frame. */
function centred(w, h, worldPoints) {
  const flat = worldPoints.map((p) => k.iso(p, BASE));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  return {
    ...BASE,
    origin: [w / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, h / 2 - (Math.min(...ys) + Math.max(...ys)) / 2],
  };
}

function boxPoints(half, z0, z1) {
  return [-half, half].flatMap((x) => [-half, half].flatMap((y) => [[x, y, z0], [x, y, z1]]));
}

/** mulberry32 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashOf = (text) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Token set of one body for the kit css: tones() plus the region line colour on the line tokens. */
function tokenStyle(hex, line = tones(hex).line) {
  const t = tones(hex);
  const v = {
    '--anatomy-top': t.top,
    '--anatomy-paper': t.shades[2],
    '--anatomy-hi': line,
    '--anatomy-mid': mixHex(line, t.top, 0.35),
    '--anatomy-lo': mixHex(line, t.top, 0.6),
    '--anatomy-faint': mixHex(line, t.top, 0.82),
  };
  t.shades.forEach((s, i) => {
    v[`--anatomy-shade-${i}`] = s;
  });
  return Object.entries(v)
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

/** Drawing context of one frame: everything is placed in tile-world units (x, y, z) and projected with P. */
function context(P) {
  const pt = (x, y, z = TOP_Z) => k.iso([x, y, z], P);
  const D = (points, closed = false) => k.pathOf(points.map(([x, y, z]) => pt(x, y, z ?? TOP_Z)), closed);
  const items = [];
  const C = {
    P,
    pt,
    D,
    /** screen point of an upright billboard coordinate: du along the screen-horizontal, dz up (units) */
    at: (x, y, du, dz, z = TOP_Z) => {
      const [sx, sy] = pt(x, y, z);
      return [sx + du * KS, sy - dz * COS_E * KS];
    },
    /** queue svg for painter's order: far (small depth) first */
    put(x, y, svg) {
      items.push({ depth: k.depthOf([x, y, TOP_Z], P), svg });
    },
    flush() {
      return items
        .splice(0)
        .sort((a, b) => a.depth - b.depth)
        .map((i) => i.svg)
        .join('');
    },
    shape(points, fill, { stroke, sw = 0.3, opacity, rule } = {}) {
      return `<path d="${D(points, true)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : ''}${opacity ? ` opacity="${opacity}"` : ''}${rule ? ' fill-rule="evenodd"' : ''}/>`;
    },
    /** a checked texture line (the line-end check sees class iso-line) */
    line(points, { tone = 'lo', stroke, sw, free } = {}) {
      const style = stroke || sw ? ` style="${stroke ? `stroke:${stroke};` : ''}${sw ? `stroke-width:${sw}` : ''}"` : '';
      return `<path class="iso-line" data-tone="${tone}"${free ? ` data-free="${free}"` : ''}${style} d="${D(points)}"/>`;
    },
    dot(x, y, r, fill, z = TOP_Z) {
      const [sx, sy] = pt(x, y, z);
      return `<circle cx="${tenth(sx)}" cy="${tenth(sy)}" r="${r}" fill="${fill}"/>`;
    },
    screenDot(sx, sy, r, fill, stroke, sw = 0.25) {
      return `<circle cx="${tenth(sx)}" cy="${tenth(sy)}" r="${r}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
    },
    poly(screenPoints, fill, stroke, sw = 0.3) {
      return `<path d="${k.pathOf(screenPoints, true)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>`;
    },
    /** an upright billboard polygon standing on (x, y): points are [du, dz] */
    upright(x, y, pts, fill, stroke, sw = 0.3) {
      return C.poly(
        pts.map(([du, dz]) => C.at(x, y, du, dz)),
        fill,
        stroke,
        sw,
      );
    },
    /** a solid slab volume (kit four-tone shading) in its own colour */
    volume(plan, z, height, hex, { line, steps = 2, bevel = 0.3, inner = '' } = {}) {
      const paths = k.slabOf(plan, z, height, P, steps, bevel);
      return `<g style="${tokenStyle(hex, line)}">${k.solidSvg(paths, { tone: 'hi', inner })}</g>`;
    },
  };
  return C;
}

/** A closed irregular ring around (cx, cy). */
function blobRing(rnd, cx, cy, rx, ry, jitter = 0.22, n = 14) {
  const phase = rnd() * Math.PI * 2;
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    const j = 1 + (rnd() - 0.5) * 2 * jitter;
    return [cx + rx * j * Math.cos(a), cy + ry * j * Math.sin(a)];
  });
}

/** Dart throwing inside +-lim with a minimum distance; `avoid(x, y)` rejects points. */
function scatter(rnd, count, minDist, { lim = 22, avoid = () => false } = {}) {
  const out = [];
  for (let tries = 0; out.length < count && tries < 400; tries++) {
    const x = (rnd() * 2 - 1) * lim;
    const y = (rnd() * 2 - 1) * lim;
    if (avoid(x, y)) continue;
    if (out.every(([ox, oy]) => Math.hypot(ox - x, oy - y) >= minDist)) out.push([x, y]);
  }
  return out;
}

/** Smooth sampled centreline (Catmull-Rom) through control points, first and last point exact. */
function smooth(points, per = 6) {
  const out = [];
  const p = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const f = (axis) =>
        0.5 *
        (2 * p[i][axis] +
          (-p[i - 1][axis] + p[i + 1][axis]) * t +
          (2 * p[i - 1][axis] - 5 * p[i][axis] + 4 * p[i + 1][axis] - p[i + 2][axis]) * t * t +
          (-p[i - 1][axis] + 3 * p[i][axis] - 3 * p[i + 1][axis] + p[i + 2][axis]) * t * t * t);
      out.push([f(0), f(1)]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Outline ring of a ribbon around a centreline with half widths `w(t)` and the two edge lines. */
function ribbon(centre, halfWidth) {
  const left = [];
  const right = [];
  centre.forEach(([x, y], i) => {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(centre.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    let nx = -(b[1] - a[1]) / len;
    let ny = (b[0] - a[0]) / len;
    if (i === 0 || i === centre.length - 1) {
      // an end that sits on a tile edge is cut square to that edge so its corners stay on the edge
      if (Math.abs(Math.abs(x) - LIM) < 1e-6) [nx, ny] = [0, Math.sign(ny) || 1];
      else if (Math.abs(Math.abs(y) - LIM) < 1e-6) [nx, ny] = [Math.sign(nx) || 1, 0];
    }
    const w = halfWidth(i / (centre.length - 1));
    left.push([clamp(x + nx * w, -LIM, LIM), clamp(y + ny * w, -LIM, LIM)]);
    right.push([clamp(x - nx * w, -LIM, LIM), clamp(y - ny * w, -LIM, LIM)]);
  });
  return { left, right, ring: [...left, ...[...right].reverse()] };
}

/** Wave line across the tile, ends exactly on the left and right top edges. */
function waveLine(y0, amp, wavelength, phase, step = 1.5) {
  const pts = [];
  for (let x = -LIM; x < LIM + 1e-9; x += step) pts.push([x, y0 + amp * Math.sin((2 * Math.PI * x) / wavelength + phase)]);
  if (pts[pts.length - 1][0] < LIM) pts.push([LIM, y0 + amp * Math.sin((2 * Math.PI * LIM) / wavelength + phase)]);
  return pts;
}

// ---------------------------------------------------------------- materials (one function per region, spec 2)

const patches = (C, rnd, specs) =>
  specs
    .map(({ fill, n, rx, ry, opacity }) =>
      Array.from({ length: n }, () => {
        const cx = (rnd() * 2 - 1) * 20;
        const cy = (rnd() * 2 - 1) * 20;
        return C.shape(blobRing(rnd, cx, cy, lerp(rx[0], rx[1], rnd()), lerp(ry[0], ry[1], rnd())).map(([x, y]) => [clamp(x, -LIM, LIM), clamp(y, -LIM, LIM)]), fill, { opacity });
      }).join(''),
    )
    .join('');

/** A clump of grass blades standing on (x, y). */
function tuft(C, rnd, x, y, size, colours, edge) {
  const blades = [
    [-1.5, 2.4, -0.5],
    [-0.5, 4.0, -0.2],
    [0.6, 3.4, 0.5],
    [1.6, 2.0, 0.8],
  ];
  blades.forEach(([du, h, lean], i) => {
    const hh = h * size * (0.8 + rnd() * 0.4);
    const px = x + du * 0.0;
    C.put(
      x,
      y + i * 0.01,
      C.upright(px, y, [[du - 0.55, 0], [du + 0.55, 0], [du + lean * size + (rnd() - 0.5) * 0.6, hh]], colours[i % colours.length], edge, 0.28),
    );
  });
}

function flower(C, rnd, x, y, colour, edge) {
  const h = 2.4 + rnd() * 1.3;
  C.put(x, y, C.upright(x, y, [[-0.3, 0], [0.3, 0], [0.05, h]], '#5E8B3A', undefined));
  const [sx, sy] = C.at(x, y, 0, h);
  C.put(x, y, C.screenDot(sx, sy, 0.95, colour, edge, 0.22) + C.screenDot(sx, sy, 0.32, ACCENT.gold));
}

function mithila(C, pat, rnd, T, { line }) {
  const lightHex = mixHex(T.top, '#F2EC6B', 0.2);
  let s = patches(C, rnd, [
    { fill: T.shades[3], n: 5, rx: [4, 9], ry: [3, 6] },
    { fill: lightHex, n: 3, rx: [3, 6], ry: [2, 4], opacity: 0.55 },
    { fill: T.shades[1], n: 4, rx: [3, 7], ry: [2, 5] },
  ]);
  const colours = [mixHex(T.top, line, 0.3), mixHex(T.top, '#4E8A32', 0.5), mixHex(T.top, '#FFFFFF', 0.28), mixHex(T.top, '#E7E36A', 0.35)];
  let avoid = () => false;
  if (pat === 'b') {
    const centre = (x) => 6 + 4 * Math.sin((Math.PI * x) / LIM);
    avoid = (x, y) => Math.abs(y - centre(x)) < 8.5;
    const pts = Array.from({ length: 19 }, (_, i) => {
      const x = -LIM + (i * 2 * LIM) / 18;
      return [x, centre(x)];
    });
    const band = ribbon(pts, () => 5.4);
    s += C.shape(band.ring, mixHex('#E9D9A8', T.top, 0.12), {});
    s += C.line(band.left, { tone: 'mid' }) + C.line(band.right, { tone: 'mid' });
    for (let i = 0; i < 7; i++) {
      const x = -22 + i * 7.4 + (rnd() - 0.5) * 1.2;
      const y = centre(x) + (rnd() - 0.5) * 2.2;
      const fill = ['#F1E4B8', '#E6D4A0', '#EFDDAE', '#D9C894'][i % 4];
      s += C.shape(blobRing(rnd, x, y, 3.0 + rnd() * 0.6, 2.2 + rnd() * 0.5, 0.12, 10), fill, { stroke: mixHex(line, fill, 0.35), sw: 0.3 });
    }
  }
  for (const [x, y] of scatter(rnd, pat === 'b' ? 7 : 12, 6.5, { avoid })) tuft(C, rnd, x, y, 0.8 + rnd() * 0.5, colours, line);
  const petals = ['#F8F2E2', '#F29BB5', ACCENT.saffron, '#9A78DE', '#F4D03F'];
  scatter(rnd, pat === 'b' ? 5 : 8, 5, { avoid }).forEach(([x, y], i) => flower(C, rnd, x, y, petals[i % petals.length], mixHex(line, '#FFFFFF', 0.2)));
  return s + C.flush();
}

function ayodhya(C, pat, rnd, T, { line }) {
  const joint = mixHex(T.top, line, 0.5);
  let s = C.shape([[-LIM, -LIM], [LIM, -LIM], [LIM, LIM], [-LIM, LIM]], joint);
  const slabFills = [T.top, T.shades[3], mixHex(T.top, '#F5E3B0', 0.5), mixHex(T.top, '#C99C58', 0.28), mixHex(T.top, ACCENT.saffron, 0.18)];
  const slabs = [];
  if (pat === 'a') {
    const ys = [-LIM, -9, 9, LIM];
    for (let r = 0; r < 3; r++) {
      const cuts = [-LIM, ...(r === 1 ? [lerp(-18, -8, rnd()), lerp(6, 16, rnd())] : [lerp(-14, -2, rnd()), lerp(8, 18, rnd())]), LIM];
      for (let c = 0; c < cuts.length - 1; c++) slabs.push([cuts[c], ys[r], cuts[c + 1], ys[r + 1]]);
    }
  } else {
    slabs.push([-LIM, -LIM, LIM, LIM]);
  }
  slabs.forEach(([x0, y0, x1, y1], i) => {
    const gap = 0.6;
    const ring = [[x0 + (x0 === -LIM ? 0.2 : gap), y0 + (y0 === -LIM ? 0.2 : gap)], [x1 - (x1 === LIM ? 0.2 : gap), y0 + (y0 === -LIM ? 0.2 : gap)], [x1 - (x1 === LIM ? 0.2 : gap), y1 - (y1 === LIM ? 0.2 : gap)], [x0 + (x0 === -LIM ? 0.2 : gap), y1 - (y1 === LIM ? 0.2 : gap)]];
    s += C.shape(ring, slabFills[(i * 2 + Math.floor(rnd() * 3)) % slabFills.length], { stroke: mixHex(line, T.top, 0.4), sw: 0.3 });
  });
  // hairline cracks end on a slab edge and on a chip dot
  if (pat === 'a') {
    const [x0, y0, x1, y1] = slabs[Math.floor(rnd() * slabs.length)];
    const mx = (x0 + x1) / 2;
    s += C.line([[mx - 2, y0 + 0.6], [mx + 1, lerp(y0, y1, 0.35)], [mx - 1, lerp(y0, y1, 0.6)]], { tone: 'mid' }) + C.dot(mx - 1, lerp(y0, y1, 0.6), 0.5, mixHex(line, T.top, 0.3));
  } else {
    // gold inlay border and centre rosette
    const ring = (r) => [[-r, -r], [r, -r], [r, r], [-r, r]];
    s += `<path d="${C.D(ring(21.5), true)}${C.D(ring(19.9), true)}" fill="${ACCENT.gold}" fill-rule="evenodd" stroke="${line}" stroke-width="0.3" stroke-linejoin="round"/>`;
    s += C.shape(ring(19.9), mixHex(T.top, '#FBEFC8', 0.45), { stroke: line, sw: 0.25 });
    s += C.shape([[0, -10], [10, 0], [0, 10], [-10, 0]], ACCENT.gold, { stroke: line, sw: 0.35 });
    s += C.shape([[0, -6.2], [6.2, 0], [0, 6.2], [-6.2, 0]], mixHex(T.top, '#FFFFFF', 0.25), { stroke: line, sw: 0.3 });
    s += C.shape([[0, -2.6], [2.6, 0], [0, 2.6], [-2.6, 0]], ACCENT.saffron, { stroke: line, sw: 0.3 });
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      s += C.line([[sx * 21.5, sy * 21.5], [sx * LIM, sy * LIM]], { tone: 'mid' });
      s += C.dot(sx * 14, sy * 14, 0.8, ACCENT.gold) + C.dot(sx * 24.3, sy * 24.3, 0.55, ACCENT.saffron);
    }
  }
  // marigold petals scattered by the festival crowds
  scatter(rnd, pat === 'a' ? 6 : 3, 7, { lim: 24 }).forEach(([x, y], i) => {
    if (pat === 'b' && Math.abs(x) < 11 && Math.abs(y) < 11) return;
    s += C.shape(blobRing(rnd, x, y, 1.1, 0.7, 0.1, 8), i % 2 ? ACCENT.saffron : '#E0522A', { stroke: mixHex(line, '#E0522A', 0.4), sw: 0.2 });
  });
  return s;
}

function leafShape(C, x, y, size, angle, fill, edge) {
  const p = (du, dv) => [x + du * Math.cos(angle) - dv * Math.sin(angle), y + du * Math.sin(angle) + dv * Math.cos(angle)];
  return C.shape([p(-size, 0), p(0, size * 0.45), p(size, 0), p(0, -size * 0.45)], fill, { stroke: edge, sw: 0.22 });
}

function dandaka(C, pat, rnd, T, { line }) {
  let s = patches(C, rnd, [
    { fill: T.shades[3], n: 4, rx: [4, 8], ry: [3, 5] },
    { fill: mixHex(T.top, '#9BC24A', 0.4), n: 3, rx: [3, 6], ry: [2, 4], opacity: 0.6 },
    { fill: T.shades[1], n: 5, rx: [3, 8], ry: [2, 5] },
  ]);
  const roots = [];
  if (pat === 'b') {
    roots.push(smooth([[-LIM, -9], [-14, -6], [-3, 4], [4, 15], [8, LIM]]));
    roots.push(smooth([[13, -LIM], [15, -14], [21, -5], [LIM, 3]]));
  }
  const rootHex = '#7B5330';
  const rt = tones(rootHex);
  roots.forEach((centre, ri) => {
    const body = ribbon(centre, (t) => lerp(2.5, 1.6, Math.abs(t - 0.5) * 2) + (ri ? -0.3 : 0.2));
    const shadow = body.ring.map(([x, y]) => [x + 0.9, y + 0.9]);
    s += C.shape(shadow, mixHex(T.top, '#14240F', 0.55), { opacity: 0.6 });
    s += C.shape(body.ring, rt.shades[1], { stroke: rt.line, sw: 0.4 });
    const crest = ribbon(centre, (t) => lerp(1.5, 0.9, Math.abs(t - 0.5) * 2));
    s += C.shape(crest.ring, rt.shades[3]);
    s += C.line(body.left.map(([x, y], i) => [x * 0.55 + centre[i][0] * 0.45, y * 0.55 + centre[i][1] * 0.45]), { stroke: rt.line, sw: 0.3 });
  });
  const nearRoot = (x, y) => roots.some((c) => c.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 5.5));
  const fern = [mixHex(T.top, '#A7D45A', 0.55), mixHex(T.top, '#7FB84A', 0.5), mixHex(T.top, '#BBE070', 0.5)];
  for (const [x, y] of scatter(rnd, 4, 9, { avoid: nearRoot })) {
    for (let b = -2; b <= 2; b++) {
      const h = 4.8 - Math.abs(b) * 0.6 + rnd() * 0.5;
      C.put(x, y + b * 0.01, C.upright(x, y, [[b * 0.35 - 0.45, 0], [b * 0.35 + 0.45, 0], [b * 1.35, h]], fern[Math.abs(b) % 3], line, 0.26));
    }
  }
  const litter = ['#B5652B', '#D2A13C', '#9A3B2A', '#C98A2E'];
  for (const [i, [x, y]] of scatter(rnd, 11, 3.4, { avoid: nearRoot }).entries()) {
    s += leafShape(C, x, y, 1.5 + rnd() * 0.6, rnd() * Math.PI, litter[i % 4], mixHex(line, litter[i % 4], 0.45));
  }
  for (const [x, y] of scatter(rnd, 1 + Math.floor(rnd() * 2), 12, { lim: 18, avoid: nearRoot })) {
    C.put(x, y, C.upright(x, y, [[-0.55, 0], [0.55, 0], [0.45, 2.2], [-0.45, 2.2]], '#EFE0C0', line, 0.25));
    const cap = Array.from({ length: 9 }, (_, i) => [lerp(-1.9, 1.9, i / 8), 2.1 + 1.5 * Math.sin((Math.PI * i) / 8)]);
    C.put(x, y, C.upright(x, y, cap, '#C8553D', line, 0.28));
    for (const [du, dz] of [[-0.8, 3], [0.5, 3.3], [1.1, 2.7]]) {
      const [sx, sy] = C.at(x, y, du, dz);
      C.put(x, y, C.screenDot(sx, sy, 0.28, '#F6EBD0'));
    }
  }
  return s + C.flush();
}

/** Wave lines and foam of the two water regions. */
function water(C, pat, rnd, T, { line, sea }) {
  const deep = pat === 'b';
  let s = patches(C, rnd, [
    { fill: T.shades[1], n: sea ? 5 : 4, rx: [5, 10], ry: [3, 6] },
    { fill: T.shades[3], n: 4, rx: [4, 8], ry: [2, 5], opacity: 0.8 },
  ]);
  const crest = mixHex(T.top, '#FFFFFF', 0.55);
  if (sea && deep) {
    // alternating swell bands bounded by long waves
    const edge = (y0) => waveLine(y0, 2.2, 54, 0.6);
    const bands = [[-LIM, -10], [-2, 12]];
    bands.forEach(([a, b], i) => {
      const top = i === 0 ? [[-LIM, -LIM], [LIM, -LIM]] : edge(a);
      const upper = i === 0 ? top : edge(a);
      const lower = edge(b);
      s += C.shape([...(i === 0 ? [[-LIM, -LIM], [LIM, -LIM]] : upper), ...lower.reverse()], i ? T.shades[3] : T.shades[1], { opacity: 0.75 });
    });
  }
  const rows = sea ? [-18, -6, 7, 19] : [-20, -10, 0, 10, 20];
  rows.forEach((y0, i) => {
    const wave = waveLine(y0 + (rnd() - 0.5) * 2, sea ? 2.0 : 1.1, sea ? 28 : 14, i * 1.7 + rnd());
    s += C.line(wave, { stroke: mixHex(line, T.top, 0.45), sw: 0.55 });
    s += C.line(wave.map(([x, y]) => [x, y + 1.6]), { stroke: crest, sw: 0.45 });
  });
  // foam flecks: closed lens shapes on wave crests
  const flecks = sea ? 9 : 6;
  for (let i = 0; i < flecks; i++) {
    const x = (rnd() * 2 - 1) * 20;
    const y = (rnd() * 2 - 1) * 22;
    const w = sea ? 3.2 + rnd() * 2.2 : 2 + rnd() * 1.6;
    const lens = [[-w, 0], [-w * 0.4, -0.9], [w * 0.5, -0.9], [w, 0], [w * 0.5, 0.7], [-w * 0.4, 0.7]].map(([dx, dy]) => [x + dx, y + dy]);
    s += C.shape(lens, i % 3 ? '#F4FAFC' : mixHex(T.top, '#FFFFFF', 0.7), { stroke: mixHex(line, '#FFFFFF', 0.5), sw: 0.2 });
  }
  if (!sea) {
    for (const [x, y] of scatter(rnd, 4, 9, { lim: 20 })) s += C.dot(x, y, 0.5, '#FFFFFF');
    // drifting marigold petals on the holy river
    [[-12, 12], [9, -13], [16, 14]].forEach(([x, y], i) => {
      s += C.shape(blobRing(rnd, x, y, 1.4, 0.9, 0.1, 8), i % 2 ? ACCENT.saffron : '#E0522A', { stroke: mixHex(line, '#E0522A', 0.4), sw: 0.2 });
    });
  }
  return s;
}

function kishkindha(C, pat, rnd, T, { line }) {
  const strata = (fill, y0, y1, jag) => {
    const top = Array.from({ length: 7 }, (_, i) => [-LIM + (i * 2 * LIM) / 6, y0 + (rnd() - 0.5) * jag]);
    const bottom = Array.from({ length: 7 }, (_, i) => [LIM - (i * 2 * LIM) / 6, y1 + (rnd() - 0.5) * jag]);
    return C.shape([...top, ...bottom].map(([x, y]) => [x, clamp(y, -LIM, LIM)]), fill, { opacity: 0.85 });
  };
  let s = strata(mixHex(T.top, '#F0C890', 0.35), -20, -12, 4) + strata(mixHex(T.top, '#8A5A2E', 0.25), -3, 6, 5) + strata(mixHex(T.top, '#F4D7A8', 0.3), 14, 21, 4);
  s += patches(C, rnd, [{ fill: T.shades[1], n: 3, rx: [3, 6], ry: [2, 4], opacity: 0.7 }]);
  let avoid;
  if (pat === 'a') {
    const crack = [[-12, -LIM], [-9, -17], [-13, -11], [-6, -4], [3, -2], [8, 6], [17, 10]];
    s += C.line(crack, { tone: 'hi' });
    s += C.line([[-6, -4], [-8, 5], [-3, 13]], { tone: 'hi' });
    s += C.line([[8, 6], [6, 15], [10, LIM]], { tone: 'hi' });
    s += C.dot(17, 10, 0.55, mixHex(line, T.top, 0.2)) + C.dot(-3, 13, 0.55, mixHex(line, T.top, 0.2));
    s += C.line([[3, -2], [8, -8], [LIM, -12]], { tone: 'mid' });
    avoid = (x, y) => Math.hypot(x + 6, y + 4) < 5;
  } else {
    // crevice: a dark rift with lit lips, ending on two tile edges
    const centre = smooth([[-LIM, -14], [-12, -8], [0, 2], [10, 9], [LIM, 18]]);
    const rift = ribbon(centre, (t) => lerp(1.2, 2.8, Math.sin(Math.PI * t)));
    s += C.shape(rift.ring, '#3A2312', { stroke: line, sw: 0.45 });
    const lip = ribbon(centre, (t) => lerp(2.1, 3.7, Math.sin(Math.PI * t)));
    s += C.line(lip.left, { stroke: mixHex(T.top, '#FFE9C0', 0.5), sw: 0.5 });
    s += C.line(lip.right, { stroke: mixHex(line, T.top, 0.3), sw: 0.45 });
    avoid = (x, y) => centre.some(([cx, cy]) => Math.hypot(cx - x, cy - y) < 6);
    // a sprig of grass in the rift
    const [gx, gy] = centre[Math.floor(centre.length * 0.55)];
    tuft(C, rnd, gx, gy + 1, 0.8, ['#7FA04B', '#9DBB5B', '#5E8B3A'], line);
  }
  for (const [x, y] of scatter(rnd, 3, 9, { lim: 20, avoid })) {
    const w = 3.6 + rnd() * 2.4;
    const d = 2.8 + rnd() * 1.6;
    const hex = ['#B9814C', '#D9AB74', '#A8703E'][Math.floor(rnd() * 3)];
    C.put(x, y, C.volume({ x: x - w / 2, y: y - d / 2, w, d, r: 1 }, TOP_Z, 1.2 + rnd() * 1.1, hex, { line, steps: 2, bevel: 0.25 }));
  }
  for (const [x, y] of scatter(rnd, 7, 5, { lim: 23, avoid })) {
    s += C.shape(blobRing(rnd, x, y, 0.9 + rnd() * 0.5, 0.6 + rnd() * 0.3, 0.2, 8), ['#E7C08A', '#A9703E', '#D2A06A'][Math.floor(rnd() * 3)], { stroke: mixHex(line, T.top, 0.25), sw: 0.22 });
  }
  return s + C.flush();
}

function lanka(C, pat, rnd, T) {
  const joint = '#10123A';
  let s = C.shape([[-LIM, -LIM], [LIM, -LIM], [LIM, LIM], [-LIM, LIM]], joint);
  const lit = '#6068B8';
  if (pat === 'a') {
    const ys = [-LIM, -9.5, 8.5, LIM];
    for (let r = 0; r < 3; r++) {
      const cuts = [-LIM, lerp(-14, -4, rnd()), lerp(6, 16, rnd()), LIM];
      for (let c = 0; c < 3; c++) {
        const x0 = cuts[c];
        const x1 = cuts[c + 1];
        const ring = [[x0 + (x0 === -LIM ? 0.2 : 0.7), ys[r] + (ys[r] === -LIM ? 0.2 : 0.7)], [x1 - (x1 === LIM ? 0.2 : 0.7), ys[r] + (ys[r] === -LIM ? 0.2 : 0.7)], [x1 - (x1 === LIM ? 0.2 : 0.7), ys[r + 1] - (ys[r + 1] === LIM ? 0.2 : 0.7)], [x0 + (x0 === -LIM ? 0.2 : 0.7), ys[r + 1] - (ys[r + 1] === LIM ? 0.2 : 0.7)]];
        const fill = [T.top, mixHex(T.top, '#5058B0', 0.22), mixHex(T.top, '#3B2A66', 0.35), T.shades[3]][Math.floor(rnd() * 4)];
        s += C.shape(ring, fill, { stroke: '#0C0E30', sw: 0.3 });
        // lit lip on the far-left edges of each slab ends on the slab outline at both corners
        s += C.line([ring[3], ring[0], ring[1]], { stroke: lit, sw: 0.45 });
        s += C.dot(ring[2][0] - 0.1, ring[2][1] - 0.1, 0.55, ACCENT.gold);
      }
    }
    // ember crack: lit by the fires of the city, ends on the edge and a spark
    s += C.line([[-10, -LIM], [-8, -17], [-12, -9.5]], { stroke: ACCENT.saffron, sw: 0.55 });
    s += C.line([[14, 8.5], [10, 15], [13, LIM]], { stroke: '#E0522A', sw: 0.55 });
    s += C.dot(-12, -9.5, 0.7, '#FFD27A') + C.dot(14, 8.5, 0.7, '#FFB04A');
  } else {
    const body = [[-LIM, -LIM], [LIM, -LIM], [LIM, LIM], [-LIM, LIM]].map(([x, y]) => [x * 0.99, y * 0.99]);
    s += C.shape(body, mixHex(T.top, '#5058B0', 0.1), { stroke: '#0C0E30', sw: 0.3 });
    const inner = 20;
    s += `<path d="${C.D([[-inner, -inner], [inner, -inner], [inner, inner], [-inner, inner]], true)}${C.D([[-inner + 1.2, -inner + 1.2], [inner - 1.2, -inner + 1.2], [inner - 1.2, inner - 1.2], [-inner + 1.2, inner - 1.2]], true)}" fill="${ACCENT.gold}" fill-rule="evenodd" stroke="#6B520F" stroke-width="0.25" stroke-linejoin="round"/>`;
    // filigree: spokes from the corners of the border to the medallion, scrolls between
    s += C.shape(blobRing(rnd, 0, 0, 8, 8, 0, 24), mixHex(T.top, '#3B2A66', 0.5), { stroke: ACCENT.gold, sw: 0.55 });
    s += C.shape(blobRing(rnd, 0, 0, 4.2, 4.2, 0, 20), ACCENT.gold, { stroke: '#6B520F', sw: 0.3 });
    s += C.dot(0, 0, 1.2, ACCENT.saffron);
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const from = [sx * 5.7, sy * 5.7];
      s += C.line([from, [sx * 11, sy * 11], [sx * (inner - 0.6), sy * (inner - 0.6)]], { stroke: ACCENT.gold, sw: 0.5 });
      s += C.line([[sx * (inner + 1.6), sy * (inner + 1.6)], [sx * 24, sy * 24], [sx * LIM, sy * LIM]], { stroke: mixHex(ACCENT.gold, '#2A2E6B', 0.4), sw: 0.45 });
      s += C.dot(sx * 14.5, sy * 3.5, 0.7, ACCENT.gold) + C.dot(sx * 3.5, sy * 14.5, 0.7, ACCENT.gold);
      s += C.dot(sx * 24.3, sy * 24.3, 0.75, ACCENT.saffron);
    }
  }
  // embers drifting over the night stone
  scatter(rnd, 4, 9, { lim: 23 }).forEach(([x, y], i) => {
    s += C.dot(x, y, 0.38, i % 2 ? '#FFB04A' : '#FF7A3A');
  });
  return s;
}

const MATERIAL = {
  mithila,
  ayodhya,
  dandaka,
  ganga: (C, pat, rnd, T, o) => water(C, pat, rnd, T, { ...o, sea: false }),
  kishkindha,
  sea: (C, pat, rnd, T, o) => water(C, pat, rnd, T, { ...o, sea: true }),
  lanka,
};

// ---------------------------------------------------------------- tile frames

const TILE_P = centred(TILE_W, TILE_H, boxPoints(28, 0, TOP_Z));
const TILE_ANCHOR = k.iso([0, 0, TOP_Z], TILE_P);
const TEAK = '#5C3D22';

/** The tile's drawn body (plate cell + slab with the material). */
function tileBody(region, pattern) {
  const spec = REGIONS[region];
  const hex = spec[pattern] ?? spec.a;
  const T = tones(hex);
  const C = context(TILE_P);
  const rnd = rng(hashOf(`${region}-${pattern}`));
  const texture = MATERIAL[region](C, pattern, rnd, T, { line: spec.line });
  const plate = C.volume(PLATE, 0, FIELD_Z, TEAK, { steps: 1, bevel: 0 });
  const slab = k.slabOf(SLAB, FIELD_Z, TOP_Z - FIELD_Z, TILE_P, 1, 0.35);
  return `${plate}<g style="${tokenStyle(hex, spec.line)}">${k.solidSvg(slab, { tone: 'hi', inner: texture })}</g>`;
}

const svgOf = (width, height, label, body) => exportSvg({ width, height, label, body });

/** `<region>-a|b` and `ganga`: the revealed tile. */
export function tileSvg(region, pattern = 'a') {
  return svgOf(TILE_W, TILE_H, `${region} ${pattern} block`, tileBody(region, pattern));
}

const FOG_SIGMA = 1.5 * KS;
const fogMatrix = () => {
  const [r, g, b] = [1, 3, 5].map((i) => (0.6 * parseInt(ACCENT.fog.slice(i, i + 2), 16)) / 255);
  return `0.4 0 0 0 ${r.toFixed(4)} 0 0.4 0 0 ${g.toFixed(4)} 0 0 0.4 0 ${b.toFixed(4)} 0 0 0 1 0`;
};

/** `<region>-fog`: the finished `a` tile, desaturated .3, mixed 60 % to #CFCCC4, blurred 1.5 units, clipped to the cell. */
export function fogSvg(region) {
  const hull = (half) => k.slabOf({ x: -half, y: -half, w: half * 2, d: half * 2, r: 0 }, 0, TOP_Z, TILE_P, 1).fill;
  const body = `<defs><filter id="fog" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0.3"/><feColorMatrix type="matrix" values="${fogMatrix()}"/><feGaussianBlur stdDeviation="${FOG_SIGMA.toFixed(2)}"/></filter><clipPath id="fogclip"><path d="${hull(28.5)}"/></clipPath></defs><g clip-path="url(#fogclip)"><g filter="url(#fog)"><path d="${hull(30)}" fill="${REGIONS[region].a}"/>${tileBody(region, 'a')}</g></g>`;
  return svgOf(TILE_W, TILE_H, `${region} fog block`, body);
}

// ---------------------------------------------------------------- numerals (spec 3.5)

const GLYPH_Z = TOP_Z;
const glyphWorld = (digit, dx = 0) =>
  NUMERAL_STROKES[digit].map((stroke) => stroke.map(([u, v]) => [-4 + u + dx, 26 - v, GLYPH_Z]));
const GLYPH_CORNERS = [[-4, 26], [4, 26], [-4, 12], [4, 12]].map(([x, y]) => [x, y, GLYPH_Z]);
const NUM_P = centred(NUM_W, NUM_H, GLYPH_CORNERS);
const NUM_ANCHOR = k.iso([0, 26, GLYPH_Z], NUM_P);

/** One digit: a sheared engraved stroke glyph with a 1 px halo baked in. */
export function numeralSvg(digit, ink) {
  const { ink: inkHex, halo } = NUMERAL_INK[ink];
  const d = glyphWorld(digit)
    .map((stroke) => k.pathOf(stroke.map(([x, y, z]) => k.iso([x, y, z], NUM_P))))
    .join('');
  const body = `<path d="${d}" fill="none" stroke="${halo}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path class="iso-line iso-numeral" data-tone="hi" data-free="both" style="stroke:${inkHex};stroke-width:1.2" d="${d}"/>`;
  return svgOf(NUM_W, NUM_H, `${digit} ${ink}`, body);
}

// ---------------------------------------------------------------- mist and shared FX

const filterDef = (id, sigma) => `<filter id="${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${sigma}"/></filter>`;

/** Soft cloud overhanging the cell by 20 %; tileable (a flat diamond core of 60 units plus puffs inside the frame). */
export function mistSvg(variant) {
  const P = centred(MIST_W, MIST_H, boxPoints(33.6, TOP_Z, TOP_Z));
  const rnd = rng(0x4d157 + variant);
  const [cx, cy] = k.iso([0, 0, TOP_Z], P);
  const diamond = k.pathOf([[-30, -30], [30, -30], [30, 30], [-30, 30]].map(([x, y]) => k.iso([x, y, TOP_Z], P)), true);
  let puffs = '';
  for (let i = 0; i < 12; i++) {
    const x = clamp(cx + (rnd() * 2 - 1) * 27, 10, MIST_W - 10);
    const y = clamp(cy + (rnd() * 2 - 1) * 19, 9, MIST_H - 9);
    const rx = 6 + rnd() * 6;
    const ry = rx * (0.55 + rnd() * 0.2);
    puffs += `<ellipse cx="${tenth(x)}" cy="${tenth(y)}" rx="${tenth(rx)}" ry="${tenth(ry)}" fill="${['#FFFFFF', '#F2F2EF', '#E4E2DA'][i % 3]}" opacity="${(0.6 + rnd() * 0.4).toFixed(2)}"/>`;
  }
  const body = `<defs>${filterDef('m', 2.6)}</defs><g filter="url(#m)"><path d="${diamond}" fill="#F2F2EF"/>${puffs}</g>`;
  return exportSvg({ width: MIST_W, height: MIST_H, label: `mist ${variant}`, body });
}

/** The token shadow: an ink-coloured blurred ellipse of 14 x 8 units on the tile top, alpha .32. */
function shadowSvg() {
  const W = 24;
  const H = 14;
  const P = centred(W, H, [[0, 0, TOP_Z]]);
  const ring = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    return k.iso([7 * Math.cos(a), 4 * Math.sin(a), TOP_Z], P);
  });
  const body = `<defs>${filterDef('s', 0.9)}</defs><path d="${k.pathOf(ring, true)}" fill="${INK}" opacity="0.32" filter="url(#s)"/>`;
  return { svg: exportSvg({ width: W, height: H, label: 'shadow', body }), anchor: { x: W / 2, y: H / 2 }, width: W, height: H };
}

/** The current player's marker: a thin ink ring on the tile top round the token's feet (T43 spec 6.2), 9.5 units in radius. */
function litRingSvg() {
  const W = 24;
  const H = 14;
  const P = centred(W, H, [[0, 0, TOP_Z]]);
  const ring = Array.from({ length: 36 }, (_, i) => {
    const a = (i / 36) * Math.PI * 2;
    return k.iso([9.5 * Math.cos(a), 9.5 * Math.sin(a), TOP_Z], P);
  });
  const body = `<path d="${k.pathOf(ring, true)}" fill="none" stroke="${INK}" stroke-width="0.9" opacity="0.85"/>`;
  return { svg: exportSvg({ width: W, height: H, label: 'lit ring', body }), anchor: { x: W / 2, y: H / 2 }, width: W, height: H };
}

/** Three glints of sunlight on water, white on transparent (alpha is animated at runtime). */
function shimmerSvg() {
  const W = 24;
  const H = 16;
  const P = centred(W, H, [[0, 0, TOP_Z]]);
  const glint = (cx, cy, rx, ry) => {
    const ring = Array.from({ length: 20 }, (_, i) => {
      const a = (i / 20) * Math.PI * 2;
      return k.iso([cx + rx * Math.cos(a), cy + ry * Math.sin(a), TOP_Z], P);
    });
    return `<path d="${k.pathOf(ring, true)}" fill="#F4FBFF"/>`;
  };
  const body = `<defs>${filterDef('g', 0.35)}</defs><g filter="url(#g)">${glint(-8, -4, 7, 0.9)}${glint(6, 2, 8, 1)}${glint(-3, 10, 5, 0.8)}</g>`;
  return { svg: exportSvg({ width: W, height: H, label: 'shimmer', body }), anchor: { x: W / 2, y: H / 2 }, width: W, height: H };
}

/** A round smoke puff (soft, light warm grey with a four-tone core), 8 x 8 logical px. */
function puffSvg() {
  const W = 10;
  const H = 10;
  const circles = [[5, 5.6, 3.2, '#CFC8BA', 0.9], [4.2, 5, 2.8, '#E4DED0', 1], [6, 4.6, 2.3, '#F1ECE0', 1], [4.6, 3.8, 1.6, '#FBF8F0', 1]]
    .map(([x, y, r, fill, op]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" opacity="${op}"/>`)
    .join('');
  const body = `<defs>${filterDef('p', 0.35)}</defs><g filter="url(#p)">${circles}</g>`;
  return { svg: exportSvg({ width: W, height: H, label: 'puff', body }), anchor: { x: 5, y: 5 }, width: W, height: H };
}

/** A forked tongue pointing right (screen +x), anchored at the root on its centre line; runtime rotates and tints it. */
function tongueSvg(long) {
  const length = long ? 7.5 : 4.5;
  const fork = long ? 2.6 : 1.6;
  const W = Math.ceil(length + fork + 2);
  const H = 8;
  const y = H / 2;
  const t = 0.55;
  const stem = `M1 ${y - t} L${1 + length} ${y - t * 0.8} L${1 + length + fork} ${y - fork * 0.55} L${1 + length + fork * 0.35} ${y - 0.05} L${1 + length + fork} ${y + fork * 0.55} L${1 + length} ${y + t * 0.8} L1 ${y + t}Z`;
  const body = `<path d="${stem}" fill="#FFFFFF" stroke="#8C8C8C" stroke-width="0.28" stroke-linejoin="round"/>`;
  return { svg: exportSvg({ width: W, height: H, label: long ? 'tongue long' : 'tongue short', body }), anchor: { x: 1, y }, width: W, height: H };
}

/** The swallowed token's bulge: a 1.6 R x 1.2 R ellipse (R = 3 units) with four-tone shading, white for tinting. */
function bulgeSvg() {
  const R = 3 * KS;
  const rx = 1.6 * R;
  const ry = 1.2 * R;
  const W = Math.ceil(rx * 2 + 3);
  const H = Math.ceil(ry * 2 + 3);
  const [cx, cy] = [W / 2, H / 2];
  const layers = [['#B8B8B8', 1, 1], ['#D2D2D2', 0.88, 0.84], ['#EAEAEA', 0.72, 0.64], ['#FFFFFF', 0.5, 0.42]]
    .map(([fill, sx, sy], i) => `<ellipse cx="${tenth(cx - i * 0.35)}" cy="${tenth(cy - i * 0.3)}" rx="${tenth(rx * sx)}" ry="${tenth(ry * sy)}" fill="${fill}"${i === 0 ? ' stroke="#7C7C7C" stroke-width="0.3"' : ''}/>`)
    .join('');
  return { svg: exportSvg({ width: W, height: H, label: 'bulge', body: layers }), anchor: { x: cx, y: cy }, width: W, height: H };
}

const BIRDS = {
  gull: { body: '#F4F4F0', wing: '#C4CBD0', tip: '#2A2E3A', beak: '#F0B429', belly: '#DCDCD6' },
  crow: { body: '#2E3050', wing: '#1E2040', tip: '#12132C', beak: '#8C8C94', belly: '#3C3F66' },
  parrot: { body: '#3FAE5A', wing: '#2C8E4A', tip: '#E4572E', beak: '#E4572E', belly: '#8CD36E' },
};

/** A bird in flight facing right, wings up (frame 1) or down (frame 2); 24 x 16 logical px, anchor at the body. */
function birdSvg(kind, frame) {
  const c = BIRDS[kind];
  const edge = '#1E1A16';
  const up = frame === 1;
  const sw = 'stroke-width="0.3" stroke-linejoin="round"';
  const far = up ? 'M11.5 7.2 L7.6 1.4 L12.8 3.6 L14 7Z' : 'M11.5 8.6 L7.6 14.4 L12.8 12.2 L14 8.8Z';
  const near = up ? 'M12.6 7.6 L9 0.8 L15.8 3.2 L16 7.8Z' : 'M12.6 8.2 L9 15.2 L15.8 12.8 L16 8.2Z';
  const tipNear = up ? 'M9 0.8 L11.2 1.8 L10 3.2Z' : 'M9 15.2 L11.2 14.2 L10 12.8Z';
  const tail = kind === 'parrot' ? 'M6.6 8.6 L1.6 10.8 L2.4 8.4 L1.2 6.6 L6.8 7.6Z' : 'M6.8 8.7 L3 10.4 L3.6 8.4 L3 6.8 L6.8 7.7Z';
  const body = `<path d="${far}" fill="${c.wing}" stroke="${edge}" ${sw} opacity="0.9"/><path d="${tail}" fill="${c.wing}" stroke="${edge}" ${sw}/><ellipse cx="12" cy="8.1" rx="5.6" ry="1.9" fill="${c.body}" stroke="${edge}" ${sw}/><ellipse cx="11.6" cy="8.8" rx="4" ry="0.9" fill="${c.belly}"/><circle cx="17.4" cy="7.5" r="1.45" fill="${c.body}" stroke="${edge}" ${sw}/><path d="M18.7 7.2 L20.7 7.9 L18.8 8.3Z" fill="${c.beak}" stroke="${edge}" stroke-width="0.25" stroke-linejoin="round"/><circle cx="17.7" cy="7.2" r="0.28" fill="${edge}"/><path d="${near}" fill="${c.wing}" stroke="${edge}" ${sw}/><path d="${tipNear}" fill="${c.tip}"/>`;
  return { svg: exportSvg({ width: 24, height: 16, label: `${kind} ${frame}`, body }), anchor: { x: 12, y: 8 }, width: 24, height: 16 };
}

// ---------------------------------------------------------------- sheets

const TILE_WORLD = { pitch: 56, slab: 54, groove: 1, plateTop: FIELD_Z, topZ: TOP_Z };

/** Frame specs of the `blocks` sheet: 13 base tiles and 7 fog variants. */
export function blockFrames() {
  const frames = [];
  for (const [region, spec] of Object.entries(REGIONS)) {
    const patterns = spec.b ? ['a', 'b'] : ['a'];
    for (const pattern of patterns) {
      const name = region === 'ganga' ? 'ganga' : `${region}-${pattern}`;
      frames.push({ name, svg: tileSvg(region, pattern), width: TILE_W, height: TILE_H, factor: FACTORS.coarse, anchor: { x: TILE_ANCHOR[0], y: TILE_ANCHOR[1] }, meta: { kind: 'tile', region, pattern, fog: false, numeralInk: spec.ink, world: TILE_WORLD } });
    }
    frames.push({ name: `${region}-fog`, svg: fogSvg(region), width: TILE_W, height: TILE_H, factor: FACTORS.coarse, anchor: { x: TILE_ANCHOR[0], y: TILE_ANCHOR[1] }, meta: { kind: 'tile', region, pattern: 'fog', fog: true, numeralInk: 'dark', world: TILE_WORLD } });
  }
  return frames;
}

/** Screen offsets (logical px) a runtime needs to compose numerals from the tile's floor point. */
export function numeralLayout() {
  const tile = k.iso([0, 0, TOP_Z], BASE);
  const sill = k.iso([0, 26, TOP_Z], BASE);
  const step = k.iso([ADVANCE, 0, 0], BASE);
  const origin = k.iso([0, 0, 0], BASE);
  return {
    sill: { x: Math.round((sill[0] - tile[0]) * 100) / 100, y: Math.round((sill[1] - tile[1]) * 100) / 100 },
    advance: { x: Math.round((step[0] - origin[0]) * 100) / 100, y: Math.round((step[1] - origin[1]) * 100) / 100 },
    advanceUnits: ADVANCE,
  };
}

/** Frame specs of the `shared` sheet: mist 2, numerals 20, FX 13 (with the lit ring). */
export function sharedFrames() {
  const layout = numeralLayout();
  const frames = [];
  for (const v of [1, 2]) frames.push({ name: `mist-${v}`, svg: mistSvg(v), width: MIST_W, height: MIST_H, factor: FACTORS.coarse, anchor: { x: MIST_W / 2, y: k.iso([0, 0, TOP_Z], centred(MIST_W, MIST_H, boxPoints(33.6, TOP_Z, TOP_Z)))[1] }, meta: { kind: 'mist', overhang: 0.2 } });
  for (const ink of ['dark', 'bone']) {
    for (const digit of Object.keys(NUMERAL_STROKES)) {
      frames.push({ name: `num-${digit}-${ink}`, svg: numeralSvg(digit, ink), width: NUM_W, height: NUM_H, factor: FACTORS.fine, anchor: { x: NUM_ANCHOR[0], y: NUM_ANCHOR[1] }, meta: { kind: 'numeral', digit: Number(digit), ink, ...layout } });
    }
  }
  const fx = [
    ['shadow', shadowSvg()],
    ['lit-ring', litRingSvg()],
    ['shimmer', shimmerSvg()],
    ['puff', puffSvg()],
    ['tongue-short', tongueSvg(false)],
    ['tongue-long', tongueSvg(true)],
    ['bulge', bulgeSvg()],
    ...['gull', 'crow', 'parrot'].flatMap((kind) => [1, 2].map((f) => [`bird-${kind}-${f}`, birdSvg(kind, f)])),
  ];
  for (const [name, f] of fx) frames.push({ name, svg: f.svg, width: f.width, height: f.height, factor: FACTORS.fine, anchor: f.anchor, meta: { kind: 'fx' } });
  return frames;
}

/** Writes the source SVG of every frame into `dir` (for the line check and review). */
export function writeSvgs(dir, frames) {
  mkdirSync(dir, { recursive: true });
  for (const f of frames) writeFileSync(join(dir, `${f.name}.svg`), `${f.svg}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const svgAt = args.indexOf('--svg');
  const svgDir = svgAt >= 0 ? args.splice(svgAt, 2)[1] : null;
  const outDir = args[0] ?? 'public/assets/iso';
  const blocks = blockFrames();
  const shared = sharedFrames();
  if (svgDir) {
    writeSvgs(svgDir, blocks);
    writeSvgs(svgDir, shared);
  }
  const started = Date.now();
  const results = await buildAtlases([
    { sheet: 'blocks', frames: blocks, options: { outDir, maxSize: 1024 } },
    { sheet: 'shared', frames: shared, options: { outDir, maxSize: 1024 } },
  ]);
  for (const r of results) {
    const mb = (r.width * r.height * 4) / 1048576;
    console.log(`wrote ${r.png} ${r.width}x${r.height} (${Object.keys(r.frames).length} frames, ${mb.toFixed(1)} MB uncompressed)`);
  }
  console.log(`done in ${Date.now() - started} ms`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
