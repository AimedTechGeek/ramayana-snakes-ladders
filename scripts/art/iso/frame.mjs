// node frame.mjs [out dir] [--svg-dir <dir>] (npm run art:frame): T42.4 builds the frame sheet `frame` of the living board
// (T42 spec 1.2, 1.4, 2, 3): the carved teak table and its brass rim as placeable modules, derived from board.mjs (T40).
//
//   rim-front|back|left|right   one 56-unit bar each (brass rim on a teak plinth face), placed 12 times per side
//   corner-nw|ne|sw|se          22 x 22 corners: brass rim, teak plinth, bun foot, teak cap
//   gate, parasol               the Ayodhya torana and the coronation parasol (standing band)
//   plate-maker, plate-chapter-1..5   brass plates drawn over the bars
// 4 sides x 12 + 4 corners = 52 placements (framePlacements()); the fixtures (gate, parasol, plates) are frameFixtures().
//
// Seam rule: every module draws the continuing solid, clipped to a window that reaches 1 unit back into the module
// before it (the neighbour at the smaller coordinate, which the runtime draws first). The clip edge of the later
// module lies on the earlier one's solid and its own end faces lie outside the window, so no joint line exists. Marks
// that belong to one place (ticks, screws, panels) are owned by the module whose [start, end) holds them and are not
// clipped; the tick on a joint belongs to the later module. A bar is drawn once at module 0 and placed 12 times, so
// neighbours sit at fractional logical px of each other; the 1-unit overlap (3 device px at factor 4) absorbs that.
//
// Deviations from T40 board.mjs (listed in the task notes): the plinth is split into the bars and corners (its top is
// covered, so only the visible strip is drawn); back and left bars have no plinth (never visible); the T40 flanges,
// hidden at 50 degrees, are replaced by visible bun feet at the three corners that show; corners are rounded 6 so the
// rim sits flush on the plinth; the maker's plate is 12 tall so it covers the carved panels of the bars under it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as A from '../anatomy/audit.mjs';
import * as k from '../anatomy/iso-kit.mjs';
import * as G from '../anatomy/lathe.mjs';
import { buildAtlas, FACTORS } from './atlas.mjs';
import { mixHex } from './common.mjs';
import { createScene, upright } from './scene.mjs';
import { INK, tones } from './tones.mjs';
import { BASE_H, CELL, FOOT_H, RIM, RIM_Z, SIZE } from './world.mjs';

export const PITCH = CELL;
export const OVERLAP = 1;
export const FRAME_SHEET = 'frame';

const STEPS_PER_SIDE = SIZE / PITCH;
const FAR = SIZE + RIM;
const PLINTH_LOW = -BASE_H;
const FOOT_LOW = -(BASE_H + FOOT_H);
const CORNER_CAP = 5.0;
const CORNER_R = 6;
const EXT = 9;
const SMOOTH_PX = 0.5;
const POST_X = -11;
const TORANA_Y = [626, 662];
const DOME_BASE = 40;
const DOME_HEIGHT = 8;
const DOME_RADIUS = 13;
const MAKER = { x: 276, w: 120 };
const CHAPTER_Y = [588, 476, 364, 224, 84];

// ---------------------------------------------------------------- placements

const centre = (a, b) => (a + b) / 2;

/** The 52 modules: 12 bars per side at pitch 56 and the four corners, anchored at their floor centre (z 0). */
export function framePlacements() {
  const out = [];
  const sides = {
    back: (a) => [a, -RIM / 2],
    front: (a) => [a, SIZE + RIM / 2],
    left: (a) => [-RIM / 2, a],
    right: (a) => [SIZE + RIM / 2, a],
  };
  for (const [side, at] of Object.entries(sides)) {
    for (let i = 0; i < STEPS_PER_SIDE; i++) {
      const [x, y] = at(i * PITCH + PITCH / 2);
      out.push({
        id: `${side}-${String(i + 1).padStart(2, '0')}`,
        frame: `rim-${side}`,
        world: [x, y, 0],
        depthAt: [x, y],
        depthBias: 0,
      });
    }
  }
  const corners = {
    nw: [-RIM / 2, -RIM / 2],
    ne: [SIZE + RIM / 2, -RIM / 2],
    sw: [-RIM / 2, SIZE + RIM / 2],
    se: [SIZE + RIM / 2, SIZE + RIM / 2],
  };
  for (const [name, [x, y]] of Object.entries(corners)) {
    out.push({
      id: `corner-${name}`,
      frame: `corner-${name}`,
      world: [x, y, 0],
      depthAt: [x, y],
      depthBias: 0,
    });
  }
  return out;
}

