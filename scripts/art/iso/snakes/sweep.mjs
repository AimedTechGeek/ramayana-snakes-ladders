// Smooth-shaded sweeps for the standing snakes (T42 spec 5.1, owner: "smooth shading, no tone staircase").
// A sweep is a 3D centreline with a radius per arc length. It is drawn in short slices, each filled with a gradient
// across the section whose stops are the true shading (the kit's light, a colour ramp built from the section 2 tones,
// belly colour on the ventral side), so highlights follow every bend of the coil instead of stepping in four bands.
// Marks (bands, diamonds, spots) are placed on the true surface and lit the same way. Geometry (chunking, caps, outline)
// is the anatomy kit's tubePieces; only the fill is ours. Everything is drawn at `projection scale x 5`: one SVG unit is
// one device pixel of the fine factor, so the kit's 0.1 coordinate rounding stays below a fifth of a device pixel.

import * as G from '../../anatomy/lathe.mjs';
import { iso, pathOf } from '../../anatomy/iso-kit.mjs';
import { tubePieces } from '../../anatomy/tube.mjs';
import { mixHex } from '../common.mjs';
import { INK, tones } from '../tones.mjs';

export const BLOOD = '#8E3B3B';
/** Spacing of the dense centre line: one slice per step (0.5 units = 2 device px at the fine factor). */
export const SPACING = 0.5;
const WHITE = '#FFFFFF';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const one = (value) => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '').replace(/^-0$/, '0');

// ---------------------------------------------------------------- colour

/** Light-to-dark ramp of one hex: [score, hex] with score = normal . light. Built from tones(hex) plus a soft highlight. */
export function ramp(hex) {
  const t = tones(hex);
  return [
    [-1, mixHex(hex, INK, 0.42)],
    [-0.15, t.shades[0]],
    [0.2, t.shades[1]],
    [0.46, t.shades[2]],
    [0.72, t.shades[3]],
    [0.95, mixHex(hex, WHITE, 0.3)],
  ];
}

/** Colour of a ramp at `score`, linear between stops. */
export function rampAt(stops, score) {
  if (score <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (score <= stops[i][0]) {
      const [s0, c0] = stops[i - 1];
      const [s1, c1] = stops[i];
      return mixHex(c0, c1, (score - s0) / (s1 - s0));
    }
  }
  return stops[stops.length - 1][1];
}

/** A paint: body ramp and belly ramp (belly = body 40 % toward blood, spec 5.5). */
export function paintOf(hex, belly = mixHex(hex, BLOOD, 0.4)) {
  return { hex, belly, body: ramp(hex), under: ramp(belly), tones: tones(hex) };
}

// ---------------------------------------------------------------- sweep

/** Unit vector `hint` made perpendicular to `T`, or `fallback` when they are parallel. */
function perpendicular(hint, T, fallback) {
  const v = G.sub3(hint, G.mul3(T, G.dot3(hint, T)));
  if (G.len3(v) > 0.15) return G.unit3(v);
  const w = G.sub3(fallback, G.mul3(T, G.dot3(fallback, T)));
  return G.unit3(w);
}

/**
 * A sweep along `route` (3D points) with `radius(u)` (u 0..1 along the route; number or function).
 * `down(s, total)` gives the ventral hint at arc length s (default straight down); belly colour lies on that side.
 */
