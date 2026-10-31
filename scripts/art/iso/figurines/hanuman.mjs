// Hanuman as an articulated character (T43 spec section 1; faces from T02 section 4). One call draws one solved pose:
// ball joints with dowel limbs, lathe cloth, torso and crown, a ringed tube for the tail, the gada in his right hand.
// Everything is placed in the character's local frame (l = right, t = forward, u = up; origin = the root's ground point)
// by rig.mjs and mapped into the board's world by frameFor(facing). Colours are materials of tones(hex) (spec 1.2).
//
// Deviations from the spec table, all forced by what the audit rejects or the camera shows (reported in the commit):
//   - dowels stand off a joint ball by r / tan(half the interior angle) when they would overlap at a deep bend;
//   - the hem band hugs the cloth (0.3 proud) instead of sinking into it;
//   - the tail is a planar chain heading back and to his left with the spec's five segment lengths.

import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { tones } from '../tones.mjs';
import { add, DEG, faceFacing, faceWorld, inBasis, mul, sub, unit } from './common.mjs';
import { frameFor } from './rig.mjs';

export const MATERIALS = {
  fur: '#F0A96B',
  parchment: '#F3E3B8',
  saffron: '#F39C2B',
  gold: '#E9C12F',
  seat: '#E4572E',
  wood: '#5A3A1E',
  ink: '#2A1A0F',
};

const HEAD_R = 7.2;
const MUZZLE_R = 2.7;
const TAIL_R = 1.3;
const MACE_L = 8.9;
const MACE_BELLY = 5;

// ---------------------------------------------------------------- analytic profiles (smooth, with slopes)

/** [s, r, 1] knots of an analytic radius over [from, to]. */
const knots = (from, to, radius, n = 22) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const s = from + ((to - from) * i) / n;
    return [s, radius(s), 1];
  });

/** Loincloth z 22..31: r 5.7 at the hem to 4.0 at the belt. */
const loinR = (z) => 5.7 - 1.7 * ((z - 22) / 9) ** 2;
const loinSlope = (z) => (-3.4 * (z - 22)) / 81;

/** Torso z 32.4..51: a barrel, r 4.8 at z 41, 3.9 at the belt, 3.1 at the ruff. */
const TORSO_MID = 41;
const torsoR = (z) =>
  z < TORSO_MID
    ? 4.8 - 0.9 * ((TORSO_MID - z) / (TORSO_MID - 32.4)) ** 2
    : 4.8 - 1.7 * ((z - TORSO_MID) / (51 - TORSO_MID)) ** 2;
const torsoSlope = (z) =>
  z < TORSO_MID
    ? (1.8 * (TORSO_MID - z)) / (TORSO_MID - 32.4) ** 2
    : (-3.4 * (z - TORSO_MID)) / (51 - TORSO_MID) ** 2;

const maceR = (s) => {
  if (s <= MACE_BELLY) return 3.4 * Math.sqrt(Math.max(0, 1 - ((MACE_BELLY - s) / 5.34) ** 2));
  return 3.4 * Math.sqrt(Math.max(0, 1 - ((s - MACE_BELLY) / (MACE_L - MACE_BELLY)) ** 2));
};
const maceSlope = (s) => {
  const a = s <= MACE_BELLY ? 5.34 : MACE_L - MACE_BELLY;
  const x = (s - MACE_BELLY) / a;
  const root = Math.sqrt(Math.max(1e-6, 1 - x * x));
  return (-3.4 * x) / (a * root);
};

const rimOn = (R, a) => Math.sqrt(R * R - a * a);

/** How far from a joint ball's centre a dowel of radius r stands so it touches the ball and clears its neighbour. */
function standOff(R, r, interiorDeg) {
  const half = Math.min(179, Math.max(20, interiorDeg)) / 2;
  const clear = r / Math.tan(half * DEG);
  return Math.min(R + 0.1, Math.max(rimOn(R, Math.min(r, R - 0.05)), clear));
}

