// T40.4: the nine ladders in low relief (T40 spec 3.2). addLadders(scene, level) puts each ladder of a level into the
// recorded scene: wood, bow, rope, vine, stone and tail styles, each from FIELD_C(foot) to FIELD_C(top), with its
// foot and top pieces. Rails take the `rail-<id>` ink class and rungs and knots the `rung-<id>` class (spec 7.4).
//
// Deviations from the spec table (also reported in the task notes):
//   guha        the boat hull is 22 x 12 (not 9 wide) so the two rope rails at +-4.5 rest on it.
//   rope rails  the axis sits at the knot ball's centre (z 1.3), 0.4 above the tile, so every tube end lands on a ball.
//   wedding     the crown discs touch the top knots from outside (the knot ends the rope).
//   shiva-bow   the burst star lies on a small plaque (r 3) between the rail tops, spokes from r 1 to r 3, so each
//               spoke ends on a ring or on the plaque's edge.

import * as k from '../anatomy/iso-kit.mjs';
import * as G from '../anatomy/lathe.mjs';
import { camera } from '../iso-board.mjs';
import { jumpPaths } from './jumps.mjs';
import { TOP_Z } from './world.mjs';

const AZIMUTH = (camera.azimuth * Math.PI) / 180;
/** World direction that points to the left of the screen: ladders keep their foot pieces on that side. */
const LEFT = [-Math.sin(AZIMUTH), Math.cos(AZIMUTH)];
const HALF = 4.5;
const RUNG_PITCH = 22;

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
/** Distance from a ball's centre to where a tube of radius `tube` meets it with its rim on the sphere. */
const onSphere = (r, tube) => Math.sqrt(r * r - tube * tube);
const touchOf = (id) => [`${id}.*`, 'tile.*'];

/** A ladder's plan frame: at(s, w, z) is the world point s along foot to top, w to the screen-left, z above TOP_Z. */
function frameOf(path) {
  const a = path.points[0];
  const b = path.points[path.points.length - 1];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const d = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
  let n = [-d[1], d[0]];
  if (n[0] * LEFT[0] + n[1] * LEFT[1] < 0) n = [-n[0], -n[1]];
  const rungs = Math.max(2, Math.floor(length / RUNG_PITCH));
  return {
    id: path.id,
    length,
    d,
    n,
    angle: Math.atan2(d[1], d[0]),
    rungs,
    rungAt: (index) => (length * (index + 0.5)) / rungs,
    at: (s, w, z = 0) => [a[0] + d[0] * s + n[0] * w, a[1] + d[1] * s + n[1] * w, TOP_Z + z],
    plan: (s, w) => [a[0] + d[0] * s + n[0] * w, a[1] + d[1] * s + n[1] * w],
    dir3: [d[0], d[1], 0],
    side3: [n[0], n[1], 0],
  };
}

/** A rail route sampled every `step` along s, with the arc length of any s for gaps. */
function railRoute(f, { s0, s1, w, z, step = 5 }) {
  const count = Math.max(2, Math.ceil((s1 - s0) / step));
  const samples = Array.from({ length: count + 1 }, (_, i) => lerp(s0, s1, i / count));
  const points = samples.map((s) => f.at(s, w(s), z(s)));
  const arcs = [0];
  for (let i = 1; i < points.length; i++) arcs.push(arcs[i - 1] + G.len3(G.sub3(points[i], points[i - 1])));
  const arc = (s) => {
    const t = ((s - s0) / (s1 - s0)) * count;
    const i = Math.min(count - 1, Math.max(0, Math.floor(t)));
    return lerp(arcs[i], arcs[i + 1], t - i);
  };
  return { points, arc, total: arcs[arcs.length - 1] };
}

/** A convex polygon (world [x, y] points) rotated by `angle` about its own origin and moved to `at`. */
const placed = (ring, angle, at) => {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return ring.map(([x, y]) => [at[0] + x * cos - y * sin, at[1] + x * sin + y * cos]);
};