/** Gate, parasol and the plates: standing-band or over-the-bar sprites. `depthAt` is the key point; plates borrow the
 * point of the last bar module they cover and a 0.5 key bias so no covered module paints over them. */
export function frameFixtures() {
  const plate = (id, frame, world, depthAt) => ({ id, frame, world, depthAt, depthBias: 0.5 });
  // centre (along the bar) of the last bar module a plate reaching up to `end` lies over
  const lastBar = (end) => Math.floor((end - 1e-6) / PITCH) * PITCH + PITCH / 2;
  return [
    { id: 'gate', frame: 'gate', world: [POST_X, 644, RIM_Z], depthAt: [POST_X, 644], depthBias: 0 },
    {
      id: 'parasol',
      frame: 'parasol',
      world: [POST_X, POST_X, CORNER_CAP],
      depthAt: [POST_X, POST_X],
      depthBias: 0,
    },
    plate(
      'maker',
      'plate-maker',
      [MAKER.x + MAKER.w / 2, FAR, -8],
      [lastBar(MAKER.x + MAKER.w), FAR - RIM / 2],
    ),
    ...CHAPTER_Y.map((y, i) =>
      plate(
        `chapter-${i + 1}`,
        `plate-chapter-${i + 1}`,
        [SIZE + RIM / 2, y, RIM_Z],
        [SIZE + RIM / 2, lastBar(y + 7)],
      ),
    ),
  ];
}

// ---------------------------------------------------------------- materials

/** CSS class that retones everything inside it: the four shades, top, paper and the line tokens of one material. */
function materialCss(name, hex, polish) {
  const t = tones(hex);
  const vars = [
    `--anatomy-top:${t.top}`,
    ...t.shades.map((v, i) => `--anatomy-shade-${i}:${v}`),
    `--anatomy-paper:${hex}`,
    `--anatomy-hi:${INK}`,
    `--anatomy-mid:${t.line}`,
    `--anatomy-lo:${t.line}`,
    `--anatomy-faint:${mixHex(t.line, hex, 0.5)}`,
    `--anatomy-lit:${mixHex(hex, '#FFFFFF', polish)}`,
    `--anatomy-dot:${t.line}`,
  ];
  return `.${name}{${vars.join(';')}}`;
}

const MATERIALS = [
  ['teak', '#A9743F', 0.3],
  ['brass', '#C9A24A', 0.62],
  ['gold', '#E9C12F', 0.55],
  ['saffron', '#F39C2B', 0.45],
];
const MATERIAL_CSS = MATERIALS.map(([name, hex, polish]) => materialCss(name, hex, polish)).join('\n');

const TEAK = { tone: 'mid', className: 'teak' };
const BRASS = { tone: 'mid', className: 'brass', crease: 'lit' };
const withClass = (name, svg) => `<g class="${name}">${svg}</g>`;

// ---------------------------------------------------------------- geometry helpers

const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** A rectangle with the corner `outer` ('nw' | 'ne' | 'sw' | 'se') rounded by r. */
function cornerRing(x0, y0, x1, y1, outer, r) {
  const arcs = {
    nw: [x0 + r, y0 + r, 180],
    ne: [x1 - r, y0 + r, 270],
    se: [x1 - r, y1 - r, 0],
    sw: [x0 + r, y1 - r, 90],
  };
  const out = [];
  for (const name of ['nw', 'ne', 'se', 'sw']) {
    if (name !== outer) {
      out.push({ nw: [x0, y0], ne: [x1, y0], se: [x1, y1], sw: [x0, y1] }[name]);
      continue;
    }
    const [cx, cy, start] = arcs[name];
    for (let i = 0; i <= 8; i++) {
      const angle = ((start + (90 * i) / 8) * Math.PI) / 180;
      out.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
  }
  return out;
}

function convexHull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list) => {
    const hull = [];
    for (const p of list) {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
      hull.push(p);
    }
    hull.pop();
    return hull;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/** Screen hull of a world box, grown by SMOOTH_PX so the half of an outline that lies outside it survives the clip. */
function boxHull(P, [x0, y0, x1, y1], z0, z1) {
  const points = [];
  for (const x of [x0, x1])
    for (const y of [y0, y1])
      for (const z of [z0, z1]) {
        const [sx, sy] = k.iso([x, y, z], P);
        for (const [dx, dy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ])
          points.push([sx + dx * SMOOTH_PX, sy + dy * SMOOTH_PX]);
      }
  return convexHull(points);
}

const hullPath = (hulls) => hulls.map((hull) => k.pathOf(hull, true)).join('');

/** Pixel frame (whole logical px of the board projection) around some screen points, with a margin. */
function frameBox(points, margin = 2) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const ox = Math.floor(Math.min(...xs) - margin);
  const oy = Math.floor(Math.min(...ys) - margin);
  return {
    ox,
    oy,
    width: Math.ceil(Math.max(...xs) + margin) - ox,
    height: Math.ceil(Math.max(...ys) + margin) - oy,
  };
}