const angleBetween = (a, b) =>
  (Math.acos(Math.max(-1, Math.min(1, -(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])))) * 180) / Math.PI;

/** A direction (local) as a world vector: W is linear, so W(v) - W(0). */
const frameVector = (W, v) => sub(W(v), W([0, 0, 0]));

// ---------------------------------------------------------------- the builder

/**
 * Draw one solved pose into `fig`. `pose` is solvePose(spec); `facing` one of SE SW NW NE; `face` the expression.
 */
export function buildHanuman(fig, pose, facing, face) {
  const frame = frameFor(facing);
  const ctx = { fig, pose, W: frame.loc, P: fig.P, m: MATERIALS };
  const loin = addBody(ctx);
  addLegs(ctx, loin);
  addHead(ctx, face, facing);
  addArms(ctx);
  addMace(ctx);
  addTail(ctx, loin);
}

/** Axis frame of the leaning upper body. */
function bodyFrame({ pose, W }) {
  const origin = pose.lean.point([0, 0, 0]);
  return G.frameAlong(W(origin), frameVector(W, pose.lean.axis));
}

function addBody(ctx) {
  const { fig, pose, W, P, m } = ctx;
  const body = bodyFrame(ctx);
  const up = (z, r = 0, f = 0) => pose.lean.point([r, f, z]);

  const loin = fig.turned('body', 'loincloth', body, knots(23.2, 31, loinR, 18), {
    slope: loinSlope,
    radius: loinR,
    mat: m.saffron,
    meta: { ground: true },
    inner: k.lineSvg(G.arcOf(body, 26, loinR(26), P, { slope: loinSlope(26) }), { tone: 'faint' }),
  });
  // Hem band: the gold lower slice of the cloth, stacked under it so no ring has to wrap round a solid.
  const hem = fig.turned('body', 'hem', body, knots(22, 23.2, loinR, 4), {
    slope: loinSlope,
    radius: loinR,
    mat: m.gold,
    meta: { ground: true },
  });
  fig.ring('body', 'belt', body, 31, 32.4, 3.9, 4.2, { mat: m.seat, meta: { ground: true } });
  const knotAngle = 25 * DEG;
  const knotC = up(31.7, 4.9 * Math.sin(knotAngle), 4.9 * Math.cos(knotAngle));
  fig.ball('body', 'belt.knot', W(knotC), 1.1, { mat: m.gold, meta: { ground: true } });
  fig.turned('body', 'torso', body, knots(32.4, 51, torsoR), {
    slope: torsoSlope,
    radius: torsoR,
    mat: m.fur,
    meta: { ground: true },
  });
  fig.ring('body', 'ruff', body, 51, 53, 1.9, 3.0, { mat: m.parchment, meta: { ground: true } });
  addSash(ctx, knotC);
  return { loin, hem };
}

/**
 * The seat-colour sash (spec 1.3): a clasp ball high on the chest, a knot ball below it, two straight tubes down to the
 * belt knot. Straight pieces between balls cannot fold on screen from any of the four facings; a bent tube does.
 */
function addSash(ctx, knotC) {
  const { fig, pose, W, m } = ctx;
  const onTorso = (z, deg, lift) => {
    const rad = torsoR(z) + lift;
    const angle = deg * DEG;
    return pose.lean.point([rad * Math.sin(angle), rad * Math.cos(angle), z]);
  };
  const clasp = onTorso(47.5, -34, 1.2);
  const chest = onTorso(40.5, -6, 1.5);
  fig.ball('sash.clasp', 'sash.clasp', W(clasp), 1.1, { mat: m.seat });
  fig.ball('sash.knot', 'sash.knot', W(chest), 1.1, { mat: m.seat });
  const touch = ['torso*', 'belt*', 'sash.clasp*', 'sash.knot*'];
  const link = (name, from, to, fromR, toR) => {
    const dir = unit(sub(to, from));
    fig.tube(
      'sash',
      name,
      [add(from, mul(dir, rimOn(fromR, 0.9))), sub(to, mul(dir, rimOn(toR, 0.9)))].map(W),
      0.9,
      {
        maxLength: 4,
        mat: m.seat,
        touch,
      },
    );
  };
  link('sash.upper', clasp, chest, 1.1, 1.1);
  link('sash.lower', chest, knotC, 1.1, 1.1);
}

