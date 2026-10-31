// One arched stone bridge as anatomy solids (T42 spec 6.2-6.4). Everything is a convex prism drawn by `G.prismOf` in the
// vertical plane of the route (u along, v up) and extruded across the deck, so every voussoir, spandrel stone, deck
// flag, rail and post is a real part with four-tone faces, and each records its true shape for the audit.
// The finished bridge is cut into one SVG per row band (render.mjs).
import * as A from '../../anatomy/audit.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { boardProjection, toScreen } from '../../iso-board.mjs';
import { mixHex } from '../common.mjs';
import { TOP_Z } from '../world.mjs';
import { allCoils } from './coils.mjs';
import {
  ABUTMENT_H,
  bandOfY,
  bridgeGeometry,
  CORNICE,
  DECK_THICK,
  TOP_BACK,
  TOP_FRONT,
} from './geometry.mjs';
import { hashUnit, MOSS, mat, STORIES, tint } from './materials.mjs';
import { area, centroid, chordAtU, chordAtV, clean, clipConvex, inside } from './poly.mjs';
import { addStory } from './stories.mjs';

export const P = boardProjection();
export const V = G.viewOf(P);
const UP = [0, 0, 1];
const FLOOR = { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] };

export const TUNING = {
  /** Half widths across the route (spec: deck 14, walkway 12). */
  deck: 7,
  body: 6,
  cornice: 7.3,
  ring: 6.4,
  /** Arch ring thickness and pier half width. */
  archRing: 3,
  span: 8,
  courseHeight: 2.8,
  courseLength: 5.4,
};

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len2 = (a) => Math.hypot(a[0], a[1]);
const lerp = (a, b, t) => a + (b - a) * t;

