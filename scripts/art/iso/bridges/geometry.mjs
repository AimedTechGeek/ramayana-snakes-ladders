// Plan geometry of the arched stone bridges (T42 spec section 6.2, 6.4, 6.5): the deck route, deck height, openings,
// band cuts, the crossed squares and the deck samples. Pure numbers, no drawing: the builder, the audit and the tests
// all read this one module. World units; x right, y toward the viewer, z up; row band n = floor((672 - y) / 56).
import { STORY_JUMPS } from '../../../../src/core/boards.ts';
import { squareWorld } from '../../iso-board.mjs';
import { CELL, SIZE, TOP_Z } from '../world.mjs';

/** Half width of the deck ribbon the crossed squares are measured with. */
export const RIBBON = 7;
/** Tile plan the crossed squares are measured on: the 54-unit top inset by 5 so a sliver of the ribbon on the outer rim (props strip, groove) is not "over" the square; this reproduces the spec 6.2 table. */
export const TILE_HALF = 22;
export const DECK_THICK = 2.5;
export const CORNICE = 0.6;
/** Lengths of the abutment blocks along the route (spec 6.2: foot 12 deep, top 16 deep). */
export const FOOT_HALF = 6;
/** The top block reaches 6 back toward the viewer and 8 on, so its near corners stay off a coil on the square in front. */
export const TOP_BACK = 6;
export const TOP_FRONT = 8;
export const ABUTMENT_H = 3;
/** Bridges that bow 12 units toward -y at mid-span. */
export const BOW = { 'rama-setu': 12, 'shiva-bow': 12 };
/** Share of each leg the bow's rounded corner takes: 1 = the whole of both legs, a quadratic Bezier (a tighter corner clears the coil on 114 less). */
const FILLET = 1;

export const bandOfY = (y) => Math.floor((SIZE - y) / CELL);
const bandEdgeY = (band) => SIZE - CELL * band;

const hypot = Math.hypot;
const round = (v) => Math.round(v * 1000) / 1000;

/** Separating-axis test of two convex polygons; touching does not count. */
export function polygonsOverlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const axis = [-(q[1] - p[1]), q[0] - p[0]];
      const range = (shape) => {
        const values = shape.map((v) => v[0] * axis[0] + v[1] * axis[1]);
        return [Math.min(...values), Math.max(...values)];
      };
      const [a0, a1] = range(a);
      const [b0, b1] = range(b);
      if (a1 <= b0 + 1e-9 || b1 <= a0 + 1e-9) return false;
    }
  }
  return true;
}

export const tileRect = (square, half = TILE_HALF) => {
  const [x, y] = squareWorld(square);
  return { x0: x - half, x1: x + half, y0: y - half, y1: y + half };
};

export function storyJump(id) {
  const jump = STORY_JUMPS.find((j) => j.id === id && j.kind === 'ladder');
  if (!jump) throw new Error(`bridge ${id}: not a ladder in boards.ts`);
  return jump;
}