// ---------------------------------------------------------------- legs

function addLegs(ctx, loin) {
  const { fig, pose, W, m } = ctx;
  for (const side of ['L', 'R']) {
    const leg = pose.legs[side];
    const o = `leg${side}`;
    const hip = leg.hipP;
    const knee = leg.kneeP;
    const ankle = leg.ankleP;
    const u1 = unit(sub(knee, hip));
    const u2 = unit(sub(ankle, knee));
    const upShin = mul(u2, -1);
    const kneeAngle = angleBetween(u1, u2);
    const kneeStand = standOff(2.1, 2.0, kneeAngle);
    const thighEnd = Math.max(kneeStand, 2.1 - 0.4);
    const hipStand = rimOn(2.2, 2.0);

    // foot and toe: a capsule with its sole at the ground
    const footShape = fig.dowel(o, `foot.${side}`, W(leg.heel), W(leg.toeC), 1.8, { mat: m.fur });
    fig.ball(o, `toe.${side}`, W(leg.toeC), 1.8, { mat: m.fur, meta: { seated: true, cut: footShape } });

    // anklet on the shin axis just above the ankle ball; the ball is seated in foot and anklet
    const anklet = fig.dowel(
      o,
      `anklet.${side}`,
      W(add(ankle, mul(upShin, 0.95))),
      W(add(ankle, mul(upShin, 1.75))),
      2.1,
      { mat: m.gold, meta: { seated: true, cut: footShape } },
    );
    fig.ball(o, `ankle.${side}`, W(ankle), 1.9, {
      mat: m.fur,
      meta: { seated: true, cut: [footShape, anklet] },
    });
    fig.dowel(o, `shin.${side}`, W(add(knee, mul(u2, kneeStand))), W(add(ankle, mul(upShin, 1.75))), 1.7, {
      mat: m.fur,
    });
    fig.ball(o, `knee.${side}`, W(knee), 2.1, { mat: m.fur });
    // the thigh belongs to the body: it enters the cloth (seated in the loincloth)
    fig.dowel('body', `thigh.${side}`, W(add(hip, mul(u1, hipStand))), W(sub(knee, mul(u1, thighEnd))), 2.0, {
      mat: m.fur,
      meta: { seated: true, cut: [loin.loin, loin.hem] },
    });
  }
}

// ---------------------------------------------------------------- head and face

function addHead(ctx, face, facing) {
  const { fig, pose, W, m } = ctx;
  const { c: headC, basis, faceBasis } = pose.head;
  const showFace = facing === 'SE' || facing === 'SW';
  const headShape = fig.ball('head', 'head', W(headC), HEAD_R, {
    mat: m.fur,
    extra: showFace ? faceMarks(ctx, face, headC, faceBasis) : '',
  });
  const muzzleC = inBasis(headC, faceBasis, [0, 5.7, -4.3]);
  fig.ball('head', 'muzzle', W(muzzleC), MUZZLE_R, {
    mat: m.parchment,
    meta: { seated: true, cut: headShape },
    extra: showFace ? muzzleMarks(ctx, face, muzzleC, faceBasis) : '',
  });
  // neck: from the ruff into the head (seated in the head)
  const neckA = pose.lean.point([0, 0, 53]);
  const neckB = add(neckA, mul(pose.lean.axis, 1.4));
  fig.dowel('head', 'neck', W(neckA), W(neckB), 2.0, { mat: m.fur, meta: { seated: true, cut: headShape } });

  for (const [side, sign] of [
    ['L', -1],
    ['R', 1],
  ]) {
    const axisE = unit(add(mul(basis.R, sign * 0.82), mul(basis.F, 0.57)));
    const centre = inBasis(headC, basis, [sign * 8.7, 0.9, 1.0]);
    const o = `ear${side}`;
    fig.turned(
      o,
      `ear.${side}`,
      G.frameAlong(W(sub(centre, mul(axisE, 0.6))), frameVector(W, axisE)),
      [
        [0, 3.0],
        [1.2, 3.0],
      ],
      { bevel: 0.3, mat: m.fur },
    );
    fig.turned(
      o,
      `ear.inner.${side}`,
      G.frameAlong(W(add(centre, mul(axisE, 0.6))), frameVector(W, axisE)),
      [
        [0, 1.8],
        [0.4, 1.8],
      ],
      { mat: m.parchment },
    );
  }
  addCrown(ctx, headC, basis, headShape);
}