/** Builds every part of one bridge. Returns what render.mjs and the audit need. */
export function buildBridge(id, options = {}) {
  const geo = bridgeGeometry(id);
  const story = STORIES[id];
  const R = A.recorder(P);
  const parts = new Set();
  const moss = [];
  const tr = options.ring ?? TUNING.archRing;

  const stone = story.stone;
  const tone = (name, hex, spread = 1) => mat(tint(hex, hashUnit(`${id}:${name}`) * spread));
  const dressed = (name) => tone(name, mixHex(stone, '#FFFFFF', 0.14), 0.6);
  const rubble = (name) => tone(name, stone, 1);

  // ------------------------------------------------------------------ frames and parts
  const frameAlong = (o, dx, dy) => G.frameOf(o, [-dy, dx, 0], [dx, dy, 0], UP);
  /** Frame of a chord from arc s0 to s1: u along the chord, o on the ground under its start. */
  const chordFrame = (s0, s1) => {
    const a = geo.sample(s0);
    const b = geo.sample(s1);
    const d = sub([b.x, b.y], [a.x, a.y]);
    const length = len2(d);
    return { F: frameAlong([a.x, a.y, TOP_Z], d[0] / length, d[1] / length), length };
  };
  const world = (F, t, u, v) => [
    F.o[0] + F.a[0] * t + F.u[0] * u,
    F.o[1] + F.a[1] * t + F.u[1] * u,
    F.o[2] + v,
  ];
  const sideOf = (F) => (G.dot3(F.a, V) > 0 ? 1 : -1);
  const flat = (F, t, pts) => pts.map(([u, v]) => k.iso(world(F, t, u, v), P));
  /** A polyline on the visible lateral face of a part spanning t0..t1. */
  const faceLine = (F, t0, t1, pts, lineTone = 'faint', closed = false) =>
    k.lineSvg(k.pathOf(flat(F, sideOf(F) > 0 ? t1 : t0, pts), closed), { tone: lineTone });
  /** A segment on the top face: between lateral ta/tb at along-positions ua/ub, height from vOf(u). */
  const topSegment = (F, vOf, ta, ua, tb, ub, lineTone = 'faint') =>
    k.lineSvg(k.segment(world(F, ta, ua, vOf(ua)), world(F, tb, ub, vOf(ub)), P), { tone: lineTone });

  /** One prism part: draws and records it, returns its record. */
  function put(owner, name, F, poly, t0, t1, o = {}) {
    const ring = clean(poly);
    if (ring.length < 3 || Math.abs(area(ring)) < 0.03) return null;
    const paths = G.prismOf(F, ring, t0, t1, P);
    const svg = k.solidSvg(paths, { tone: 'hi', className: o.mat, inner: o.inner ?? '' }) + (o.extra ?? '');
    const id = R.nameFor(name);
    const shape = R.solid(
      A.prism(F, ring, t0, t1, { name: `${id}.shape`, owner, ...(o.ground ? { ground: true } : {}) }),
    );
    const [cu, cv] = centroid(ring);
    const centre = world(F, (t0 + t1) / 2, cu, cv);
    // `unit`: the world point whose row band the part belongs to (an arch ring is cut as one unit, spec 6.4 rule 1).
    R.put({
      piece: owner,
      at: centre,
      bias: o.bias ?? 0,
      svg,
      shapes: [shape],
      name: id,
      centre: o.unit ?? centre,
    });
    parts.add(name.replace(/[#:.].*$/, ''));
    return { shape, centre, ring };
  }
  /** A prism standing on the floor plane (axis-aligned plan, z0..z1). */
  const putFloor = (owner, name, plan, z0, z1, o = {}) => put(owner, name, FLOOR, plan, z0, z1, o);

  // ------------------------------------------------------------------ chunk layout
  const { Lp } = geo;
  const e0 = geo.exitFoot;
  const e1 = geo.exitTop;
  // A span too short for the table's openings still gets one real (small) opening: shabari's groove between the blocks.
  const bays = e1 - e0 >= 14 ? geo.openings : e1 - e0 >= 2.4 ? 1 : 0;
  const bayWidth = bays ? (e1 - e0) / bays : 0;
  // Pier lines: equal bays, except that the bay a snake coil stands under is centred on it (the coil sits in the
  // middle of that opening, where the arch is tallest), the other piers spreading evenly around it.
  const piers = Array.from({ length: bays + 1 }, (_, j) => e0 + j * bayWidth);
  for (const coil of allCoils()) {
    const [v] = coil.volumes;
    let nearest = Infinity;
    let sCoil = 0;
    for (let s = e0; s <= e1; s += 0.25) {
      const p = geo.sample(s);
      const d = Math.hypot(p.x - v.c[0], p.y - v.c[1]);
      if (d < nearest) [nearest, sCoil] = [d, s];
    }
    const j = piers.findIndex((s, q) => q < bays && sCoil >= s && sCoil < piers[q + 1]);
    if (nearest > v.r + 6.4 || j < 1 || j > bays - 2) continue;
    piers[j] = sCoil - bayWidth / 2;
    piers[j + 1] = sCoil + bayWidth / 2;
    for (let q = 1; q < j; q++) piers[q] = lerp(e0, piers[j], q / j);
    for (let q = j + 2; q < bays; q++) piers[q] = lerp(piers[j + 1], e1, (q - j - 1) / (bays - j - 1));
  }
  const pier = (j) => piers[j];
  const anchors = [
    0,
    e0,
    e1,
    Lp,
    ...geo.bandCuts,
    ...(bays ? Array.from({ length: bays - 1 }, (_, j) => pier(j + 1)) : []),
  ]
    .sort((a, b) => a - b)
    .filter((s, i, all) => i === 0 || s - all[i - 1] > 0.15);
  const bounds = [];
  anchors.slice(0, -1).forEach((a, i) => {
    const b = anchors[i + 1];
    const n = Math.max(1, Math.ceil((b - a) / TUNING.span - 1e-9));
    for (let q = 0; q < n; q++) bounds.push(lerp(a, b, q / n));
  });
  bounds.push(Lp);
  const chunks = bounds.slice(0, -1).map((s0, i) => ({ s0, s1: bounds[i + 1], i }));
  const deckV = (s) => geo.deckTop(s) - TOP_Z;
  /** Deck underside relative to the tile: clamped to the abutment top over the end blocks. */
  const underV = (s) =>
    s < e0 || s > e1 ? Math.max(deckV(s) - DECK_THICK, ABUTMENT_H) : deckV(s) - DECK_THICK;

  // ------------------------------------------------------------------ abutments
  // The blocks face the same way as the chord of the bay beside them, so their end faces meet the first and last bay
  // flush even on the bowed routes.
  const chordDir = (s0, s1) => {
    const a = geo.sample(s0);
    const b = geo.sample(s1);
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    return { dx: (b.x - a.x) / l, dy: (b.y - a.y) / l };
  };
  const footDir = bays ? chordDir(pier(0), pier(1)) : geo.sample(0);
  const topDir = bays ? chordDir(pier(bays - 1), pier(bays)) : geo.sample(Lp);
  const footFrame = frameAlong([geo.F[0], geo.F[1], TOP_Z], footDir.dx, footDir.dy);
  const topFrame = frameAlong([geo.T[0], geo.T[1], TOP_Z], topDir.dx, topDir.dy);
  const block = (name, F, u0, u1, extraInner = '') => {
    const t = TUNING.deck;
    const plan = [
      [u0, 0],
      [u1, 0],
      [u1, ABUTMENT_H],
      [u0, ABUTMENT_H],
    ];
    const inset = 1.1;
    const panel = [
      [u0 + inset, -t + inset],
      [u1 - inset, -t + inset],
      [u1 - inset, t - inset],
      [u0 + inset, t - inset],
    ].map(([u, tt]) => k.iso(world(F, tt, u, ABUTMENT_H), P));
    const seams = [-t / 2, 0, t / 2].map((tt) =>
      k.lineSvg(k.segment(world(F, tt, u0 + inset, ABUTMENT_H), world(F, tt, u1 - inset, ABUTMENT_H), P), {
        tone: 'faint',
      }),
    );
    const inner =
      k.lineSvg(k.pathOf(panel, true), { tone: 'faint' }) +
      seams.join('') +
      faceLine(
        F,
        -t,
        t,
        [
          [u0, 1.1],
          [u1, 1.1],
        ],
        'faint',
      ) +
      extraInner;
    // The blocks belong to the masonry assembly: a bowed bay meets them at a slight angle, hidden inside the stone.
    return put('masonry', name, F, plan, -t, t, { mat: dressed(name), ground: true, inner });
  };
  block('stand.foot', footFrame, -6, 6);
  // The Shiva bow top: a burst star, 6 spokes between a dot ring and an outer ring, all on the top face of the block.
  const starLines = () => {
    if (story.top !== 'star') return '';
    const at = (r, a) => k.iso(world(topFrame, Math.cos(a) * r, 4.6 + Math.sin(a) * r, ABUTMENT_H), P);
    const ring = (r) =>
      k.lineSvg(
        k.pathOf(
          Array.from({ length: 25 }, (_, q) => at(r, (q / 24) * 6.2832)),
          true,
        ),
        { tone: 'lo' },
      );
    const spokes = Array.from({ length: 6 }, (_, q) =>
      k.pathOf([at(0.8, (q / 6) * 6.2832 + 0.3), at(3.2, (q / 6) * 6.2832 + 0.3)]),
    );
    return ring(0.8) + ring(3.2) + k.lineSvg(spokes.join(''), { tone: 'lo' });
  };
  block('stand.top', topFrame, -TOP_BACK, TOP_FRONT, starLines());

  // ------------------------------------------------------------------ deck, cornice, fillers
  const deckMat = (i) => tone(`deck${i}`, mixHex(stone, '#FFFFFF', 0.08), 0.8);
  for (const c of chunks) {
    const { F, length } = chordFrame(c.s0, c.s1);
    const t0 = deckV(c.s0);
    const t1 = deckV(c.s1);
    const b0 = underV(c.s0);
    const b1 = underV(c.s1);
    const topV = (u) => lerp(t0, t1, u / length);
    const D = TUNING.deck;
    const stagger = c.i % 2 ? 1 : -1;
    // Rama Setu: the deck is a continuous bed 1.2 thick under stepping slabs (added below); elsewhere flagstones.
    if (story.rail === 'blocks') {
      const bt0 = Math.max(t0 - 1.3, b0);
      const bt1 = Math.max(t1 - 1.3, b1);
      if (bt0 - b0 > 0.05 || bt1 - b1 > 0.05)
        put(
          'deck',
          `bed.${c.i}`,
          F,
          [
            [0, b0],
            [length, b1],
            [length, bt1],
            [0, bt0],
          ],
          -6.2,
          6.2,
          { mat: deckMat(c.i) },
        );
    } else {
      const inner =
        topSegment(F, topV, 0, 0, 0, length) + topSegment(F, topV, 0, length / 2, stagger * D, length / 2);
      put(
        'deck',
        `deck.${c.i}`,
        F,
        [
          [0, b0],
          [length, b1],
          [length, t1],
          [0, t0],
        ],
        -D,
        D,
        { mat: deckMat(c.i), inner },
      );
    }
    c.F = F;
    c.length = length;
    c.topV = topV;
    const midZone = c.s0 >= e0 - 1e-6 && c.s1 <= e1 + 1e-6;
    if (midZone) {
      const bot = (s) => deckV(s) - DECK_THICK - CORNICE;
      const dentils = [];
      for (let u = 0.9; u < length - 0.4; u += 1.8) {
        dentils.push(
          faceLine(
            F,
            -TUNING.cornice,
            TUNING.cornice,
            [
              [u, lerp(bot(c.s0), bot(c.s1), u / length)],
              [u, lerp(b0, b1, u / length)],
            ],
            'faint',
          ),
        );
      }
      put(
        'masonry',
        `cornice.${c.i}`,
        F,
        [
          [0, bot(c.s0)],
          [length, bot(c.s1)],
          [length, b1],
          [0, b0],
        ],
        -TUNING.cornice,
        TUNING.cornice,
        {
          mat: dressed(`cornice${c.i}`),
          inner: dentils.join(''),
        },
      );
    } else if (b0 > ABUTMENT_H + 0.05 || b1 > ABUTMENT_H + 0.05) {
      put(
        'masonry',
        `filler.${c.i}`,
        F,
        [
          [0, ABUTMENT_H],
          [length, ABUTMENT_H],
          [length, b1],
          [0, b0],
        ],
        -TUNING.body,
        TUNING.body,
        {
          mat: rubble(`filler${c.i}`),
        },
      );
    }
  }

  // ------------------------------------------------------------------ bays: arch rings and spandrel stones
  const archInfo = [];
  for (let j = 0; j < bays; j++) {
    const sa = pier(j);
    const sb = pier(j + 1);
    const { F, length } = chordFrame(sa, sb);
    const uOf = (s) => ((s - sa) * length) / (sb - sa);
    const inner = bounds.filter((s) => s > sa + 1e-6 && s < sb - 1e-6);
    const topPts = [sa, ...inner, sb].map((s) => [uOf(s), deckV(s) - DECK_THICK - CORNICE]);
    const rtop = (u) => {
      for (let q = 0; q < topPts.length - 1; q++) {
        if (u <= topPts[q + 1][0] + 1e-9)
          return lerp(topPts[q][1], topPts[q + 1][1], (u - topPts[q][0]) / (topPts[q + 1][0] - topPts[q][0]));
      }
      return topPts[topPts.length - 1][1];
    };
    const region = [[0, 0], [length, 0], ...[...topPts].reverse()];
    const c = length / 2;
    const { tr: ringT, aH, b, p, ok } = fitArch(F, length, c, rtop, bays === 1 && length < 8);
    if (!ok) console.warn(`${id}: bay ${j} arch cannot clear a coil (b ${b.toFixed(1)})`);
    const count = aH < 2.5 ? 3 : Math.max(5, 2 * Math.round(aH / 5) + 1);
    const unitCentre = world(F, 0, length / 2, 0);
    // Superellipse of exponent p (2 = ellipse): a flatter crown where a coil stands under the arch.
    const pow = (x, e) => Math.sign(x) * Math.abs(x) ** e;
    const intr = (th) => [c + aH * pow(Math.cos(th), 2 / p), b * pow(Math.sin(th), 2 / p)];
    const extr = (th) => [
      c + (aH + ringT) * pow(Math.cos(th), 2 / p),
      (b + ringT) * pow(Math.sin(th), 2 / p),
    ];
    const theta = (i) => Math.PI - (Math.PI * i) / count;
    const keystone = (count - 1) / 2;
    const T = TUNING;
    for (let i = 0; i < count; i++) {
      const [th0, th1] = [theta(i), theta(i + 1)];
      const quad = [intr(th0), intr(th1), extr(th1), extr(th0)];
      const key = i === keystone;
      const rosette = key ? keystoneCarving(F, -T.ring, T.ring, quad) : '';
      put('masonry', `voussoir.${j}.${i}`, F, quad, -T.ring, T.ring, {
        unit: unitCentre,
        mat: key ? mat(mixHex(stone, '#FFFFFF', 0.28)) : dressed(`v${j}.${i}`),
        inner: rosette,
      });
    }
    for (let i = 0; i < count; i++) {
      const [th0, th1] = [theta(i), theta(i + 1)];
      const dir = (th) => {
        const d = sub(extr(th), intr(th));
        const l = len2(d);
        return [d[0] / l, d[1] / l];
      };
      const [d0, d1] = [dir(th0), dir(th1)];
      const e0p = extr(th0);
      const e1p = extr(th1);
      const K = 80;
      const wedge = [
        e0p,
        e1p,
        [e1p[0] + d1[0] * K, e1p[1] + d1[1] * K],
        [e0p[0] + d0[0] * K, e0p[1] + d0[1] * K],
      ];
      const piece = clean(clipConvex(wedge, region));
      if (piece.length < 3 || Math.abs(area(piece)) < 0.05) continue;
      const lines = courseLines(F, -T.body, T.body, piece);
      const mossBlob = piece.some((p) => p[1] < 1) ? mossPatch(F, -T.body, T.body, piece, `${j}.${i}`) : '';
      put('masonry', `spandrel.${j}.${i}`, F, piece, -T.body, T.body, {
        unit: unitCentre,
        mat: rubble(`s${j}.${i}`),
        ground: Math.min(...piece.map((p) => p[1])) < 0.01,
        inner: lines + mossBlob,
      });
    }
    archInfo.push({ j, sa, sb, centre: c, aH, b, tr: ringT, p, F, length });
  }

  // ------------------------------------------------------------------ piers: a plinth course, and boat prows on guha's
  for (let j = 1; j < bays; j++) {
    const s = pier(j);
    const p = geo.sample(s);
    const F = frameAlong([p.x, p.y, TOP_Z], p.dx, p.dy);
    const unit = world(F, 0, 0, 0);
    put(
      'masonry',
      `plinth.${j}`,
      F,
      [
        [-4.2, 0],
        [4.2, 0],
        [4.2, 0.7],
        [-4.2, 0.7],
      ],
      -7,
      7,
      {
        mat: dressed(`plinth${j}`),
        unit,
        ground: true,
        inner: faceLine(
          F,
          -7,
          7,
          [
            [-4.2, 0.35],
            [4.2, 0.35],
          ],
          'faint',
        ),
      },
    );
    if (id === 'guha') {
      // Piers are boat prows (spec 6.3): a pointed cutwater at each lateral end, as tall as the pier.
      const top = deckV(s) - DECK_THICK - CORNICE - 0.3;
      for (const side of [-1, 1]) {
        const at = (u, t) => [F.o[0] + F.u[0] * u + F.a[0] * t, F.o[1] + F.u[1] * u + F.a[1] * t];
        putFloor(
          'masonry',
          `prow.${j}.${side}`,
          [at(-3, side * 6), at(3, side * 6), at(0, side * 9.8)],
          TOP_Z,
          TOP_Z + top,
          {
            mat: dressed(`prow${j}.${side}`),
            unit,
            ground: true,
            inner: k.lineSvg(k.segment(world(F, side * 9.8, 0, top), world(F, side * 9.8, 0, 0), P), {
              tone: 'lo',
            }),
          },
        );
      }
    }
  }

  /**
   * Arch of one bay: the tallest superellipse that fits under the deck, flattened (exponent p up to 3, ring thinned)
   * only as far as needed for the intrados to clear the snake coils standing under it (spec 6.5, wedding over kaikeyi).
   * The coils are the spec 5.1 frustums: the surface height over each point of the barrel's plan is what the intrados
   * must clear. `narrow` bays (shabari's groove) may be taller than wide.
   */
  function fitArch(F, length, c, rtop, narrow = false) {
    const coils = allCoils()
      .map((coil) => coil.volumes[0])
      .map((v) => ({
        v,
        t: (v.c[0] - F.o[0]) * F.a[0] + (v.c[1] - F.o[1]) * F.a[1],
        u: (v.c[0] - F.o[0]) * F.u[0] + (v.c[1] - F.o[1]) * F.u[1],
      }))
      .filter(({ v, t, u }) => Math.abs(t) - TUNING.ring < v.r && u + v.r > 0 && u - v.r < length);
    /** Height (over the tile) of the highest coil surface point inside the barrel at along-position u, with margin. */
    const needAt = (u) => {
      let need = 0;
      for (const { v, t: tc, u: uc } of coils) {
        for (let t = -TUNING.ring; t <= TUNING.ring + 1e-9; t += 0.4) {
          const rho = Math.hypot(u - uc, t - tc);
          if (rho >= v.r) continue;
          const top = v.z1 - TOP_Z;
          const surface = rho <= v.rTop ? top : (top * (v.r - rho)) / (v.r - v.rTop);
          need = Math.max(need, surface + 0.4);
        }
      }
      return need;
    };
    const ladder = narrow
      ? [[Math.min(0.8, length * 0.28), 2]]
      : [
          [tr, 2],
          [2.6, 2.4],
          [2.2, 2.8],
          [1.8, 3.2],
          [1.5, 3.6],
        ];
    let last = null;
    for (const [ringT, p] of ladder) {
      const aH = length / 2 - ringT;
      let b = narrow ? aH * 3 : aH;
      for (let q = 1; q < 60; q++) {
        const th = (Math.PI * q) / 60;
        const cs = Math.abs(Math.cos(th)) ** (2 / p);
        const sn = Math.abs(Math.sin(th)) ** (2 / p);
        const ex = c + Math.sign(Math.cos(th)) * (aH + ringT) * cs;
        b = Math.min(b, (rtop(ex) - 0.2) / sn - ringT);
      }
      b = Math.max(b, narrow ? 0.8 : 1.5);
      const height = (u) => {
        const x = Math.min(0.9999, Math.abs(u - c) / aH);
        return b * (1 - x ** p) ** (1 / p);
      };
      let ok = true;
      for (let u = 0; u <= length && ok; u += 0.4) {
        const need = needAt(u);
        if (need > 0 && (u < c - aH || u > c + aH || height(u) < need)) {
          ok = false;
        }
      }
      last = { tr: ringT, aH, b, p, ok };
      if (ok) return last;
    }
    return last;
  }

  /** Ashlar courses and staggered joints on the visible lateral face of a convex stone. */
  function courseLines(F, t0, t1, poly) {
    const vs = poly.map((p) => p[1]);
    const lo = Math.min(...vs);
    const hi = Math.max(...vs);
    const ch = TUNING.courseHeight;
    const out = [];
    const first = Math.ceil((lo + 0.4) / ch);
    for (let row = first; row * ch < hi - 0.4; row++) {
      const v = row * ch;
      const chord = chordAtV(poly, v);
      if (!chord || chord[1] - chord[0] <= 0.3) continue;
      // Hanuman's leap: the courses are carved as wave crests (spec 6.3), a sine that returns to the course at both ends.
      const wave = story.rail === 'wave' && chord[1] - chord[0] > 3;
      const line = wave
        ? Array.from({ length: 13 }, (_, q) => [
            lerp(chord[0], chord[1], q / 12),
            v + 0.45 * Math.sin((q / 12) * Math.PI * 2),
          ])
        : [
            [chord[0], v],
            [chord[1], v],
          ];
      out.push(faceLine(F, t0, t1, line));
    }
    for (let row = Math.floor(lo / ch); row * ch < hi; row++) {
      const v0 = row * ch;
      const v1 = v0 + ch;
      const phase = (row % 2) * 0.5;
      for (let i = -2; i < 60; i++) {
        const u = (i + phase) * TUNING.courseLength;
        const chord = chordAtU(poly, u);
        if (!chord) continue;
        const a = Math.max(v0, chord[0]);
        const b = Math.min(v1, chord[1]);
        const wide = chordAtV(poly, (a + b) / 2);
        if (b - a > 0.5 && wide && u > wide[0] + 0.3 && u < wide[1] - 0.3)
          out.push(
            faceLine(F, t0, t1, [
              [u, a],
              [u, b],
            ]),
          );
      }
    }
    return out.join('');
  }

  /** An irregular moss patch lying on a lateral face, kept inside the stone. */
  function mossPatch(F, t0, t1, poly, seed) {
    const [cu, cv] = centroid(poly);
    const low = poly.reduce((best, p) => (p[1] < best[1] ? p : best), poly[0]);
    const base = [lerp(cu, low[0], 0.55), lerp(cv, low[1], 0.7) + 0.6];
    const r = 1.2 + Math.abs(hashUnit(`${id}:m${seed}`)) * 1.8;
    const pts = [];
    for (let q = 0; q < 9; q++) {
      const a = (q / 9) * Math.PI * 2;
      const jitter = 0.7 + 0.5 * Math.abs(hashUnit(`${id}:m${seed}:${q}`));
      let p = [base[0] + Math.cos(a) * r * jitter * 1.4, base[1] + Math.sin(a) * r * jitter * 0.75];
      for (let shrink = 0; shrink < 8 && !inside(poly, p, 0.25); shrink++)
        p = [lerp(p[0], cu, 0.18), lerp(p[1], cv, 0.18)];
      pts.push(p);
    }
    if (hashUnit(`${id}:mm${seed}`) > story.moss * 2 - 1) return '';
    const d = k.pathOf(flat(F, sideOf(F) > 0 ? t1 : t0, pts), true);
    moss.push(d);
    return `<path class="moss" d="${d}" fill="${MOSS}" fill-opacity=".82" stroke="${mixHex(MOSS, '#2A1A0F', 0.5)}"/>`;
  }

  /** A carved rosette: a ring of petals on the keystone's face. */
  function keystoneCarving(F, t0, t1, quad) {
    const [cu, cv] = centroid(quad);
    const r = Math.min(1.05, Math.abs(area(quad)) ** 0.5 * 0.27);
    const ring = [];
    const petals = [];
    for (let q = 0; q <= 24; q++)
      ring.push([cu + Math.cos((q / 24) * Math.PI * 2) * r, cv + Math.sin((q / 24) * Math.PI * 2) * r]);
    for (let q = 0; q < 6; q++) {
      const a = (q / 6) * Math.PI * 2;
      petals.push([
        [cu, cv],
        [cu + Math.cos(a) * r, cv + Math.sin(a) * r],
      ]);
    }
    return (
      k.lineSvg(k.pathOf(flat(F, sideOf(F) > 0 ? t1 : t0, ring), true), { tone: 'lo' }) +
      petals.map((seg) => faceLine(F, t0, t1, seg, 'lo')).join('')
    );
  }

  // ------------------------------------------------------------------ story: parapets, ornaments, numeral
  const context = {
    id,
    geo,
    story,
    R,
    P,
    V,
    k,
    G,
    A,
    put,
    putFloor,
    chordFrame,
    frameAlong,
    world,
    faceLine,
    topSegment,
    flat,
    sideOf,
    bounds,
    chunks,
    deckV,
    underV,
    e0,
    e1,
    tone,
    dressed,
    rubble,
    stone,
    TUNING,
    footFrame,
    topFrame,
    parts,
    archInfo,
    bays,
  };
  addStory(context);

  // Ground shadows: one flat decal per deck chunk and block, thrown away from the light, so the arches sit on the tile.
  const light = G.lightOf(P);
  const throwOf = (z) => [
    (-light[0] / Math.max(0.35, light[2])) * z * 0.5,
    (-light[1] / Math.max(0.35, light[2])) * z * 0.5,
  ];
  const shadows = [];
  const decal = (corners, z, centre) => {
    const [dx, dy] = throwOf(z);
    const d = k.pathOf(
      corners.map(([x, y]) => k.iso([x + dx, y + dy, TOP_Z], P)),
      true,
    );
    shadows.push({ d, centre });
  };
  for (const ch of chunks) {
    const z = (deckV(ch.s0) + deckV(ch.s1)) / 2;
    const corners = [
      [-TUNING.cornice, 0],
      [TUNING.cornice, 0],
      [TUNING.cornice, ch.length],
      [-TUNING.cornice, ch.length],
    ].map(([t, u]) => world(ch.F, t, u, 0));
    decal(corners, z, world(ch.F, 0, ch.length / 2, 0));
  }
  for (const [F, u0, u1] of [
    [footFrame, -6, 6],
    [topFrame, -TOP_BACK, TOP_FRONT],
  ]) {
    decal(
      [
        [-7, u0],
        [7, u0],
        [7, u1],
        [-7, u1],
      ].map(([t, u]) => world(F, t, u, 0)),
      ABUTMENT_H,
      world(F, 0, (u0 + u1) / 2, 0),
    );
  }

  A.settle(R, P);
  R.items.sort((a, b) => a.key - b.key);
  /** Row band of a part: set by assignBands (render.mjs) after the depth order is settled, else its unit's centre. */
  const band = (item) => item.band ?? bandOfY(item.centre[1]);
  return { id, geo, R, P, parts, moss, archInfo, bounds, chunks, band, e0, e1, bays, shadows };
}

export { bandOfY, toScreen };