/** Rope, vine and tail-fur ladders: two rails on knot balls, rungs running ball to ball. */
function ropeLadder(scene, f, o) {
  const { id, railR, knotR, rungR, wave, waveLength, phases = [0, 0], lift = () => 0, rings } = o;
  const { s0 = knotR, s1 = f.length - knotR } = o;
  const { tube, ball } = scene;
  const touch = touchOf(id);
  scene.allowCrowd(`${id}.rung`, `${id}.rail`);
  // signed lateral offset of a rail: both rails sway together (in phase) or against each other (phases apart)
  const lateralAt = (s, side) =>
    side * HALF + wave * Math.sin((2 * Math.PI * s) / waveLength + phases[side > 0 ? 0 : 1]);
  const rungS = Array.from({ length: f.rungs }, (_, i) => f.rungAt(i));
  // the end knots, and a rung knot too unless the rung sits on an end knot
  const knotS = [s0, ...rungS.filter((s) => Math.abs(s - s0) > 0.5 && Math.abs(s - s1) > 0.5), s1].sort(
    (a, b) => a - b,
  );
  const interior = knotS.slice(1, -1);
  const gapR = onSphere(knotR, railR);
  const centres = [];
  for (const side of [1, -1]) {
    const route = railRoute(f, {
      s0: s0 + gapR,
      s1: s1 - gapR,
      w: (s) => lateralAt(s, side),
      z: (s) => knotR + lift(s),
    });
    const gaps = interior.map((s) => [route.arc(s) - gapR, route.arc(s) + gapR]);
    tube(`${id}.rail`, route.points, railR, {
      className: `rail-${id}`,
      rings,
      gaps,
      maxLength: 80,
      spacing: 8,
      owner: id,
      touch,
      tone: 'hi',
      limp: false,
    });
    const row = knotS.map((s) => f.at(s, lateralAt(s, side), knotR + lift(s)));
    row.forEach((c) =>
      ball(`${id}.knot`, c, knotR, { tone: 'hi', className: `rung-${id}` }, { symbol: `${id}.knot` }),
    );
    centres.push(row);
  }
  const gapRung = onSphere(knotR, rungR);
  for (const s of rungS) {
    const i = knotS.findIndex((knot) => Math.abs(knot - s) < 0.5);
    const [c1, c2] = [centres[0][i], centres[1][i]];
    const dir = G.unit3(G.sub3(c2, c1));
    const route = [G.add3(c1, G.mul3(dir, gapRung)), G.sub3(c2, G.mul3(dir, gapRung))];
    tube(`${id}.rung`, route, rungR, {
      className: `rung-${id}`,
      maxLength: 80,
      spacing: 8,
      owner: id,
      touch,
      tone: 'hi',
      limp: false,
    });
  }
  return { centres, lateralAt };
}

// ---------------------------------------------------------------- vishwamitra (wood)