function worldBoxPoints(P, [x0, y0, x1, y1], z0, z1) {
  const out = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push(k.iso([x, y, z], P));
  return out;
}

/** One finished frame: the scene's SVG cropped to `box`, with the material classes and the anchor in frame px. */
function finishFrame(scene, box, anchorWorld, label, audits, name) {
  const svg = scene
    .finish({ label })
    .replace(/viewBox="[^"]*"/, `viewBox="${box.ox} ${box.oy} ${box.width} ${box.height}"`)
    .replace('</style>', `${MATERIAL_CSS}\n</style>`);
  const result = A.audit(scene.R, scene.P);
  audits.push({ name, problems: A.failures(result), report: A.report(result) });
  const [ax, ay] = scene.at(anchorWorld);
  return { svg, width: box.width, height: box.height, anchor: { x: ax - box.ox, y: ay - box.oy } };
}

/** A solid drawn as the continuing prism (`extRing`) and clipped to the module window; recorded as the window shape. */
function clippedPrism(scene, name, extRing, shapeRing, z, height, style, options = {}) {
  const { P, S, record, put } = scene;
  const { inner = '', extra = '', bias = 0, ground = false, bevel = 0 } = options;
  const shape = record(A.extruded(shapeRing, z, height, { name: ground ? `stand.${name}` : name }));
  const solid = S(k.extrude(extRing, z, height, P, { convex: true, bevel }), { ...style, inner });
  const cx = shapeRing.reduce((sum, p) => sum + p[0], 0) / shapeRing.length;
  const cy = shapeRing.reduce((sum, p) => sum + p[1], 0) / shapeRing.length;
  put(name, [cx, cy, z + height / 2], `<g clip-path="url(#win)">${solid}</g>${extra}`, [shape], { bias });
}

const addWindow = (scene, hulls) =>
  scene.back.push(`<defs><clipPath id="win"><path d="${hullPath(hulls)}"/></clipPath></defs>`);

// ---------------------------------------------------------------- bars

/** Per side: the axis the bar runs along, the across range, whether it shows a plinth face and a ruler. */
const BARS = {
  front: { axis: 'x', across: [SIZE, FAR], inner: SIZE, outward: 1, plinth: true, ruler: true },
  back: { axis: 'x', across: [-RIM, 0], inner: 0, outward: -1, plinth: false, ruler: false },
  left: { axis: 'y', across: [-RIM, 0], inner: 0, outward: -1, plinth: false, ruler: true },
  right: { axis: 'y', across: [SIZE, FAR], inner: SIZE, outward: 1, plinth: true, ruler: false },
};

/** Three grain lines along a plinth face from `from` to `to`: phase-locked to the world coordinate (period 56), so bars and corners continue each other. */
function grainPath(at, from, to) {
  return [
    [-3.6, 0.5, 1, 0.4],
    [-9.4, 0.4, 2, 2.1],
    [-12.8, 0.45, 1, 4.0],
  ]
    .map(([z, amp, turns, phase]) => {
      const points = [];
      for (let along = from; along <= to + 1e-9; along += 1.4) {
        points.push(at(along, z + amp * Math.sin((2 * Math.PI * turns * along) / PITCH + phase)));
      }
      return k.pathOf(points);
    })
    .join('');
}