function addCrown({ fig, W, m }, headC, basis, headShape) {
  const crownAxis = frameVector(W, basis.Z);
  const crownAt = (u) => W(inBasis(headC, basis, [0, 0, u]));
  const frameAt = (u) => G.frameAlong(crownAt(u), crownAxis);
  const bulged = (r0, r1, length, bulge) => ({
    radius: (t) => r0 + ((r1 - r0) * t) / length + bulge * Math.sin((Math.PI * t) / length),
    slope: (t) => (r1 - r0) / length + ((bulge * Math.PI) / length) * Math.cos((Math.PI * t) / length),
  });
  const seated = { seated: true, cut: headShape };
  const addTier = (name, u, r0, r1, length, bulge, meta) => {
    const shape = bulged(r0, r1, length, bulge);
    fig.turned('head', name, frameAt(u), knots(0, length, shape.radius, 10), { ...shape, mat: m.gold, meta });
  };
  const band = (name, u, r, height, options) =>
    fig.turned(
      'head',
      name,
      frameAt(u),
      [
        [0, r],
        [height, r],
      ],
      { mat: m.gold, ...options },
    );
  band('crown.band', 6.0, 3.9, 0.9, { bevel: 0.3, meta: seated });
  addTier('crown.tier1', 6.9, 3.6, 3.0, 3.2, 0.35, seated);
  band('crown.ring1', 10.1, 3.2, 0.6);
  addTier('crown.tier2', 10.7, 2.8, 2.0, 2.6, 0.3);
  band('crown.ring2', 13.3, 2.3, 0.6);
  addTier('crown.tier3', 13.9, 1.8, 0, 2.7, 0.4);
  fig.ball('head', 'crown.finial', crownAt(16.6 + 0.55), 0.55, { mat: m.gold });
}

// ---------------------------------------------------------------- arms

function addArms(ctx) {
  const { fig, pose, W, m } = ctx;
  for (const side of ['L', 'R']) {
    const { shoulder, elbow, hand } = pose.arms[side];
    const o = `arm${side}`;
    const u1 = unit(sub(elbow, shoulder));
    const u2 = unit(sub(hand, elbow));
    const elbowStand = standOff(1.9, 1.6, angleBetween(u1, u2));
    fig.ball(o, `shoulder.${side}`, W(shoulder), 2.1, { mat: m.fur });
    const upperA = add(shoulder, mul(u1, rimOn(2.1, 1.6)));
    const upperB = sub(elbow, mul(u1, elbowStand));
    const mid = mul(add(upperA, upperB), 0.5);
    const collarA = sub(mid, mul(u1, 0.4));
    const collarB = add(mid, mul(u1, 0.4));
    fig.dowel(o, `arm.upper.${side}.a`, W(upperA), W(collarA), 1.6, { mat: m.fur });
    fig.dowel(o, `armlet.${side}`, W(collarA), W(collarB), 2.0, { mat: m.gold });
    fig.dowel(o, `arm.upper.${side}.b`, W(collarB), W(upperB), 1.6, { mat: m.fur });
    fig.ball(o, `elbow.${side}`, W(elbow), 1.9, { mat: m.fur });
    fig.dowel(
      o,
      `arm.fore.${side}`,
      W(add(elbow, mul(u2, elbowStand))),
      W(sub(hand, mul(u2, rimOn(1.9, 1.6)))),
      1.6,
      {
        mat: m.fur,
      },
    );
    fig.ball(o, `hand.${side}`, W(hand), 1.9, { mat: m.fur });
    if (pose.spec.openHand === side) openHand(ctx, o, side, hand, u2);
  }
}

