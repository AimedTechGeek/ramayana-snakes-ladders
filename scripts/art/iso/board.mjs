// T40.3: the board base (T40 spec section 1): a carved teak chaupar table on four turned feet with a brass-rimmed
// frame, 144 bone tiles with engraved numbers, the Ayodhya gate and the coronation parasol. addBase(scene) puts every
// part, with its true shape, into the recorded scene; ladders.mjs and snakes.mjs add their pieces to the same scene.
//
// Deviations from the spec tables (each also reported in the task notes):
//   B2     the foot flanges are inset 15, not 34: at 50 degrees elevation a flange inset 34 is wholly hidden under the
//          plinth. B3 (the waisted foot between flange and plinth) is dropped for the same reason: never visible.
//   B6/B7  dropped: the plinth top is covered by the rim bars, so a groove and screws there are never seen; four
//          bolts on the visible front and right faces stand in for the screws.
//   E4     the finial ball rests on a short visible pin (a ball at z 30 would swallow the pin).
//   E6     the parasol post stands on the corner cap (z 5.0) and ends under the dome (z 40), nothing sunk.
//   E10    the finial ball touches the dome apex directly (a pin inside the ball would be a sunk part).
//   F7     the Ayodhya threshold outlines the standing field of tile 1, not the whole tile (it would cut its numeral).
//   F10    the dais spokes lie on the tile top (z 2.4) so they end on the lotus ring and the band's inner wall.

import * as A from '../anatomy/audit.mjs';
import * as k from '../anatomy/iso-kit.mjs';
import * as G from '../anatomy/lathe.mjs';
import { squareWorld } from '../iso-board.mjs';
import { NUMERAL_ADVANCE, NUMERAL_BASELINE, NUMERAL_STROKES, NUMERAL_WIDTH } from './common.mjs';
import { upright } from './scene.mjs';
import { BASE_H, CELL, FIELD_Z, FOOT_H, RIM, RIM_Z, SIZE, TOP_Z } from './world.mjs';

const PLINTH = { x: -RIM, y: -RIM, w: SIZE + 2 * RIM, d: SIZE + 2 * RIM, r: 10 };
const FIELD = { x: 0, y: 0, w: SIZE, d: SIZE, r: 0 };
const PLINTH_LOW = -BASE_H;
const FOOT_LOW = -(BASE_H + FOOT_H);
const GANGA = [49, 50, 71, 72, 73, 74];
const SEA = Array.from({ length: 12 }, (_, i) => 109 + i);
const DOME_BASE = 40;
const DOME_HEIGHT = 8;
const DOME_RADIUS = 13;
const POST_X = -11;
const TORANA_Y = [626, 662];
const CORNER_CAP = 5.0;
const TILE_STEPS = 1;

/** Tile geometry of one square: world plan, centre and (row, column) counted from the near-left corner. */
export function tileOf(square) {
  const [cx, cy] = squareWorld(square);
  const column = Math.round((cx - CELL / 2) / CELL);
  const row = Math.round((SIZE - cy - CELL / 2) / CELL);
  return {
    square,
    cx,
    cy,
    column,
    row,
    plan: { x: column * CELL + 1, y: cy - CELL / 2 + 1, w: CELL - 2, d: CELL - 2, r: 1 },
  };
}

const domeRadius = (s) => DOME_RADIUS * Math.sqrt(1 - Math.min(((s - DOME_BASE) / DOME_HEIGHT) ** 2, 1));
const domeSlope = (s) => {
  const u = Math.min((s - DOME_BASE) / DOME_HEIGHT, 0.9995);
  return (-DOME_RADIUS * u) / (DOME_HEIGHT * Math.sqrt(1 - u * u));
};

function domeProfile() {
  const knots = 16;
  return Array.from({ length: knots + 1 }, (_, i) => {
    const s = DOME_BASE + (DOME_HEIGHT * i) / knots;
    if (i === 0) return [s, domeRadius(s)];
    return i === knots ? [s, 0] : [s, domeRadius(s), 1];
  });
}