/** Carved teak on the visible plinth face: phase-locked grain (clipped, continuous) and a framed panel with a lozenge. */
function plinthCarving(scene, bar, pt) {
  const { P, Ln } = scene;
  const face = bar.across[1];
  const at = (along, z) => k.iso(pt(along, face, z), P);
  const grain = grainPath(at, -EXT, PITCH + EXT);
  const panel = k.pathOf(
    [
      [7, -2.8],
      [PITCH - 7, -2.8],
      [PITCH - 7, -13.2],
      [7, -13.2],
      [7, -2.8],
    ].map(([along, z]) => at(along, z)),
  );
  const lozenge = k.pathOf(
    [
      [PITCH / 2 - 5.5, -8],
      [PITCH / 2, -5.4],
      [PITCH / 2 + 5.5, -8],
      [PITCH / 2, -10.6],
      [PITCH / 2 - 5.5, -8],
    ].map(([along, z]) => at(along, z)),
  );
  return {
    grain: Ln(grain, { tone: 'faint', free: 'both' }),
    carved: withClass('teak', Ln(panel, { tone: 'mid' }) + Ln(lozenge, { tone: 'mid' })),
  };
}

function barModule(side, audits) {
  const bar = BARS[side];
  const scene = createScene();
  const { P, Ln, Dots } = scene;
  const pt = (along, across, z) => (bar.axis === 'x' ? [along, across, z] : [across, along, z]);
  const plan = (a0, a1) =>
    bar.axis === 'x'
      ? rect(a0, bar.across[0], a1, bar.across[1])
      : rect(bar.across[0], a0, bar.across[1], a1);
  const [c0, c1] = bar.across;
  const windowBox = (z0, z1) =>
    boxHull(P, bar.axis === 'x' ? [-OVERLAP, c0, PITCH, c1] : [c0, -OVERLAP, c1, PITCH], z0, z1);
  const low = bar.plinth ? PLINTH_LOW : 0;
  addWindow(scene, [windowBox(low, RIM_Z)]);

  if (bar.plinth) {
    const carving = plinthCarving(scene, bar, pt);
    clippedPrism(scene, 'plinth', plan(-EXT, PITCH + EXT), plan(-OVERLAP, PITCH), PLINTH_LOW, BASE_H, TEAK, {
      ground: true,
      inner: carving.grain,
      extra: carving.carved,
    });
  }

  // the rim: a groove with a polished line beside it, one screw at the module centre, the ruler on the inner edge
  const sign = bar.outward;
  const groove = bar.inner + sign * 8;
  const along = (a, b, across) =>
    bar.axis === 'x'
      ? [
          [a, across],
          [b, across],
        ]
      : [
          [across, a],
          [across, b],
        ];
  const strip = (across, tone) => Ln(k.onTop(along(-EXT, PITCH + EXT, across), RIM_Z, P), { tone });
  const inner = strip(groove, 'lo') + strip(groove + sign * 0.9, 'lit');
  const screwAcross = bar.inner + sign * 15.5;
  const [sx, sy] = pt(PITCH / 2, screwAcross, RIM_Z).slice(0, 2);
  const slot = k.onTop(
    bar.axis === 'x'
      ? [
          [sx - 1.2, sy - 1.2],
          [sx + 1.2, sy + 1.2],
        ]
      : [
          [sx - 1.2, sy + 1.2],
          [sx + 1.2, sy - 1.2],
        ],
    RIM_Z,
    P,
  );
  let marks =
    Ln(k.ring(sx, sy, 1.8, RIM_Z, P, 24), { tone: 'mid' }) +
    Ln(slot, { tone: 'lo', free: 'both' }) +
    Dots([scene.at([sx, sy, RIM_Z])], { size: 0.45 });
  if (bar.ruler) {
    const edge = bar.inner + sign * 0.8;
    const lengths = [sign * 2, sign * 3.6];
    const t = k.topTicks(0, PITCH - 1, 8, 7, edge, RIM_Z, lengths, P, bar.axis);
    marks += Ln(t.minor, { tone: 'mid' }) + Ln(t.major, { tone: 'hi' });
  }
  clippedPrism(scene, 'rim', plan(-EXT, PITCH + EXT), plan(-OVERLAP, PITCH), 0, RIM_Z, BRASS, {
    ground: !bar.plinth, // no plinth is drawn under the hidden bars: the table stands under them
    bevel: 1.0,
    inner,
    extra: withClass('brass', marks),
  });

  const box = frameBox(windowBox(low, RIM_Z));
  return finishFrame(
    scene,
    box,
    pt(PITCH / 2, centre(c0, c1), 0),
    `Frame bar module, ${side} side: a 56-unit brass rim${bar.plinth ? ' on a carved teak plinth' : ''}.`,
    audits,
    `rim-${side}`,
  );
}