function openHand({ fig, W, m }, owner, side, hand, forearmDir) {
  const palm = unit(add(forearmDir, [0, 0, 0.6]));
  const across = unit([palm[1], -palm[0], 0]);
  [-1.2, -0.4, 0.4, 1.2].forEach((spread, index) => {
    const dir = unit(add(palm, mul(across, spread * 0.55)));
    const reach = index === 0 || index === 3 ? 2.15 : 2.35;
    fig.ball(owner, `finger.${side}${index}`, W(add(hand, mul(dir, reach))), 0.55, { mat: m.fur });
  });
}

// ---------------------------------------------------------------- mace

/** The gada: butt, grip collars either side of the hand, shaft, knurled head, finial (spec 1.3). */
function addMace(ctx) {
  const { fig, pose, W, m } = ctx;
  const mace = pose.mace;
  const o = 'mace';
  const hand = mace.hand;
  const grip = rimOn(1.9, 0.9);
  if (mace.mode === 'standing') {
    const [l, t] = mace.at;
    const butt = [l, t, 0.7];
    const axis = [0, 0, 1];
    const at = (s) => add(butt, mul(axis, s));
    fig.ball(o, 'mace.butt', W(butt), 0.7, { mat: m.wood, meta: { ground: true } });
    fig.dowel(o, 'mace.shaft', W(at(0.7)), W(at(22)), 0.6, { mat: m.wood });
    maceHead(ctx, at(22), axis);
    fig.ball(o, 'mace.finial', W(at(22 + MACE_L + 0.8)), 0.8, { mat: m.gold });
    return;
  }
  if (mace.mode === 'headDown') {
    const [l, t] = mace.at;
    const finial = [l, t, 0.8];
    const axis = unit(sub(hand, finial));
    fig.ball(o, 'mace.finial', W(finial), 0.8, { mat: m.gold, meta: { ground: true } });
    const neck = add(finial, mul(axis, 0.8 + MACE_L));
    maceHead(ctx, neck, mul(axis, -1));
    const at = (s) => add(hand, mul(axis, s));
    fig.dowel('armR', 'mace.shaft', W(neck), W(at(-grip - 0.6)), 0.6, { mat: m.wood });
    fig.dowel('armR', 'grip.collar.low', W(at(-grip - 0.6)), W(at(-grip)), 0.9, { mat: m.gold });
    return;
  }
  const axis = mace.axis;
  const at = (s) => add(hand, mul(axis, s));
  fig.dowel('armR', 'mace.butt', W(at(-mace.below)), W(at(-grip - 0.6)), 0.6, { mat: m.wood });
  fig.dowel('armR', 'grip.collar.low', W(at(-grip - 0.6)), W(at(-grip)), 0.9, { mat: m.gold });
  fig.dowel('armR', 'grip.collar.high', W(at(grip)), W(at(grip + 0.6)), 0.9, { mat: m.gold });
  fig.dowel('armR', 'mace.shaft', W(at(grip + 0.6)), W(at(mace.above)), 0.6, { mat: m.wood });
  maceHead(ctx, at(mace.above), axis);
  fig.ball(o, 'mace.finial', W(at(mace.above + MACE_L + 0.8)), 0.8, { mat: m.gold });
}