/** Eight ribs running from the dome rim to its apex on the dome surface, each fading toward the turn. */
function domeRibs(scene, F) {
  const { P } = scene;
  const V = G.viewOf(P);
  const out = [];
  for (let rib = 0; rib < 8; rib++) {
    const angle = (rib / 8) * Math.PI * 2 + Math.PI / 8;
    const samples = [];
    for (let i = 0; i <= 16; i++) {
      const s = DOME_BASE + (DOME_HEIGHT * i) / 16;
      const r = i === 16 ? 0 : domeRadius(s);
      const normal = G.unit3(G.sub3(G.radialOf(F, angle), G.mul3(F.a, domeSlope(s))));
      samples.push({ point: k.iso(G.pointOf(F, s, r, angle), P), facing: G.dot3(normal, V) });
    }
    for (let i = 0; i < 16; i++) {
      const alpha = G.fadeOf((samples[i].facing + samples[i + 1].facing) / 2, [0.1, 0.55]);
      if (alpha > 0.02) out.push({ d: k.pathOf([samples[i].point, samples[i + 1].point]), alpha });
    }
  }
  return k.fadedSvg(out, { tone: 'lo' });
}

/** Three sine lines across a tile top, phase-locked to world x so neighbouring tiles continue each other. */
function waveInlay(tile, P) {
  return [-18, -10, -2]
    .map((dy) => {
      const points = [];
      for (let x = tile.plan.x; x <= tile.plan.x + tile.plan.w + 1e-9; x += 1.5) {
        points.push([x, tile.cy + dy + 1.2 * Math.sin((2 * Math.PI * x) / 14)]);
      }
      points[points.length - 1][0] = tile.plan.x + tile.plan.w;
      return k.onTop(points, TOP_Z, P);
    })
    .join('');
}

function plinthParts(scene) {
  const { P, Ln, Dots, at, back, slab, cyl } = scene;
  back.push(`<path class="iso-halo" d="${k.haloOf(PLINTH, FOOT_LOW, FOOT_H + BASE_H, P)}"/>`); // B1
  for (const [x, y] of k.corners(PLINTH, 15)) {
    cyl(
      'foot.flange',
      x,
      y,
      13,
      FOOT_LOW,
      1.6,
      { tone: 'lo' },
      { steps: 28, ground: true, symbol: 'foot.flange' },
    ); // B2
  }
  // B4 slab and B5 lid seam; four bolts on the visible front and right faces (B7 replacement)
  const frontY = PLINTH.y + PLINTH.d;
  const rightX = PLINTH.x + PLINTH.w;
  const bolts = [
    [18, frontY, 'x'],
    [654, frontY, 'x'],
    [rightX, 18, 'y'],
    [rightX, 654, 'y'],
  ];
  slab(
    'plinth',
    PLINTH,
    PLINTH_LOW,
    BASE_H,
    { tone: 'lo' },
    {
      steps: 8,
      bevel: 1.6,
      ground: true,
      inner:
        Ln(k.sideSeam(PLINTH, -8, P, 8), { tone: 'faint' }) +
        Ln(bolts.map(([x, y, axis]) => k.sideRing([x, y, -4], 2.2, axis, P, 24)).join(''), { tone: 'lo' }),
      extra: Dots(
        bolts.map(([x, y]) => at([x, y, -4])),
        { size: 0.5 },
      ),
    },
  );
  // B8-B10 maker's plate on the front face: three rule lines, two screws
  const faceY = frontY + 0.8;
  const rules = [
    [72, -6.5],
    [48, -8],
    [60, -9.5],
  ]
    .map(([length, z]) => k.segment([290, faceY, z], [290 + length, faceY, z], P))
    .join('');
  slab(
    'plate',
    { x: 276, y: frontY, w: 120, d: 0.8, r: 0.4 },
    -12,
    8,
    { tone: 'mid' },
    {
      steps: 2,
      inner: Ln(rules, { tone: 'lo', free: true }),
      extra: Dots([at([282, faceY, -8]), at([390, faceY, -8])], { size: 0.45 }),
      bias: 0.2,
    },
  );
  // B11, B12 corner caps with a screw each
  for (const [x, y] of k.corners(PLINTH, 8)) {
    slab(
      'cap',
      { x: x - 6, y: y - 6, w: 12, d: 12, r: 2 },
      RIM_Z,
      CORNER_CAP - RIM_Z,
      { tone: 'mid' },
      {
        steps: 3,
        extra: Dots([at([x, y, CORNER_CAP])], { size: 0.5 }),
        symbol: 'cap',
      },
    );
  }
}