// ---------------------------------------------------------------- corners

/**
 * Corner footprint, rounded outer corner, the strips of overlap back into the earlier bars, and what shows below.
 * `backX` / `backY`: the module before it along x / y is a bar, so the corner reaches 1 unit into it.
 */
const CORNERS = {
  nw: { rect: [-RIM, -RIM, 0, 0], backX: false, backY: false, faces: [], foot: false },
  ne: { rect: [SIZE, -RIM, FAR, 0], backX: true, backY: false, faces: ['x'], foot: true },
  sw: { rect: [-RIM, SIZE, 0, FAR], backX: false, backY: true, faces: ['y'], foot: true },
  se: { rect: [SIZE, SIZE, FAR, FAR], backX: true, backY: true, faces: ['x', 'y'], foot: true },
};

function cornerModule(name, audits) {
  const def = CORNERS[name];
  const scene = createScene();
  const { P, Ln, Dots, at, slab, cyl } = scene;
  const [x0, y0, x1, y1] = def.rect;
  const outerX = name.endsWith('e') ? x1 : x0;
  const outerY = name.startsWith('s') ? y1 : y0;
  const innerX = outerX === x1 ? x0 : x1;
  const innerY = outerY === y1 ? y0 : y1;
  const visible = def.faces.length > 0;
  const low = def.foot ? FOOT_LOW : 0;
  const top = CORNER_CAP + 0.8;

  // window = footprint plus the 1-unit strips over the earlier bars (never the square where the two strips meet)
  const boxes = [[x0, y0, x1, y1]];
  if (def.backX) boxes.push([x0 - OVERLAP, y0, x0, y1]);
  if (def.backY) boxes.push([x0, y0 - OVERLAP, x1, y0]);
  addWindow(
    scene,
    boxes.map((b) => boxHull(P, b, low, top)),
  );

  const outer = `${name[0]}${name[1]}`;
  const extend = (a, back) => (back ? a - EXT : a);
  const ext = cornerRing(extend(x0, def.backX), extend(y0, def.backY), x1, y1, outer, CORNER_R);
  const shape = ext; // the audit measures the markup, which includes the continuing stretch the window clips away
  // the flat part of a face is the footprint minus the rounded outer corner; grain and rosette sit on it
  const flat = (lo, hi, outerAt) => (outerAt === lo ? [lo + CORNER_R, hi] : [lo, hi - CORNER_R]);
  const [fxa, fxb] = flat(x0, x1, outerX);
  const [fya, fyb] = flat(y0, y1, outerY);
  const faceGrain = def.faces
    .map((axis) => {
      const at =
        axis === 'y'
          ? (along, z) => k.iso([along, outerY, z], P)
          : (along, z) => k.iso([outerX, along, z], P);
      return axis === 'y' ? grainPath(at, fxa, fxb) : grainPath(at, fya, fyb);
    })
    .join('');
  const faceRosettes = def.faces
    .map((axis) => {
      const [fx, fy] = axis === 'y' ? [centre(fxa, fxb), outerY] : [outerX, centre(fya, fyb)];
      const ring = k.sideRing([fx, fy, -8], 3.4, axis === 'y' ? 'x' : 'y', P, 28);
      const rosette = Ln(ring, { tone: 'mid' }) + Dots([at([fx, fy, -8])], { size: 0.6 });
      return rosette;
    })
    .join('');
  if (visible) {
    clippedPrism(scene, 'plinth', ext, shape, PLINTH_LOW, BASE_H, TEAK, {
      ground: true,
      inner: Ln(faceGrain, { tone: 'faint', free: 'both' }),
      extra: withClass('teak', faceRosettes),
    });
  }

  const toward = (a, b) => (b > a ? 1 : -1);
  // the last tick of each ruler (at 672) belongs to the corner that follows its bar
  const marks = [];
  if (name === 'sw') {
    const t = k.topTicks(SIZE, SIZE, 8, 7, -0.8, RIM_Z, [-2, -3.6], P, 'y');
    marks.push(Ln(t.minor, { tone: 'mid' }) + Ln(t.major, { tone: 'hi' }));
  }
  if (name === 'se') {
    const t = k.topTicks(SIZE, SIZE, 8, 7, SIZE + 0.8, RIM_Z, [2, 3.6], P, 'x');
    marks.push(Ln(t.minor, { tone: 'mid' }) + Ln(t.major, { tone: 'hi' }));
  }
  clippedPrism(scene, 'rim', ext, shape, 0, RIM_Z, BRASS, {
    ground: !visible,
    bevel: 1.0,
    extra: withClass('brass', marks.join('')),
  });

  const capX = outerX + toward(outerX, innerX) * 8;
  const capY = outerY + toward(outerY, innerY) * 8;
  slab('cap', { x: capX - 6, y: capY - 6, w: 12, d: 12, r: 2 }, RIM_Z, CORNER_CAP - RIM_Z, TEAK, {
    steps: 3,
    bevel: 0.3,
    extra: withClass('brass', Dots([at([capX, capY, CORNER_CAP])], { size: 0.55 })),
  });

  if (def.foot) {
    // a turned bun foot: flange, waist and collar under the plinth, inset so 1 unit of it shows below the face
    const footX = outerX + toward(outerX, innerX) * 10.5;
    const footY = outerY + toward(outerY, innerY) * 10.5;
    const flange = { tone: 'mid', className: 'teak' };
    cyl('foot.flange', footX, footY, 9.5, FOOT_LOW, 1.6, flange, { steps: 28, bevel: 0.5, ground: true });
    cyl('foot.waist', footX, footY, 7.4, FOOT_LOW + 1.6, 2.8, flange, { steps: 28, ground: true });
    cyl('foot.collar', footX, footY, 9.0, FOOT_LOW + 4.4, FOOT_H - 4.4, flange, {
      steps: 28,
      bevel: 0.4,
      ground: true,
    });
  }

  const box = frameBox(boxes.flatMap((b) => boxHull(P, b, low, top)));
  return finishFrame(
    scene,
    box,
    [centre(x0, x1), centre(y0, y1), 0],
    `Frame corner module ${name}: brass rim corner, teak plinth, cap${def.foot ? ' and bun foot' : ''}.`,
    audits,
    `corner-${name}`,
  );
}