/** Head of the mace on a frame whose s = 0 is the neck, running along `dir` (local): lathe and knurl. */
function maceHead({ fig, W, m }, neck, dir) {
  const F = G.frameAlong(W(neck), frameVector(W, dir));
  const profile = knots(0, MACE_L, maceR, 24);
  profile[0] = [0, 1.2, 1];
  const ribs = [
    ...G.ribsOf(F, 2, 5, 2.95, 12, fig.P, { r1: 3.4, fade: [0.1, 0.55], seams: true }),
    ...G.ribsOf(F, 5, 7, 3.4, 12, fig.P, { r1: 3.05, fade: [0.1, 0.55], seams: true }),
  ];
  fig.turned('mace', 'mace.head', F, profile, {
    slope: maceSlope,
    radius: maceR,
    mat: m.gold,
    extra: k.fadedSvg(ribs, { tone: 'lo' }),
  });
}

// ---------------------------------------------------------------- tail

function tailRoute({ pose }) {
  const tail = pose.tail;
  if (tail.style === 'chain') return { points: tail.points, tuft: tail.tuft };
  const [rl, rt, ru] = tail.root;
  if (tail.style === 'droop') {
    return {
      points: [
        tail.root,
        [rl - 2.5, rt - 3.6, ru - 5],
        [rl - 6, rt - 4.7, ru - 13],
        [-8, -6.5, 6.5],
        [-8.4, -2, 3.4],
        [-8, 3.5, 2.2],
      ],
      tuft: 2.2,
      ground: true,
    };
  }
  // wrapped round both shins, 1.75 turns on an ellipse
  const { L, R } = tail.legs;
  const centreT = (L.kneeP[1] + L.ankleP[1] + R.kneeP[1] + R.ankleP[1]) / 4;
  const topU = (L.ankleP[2] + R.ankleP[2]) / 2 + 7.4;
  const turns = 1.75;
  const steps = Math.round(36 * turns);
  const ring = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const phi = Math.PI - t * turns * 2 * Math.PI;
    return [7.4 * Math.cos(phi), centreT + 5.2 * Math.sin(phi), topU - 5 * t];
  });
  return {
    points: [
      tail.root,
      [rl - 3.2, rt - 1.8, ru - 4.4],
      [-8.9, 0, topU + 6],
      [-7.9, centreT - 4.5, topU + 1.5],
      ...ring,
    ],
    tuft: 2.2,
  };
}

function addTail(ctx, loin) {
  const { fig, W, P, m } = ctx;
  const { points, tuft, ground } = tailRoute(ctx);
  const raw = points.map(W);
  const smooth = G.fillet(raw, 5, 8, { P, tube: TAIL_R });
  const first = unit(sub(smooth[1], smooth[0]));
  const last = smooth[smooth.length - 1];
  const end = unit(sub(last, smooth[smooth.length - 2]));
  const rootR = 1.7;
  const route = [add(smooth[0], mul(first, rimOn(rootR, TAIL_R))), ...smooth.slice(1, -1), last];
  fig.ball('body', 'tail.root', raw[0], rootR, { mat: m.fur, meta: { seated: true, cut: loin.loin } });
  fig.tube('tail.tube', 'tail', route, TAIL_R, {
    maxLength: 7,
    mat: m.fur,
    rings: { pitch: 2.4, fade: [0.1, 0.55] },
    touch: ['tail.root*', 'tail.tuft*'],
  });
  fig.ball('tail', 'tail.tuft', add(last, mul(end, rimOn(tuft, TAIL_R))), tuft, {
    mat: m.seat,
    meta: ground ? { ground: true } : {},
  });
}

// ---------------------------------------------------------------- face

const inkClass = (svg) => `<g class="m${MATERIALS.ink.slice(1)}">${svg}</g>`;

/** Eye outline on the head sphere: an ellipse of (w, h) face units around (fx, fy). */
function eyeLine(ctx, headC, basis, fx, fy, w, h, droop = 0) {
  const pts = [];
  for (let i = 0; i < 18; i += 1) {
    const t = (i / 18) * 2 * Math.PI;
    const px = fx + (Math.cos(t) * w) / 2;
    const py = fy + (Math.sin(t) * h) / 2 + droop * Math.max(0, Math.sign(fx - 50) * Math.cos(t) > 0 ? 1 : 0);
    pts.push(faceWorld(headC, basis, HEAD_R, px, py, 0.02, 1, ctx.W));
  }
  return k.lineSvg(
    k.pathOf(
      pts.map((p) => k.iso(p, ctx.P)),
      true,
    ),
    { tone: 'hi' },
  );
}