/** Everything the drawing, the audit and the runtime need about one bridge. */
export function bridgeGeometry(id) {
  const jump = storyJump(id);
  const [fx, fy] = squareWorld(jump.from);
  const [tx, ty] = squareWorld(jump.to);
  const F = [fx, fy - 21];
  const T = [tx, ty + 20];
  const straight = hypot(T[0] - F[0], T[1] - F[1]);
  const bow = BOW[id] ?? 0;
  // The bowed routes are a 3-point fillet (spec 6.2): F to a corner M, rounded by a quadratic Bezier that takes the
  // last FILLET of each leg, with M placed so the route sits exactly `bow` units toward -y of the chord at mid-span.
  const chordMid = [(F[0] + T[0]) / 2, (F[1] + T[1]) / 2];
  const corner = [chordMid[0], chordMid[1] - bow / (1 - FILLET / 2)];
  const into = (from, to, f) => [to[0] + (from[0] - to[0]) * f, to[1] + (from[1] - to[1]) * f];
  const p1 = into(F, corner, FILLET);
  const p2 = into(T, corner, FILLET);
  const dense = [];
  const pushLine = (a, b, n) => {
    for (let i = 0; i < n; i++) dense.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  };
  if (bow) {
    pushLine(F, p1, 1500);
    for (let i = 0; i < 1000; i++) {
      const u = i / 1000;
      dense.push([
        (1 - u) ** 2 * p1[0] + 2 * (1 - u) * u * corner[0] + u * u * p2[0],
        (1 - u) ** 2 * p1[1] + 2 * (1 - u) * u * corner[1] + u * u * p2[1],
      ]);
    }
    pushLine(p2, T, 1500);
    dense.push(T);
  } else {
    pushLine(F, T, 4000);
    dense.push(T);
  }
  const fine = dense.length - 1;
  const along = [0];
  for (let i = 1; i <= fine; i++)
    along.push(along[i - 1] + hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const Lp = along[fine];
  const count = Math.round(Lp / 0.5);
  const x = [];
  const y = [];
  let at = 0;
  for (let k = 0; k <= count; k++) {
    const target = (Lp * k) / count;
    while (at < fine - 1 && along[at + 1] < target) at++;
    const f = (target - along[at]) / (along[at + 1] - along[at] || 1);
    x.push(dense[at][0] + (dense[at + 1][0] - dense[at][0]) * f);
    y.push(dense[at][1] + (dense[at + 1][1] - dense[at][1]) * f);
  }
  const tangent = x.map((_, k) => {
    const a = Math.max(0, k - 1);
    const b = Math.min(count, k + 1);
    const len = hypot(x[b] - x[a], y[b] - y[a]);
    return [(x[b] - x[a]) / len, (y[b] - y[a]) / len];
  });

  /** Route point and unit direction at arc length s. */
  const sample = (s) => {
    const k = Math.min(count - 1, Math.max(0, Math.floor((s / Lp) * count)));
    const f = (s / Lp) * count - k;
    const lerp = (arr) => arr[k] + (arr[k + 1] - arr[k]) * f;
    const dx = tangent[k][0] + (tangent[k + 1][0] - tangent[k][0]) * f;
    const dy = tangent[k][1] + (tangent[k + 1][1] - tangent[k][1]) * f;
    const len = hypot(dx, dy);
    return { x: lerp(x), y: lerp(y), dx: dx / len, dy: dy / len };
  };

  const openings = Math.max(1, Math.round(straight / 45));
  const h = Math.min(22, Math.round(7 + 0.08 * straight));
  /** Deck top (absolute z) at arc position s. */
  const deckTop = (s) => TOP_Z + 3 + h * Math.sin((Math.PI * s) / Lp);

  // Abutment blocks are turned to the route (spec 6.2 plan, 14 wide x 12 / 16 long, 3 tall): the foot block spans
  // s in [-6, 6] around F and the top block s in [L - 8, L + 8] around T, so the masonry starts at 6 and ends at L - 8.
  const exitFoot = FOOT_HALF;
  const exitTop = Lp - TOP_BACK;

  // Row band edges the route crosses (spec 6.4 rule 1).
  const bandCuts = [];
  for (let band = bandOfY(F[1]) + 1; band <= bandOfY(T[1]); band++) {
    const edge = bandEdgeY(band);
    let lo = 0;
    let hi = Lp;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (sample(m).y > edge) lo = m;
      else hi = m;
    }
    bandCuts.push((lo + hi) / 2);
  }

  const deck = [];
  const route = [];
  for (let s = 0; s < Lp - 1e-6; s += 4) {
    deck.push([round(s), round(deckTop(s))]);
    const p = sample(s);
    route.push([round(p.x), round(p.y)]);
  }
  deck.push([round(Lp), round(deckTop(Lp))]);
  route.push([round(T[0]), round(T[1])]);

  return {
    id,
    jump,
    from: jump.from,
    to: jump.to,
    F,
    T,
    straight,
    bow,
    Lp,
    h,
    openings,
    sample,
    deckTop,
    exitFoot,
    exitTop,
    bandCuts,
    crossed: crossedSquares(jump, sample, Lp),
    deck,
    route,
  };
}

/** Squares (not the foot or the top) whose tile top the deck ribbon of +-7 overlaps. */
function crossedSquares(jump, sample, Lp) {
  const quads = [];
  let prev = null;
  for (let s = 0; s <= Lp + 1e-9; s += 1) {
    const p = sample(Math.min(s, Lp));
    const l = [p.x + RIBBON * p.dy, p.y - RIBBON * p.dx];
    const r = [p.x - RIBBON * p.dy, p.y + RIBBON * p.dx];
    if (prev) quads.push([prev[0], prev[1], r, l]);
    prev = [l, r];
  }
  const out = [];
  for (let square = 1; square <= 144; square++) {
    if (square === jump.from || square === jump.to) continue;
    const r = tileRect(square);
    const rect = [
      [r.x0, r.y0],
      [r.x1, r.y0],
      [r.x1, r.y1],
      [r.x0, r.y1],
    ];
    if (quads.some((q) => polygonsOverlap(q, rect))) out.push(square);
  }
  return out;
}