function rimParts(scene) {
  const { P, Ln, Dots, at, slab } = scene;
  const bars = [
    { name: 'back', plan: { x: -RIM, y: -RIM, w: SIZE + 2 * RIM, d: RIM, r: 2 } },
    { name: 'left', plan: { x: -RIM, y: 0, w: RIM, d: SIZE, r: 0 } },
    { name: 'right', plan: { x: SIZE, y: 0, w: RIM, d: SIZE, r: 0 } },
    { name: 'front', plan: { x: -RIM, y: SIZE, w: SIZE + 2 * RIM, d: RIM, r: 2 } },
  ];
  // S3, S4 ruler ticks hang from the inner top edges of the front and left bars; tile edges are the majors
  const front = k.topTicks(0, SIZE, 8, 7, SIZE + 0.8, RIM_Z, [2, 3.6], P, 'x');
  const left = k.topTicks(0, SIZE, 8, 7, -0.8, RIM_Z, [-2, -3.6], P, 'y');
  const ticks = {
    front: Ln(front.minor, { tone: 'lo' }) + Ln(front.major, { tone: 'mid' }),
    left: Ln(left.minor, { tone: 'lo' }) + Ln(left.major, { tone: 'mid' }),
  };
  // S5 ruler end screws and S9 rim end screws (ring + dot), each drawn with the bar that carries it
  const screws = (list, size) =>
    Dots(
      list.map(([x, y]) => at([x, y, RIM_Z])),
      { size },
    );
  const rimRings = (list) =>
    Ln(list.map(([x, y]) => k.ring(x, y, 1.8, RIM_Z, P, 24)).join(''), { tone: 'lo' });
  const rimScrews = {
    back: [
      [8, -11],
      [664, -11],
    ],
    front: [
      [8, SIZE + 16],
      [664, SIZE + 16],
    ],
    right: [
      [SIZE + 11, 8],
      [SIZE + 11, 664],
    ],
    left: [
      [-11, 22],
      [-11, 596],
    ],
  };
  const rulerScrews = {
    front: [
      [4, SIZE + 9],
      [668, SIZE + 9],
    ],
    left: [
      [-11, 4],
      [-11, 668],
    ],
  };
  // S2 rim inner seam: the field outline at the rim top, one side per bar (the four ends meet at the corners)
  const seams = {
    back: [
      [0, 0],
      [SIZE, 0],
    ],
    right: [
      [SIZE, 0],
      [SIZE, SIZE],
    ],
    front: [
      [SIZE, SIZE],
      [0, SIZE],
    ],
    left: [
      [0, SIZE],
      [0, 0],
    ],
  };
  for (const { name, plan } of bars) {
    slab(
      `rim.${name}`,
      plan,
      0,
      RIM_Z,
      { tone: 'mid' },
      {
        steps: 4,
        bevel: 1.0,
        ground: true,
        inner:
          (ticks[name] ?? '') +
          Ln(k.onTop(seams[name], RIM_Z, P), { tone: 'lo' }) +
          rimRings(rimScrews[name]),
        extra: screws(rimScrews[name], 0.45) + (rulerScrews[name] ? screws(rulerScrews[name], 0.45) : ''),
      },
    );
  }
  // S6-S8 chapter plates on the right bar: a faint inset outline, three rule lines along y, two screws
  for (const yc of [588, 476, 364, 224, 84]) {
    const plate = { x: SIZE + 5, y: yc - 7, w: 12, d: 14, r: 1 };
    const rules = [
      [-2.4, 8],
      [0, 6],
      [2.4, 7],
    ]
      .map(([dx, length]) =>
        k.lineOnTop([SIZE + 11 + dx, yc - 3.5], [SIZE + 11 + dx, yc - 3.5 + length], 4.4, P),
      )
      .join('');
    slab(
      'chapter',
      plate,
      RIM_Z,
      0.8,
      { tone: 'mid' },
      {
        steps: 2,
        symbol: 'chapter',
        inner:
          Ln(k.planOutline(k.insetPlan(plate, 1.6), 4.4, P), { tone: 'faint' }) +
          Ln(rules, { tone: 'lo', free: true }),
        extra: Dots([at([SIZE + 11, yc - 6.2, 4.4]), at([SIZE + 11, yc + 6.2, 4.4])], { size: 0.4 }),
      },
    );
  }
}