const EYES = {
  idle: { w: 16, h: 11, y: 46, dy: 0, dx: 0 },
  happy: { w: 16, h: 9, y: 46, dy: -1, dx: 0 },
  excited: { w: 16, h: 16, y: 44, dy: 0, dx: 0 },
  scared: { w: 18, h: 18, y: 45, dy: 0, dx: 2 },
  sad: { w: 16, h: 9, y: 46, dy: 1, dx: 0 },
};

const BROWS = {
  idle: [
    [26, 34, 36, 32.4, 46, 32],
    [54, 32, 64, 32.4, 74, 34],
  ],
  happy: [
    [26, 32, 36, 30.4, 46, 30],
    [54, 30, 64, 30.4, 74, 32],
  ],
  excited: [
    [26, 29, 36, 25.5, 46, 26],
    [54, 26, 64, 25.5, 74, 29],
  ],
  scared: [
    [26, 36, 36, 32.5, 46, 30],
    [54, 30, 64, 32.5, 74, 36],
  ],
  sad: [
    [26, 34, 36, 31.6, 46, 30],
    [54, 30, 64, 31.6, 74, 34],
  ],
};

/** T02 section 4, Hanuman: eyes, pupils, brows, sindoor, extras. Only the facings that see the face call this. */
function faceMarks(ctx, emotion, headC, basis) {
  const { fig, W, P } = ctx;
  const world = (fx, fy, lift = 0.05) => faceWorld(headC, basis, HEAD_R, fx, fy, lift, 1, W);
  const screen = (p) => k.iso(p, P);
  const visible = (fx, fy) => faceFacing(fig, headC, basis, HEAD_R, fx, fy, W) > 0.12;
  const parts = [];
  const eyes = EYES[emotion];
  const pupils = [];
  for (const cx of [36, 64]) {
    if (!visible(cx, eyes.y)) continue;
    parts.push(eyeLine(ctx, headC, basis, cx, eyes.y, eyes.w, eyes.h, emotion === 'sad' ? 2 : 0));
    const towards = cx < 50 ? eyes.dx : -eyes.dx;
    pupils.push(screen(world(cx + towards, eyes.y + eyes.dy)));
  }
  if (pupils.length) parts.push(k.dotsSvg(pupils, { size: 0.5, tone: 'hi' }));

  // brows are a hair finer than the other marks: dark and wide they read as a frown at game size
  for (const [x0, y0, x1, y1, x2, y2] of BROWS[emotion]) {
    if (!visible(x1, y1)) continue;
    const brow = k.lineSvg(k.pathOf([world(x0, y0), world(x1, y1), world(x2, y2)].map(screen)), {
      tone: 'hi',
      free: true,
    });
    parts.push(`<g style="--anatomy-weight:.45px">${brow}</g>`);
  }

  // sindoor mark: a closed lozenge on the forehead, filled with the seat colour
  if (visible(50, 28)) {
    const lozenge = [
      [50, 28],
      [51.5, 31],
      [50, 34.2],
      [48.5, 31],
    ];
    const seat = tones(MATERIALS.seat);
    parts.push(
      `<path class="iso-line" data-tone="hi" data-free="" style="fill:${seat.top};stroke:${seat.line}" d="${k.pathOf(
        lozenge.map(([x, y]) => screen(world(x, y - 6))),
        true,
      )}"/>`,
    );
  }

  if (emotion === 'excited') {
    for (const [fx, fy, sign] of [
      [2, 22, -1],
      [98, 18, 1],
    ]) {
      if (!visible(fx, fy)) continue;
      const centre = screen(world(fx, fy, 1.6));
      const rays = [
        [-1, -0.2],
        [-0.6, -0.9],
        [0.1, -1],
        [0.7, -0.8],
      ].map(([x, y]) => [x * sign * -1, y]);
      parts.push(k.dotsSvg([centre], { size: 0.5, tone: 'hi' }));
      for (const [x, y] of rays) {
        const dx = x * 1.2 * fig.ks;
        const dy = y * 1.2 * fig.ks;
        parts.push(
          k.lineSvg(
            k.pathOf([
              [centre[0] + dx * 1.3, centre[1] + dy * 1.3],
              [centre[0] + dx * 2.6, centre[1] + dy * 2.6],
            ]),
            { tone: 'mid', free: true },
          ),
        );
      }
    }
  }
  if (emotion === 'scared') {
    for (const [fx, fy] of [
      [72, 36],
      [78, 33],
      [84, 36],
    ]) {
      if (!visible(fx, fy)) continue;
      const from = screen(world(fx, fy, 0.9));
      const to = [from[0] + 1.1 * fig.ks, from[1] + 2.0 * fig.ks];
      parts.push(
        k.lineSvg(k.pathOf([from, to]), { tone: 'hi', free: 'start' }),
        k.dotsSvg([to], { size: 0.5, tone: 'hi' }),
      );
    }
  }
  if (emotion === 'sad' && visible(34, 56)) {
    parts.push(k.dotsSvg([screen(world(34, 56, 0.1))], { size: 0.6, tone: 'hi' }));
  }
  return inkClass(parts.join(''));
}