// ---------------------------------------------------------------- gate and parasol (T40 E1-E10)

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

/** Eight ribs from the dome rim to its apex on the dome surface, each fading toward the turn. */
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

function gateModule(audits) {
  const scene = createScene();
  const { slab, cyl, band, ball, tube, disc, P } = scene;
  const paper = { tone: 'hi' };
  for (const y of TORANA_Y) {
    // E1 posts, cut at the two E2 beads: a bead wraps its post, so the post is a piece under, between and over them
    const cuts = [RIM_Z, 8, 8.8, 21, 21.8, 25.6];
    for (let i = 0; i < cuts.length; i += 2) {
      cyl('torana.post', POST_X, y, 2.2, cuts[i], cuts[i + 1] - cuts[i], paper, {
        steps: 20,
        ground: i === 0,
        symbol: `torana.post.${i}`,
      });
    }
    for (const z of [8, 21]) {
      band(
        'torana.bead',
        upright(POST_X, y),
        z,
        z + 0.8,
        2.2,
        2.6,
        { tone: 'mid', className: 'gold' },
        { steps: 20, symbol: 'torana.bead' },
      );
    }
  }
  slab('torana.lintel', { x: -14.5, y: 623, w: 7, d: 42, r: 1 }, 25.6, 3, paper, { steps: 3, bevel: 0.6 }); // E3
  for (const y of TORANA_Y) {
    disc('torana.pin', upright(POST_X, y), 28.6, 30, 0.6, { ...paper, className: 'gold' }, { steps: 12 }); // E4
    ball('torana.finial', [POST_X, y, 31.4], 1.4, { ...paper, className: 'gold' });
  }
  // E5 garland, a marigold string: knot to knot, sagging toward the field
  const knots = TORANA_Y.map((y, i) => [POST_X, i ? y - 3.5 : y + 3.5, 21.4]);
  const sag = [-8, 644, 20];
  const onKnot = (knot) => G.add3(knot, G.mul3(G.unit3(G.sub3(sag, knot)), 0.67));
  const route = G.fillet([onKnot(knots[0]), sag, onKnot(knots[1])], 3, 10);
  tube('torana.garland', route, 0.6, {
    tone: 'hi',
    maxLength: 10,
    spacing: 0.8,
    limp: false,
    caps: false,
    className: 'saffron',
  });
  for (const knot of knots) ball('torana.knot', knot, 0.9, { ...paper, className: 'saffron' });
  const box = frameBox(worldBoxPoints(P, [-16, 621, -6, 667], RIM_Z, 34));
  return finishFrame(
    scene,
    box,
    [POST_X, 644, RIM_Z],
    'The Ayodhya torana: two posts, a lintel, gold finials and a marigold garland.',
    audits,
    'gate',
  );
}