/** One tile solid is drawn once per tone in <defs>; every tile is a <use> at its screen offset (parallel camera). */
const fixed = (v) => String(Math.round(v * 10) / 10);

function surfaceParts(scene) {
  const { P, Ln, S, at, slab, band, put, record } = scene;
  slab('field', FIELD, 0, FIELD_Z, { tone: 'mid' }, { steps: 2, ground: true }); // F1
  const wet = new Set([...GANGA, ...SEA]);
  const origins = {};
  const uses = [];
  const numerals = [];
  const waves = [];
  const glyphOrigin = at([0, 0, TOP_Z]);
  for (const [digit, strokes] of Object.entries(NUMERAL_STROKES)) {
    // one engraved digit at the world origin, drawn once; every numeral is a row of <use> glyphs (the digits are
    // free-ended marks, so the line check has nothing to see inside them)
    const d = strokes
      .map((stroke) =>
        k.onTop(
          stroke.map(([u, v]) => [u, -v]),
          TOP_Z,
          P,
        ),
      )
      .join('');
    scene.addDef(
      `<path id="n${digit}" class="iso-line iso-numeral" data-tone="mid" data-free="both" d="${d}"/>`,
    );
  }
  const edges = [];
  let extra = '';
  for (let square = 1; square <= 144; square++) {
    const tile = tileOf(square);
    const odd = (tile.row + tile.column) % 2 === 1; // F3
    const paths = k.slabOf(tile.plan, FIELD_Z, TOP_Z - FIELD_Z, P, TILE_STEPS); // F2
    const here = at([tile.cx, tile.cy, TOP_Z]);
    const id = odd ? 'tileO' : 'tileE';
    if (!origins[id]) {
      origins[id] = here;
      scene.addDef(`<g id="${id}">${S(paths, { tone: 'hi', className: odd ? 'sq-b' : undefined })}</g>`);
    }
    const [dx, dy] = [here[0] - origins[id][0], here[1] - origins[id][1]];
    const move = (dx ? ` x="${fixed(dx)}"` : '') + (dy ? ` y="${fixed(dy)}"` : '');
    uses.push(`<use href="#${id}"${move}/>`);
    const digits = [...String(square)]; // F4
    const left = tile.cx - ((digits.length - 1) * NUMERAL_ADVANCE + NUMERAL_WIDTH) / 2;
    digits.forEach((digit, i) => {
      const [gx, gy] = at([left + i * NUMERAL_ADVANCE, tile.cy + NUMERAL_BASELINE, TOP_Z]);
      numerals.push(
        `<use href="#n${digit}" x="${fixed(gx - glyphOrigin[0])}" y="${fixed(gy - glyphOrigin[1])}"/>`,
      );
    });
    scene.stats.marks += digits.length;
    if (wet.has(square)) {
      waves.push(waveInlay(tile, P)); // F5, F6
      // The tile solid is a <use>, which the line check cannot see into: hidden copies of the two edges the waves
      // end on (left and right), under the tiles, give it strokes to find (the visible edges are the <use>'s own).
      const { x, y, w, d } = tile.plan;
      edges.push(
        k.lineOnTop([x, y], [x, y + d], TOP_Z, P),
        k.lineOnTop([x + w, y], [x + w, y + d], TOP_Z, P),
      );
    }
    if (square === 1) {
      // F7 Ayodhya threshold: the standing field of tile 1 inset 3
      const field = { x: tile.plan.x + 3, y: tile.plan.y + 3, w: tile.plan.w - 6, d: 33, r: 1 };
      extra += Ln(k.planOutline(field, TOP_Z, P), { tone: 'hi' });
    }
    if (square === 144) {
      // F9 lotus ring and F10 spokes inside the dais band
      const F = upright(28, 19);
      extra += Ln(k.ring(28, 19, 10, TOP_Z, P, 40), { tone: 'lo' });
      extra += Ln(G.spokesOf(F, TOP_Z, 10, 13, 8, P, { phase: Math.PI / 8 }), { tone: 'lo' });
    }
    // The recorded item carries the tile's true shape; its own markup is only used by the audit.
    const shape = record(A.slab(tile.plan, FIELD_Z, TOP_Z - FIELD_Z, { name: `tile.${square}` }, TILE_STEPS));
    put(`tile.${square}`, [tile.cx, tile.cy, TOP_Z], k.solidSvg(paths, { tone: 'hi' }), [shape]);
  }
  const marks = numerals.join('') + Ln(waves.join(''), { tone: 'faint' }) + extra;
  const proxies = Ln(edges.join(''), { tone: 'faint', className: 'iso-crease' });
  scene.mergeLayer('tile.', 'field', proxies + uses.join('') + marks);
  // F8 coronation dais ring on tile 144
  band(
    'dais',
    upright(28, 19),
    TOP_Z,
    2.8,
    13,
    16,
    { tone: 'hi', className: 'open' },
    { bias: 0.1, open: true },
  );
}