export function makeSweep(route, radius, P, { spacing = SPACING, down = () => [0, 0, -1], fallback = [0, 1, 0] } = {}) {
  const dense = G.resample(route, spacing);
  const total = G.pathLength(dense);
  const lengths = [0];
  for (let i = 1; i < dense.length; i++) lengths.push(lengths[i - 1] + G.len3(G.sub3(dense[i], dense[i - 1])));
  const radiusAt = typeof radius === 'function' ? radius : () => radius;
  const V = G.viewOf(P);

  const index = (s) => {
    let lo = 0;
    let hi = lengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (lengths[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const pointAt = (s) => {
    const i = index(clamp(s, 0, total));
    const span = lengths[i + 1] - lengths[i] || 1;
    return G.lerp3(dense[i], dense[i + 1], clamp((s - lengths[i]) / span, 0, 1));
  };
  const tangentAt = (s) => {
    const a = pointAt(Math.max(0, s - 0.5));
    const b = pointAt(Math.min(total, s + 0.5));
    return G.unit3(G.sub3(b, a));
  };

  /** Frame at arc length s: centre, tangent, radius, dorsal direction d and lateral e (d, e, T orthonormal). */
  const frameAt = (s) => {
    const c = pointAt(s);
    const T = tangentAt(s);
    const v = perpendicular(down(s, total), T, fallback);
    const d = G.mul3(v, -1);
    const e = G.cross3(T, d);
    return { s, c, T, d, e, r: radiusAt(clamp(s / total, 0, 1)), v };
  };

  /** Surface point and unit normal at (s, a): a = angle from the dorsal direction toward e. */
  const surf = (s, a, lift = 0) => {
    const f = frameAt(s);
    const n = G.add3(G.mul3(f.d, Math.cos(a)), G.mul3(f.e, Math.sin(a)));
    return { p: G.add3(f.c, G.mul3(n, f.r + lift)), n, f };
  };

  /** Visible window of the section angle: a in [a0 - 90deg, a0 + 90deg] faces the viewer. */
  const window = (f) => {
    const a0 = Math.atan2(G.dot3(f.e, V), G.dot3(f.d, V));
    return [a0 - Math.PI / 2, a0 + Math.PI / 2];
  };

  return { P, V, dense, total, radiusAt, pointAt, tangentAt, frameAt, surf, window, k: G.scaleOf(P), route };
}

/** Wrap an angle into (-PI, PI]. */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- lighting

const unitL = (P) => G.lightOf(P);

/** Colour of the surface at normal `n` with ventral direction `v`. */
export function surfaceColour(paint, n, v, L) {
  const score = G.dot3(n, L);
  const base = rampAt(paint.body, score);
  const w = smoothstep(0.28, 0.78, G.dot3(n, v));
  if (w <= 0) return base;
  return mixHex(base, rampAt(paint.under, score), w);
}

// ---------------------------------------------------------------- chunks

let ids = 0;
export const resetIds = () => {
  ids = 0;
};
/** A fresh document-unique id. */
export const uid = (prefix = 'u') => `${prefix}${ids++}`;

/** Gradient across the section at a station: stops from the screen limb on one side to the other. */
function sectionGradient(sweep, paint, f, ramps) {
  const { P, V } = sweep;
  const c = iso(f.c, P);
  const ahead = iso(G.add3(f.c, G.mul3(f.T, 0.4)), P);
  let tx = ahead[0] - c[0];
  let ty = ahead[1] - c[1];
  const length = Math.hypot(tx, ty);
  if (length < 1e-6) return null;
  tx /= length;
  ty /= length;
  const nx = -ty;
  const ny = tx;
  let n1 = G.cross3(f.T, V);
  if (G.len3(n1) < 1e-6) return null;
  n1 = G.unit3(n1);
  let n2 = G.unit3(G.cross3(f.T, n1));
  if (G.dot3(n2, V) < 0) n2 = G.mul3(n2, -1);
  const onScreen = iso(G.add3(f.c, n1), P);
  const sign = (onScreen[0] - c[0]) * nx + (onScreen[1] - c[1]) * ny >= 0 ? 1 : -1;
  const half = f.r * sweep.k;
  const id = `g${ids++}`;
  const stops = [];
  for (let step = 0; step <= 8; step++) {
    const t = -1 + step / 4;
    const n = G.add3(G.mul3(n1, sign * t), G.mul3(n2, Math.sqrt(Math.max(0, 1 - t * t))));
    const colour = ramps(n);
    stops.push(`<stop offset="${(step / 8).toFixed(3)}" stop-color="${colour}"/>`);
  }
  const grad = `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${one(c[0] - nx * half)}" y1="${one(c[1] - ny * half)}" x2="${one(c[0] + nx * half)}" y2="${one(c[1] + ny * half)}">${stops.join('')}</linearGradient>`;
  return { id, grad };
}

/**
 * The chunks of a sweep (kit tubePieces with no stripes) and, per chunk, the slices that paint it. Returns the pieces
 * with `.slices` (SVG) and `.arc0` (arc length of the first point).
 */
export function chunksOf(sweep, { maxLength = 6, breaks = [], gaps = [], caps = true } = {}) {
  return tubePieces(sweep.route, (u) => sweep.radiusAt(u), sweep.P, {
    maxLength,
    spacing: SPACING,
    breaks,
    gaps,
    stripes: false,
    caps,
  });
}

/** Arc length of the dense point nearest to `p`, searched within `near` +- 1.5 units. */
function arcOf(sweep, p, near) {
  const { dense } = sweep;
  let best = Infinity;
  let at = near;
  for (let s = Math.max(0, near - 1.5); s <= Math.min(sweep.total, near + 1.5); s += 0.05) {
    const d = G.len3(G.sub3(sweep.pointAt(s), p));
    if (d < best) {
      best = d;
      at = s;
    }
  }
  void dense;
  return at;
}

/** Slice markup (gradient defs + quads) of one chunk, from its centreline points and radii. */
export function slicesOf(sweep, paint, piece) {
  const { P } = sweep;
  const L = unitL(P);
  const pts = piece.points;
  const arc0 = arcOf(sweep, pts[0], Math.max(0, piece.from - 0.5));
  const flat = pts.map((p) => iso(p, P));
  const arcs = [];
  let walked = arc0;
  pts.forEach((p, i) => {
    if (i > 0) walked += G.len3(G.sub3(p, pts[i - 1]));
    arcs.push(walked);
  });
  const edge = pts.map((_, i) => {
    const a = flat[Math.max(0, i - 1)];
    const b = flat[Math.min(pts.length - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const length = Math.hypot(tx, ty) || 1;
    tx /= length;
    ty /= length;
    const half = piece.radii[i] * sweep.k;
    return { l: [flat[i][0] - ty * half, flat[i][1] + tx * half], r: [flat[i][0] + ty * half, flat[i][1] - tx * half] };
  });
  let defs = '';
  let quads = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const mid = (arcs[i] + arcs[i + 1]) / 2;
    const f = sweep.frameAt(clamp(mid, 0, sweep.total));
    const colour = (n) => surfaceColour(paint, n, f.v, L);
    const g = sectionGradient(sweep, paint, f, colour, L);
    if (!g) continue;
    defs += g.grad;
    const j = Math.min(pts.length - 1, i + 2);
    const d = pathOf([edge[i].l, edge[i + 1].l, edge[j].l, edge[j].r, edge[i + 1].r, edge[i].r], true);
    quads += `<path d="${d}" fill="url(#${g.id})"/>`;
  }
  return { defs, quads };
}


/** One chunk as SVG: flat underlay (and caps), gradient slices, marks, then the outline. */
export function chunkSvg(sweep, paint, piece, marks = '') {
  const { defs, quads } = slicesOf(sweep, paint, piece);
  return `<g class="tb"><defs>${defs}</defs><path class="tb-body" d="${piece.body}"/>${quads}${marks}<path class="iso-line tb-edge" data-tone="hi" d="${piece.edges}"/></g>`;
}

// ---------------------------------------------------------------- marks on the surface

/** Screen path of a closed polygon given as (s, a) pairs on the sweep. */
function surfacePolygon(sweep, pairs, lift = 0.02) {
  const pts = pairs.map(([s, a]) => iso(sweep.surf(s, a, lift).p, sweep.P));
  return pathOf(pts, true);
}

/** A gradient (in `ramps`) across the section at station s, for a mark centred there. */
function markGradient(sweep, paint, s, ramps) {
  const f = sweep.frameAt(clamp(s, 0, sweep.total));
  const L = unitL(sweep.P);
  const g = sectionGradient(sweep, paint, f, (n) => ramps(n, f, L), L);
  return g;
}

/**
 * Marks of a pattern for the chunk [from, to): returns SVG (defs + paths). The pattern anchors are at stations
 * phase + i * pitch; chunk breaks must lie halfway between stations so that no mark is cut.
 *  kind 'bands'    a full-wrap band `width` long, tinted with `colour`
 *  kind 'diamonds' a dorsal diamond `length` long and `span` radians wide
 *  kind 'spots'    two rows of round dots of radius `size`, alternating
 */
export function marksFor(sweep, paint, pattern, from, to, extent = [0, sweep.total]) {
  const { kind, pitch, colour, phase = 0 } = pattern;
  if (!colour) return '';
  const inkPaint = paintOf(colour);
  const L = unitL(sweep.P);
  const shaded = (n, f) => surfaceColour(inkPaint, n, f.v, L);
  let defs = '';
  let body = '';
  const first = Math.ceil((from - phase) / pitch);
  const last = Math.ceil((to - phase) / pitch) - 1;
  for (let i = first; i <= last; i++) {
    if (i % (pattern.every ?? 1) !== 0) continue;
    const s = phase + i * pitch + (pattern.offset ?? 0);
    if (s < extent[0] || s > extent[1]) continue;
    const f = sweep.frameAt(clamp(s, 0, sweep.total));
    const [w0, w1] = sweep.window(f);
    if (kind === 'bands') {
      const half = (pattern.width ?? pitch * 0.4) / 2;
      const taper = pattern.taper ?? 0;
      const front = [];
      const back = [];
      const steps = 14;
      for (let j = 0; j <= steps; j++) {
        const a = w0 + ((w1 - w0) * j) / steps;
        const shrink = 1 - taper * smoothstep(0.55, 1, Math.abs(wrap(a - 0)) / Math.PI);
        front.push([s + half * shrink, a]);
        back.push([s - half * shrink, a]);
      }
      const grad = markGradient(sweep, inkPaint, s, (n, fr) => shaded(n, fr));
      if (!grad) continue;
      defs += grad.grad;
      body += `<path d="${surfacePolygon(sweep, [...front, ...back.reverse()])}" fill="url(#${grad.id})"/>`;
    } else if (kind === 'diamonds') {
      const half = (pattern.length ?? pitch * 0.9) / 2;
      const span = pattern.span ?? 1.25;
      const a0 = Math.max(-span, wrap(w0));
      const a1 = Math.min(span, wrap(w1));
      if (!(wrap(w0) < span && wrap(w1) > -span)) continue;
      const up = [];
      const down = [];
      const steps = 16;
      for (let j = 0; j <= steps; j++) {
        const a = a0 + ((a1 - a0) * j) / steps;
        const reach = half * (1 - Math.abs(a) / span);
        up.push([s + reach, a]);
        down.push([s - reach, a]);
      }
      const grad = markGradient(sweep, inkPaint, s, (n, fr) => shaded(n, fr));
      if (!grad) continue;
      defs += grad.grad;
      body += `<path d="${surfacePolygon(sweep, [...up, ...down.reverse()])}" fill="url(#${grad.id})"/>`;
    } else if (kind === 'spots') {
      const rows = pattern.rows ?? [-0.62, 0.62];
      const size = pattern.size ?? 0.55;
      rows.forEach((a, row) => {
        const sc = s + (row % 2 ? pitch / 2 : 0);
        if (sc < from || sc >= to) return;
        const fr = sweep.frameAt(clamp(sc, 0, sweep.total));
        const [x0, x1] = sweep.window(fr);
        const centre = wrap(a);
        if (!(wrap(x0) + 0.2 < centre && centre < wrap(x1) - 0.2)) return;
        const { n, p } = sweep.surf(sc, a, 0.02);
        const facing = G.dot3(n, sweep.V);
        if (facing < 0.2) return;
        const ring = [];
        for (let j = 0; j < 10; j++) {
          const t = (j / 10) * Math.PI * 2;
          ring.push([sc + (size * Math.cos(t)) / 1, a + (size * Math.sin(t)) / fr.r]);
        }
        body += `<path d="${surfacePolygon(sweep, ring)}" fill="${surfaceColour(inkPaint, n, fr.v, L)}"/>`;
        void p;
      });
    }
  }
  return `${defs ? `<defs>${defs}</defs>` : ''}${body}`;
}

/** A polygon of (s, a) pairs on the sweep, lit like the surface in `colour` (one gradient across the section at `s`). */
export function markPolygon(sweep, pairs, colour, s) {
  const inkPaint = paintOf(colour);
  const L = unitL(sweep.P);
  const grad = markGradient(sweep, inkPaint, s, (n, f) => surfaceColour(inkPaint, n, f.v, L));
  if (!grad) return '';
  return `<defs>${grad.grad}</defs><path d="${surfacePolygon(sweep, pairs)}" fill="url(#${grad.id})"/>`;
}

/** Pattern break positions: halfway between stations, so a chunk never cuts a mark. */
export function breaksFor(pattern, total) {
  if (!pattern) return [];
  const out = [];
  const { pitch, phase = 0 } = pattern;
  for (let s = phase + pitch / 2; s < total; s += pitch) if (s > 0) out.push(s);
  return out;
}