function parasolModule(audits) {
  const scene = createScene();
  const { cyl, turned, band, ball, P } = scene;
  const F = upright(POST_X, POST_X);
  const paper = { tone: 'hi' };
  cyl('parasol.post', POST_X, POST_X, 1.4, CORNER_CAP, DOME_BASE - CORNER_CAP, paper, {
    steps: 14,
    ground: true,
  }); // E6
  turned('parasol.dome', F, domeProfile(), paper, {
    smooth: { slope: domeSlope, radius: domeRadius, rows: 2, error: 0.8, fineness: 0.5 },
    steps: 28,
    radius: domeRadius,
    inner: domeRibs(scene, F),
  }); // E7, E9
  band('parasol.fringe', F, 39.2, DOME_BASE, 12.6, 13.2, { ...paper, className: 'saffron' }, { steps: 40 }); // E8
  ball('parasol.finial', [POST_X, POST_X, DOME_BASE + DOME_HEIGHT + 1.5], 1.5, {
    ...paper,
    className: 'gold',
  }); // E10
  const box = frameBox(
    worldBoxPoints(
      P,
      [POST_X - 14, POST_X - 14, POST_X + 14, POST_X + 14],
      CORNER_CAP,
      DOME_BASE + DOME_HEIGHT + 3.5,
    ),
  );
  return finishFrame(
    scene,
    box,
    [POST_X, POST_X, CORNER_CAP],
    'The coronation parasol: a post, a ribbed dome, a saffron fringe and a gold finial.',
    audits,
    'parasol',
  );
}

// ---------------------------------------------------------------- plates

function makerPlate(audits) {
  const scene = createScene();
  const { P, Ln, Dots, at, slab } = scene;
  const plan = { x: MAKER.x, y: FAR, w: MAKER.w, d: 0.8, r: 0.4 };
  const face = FAR + 0.8;
  const rules = [
    [72, -5.5],
    [48, -8],
    [60, -10.5],
  ]
    .map(([length, z]) => k.segment([MAKER.x + 14, face, z], [MAKER.x + 14 + length, face, z], P))
    .join('');
  slab(
    'plate',
    plan,
    -14,
    12,
    { tone: 'mid', className: 'brass', crease: 'lit' },
    {
      steps: 2,
      ground: true,
      inner:
        Ln(k.sideSeam({ x: MAKER.x + 3, y: FAR, w: MAKER.w - 6, d: 0.8, r: 0.4 }, -3.2, P, 2), {
          tone: 'lo',
        }) + Ln(rules, { tone: 'lo', free: true }),
      extra: withClass(
        'brass',
        Dots([at([MAKER.x + 6, face, -8]), at([MAKER.x + MAKER.w - 6, face, -8])], { size: 0.45 }),
      ),
      bias: 0.2,
    },
  );
  const box = frameBox(worldBoxPoints(P, [MAKER.x, FAR, MAKER.x + MAKER.w, face], -14, -2), 1.5);
  return finishFrame(
    scene,
    box,
    [MAKER.x + MAKER.w / 2, FAR, -8],
    "The maker's plate: brass, three engraved rules and two screws.",
    audits,
    'plate-maker',
  );
}

/** Chapter plate n carries n engraved rules, so the five plates read as chapters one to five. */
function chapterPlate(n, audits) {
  const scene = createScene();
  const { P, Ln, Dots, at, slab } = scene;
  const yc = 0;
  const px = SIZE + RIM / 2;
  const plate = { x: SIZE + 5, y: yc - 7, w: 12, d: 14, r: 1 };
  const rules = Array.from({ length: n }, (_, i) => {
    const dx = (i - (n - 1) / 2) * 1.9;
    return k.lineOnTop([px + dx, yc - 3.5], [px + dx, yc + 3.5], RIM_Z + 0.8, P);
  }).join('');
  slab(
    'chapter',
    plate,
    RIM_Z,
    0.8,
    { tone: 'mid', className: 'brass', crease: 'lit' },
    {
      steps: 2,
      ground: true,
      inner:
        Ln(k.planOutline(k.insetPlan(plate, 1.4), RIM_Z + 0.8, P), { tone: 'faint' }) +
        Ln(rules, { tone: 'lo', free: true }),
      extra: withClass(
        'brass',
        Dots([at([px, yc - 5.6, RIM_Z + 0.8]), at([px, yc + 5.6, RIM_Z + 0.8])], { size: 0.4 }),
      ),
    },
  );
  const box = frameBox(
    worldBoxPoints(P, [plate.x, plate.y, plate.x + plate.w, plate.y + plate.d], RIM_Z, RIM_Z + 0.8),
    1.5,
  );
  return finishFrame(
    scene,
    box,
    [px, yc, RIM_Z],
    `Chapter plate ${n}: brass with ${n} engraved rule${n > 1 ? 's' : ''}.`,
    audits,
    `plate-chapter-${n}`,
  );
}