function woodLadder(scene, f) {
  const { id } = f;
  const { prism, disc, turned } = scene;
  for (const side of [1, -1]) {
    const plan = k.roundedPlan({ x: -f.length / 2, y: -1.2, w: f.length, d: 2.4, r: 0.8 }, 2);
    prism(
      `${id}.rail`,
      placed(plan, f.angle, f.plan(f.length / 2, side * HALF)),
      TOP_Z,
      1.0,
      { tone: 'hi', className: `rail-${id}` },
      { bevel: 0.3 },
    );
  }
  const half = HALF - 1.2;
  for (let i = 0; i < f.rungs; i++) {
    const F = G.frameAlong(f.at(f.rungAt(i), 0, 0.7), f.side3);
    // the bowstring wraps the top rung: one hi turn round its middle
    const wrap =
      i === f.rungs - 1 ? k.lineSvg(G.arcOf(F, 0, 0.7, scene.P, { steps: 20 }), { tone: 'hi' }) : '';
    disc(
      `${id}.rung`,
      F,
      -half,
      half,
      0.7,
      { tone: 'hi', className: `rung-${id}` },
      { steps: 14, inner: wrap, symbol: wrap ? undefined : `${id}.rung` },
    );
  }
  // foot: the kamandalu 8 units to the left of the foot, with a spout turned toward the ladder
  const [px, py] = f.plan(0, 8);
  const pot = [
    [0, 2.2],
    [1.2, 2.6, 1],
    [3.2, 2.0, 1],
    [3.6, 1.0],
    [4.2, 1.0],
  ];
  turned(
    `${id}.kamandalu`,
    G.frameOf([px, py, TOP_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
    pot,
    { tone: 'hi', className: `rung-${id}` },
    {
      steps: 16,
      smooth: { rows: 3, error: 0.6, fineness: 0.4 },
    },
  );
  disc(
    `${id}.spout`,
    G.frameAlong([px, py, TOP_Z + 2.2], G.mul3(f.side3, -1)),
    2.3,
    3.9,
    0.5,
    { tone: 'hi', className: `rung-${id}` },
    { steps: 4 },
  );
}

// ---------------------------------------------------------------- shiva-bow

function bowLadder(scene, f) {
  const { id } = f;
  const { tube, disc, line } = scene;
  const bow = (s) => 14 * (1 - ((2 * s) / f.length - 1) ** 2);
  const touch = touchOf(id);
  for (const side of [1, -1]) {
    const route = railRoute(f, {
      s0: 0.5,
      s1: f.length - 0.5,
      w: (s) => side * (HALF + bow(s)),
      z: () => 1.0,
      step: 6,
    });
    tube(`${id}.rail`, route.points, 1.0, {
      className: `rail-${id}`,
      rings: { pitch: 6, steps: 5, tone: 'lo' },
      maxLength: 80,
      spacing: 8,
      owner: id,
      touch,
      tone: 'hi',
      limp: false,
      ends: [false, false],
    });
  }
  // strings: one hi line across the bow at every rung position, from rail to rail
  for (let i = 0; i < f.rungs; i++) {
    const s = f.rungAt(i);
    const w = HALF + bow(s) - 1.0;
    line(`${id}.string`, [f.at(s, w, 1.0), f.at(s, -w, 1.0)], { tone: 'hi' }, { group: `rung-${id}` });
  }
  // top: the burst plaque between the rail tops with six spokes from a dot ring to its edge
  const top = f.at(f.length - 2.2, 0, 0);
  const F = G.frameOf([top[0], top[1], TOP_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const spokes = G.spokesOf(F, 0.5, 1.0, 3.0, 6, scene.P, { phase: Math.PI / 6 });
  const star = k.lineSvg(spokes + k.ring(top[0], top[1], 1.0, TOP_Z + 0.5, scene.P, 16), { tone: 'hi' });
  disc(
    `${id}.plaque`,
    F,
    0,
    0.5,
    3.0,
    { tone: 'hi', className: `rung-${id}` },
    {
      steps: 24,
      inner: star,
      extra: scene.Dots([scene.at([top[0], top[1], TOP_Z + 0.5])], { size: 0.5, tone: 'hi' }),
    },
  );
}

// ---------------------------------------------------------------- wedding, guha, hanuman-meeting (rope)

function weddingLadder(scene, f) {
  const { id } = f;
  const { cyl, tube } = scene;
  const crown = 2.9;
  const { centres } = ropeLadder(scene, f, {
    id,
    railR: 0.9,
    knotR: 1.3,
    rungR: 0.6,
    wave: 1.6,
    waveLength: 36,
    rings: { pitch: 2.4, twist: 1.2, steps: 3 },
    s1: f.length - crown,
  });
  // top: a crown disc with four knurl lines touches each top knot from outside
  for (const c of [centres[0][centres[0].length - 1], centres[1][centres[1].length - 1]]) {
    const x = c[0] + f.d[0] * crown;
    const y = c[1] + f.d[1] * crown;
    cyl(
      `${id}.crown`,
      x,
      y,
      1.6,
      TOP_Z,
      1.0,
      { tone: 'hi', className: `rung-${id}` },
      { steps: 16, inner: k.lineSvg(k.knurl(x, y, 1.6, TOP_Z, TOP_Z + 1.0, 4, scene.P, 0), { tone: 'lo' }) },
    );
  }
  // foot: a garland loop on the ground between the two foot knots
  const [a, b] = [centres[0][0], centres[1][0]];
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const radius = Math.hypot(a[0] - b[0], a[1] - b[1]) / 2;
  const route = Array.from({ length: 13 }, (_, i) => {
    const phi = (i / 12) * Math.PI;
    return [
      mid[0] + f.side3[0] * radius * Math.cos(phi) - f.d[0] * radius * Math.sin(phi),
      mid[1] + f.side3[1] * radius * Math.cos(phi) - f.d[1] * radius * Math.sin(phi),
      TOP_Z + 0.5,
    ];
  });
  tube(`${id}.garland`, route, 0.5, {
    className: `rung-${id}`,
    maxLength: 80,
    spacing: 2,
    owner: id,
    touch: touchOf(id),
    tone: 'hi',
    ends: [false, false],
  });
}

function guhaLadder(scene, f) {
  const { id } = f;
  const { prism, slab } = scene;
  const hullTop = 0.6;
  const lift = (s) => hullTop * (1 - smooth((s - 19) / 5));
  // the boat hull: a lens under the first 20 units, drawn over the Ganga inlay
  const lens = [];
  for (let i = 0; i <= 16; i++) {
    const u = -1 + (2 * i) / 16;
    lens.push([10 + 11 * u, 6 * (1 - Math.abs(u) ** 2.6) ** (1 / 2.6)]);
  }
  const ring = [
    ...lens,
    ...lens
      .slice(1, -1)
      .reverse()
      .map(([s, w]) => [s, -w]),
  ];
  const plan = ring.map(([s, w]) => f.plan(s, w));
  prism(`${id}.hull`, plan, TOP_Z, hullTop, { tone: 'hi', className: `rail-${id}` }, { bevel: 0.3 });
  const first = f.rungAt(0);
  const { centres } = ropeLadder(scene, f, {
    id,
    railR: 0.9,
    knotR: 1.3,
    rungR: 0.6,
    wave: 1.6,
    waveLength: 36,
    rings: { pitch: 2.4, twist: 1.2, steps: 3 },
    lift,
    s0: first,
  });
  // the rails are oars: each ends at the foot in a paddle blade lying on the hull, touching its end knot
  for (const c of [centres[0][0], centres[1][0]]) {
    const centre = f.plan(first - 1.3 - 3, 0);
    const w = (c[0] - centre[0]) * f.n[0] + (c[1] - centre[1]) * f.n[1];
    const at = [centre[0] + f.n[0] * w, centre[1] + f.n[1] * w];
    const blade = placed(k.roundedPlan({ x: -3, y: -1.5, w: 6, d: 3, r: 0.6 }, 2), f.angle, at);
    prism(`${id}.paddle`, blade, TOP_Z + hullTop, 0.8, { tone: 'hi', className: `rail-${id}` }, {});
  }
  void slab;
}

function meetingLadder(scene, f) {
  const { id } = f;
  const { tube, turned, ball } = scene;
  const { centres } = ropeLadder(scene, f, {
    id,
    railR: 0.9,
    knotR: 1.3,
    rungR: 0.6,
    wave: 1.6,
    waveLength: 36,
    rings: { pitch: 3, steps: 3 },
  });
  const touch = touchOf(id);
  // foot: a tiny mace lying flat to the left of the foot, handle sloping down to the tile
  const head = f.at(9, 9.5, 1.6);
  const shaftEnd = f.at(1, 9.5, 0.5);
  const F = G.frameAlong(head, [f.d[0], f.d[1], 0]);
  turned(
    `${id}.mace`,
    F,
    [
      [0, 0.6],
      [1.5, 1.6, 1],
      [3, 1.4, 1],
      [4.5, 0.6],
    ],
    { tone: 'hi', className: `rung-${id}` },
    { steps: 14, smooth: { rows: 3, error: 0.6, fineness: 0.4 } },
  );
  tube(`${id}.shaft`, [head, shaftEnd], 0.5, {
    className: `rung-${id}`,
    maxLength: 20,
    spacing: 2,
    owner: id,
    touch,
    tone: 'hi',
    ends: [true, false],
    limp: false,
  });
  // top: the tail curl, a spiral of 1.5 turns from r 2 to r 4 ending in a tuft ball
  const top = centres[0][centres[0].length - 1];
  const mid = [
    (top[0] + centres[1][centres[1].length - 1][0]) / 2,
    (top[1] + centres[1][centres[1].length - 1][1]) / 2,
  ];
  const C = G.frameOf([mid[0] + f.d[0] * 6, mid[1] + f.d[1] * 6, TOP_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const spiral = G.spiral(C, 0.7, 2, 4, 0, 3 * Math.PI, 28);
  const end = spiral[spiral.length - 1];
  const before = spiral[spiral.length - 2];
  const onTuft = G.add3(end, G.mul3(G.unit3(G.sub3(before, end)), onSphere(0.9, 0.7)));
  const route = [...spiral.slice(0, -1), onTuft];
  tube(`${id}.curl`, route, 0.7, {
    className: `rung-${id}`,
    maxLength: 20,
    spacing: 1.5,
    owner: id,
    touch,
    tone: 'hi',
    ends: [false, true],
    limp: false,
  });
  ball(`${id}.tuft`, end, 0.9, { tone: 'hi', className: `rung-${id}` });
}

// ---------------------------------------------------------------- shabari (vine)

function vineLadder(scene, f) {
  const { id } = f;
  const { prism, disc, line } = scene;
  const { lateralAt } = ropeLadder(scene, f, {
    id,
    railR: 0.8,
    knotR: 1.0,
    rungR: 0.5,
    wave: 2.2,
    waveLength: 28,
    phases: [0, Math.PI],
  });
  // leaves every 12 units along each rail, outward, leaning forward and back alternately, each on a stem that ends on the rail
  [1, -1].forEach((side) => {
    for (let i = 0; ; i++) {
      const s = 7 + 14 * i;
      if (s > f.length - 6) break;
      const lean = i % 2 ? -1 : 1;
      const rail = f.at(s, lateralAt(s, side), 1.0);
      const dir = [f.n[0] * side * 0.6 + f.d[0] * 0.8 * lean, f.n[1] * side * 0.6 + f.d[1] * 0.8 * lean];
      const angle = Math.atan2(dir[1], dir[0]);
      const base = [rail[0] + dir[0] * 2.2, rail[1] + dir[1] * 2.2];
      const leaf = placed(k.roundedPlan({ x: 0, y: -1, w: 4, d: 2, r: 1 }, 3), angle, base);
      prism(
        `${id}.leaf`,
        leaf,
        TOP_Z,
        0.6,
        { tone: 'hi', className: `rung-${id}` },
        { symbol: `${id}.leaf.${side}.${lean}` },
      );
      line(`${id}.stem`, [rail, [base[0], base[1], TOP_Z + 0.3]], { tone: 'lo' }, { group: `rung-${id}` });
    }
  });
  // foot: a basket between the rails, a short cup with fourteen knurl lines
  const [bx, by] = f.plan(3.2, 0);
  disc(
    `${id}.basket`,
    G.frameOf([bx, by, TOP_Z], [0, 0, 1], [1, 0, 0], [0, 1, 0]),
    0,
    2.2,
    2.4,
    { tone: 'hi', className: `rung-${id}` },
    {
      steps: 24,
      inner: k.lineSvg(k.knurl(bx, by, 2.4, TOP_Z, TOP_Z + 2.2, 14, scene.P, 0), { tone: 'lo' }),
    },
  );
}

// ---------------------------------------------------------------- sugriva (stone)

function stoneLadder(scene, f) {
  const { id } = f;
  const { slab, cyl } = scene;
  const sx = 4;
  // two rows of pillar blocks every 6 units; the gaps are the mortar
  const count = Math.floor((f.length - 2 - sx) / 6) + 1;
  for (const side of [1, -1]) {
    for (let i = 0; i < count; i++) {
      const [x, y] = f.plan(2 + sx / 2 + 6 * i, side * HALF);
      const plan = placed(k.roundedPlan({ x: -2, y: -2, w: 4, d: 4, r: 0.6 }, 1), f.angle, [x, y]);
      scene.prism(
        `${id}.block`,
        plan,
        TOP_Z,
        2.0,
        { tone: 'hi', className: `rail-${id}` },
        { symbol: `${id}.block` },
      );
    }
  }
  // rungs: low slabs 1.6 wide between the rows, each holding a ring (the clasped hands)
  const span = HALF - 2.0;
  for (let i = 0; i < f.rungs; i++) {
    const [x, y] = f.plan(f.rungAt(i), 0);
    const plan = placed(k.roundedPlan({ x: -0.8, y: -span, w: 1.6, d: 2 * span, r: 0.3 }, 1), f.angle, [
      x,
      y,
    ]);
    scene.prism(
      `${id}.rung`,
      plan,
      TOP_Z,
      0.8,
      { tone: 'hi', className: `rung-${id}` },
      {
        inner: k.lineSvg(k.ring(x, y, 0.8, TOP_Z + 0.8, scene.P, 16), { tone: 'lo' }),
        symbol: `${id}.rung`,
      },
    );
  }
  // top: a crown disc with two ears standing on it
  const [cx, cy] = f.plan(f.length - 2, 0);
  cyl(`${id}.crown`, cx, cy, 2, TOP_Z, 1.0, { tone: 'hi', className: `rung-${id}` }, { steps: 18 });
  for (const side of [1, -1]) {
    const [ex, ey] = f.plan(f.length - 2, side * 1.1);
    cyl(`${id}.ear`, ex, ey, 0.7, TOP_Z + 1.0, 1.2, { tone: 'hi', className: `rung-${id}` }, { steps: 4 });
  }
  void slab;
}

// ---------------------------------------------------------------- hanuman-leap (tail)

function tailLadder(scene, f) {
  const { id } = f;
  const { tube, ball } = scene;
  const bow = (s) => 22 * (1 - ((2 * s) / f.length - 1) ** 2);
  const touch = touchOf(id);
  scene.allowCrowd(`${id}.tail`, `${id}.tuft`);
  scene.allowCrowd(`${id}.tuft`, `${id}.tuft`);
  const tipRadius = 1.6;
  const route = railRoute(f, { s0: 0, s1: f.length - tipRadius, w: bow, z: () => 1.6, step: 6 });
  tube(`${id}.tail`, route.points, tipRadius, {
    className: `rail-${id}`,
    rings: { pitch: 3, fade: [0.1, 0.55], steps: 3 },
    maxLength: 80,
    spacing: 8,
    owner: id,
    touch,
    tone: 'hi',
    limp: false,
    ends: [false, true],
  });
  // top: the tuft, four short tubes fanning +-35 degrees from the tip, each ending on a terminal ball
  const tip = f.at(f.length - tipRadius, bow(f.length - tipRadius), 1.6);
  ball(`${id}.tip`, tip, tipRadius, { tone: 'hi', className: `rail-${id}` });
  const last = route.points[route.points.length - 1];
  const heading = Math.atan2(tip[1] - last[1], tip[0] - last[0]);
  for (const deg of [-35, -12, 12, 35]) {
    const angle = heading + (deg * Math.PI) / 180;
    const dir = [Math.cos(angle), Math.sin(angle), 0];
    const start = G.add3(tip, G.mul3(dir, onSphere(tipRadius, 0.6)));
    const end = G.add3(tip, G.mul3(dir, onSphere(tipRadius, 0.6) + 5));
    const dot = G.add3(end, G.mul3(dir, onSphere(0.9, 0.6)));
    tube(`${id}.tuft`, [start, end], 0.6, {
      className: `rail-${id}`,
      maxLength: 20,
      spacing: 2,
      owner: id,
      touch,
      tone: 'hi',
      limp: false,
    });
    ball(`${id}.tuft-dot`, dot, 0.9, { tone: 'hi', className: `rail-${id}` }, { symbol: `${id}.tuft-dot` });
  }
}

// ---------------------------------------------------------------- rama-setu (stepping stones)

function stonesLadder(scene, f) {
  const { id } = f;
  const { prism } = scene;
  const count = Math.max(1, Math.floor(f.length / 24));
  for (let i = 0; i < count; i++) {
    const s = (f.length * (i + 0.5)) / count;
    const [x, y] = f.plan(s, i % 2 ? 3 : -3);
    const stone = { x: -8, y: -5.5, w: 16, d: 11, r: 4 };
    const plan = placed(k.roundedPlan(stone, 5), f.angle, [x, y]);
    const mortar = placed(k.roundedPlan(k.insetPlan(stone, 1.6), 5), f.angle, [x, y]);
    // each stone carries a mortar outline and a ring (the inscribed name); the first also the squirrel's footprints
    let inner = k.lineSvg(k.onTop(mortar, TOP_Z + 1.4, scene.P, true), { tone: 'faint' });
    inner += k.lineSvg(k.ring(x, y, 0.8, TOP_Z + 1.4, scene.P, 16), { tone: 'hi' });
    let extra = '';
    if (i === 0) {
      const prints = [-1.6, 1.6].map((dw) =>
        scene.at([...f.plan(s - 4.5, (i % 2 ? 3 : -3) + dw), TOP_Z + 1.4]),
      );
      extra = scene.Dots(prints, { size: 0.5, tone: 'hi' });
    }
    prism(
      `${id}.stone`,
      plan,
      TOP_Z,
      1.4,
      { tone: 'hi', className: `rail-${id}` },
      { inner, extra, symbol: i === 0 ? undefined : `${id}.stone` },
    );
  }
}

const BUILDERS = {
  vishwamitra: woodLadder,
  'shiva-bow': bowLadder,
  wedding: weddingLadder,
  guha: guhaLadder,
  shabari: vineLadder,
  'hanuman-meeting': meetingLadder,
  sugriva: stoneLadder,
  'hanuman-leap': tailLadder,
  'rama-setu': stonesLadder,
};

/** Every ladder of a level, in jumps.mjs order. Returns the ladder ids drawn. */
export function addLadders(scene, level) {
  const ids = [];
  for (const path of jumpPaths(level)) {
    if (path.kind !== 'ladder') continue;
    const build = BUILDERS[path.id];
    if (!build) throw new Error(`No ladder builder for ${path.id}`);
    build(scene, frameOf(path));
    ids.push(path.id);
  }
  return ids;
}