/** Mouth and nose on the muzzle sphere: lon/lat in degrees on the muzzle, the T02 mouth shapes (Hanuman: 6 units wider). */
function muzzleMarks(ctx, emotion, muzzleC, basis) {
  const { P, W } = ctx;
  const onMuzzle = (lon, lat, lift = 0.04) => {
    const lo = lon * DEG;
    const la = lat * DEG;
    const dir = add(
      add(mul(basis.F, Math.cos(la) * Math.cos(lo)), mul(basis.R, Math.cos(la) * Math.sin(lo))),
      mul(basis.Z, Math.sin(la)),
    );
    return W(add(muzzleC, mul(dir, MUZZLE_R + lift)));
  };
  const screen = (p) => k.iso(p, P);
  const curve = (halfWidth, cornerLat, bulge, n = 12) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * 2 - 1;
      return onMuzzle(halfWidth * t, cornerLat - bulge * (1 - t * t));
    });
  const parts = [k.dotsSvg([screen(onMuzzle(0, 38, 0.1))], { size: 0.6, tone: 'hi' })];
  const line = (points) => k.lineSvg(k.pathOf(points.map(screen)), { tone: 'hi', free: true });
  const filled = (points) =>
    `<path class="iso-line" data-tone="hi" data-free="" style="fill:${tones(MATERIALS.ink).top}" d="${k.pathOf(points.map(screen), true)}"/>`;
  switch (emotion) {
    case 'idle':
      parts.push(line(curve(38, -2, 9)));
      break;
    case 'happy':
      parts.push(line(curve(52, 1, 16)));
      break;
    case 'excited': {
      const top = curve(46, 2, 7);
      const bottom = Array.from({ length: 13 }, (_, i) => {
        const t = 1 - (i / 12) * 2;
        return onMuzzle(46 * t, 2 - 7 * (1 - t * t) - 22 * (1 - t * t) * 0.9);
      });
      parts.push(filled([...top, ...bottom]));
      break;
    }
    case 'scared': {
      const oval = Array.from({ length: 16 }, (_, i) => {
        const t = (i / 16) * 2 * Math.PI;
        return onMuzzle(15 * Math.cos(t), -10 + 11 * Math.sin(t));
      });
      parts.push(filled(oval));
      break;
    }
    default:
      parts.push(line(curve(30, -11, -8)));
  }
  return inkClass(parts.join(''));
}