function toranaParts(scene) {
  const { slab, cyl, band, ball, tube, disc } = scene;
  for (const y of TORANA_Y) {
    // E1 posts, cut at the two E2 beads: a bead wraps its post, so the post is a piece under, between and over them
    const cuts = [RIM_Z, 8, 8.8, 21, 21.8, 25.6];
    for (let i = 0; i < cuts.length; i += 2) {
      cyl(
        'torana.post',
        POST_X,
        y,
        2.2,
        cuts[i],
        cuts[i + 1] - cuts[i],
        { tone: 'hi' },
        { steps: 20, symbol: `torana.post.${i}` },
      );
    }
    for (const z of [8, 21]) {
      band(
        'torana.bead',
        upright(POST_X, y),
        z,
        z + 0.8,
        2.2,
        2.6,
        { tone: 'hi' },
        { steps: 20, symbol: 'torana.bead' },
      ); // E2
    }
  }
  slab(
    'torana.lintel',
    { x: -14.5, y: 623, w: 7, d: 42, r: 1 },
    25.6,
    3,
    { tone: 'hi' },
    { steps: 3, bevel: 0.6 },
  ); // E3
  for (const y of TORANA_Y) {
    disc('torana.pin', upright(POST_X, y), 28.6, 30, 0.6, { tone: 'hi' }, { steps: 12 }); // E4
    ball('torana.finial', [POST_X, y, 31.4], 1.4, { tone: 'hi' });
  }
  // E5 garland: a tube from knot to knot that sags toward the field. Each knot ball rests on its post's upper bead,
  // and the tube ends with its rim on the ball (centre + 0.67 along the tube: sqrt(0.9^2 - 0.6^2)).
  const knots = TORANA_Y.map((y, i) => [POST_X, i ? y - 3.5 : y + 3.5, 21.4]);
  const sag = [-8, 644, 20];
  const onKnot = (knot) => G.add3(knot, G.mul3(G.unit3(G.sub3(sag, knot)), 0.67));
  const route = G.fillet([onKnot(knots[0]), sag, onKnot(knots[1])], 3, 10);
  tube('torana.garland', route, 0.6, { tone: 'hi', maxLength: 10, spacing: 0.8, limp: false, caps: false });
  for (const knot of knots) ball('torana.knot', knot, 0.9, { tone: 'hi' });
}

function parasolParts(scene) {
  const { cyl, turned, band, ball } = scene;
  const F = upright(POST_X, POST_X);
  cyl('parasol.post', POST_X, POST_X, 1.4, CORNER_CAP, DOME_BASE - CORNER_CAP, { tone: 'hi' }, { steps: 14 }); // E6
  turned(
    'parasol.dome',
    F,
    domeProfile(),
    { tone: 'hi' },
    {
      // E7, E9
      smooth: { slope: domeSlope, radius: domeRadius, rows: 2, error: 0.8, fineness: 0.5 },
      steps: 28,
      radius: domeRadius,
      inner: domeRibs(scene, F),
    },
  );
  band('parasol.fringe', F, 39.2, DOME_BASE, 12.6, 13.2, { tone: 'hi' }, { steps: 40 }); // E8
  ball('parasol.finial', [POST_X, POST_X, DOME_BASE + DOME_HEIGHT + 1.5], 1.5, { tone: 'hi' }); // E10
}

/** Every part of the board base (T40 spec 1.1-1.4). */
export function addBase(scene) {
  plinthParts(scene);
  rimParts(scene);
  surfaceParts(scene);
  toranaParts(scene);
  parasolParts(scene);
}