// ---------------------------------------------------------------- build

/** All 16 frames: { name, svg, width, height, anchor, world, kind }, plus the audit totals. */
export function buildFrames() {
  const audits = [];
  const frames = [];
  const add = (name, kind, world, made) => frames.push({ name, kind, world, ...made });
  for (const side of Object.keys(BARS)) {
    const made = barModule(side, audits);
    const bar = BARS[side];
    const mid = centre(bar.across[0], bar.across[1]);
    add(`rim-${side}`, 'bar', bar.axis === 'x' ? [PITCH / 2, mid, 0] : [mid, PITCH / 2, 0], made);
  }
  for (const name of Object.keys(CORNERS)) {
    const [x0, y0, x1, y1] = CORNERS[name].rect;
    add(`corner-${name}`, 'corner', [centre(x0, x1), centre(y0, y1), 0], cornerModule(name, audits));
  }
  add('gate', 'fixture', [POST_X, 644, RIM_Z], gateModule(audits));
  add('parasol', 'fixture', [POST_X, POST_X, CORNER_CAP], parasolModule(audits));
  add('plate-maker', 'plate', [MAKER.x + MAKER.w / 2, FAR, -8], makerPlate(audits));
  for (let n = 1; n <= 5; n++)
    add(`plate-chapter-${n}`, 'plate', [SIZE + RIM / 2, 0, RIM_Z], chapterPlate(n, audits));
  return { frames, audits };
}

async function main() {
  const args = process.argv.slice(2);
  const svgFlag = args.indexOf('--svg-dir');
  const svgDir = svgFlag >= 0 ? args.splice(svgFlag, 2)[1] : null;
  const out = args[0] ?? 'public/assets/iso';
  const started = Date.now();
  const { frames, audits } = buildFrames();
  const problems = audits.reduce((sum, a) => sum + a.problems, 0);
  for (const a of audits) console.log(`audit ${a.name}: ${a.problems} problem${a.problems === 1 ? '' : 's'}`);
  if (problems) {
    for (const a of audits) if (a.problems) console.log(a.report);
    throw new Error(`frame audit failed: ${problems} problems`);
  }
  if (svgDir) {
    mkdirSync(svgDir, { recursive: true });
    for (const f of frames) writeFileSync(join(svgDir, `${f.name}.svg`), f.svg);
  }
  const result = await buildAtlas(
    FRAME_SHEET,
    frames.map((f) => ({
      name: f.name,
      svg: f.svg,
      width: f.width,
      height: f.height,
      factor: FACTORS.coarse,
      anchor: f.anchor,
      meta: { kind: f.kind, drawnAt: f.world },
    })),
    { outDir: out, maxSize: 1024 },
  );
  // sheet-level placement data next to the per-frame sidecar entries
  const sidecar = JSON.parse(readFileSync(result.meta, 'utf8'));
  sidecar.pitch = PITCH;
  sidecar.overlap = OVERLAP;
  sidecar.placementSchema =
    'sprite = frames[frame]; position = toScreen(world) - (anchorX, anchorY) / factor, origin at the anchor; depth = depthKey([depthAt[0], depthAt[1], TOP_Z]) + depthBias; rim and corner placements use the frame band (0 + key), fixtures gate and parasol the standing band (1000 + key), plates the frame band with their depthBias';
  sidecar.placements = framePlacements();
  sidecar.fixtures = frameFixtures();
  writeFileSync(result.meta, `${JSON.stringify(sidecar, null, 2)}\n`);
  console.log(
    `wrote ${result.png} ${result.width}x${result.height} (${frames.length} frames, ${sidecar.placements.length} placements + ${sidecar.fixtures.length} fixtures, ${Date.now() - started} ms)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
