// Hanuman (T40 spec 4.2 and the Hanuman row of 4.6; faces from T02 section 4). A turned-wood toy: stacked lathe profiles
// on a vertical axis, ball joints and dowels for the arms, a ringed tube for the tail, a gada with a knurled head.
// Positions are local (right, forward, up) in world units, origin at the feet point.
//
// Deviations from the spec table, all forced by geometry the audit would reject (nothing may sink into anything):
//   - the tail leaves toward screen-left and behind (the spec's tail path runs through the mace head);
//   - the muzzle sits lower and is not sunk (the spec's muzzle would hide the eyes); the mouth is drawn on it;
//   - ears are tilted toward the viewer (axis 35 deg off `R`) so they read as discs, not as edge-on bars;
//   - the legs end at the hem disc (no overlap), the hem is a separate disc under the loincloth;
//   - spec 4.2 has no headgear row: a tiered gold-less crown (kiritamukuta) sits on the head, top 74;
//   - the scared mace is planted beside him (his hands are over his eyes), the sad one leans on its head as in 4.6.

import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { add, cross, DEG, faceWorld, headBasis, inBasis, local, mul, sub, unit } from './common.mjs';

export const EMOTIONS = ['idle', 'happy', 'excited', 'scared', 'sad'];

const HEAD_R = 7.2;
const HEAD_C = [0, 0, 55];
const SHOULDER = 5.5;
const SHOULDER_Z = 44;
const TAIL_R = 1.3;
/** The camera looks down at 50 deg, so a level face sits low on the sphere: features are painted this much higher. */
const MUZZLE_R = 2.7;
const FACE_PITCH = 24;

// ---------------------------------------------------------------- analytic profiles (smooth, with slopes)

const lerpArray = (n, from, to) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

/** [s, r, 1] knots of an analytic radius over [from, to]. */
const knots = (from, to, radius, n = 22) => lerpArray(n, from, to).map((s) => [s, radius(s), 1]);

/** Torso: a barrel, r 3.6 at the waist, 4.6 at z 38, 3.0 at the neck (spec 4.2 S10 knots as a smooth curve). */
const torsoR = (z) => (z < 38 ? 4.6 - ((z - 38) / 10.8) ** 2 : 4.6 - 1.6 * ((z - 38) / 8) ** 2);
const torsoSlope = (z) => (z < 38 ? (-2 * (z - 38)) / 10.8 ** 2 : (-3.2 * (z - 38)) / 64);

/** Loincloth: r 5.0 at the hem, 4.6 at z 24, 3.8 at the waist. */
const LOIN_K = 4.37;
const loinR = (z) => 5.0 - 1.2 * ((z - 17) / 9) ** LOIN_K;
const loinSlope = (z) => (-1.2 * LOIN_K * ((z - 17) / 9) ** (LOIN_K - 1)) / 9;

/** Mace head along its axis, length 8.9: neck r 1.2, belly r 3.4 at s 5, closed at the tip (spec 4.2 H40). */
const MACE_L = 8.9;
const MACE_BELLY = 5;
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

// ---------------------------------------------------------------- poses (spec 4.6, row Hanuman)

/**
 * hand / mace / tail per emotion. `drop` lowers everything above the legs; `legTop` is the top of the legs before the drop.
 * Mace: `d` axis (local, unit-ish), `a` shaft above the grip, `b` shaft below; `planted` = head down (finial on the ground).
 */
const POSES = {
  idle: {
    nod: 0,
    tilt: 0,
    drop: 0,
    flare: 1,
    rHand: [6.6, 2.4, 40],
    rHint: [0.5, -0.4, -0.8],
    rBend: 3.4,
    lHand: [-6.4, 1.6, 30],
    lHint: [-1, 0.4, 0],
    lBend: 1.8,
    mace: { d: [0.3, -0.34, 0.89], a: 16, b: 6 },
    tail: [
      [0, -6.1, 24],
      [-3, -8.4, 25.5],
      [-8.2, -8.2, 31],
      [-10.2, -6.8, 41],
      [-9.6, -7, 52],
      [-7, -6.8, 60.5],
      [-5.2, -6, 65.5],
    ],
    tuft: 2.2,
  },
  happy: {
    nod: 0,
    tilt: 6,
    drop: 0,
    flare: 1,
    rHand: [8, 2.4, 47],
    rHint: [0.6, -0.2, -0.8],
    rBend: 3.2,
    lHand: [-4.2, 5.4, 37.5],
    lHint: [-0.8, 0.2, -0.6],
    lBend: 2.8,
    mace: { d: [0.22, -0.55, 0.8], a: 16, b: 0 },
    tail: [
      [0, -6.1, 24],
      [-3, -8.4, 25.5],
      [-8.2, -8.2, 31],
      [-10.2, -6.8, 43],
      [-10, -7.4, 56],
      [-8.4, -7.2, 66],
      [-6.4, -6.4, 71.5],
    ],
    tuft: 2.2,
  },
  excited: {
    nod: 0,
    tilt: 0,
    drop: 0,
    flare: 1,
    rHand: [13, 1.5, 58],
    rHint: [1, 0, -0.6],
    rBend: 2.5,
    lHand: [-13, 1.5, 58],
    lHint: [-1, 0, -0.6],
    lBend: 2.5,
    lOpen: true,
    mace: { d: [0.02, 0, 1], a: 7.2, b: 0 },
    tail: [
      [0, -6.1, 24],
      [-3, -8.6, 27],
      [-8.4, -9.4, 36],
      [-10.4, -9.6, 50],
      [-9.4, -9.6, 62],
      [-6.8, -9.4, 70],
    ],
    tuft: 2.6,
  },
  scared: {
    nod: 0,
    tilt: 0,
    drop: -2,
    flare: 1.08,
    rHint: [1, 0.2, -0.4],
    rBend: 3.4,
    rAtEyes: true,
    lHint: [-1, 0.2, -0.4],
    lBend: 3.4,
    lAtEyes: true,
    mace: { d: [0, 0, 1], a: 16, b: 6, planted: true, at: [12, -3] },
    tail: 'wrap',
    tuft: 2.2,
  },
  sad: {
    nod: -8,
    tilt: 0,
    drop: 0,
    flare: 1,
    rHand: [6.4, 2, 28],
    rHint: [1, 0.3, -0.2],
    rBend: 1.8,
    lHand: [-6.4, 1.6, 30],
    lHint: [-1, 0.3, 0],
    lBend: 1.8,
    mace: { d: [0.1, 0, 1], a: 16, b: 6, planted: true, at: [9, 3] },
    tail: [
      [0, -6.1, 24],
      [-2.8, -8.2, 20.5],
      [-5.6, -8.2, 14],
      [-5.6, -7, 10],
      [-4.6, -5.8, 8.2],
    ],
    tuft: 2.2,
  },
};

// ---------------------------------------------------------------- helpers

const W = (p) => local(p);

function elbowOf(shoulder, hand, hint, bend) {
  const axis = unit(sub(hand, shoulder));
  const along = axis[0] * hint[0] + axis[1] * hint[1] + axis[2] * hint[2];
  const away = unit(sub(hint, mul(axis, along)));
  return add(mul(add(shoulder, hand), 0.5), mul(away, bend));
}

const rimOn = (R, a) => Math.sqrt(R * R - a * a);

/** The axis frame of a vertical lathe whose `s` is the nominal height (the figure may be lowered by `drop`). */
const upright = (drop = 0, r = 0, f = 0) => G.frameOf(W([r, f, drop]), [0, 0, 1], [1, 0, 0], [0, 1, 0]);

// ---------------------------------------------------------------- the builder

export function buildHanuman(fig, emotion) {
  const pose = POSES[emotion];
  if (!pose) throw new Error(`Unknown emotion ${emotion}`);
  const { P } = fig;
  const drop = pose.drop;
  const headC = add(HEAD_C, [0, 0, drop]);
  const basis = headBasis(pose.nod, pose.tilt);
  const faceBasis = headBasis(pose.nod + FACE_PITCH, pose.tilt);
  const headW = W(headC);
  const fw = pose.flare;

  // ---- legs (H25-26, H45-46, anklets S20)
  const legTop = 16 + drop;
  const kneeZ = emotion === 'scared' ? 9 : 12;
  for (const [side, x] of [
    ['L', -2.6],
    ['R', 2.6],
  ]) {
    const at = (z) => W([x, 0, z]);
    const o = `leg${side}`;
    fig.dowel(o, `leg.${side}.foot`, at(4), at(5), 1.8);
    fig.dowel(o, `anklet.${side}`, at(5), at(5.8), 2.1, { tone: 'hi' });
    fig.dowel(o, `leg.${side}.shin`, at(5.8), at(kneeZ - 0.4), 1.8);
    fig.dowel(o, `knee.${side}`, at(kneeZ - 0.4), at(kneeZ + 0.4), 2.0);
    fig.dowel(o, `leg.${side}.thigh`, at(kneeZ + 0.4), at(legTop), 1.8);
  }

  // ---- loincloth, hem, belt (H27, S8, S9, H44)
  const body = upright(drop);
  fig.dowel('body', 'hem', W([0, 0, 16 + drop]), W([0, 0, 17 + drop]), 5.2 * fw, { tone: 'hi' });
  const loinProfile = knots(17, 26, loinR);
  const flareProfile = loinProfile.map(([s, r, c]) => [s, r * fw, c]);
  fig.turned('body', 'loincloth', body, flareProfile, {
    slope: (s) => loinSlope(s) * fw,
    radius: (s) => loinR(s) * fw,
    inner: k.lineSvg(G.arcOf(body, 21, loinR(21) * fw, P, { slope: loinSlope(21) * fw }), { tone: 'faint' }),
  });
  fig.ring('body', 'waist.band', body, 26, 27.2, 3.6, 3.9);
  const knotAngle = 25 * DEG;
  const knotC = [4.6 * Math.sin(knotAngle), 4.6 * Math.cos(knotAngle), 26.6 + drop];
  fig.ball('body', 'belt.knot', W(knotC), 1.1);

  // ---- torso, sacred thread, ruff (S10, H36, H28)
  fig.turned('body', 'torso', body, knots(27.2, 46, torsoR), { slope: torsoSlope, radius: torsoR });
  addThread(fig, drop, knotC);
  fig.ring('body', 'ruff', body, 46, 48, 1.8, 2.8);

  // ---- head and face (S12-S15, H29-H33)
  const headShape = fig.ball('head', 'head', headW, HEAD_R, {
    extra: faceMarks(fig, emotion, headC, faceBasis),
  });
  const muzzleC = inBasis(headC, faceBasis, [0, 5.7, -4.3]);
  fig.ball('head', 'muzzle', W(muzzleC), MUZZLE_R, {
    meta: { seated: true, cut: headShape },
    extra: muzzleMarks(fig, emotion, muzzleC, faceBasis),
  });
  for (const [side, sign] of [
    ['L', -1],
    ['R', 1],
  ]) {
    const axisE = unit(add(mul(basis.R, sign * 0.82), mul(basis.F, 0.57)));
    const centre = inBasis(headC, basis, [sign * 8.7, 0.9, 1.0]);
    const back = sub(centre, mul(axisE, 0.6));
    fig.turned(
      `ear${side}`,
      `ear.${side}`,
      G.frameAlong(W(back), W(axisE)),
      [
        [0, 3.0],
        [1.2, 3.0],
      ],
      { bevel: 0.3 },
    );
    const front = add(centre, mul(axisE, 0.6));
    fig.turned(
      `ear${side}`,
      `ear.inner.${side}`,
      G.frameAlong(W(front), W(axisE)),
      [
        [0, 1.8],
        [0.4, 1.8],
      ],
      { tone: 'mid' },
    );
  }

  // ---- crown (kiritamukuta), on the head basis: band, three bulged tiers with rings between, a finial
  const crownAxis = W(basis.Z);
  const crownAt = (u) => W(inBasis(headC, basis, [0, 0, u]));
  const frameAt = (u) => G.frameAlong(crownAt(u), crownAxis);
  const bulged = (r0, r1, length, bulge) => ({
    radius: (t) => r0 + ((r1 - r0) * t) / length + bulge * Math.sin((Math.PI * t) / length),
    slope: (t) => (r1 - r0) / length + ((bulge * Math.PI) / length) * Math.cos((Math.PI * t) / length),
  });
  const addTier = (name, u, r0, r1, length, bulge, meta) => {
    const shape = bulged(r0, r1, length, bulge);
    fig.turned('head', name, frameAt(u), knots(0, length, shape.radius, 10), { ...shape, meta });
  };
  const seated = { seated: true, cut: headShape };
  fig.turned(
    'head',
    'crown.band',
    frameAt(6.0),
    [
      [0, 3.9],
      [0.9, 3.9],
    ],
    { bevel: 0.3, meta: seated },
  );
  addTier('crown.tier1', 6.9, 3.6, 3.0, 3.2, 0.35, seated);
  fig.turned('head', 'crown.ring1', frameAt(10.1), [
    [0, 3.2],
    [0.6, 3.2],
  ]);
  addTier('crown.tier2', 10.7, 2.8, 2.0, 2.6, 0.3);
  fig.turned('head', 'crown.ring2', frameAt(13.3), [
    [0, 2.3],
    [0.6, 2.3],
  ]);
  addTier('crown.tier3', 13.9, 1.8, 0, 2.7, 0.4);
  fig.ball('head', 'crown.finial', crownAt(16.6 + 0.55), 0.55);

  // ---- arms (S16-S19, H37-H38), ball joints and dowels; the right hand holds the mace
  const handAtEyes = (sign) => inBasis(headC, faceBasis, [sign * 2.9, 8.9, 1]);
  const rHand = pose.rAtEyes ? handAtEyes(1) : pose.rHand;
  const lHand = pose.lAtEyes ? handAtEyes(-1) : pose.lHand;
  addArm(fig, 'R', [SHOULDER, 0, SHOULDER_Z + drop], rHand, pose.rHint, pose.rBend, false);
  addArm(fig, 'L', [-SHOULDER, 0, SHOULDER_Z + drop], lHand, pose.lHint, pose.lBend, Boolean(pose.lOpen));

  // ---- mace (H39-H43) and tail (H34-H35)
  addMace(fig, pose.mace, pose.rAtEyes ? null : rHand);
  addTail(fig, pose, drop);
  return fig;
}

/** Sacred thread (H36): from the left shoulder ball over the chest, hugging the torso, to the belt knot. */
function addThread(fig, drop, knotC) {
  const shoulderC = [-SHOULDER, 0, SHOULDER_Z + drop];
  const onTorso = (u) => {
    const z = 42.6 - 13.4 * u;
    const angle = (-38 + 60 * u) * DEG;
    const rad = torsoR(z) + 0.38;
    return [rad * Math.sin(angle), rad * Math.cos(angle), z + drop];
  };
  const body = [0, 0.2, 0.4, 0.6, 0.8, 1].map(onTorso);
  const toFirst = unit(sub(body[0], shoulderC));
  const start = add(shoulderC, mul(toFirst, rimOn(2.0, 0.35)));
  const toKnot = unit(sub(knotC, body[body.length - 1]));
  const end = sub(knotC, mul(toKnot, rimOn(1.1, 0.35)));
  const route = G.fillet([start, ...body, end].map(W), 2, 6);
  fig.tube('thread', 'thread', route, 0.35, {
    maxLength: 40,
    touch: ['torso*', 'shoulder*', 'waist*', 'belt*'],
  });
}

function addArm(fig, side, S, H, hint, bend, open) {
  const o = `arm${side}`;
  const E = elbowOf(S, H, hint, bend);
  fig.ball(o, `shoulder.${side}`, W(S), 2.0);
  const u1 = unit(sub(E, S));
  const u2 = unit(sub(H, E));
  const upperA = add(S, mul(u1, rimOn(2.0, 1.5)));
  const upperB = sub(E, mul(u1, rimOn(1.9, 1.5)));
  const mid = mul(add(upperA, upperB), 0.5);
  const collarA = sub(mid, mul(u1, 0.4));
  const collarB = add(mid, mul(u1, 0.4));
  const upperLength = Math.hypot(...sub(upperB, upperA));
  if (upperLength >= 1.6) {
    fig.dowel(o, `arm.upper.${side}.a`, W(upperA), W(collarA), 1.5);
    fig.dowel(o, `armlet.${side}`, W(collarA), W(collarB), 1.9);
    fig.dowel(o, `arm.upper.${side}.b`, W(collarB), W(upperB), 1.5);
  } else {
    fig.dowel(o, `arm.upper.${side}`, W(upperA), W(upperB), 1.5);
  }
  fig.ball(o, `elbow.${side}`, W(E), 1.9);
  fig.dowel(
    o,
    `arm.fore.${side}`,
    W(add(E, mul(u2, rimOn(1.9, 1.5)))),
    W(sub(H, mul(u2, rimOn(1.9, 1.5)))),
    1.5,
  );
  fig.ball(o, `hand.${side}`, W(H), 1.9);
  if (open) openHand(fig, o, side, H, u2);
}

function openHand(fig, owner, side, hand, forearmDir) {
  const palm = unit(add(forearmDir, [0, 0, 0.6]));
  const across = unit(cross(palm, [0, 1, 0]));
  [-1.2, -0.4, 0.4, 1.2].forEach((spread, index) => {
    const dir = unit(add(palm, mul(across, spread * 0.55)));
    const reach = index === 0 || index === 3 ? 2.15 : 2.35;
    fig.ball(owner, `finger.${side}${index}`, W(add(hand, mul(dir, reach))), 0.55);
  });
}

/** The gada: butt, grip collars either side of the hand, shaft, knurled head, finial. Planted = head down on the ground. */
function addMace(fig, mace, hand) {
  const o = 'mace';
  const grip = rimOn(1.9, 0.9);
  if (mace.planted) {
    const [px, pf] = mace.at;
    const finial = [px, pf, 0.8];
    const axis = hand ? unit(sub(hand, finial)) : unit(mace.d);
    fig.ball(o, 'mace.finial', W(finial), 0.8, { meta: { ground: true } });
    const neck = add(finial, mul(axis, 0.8 + MACE_L));
    maceHead(fig, neck, mul(axis, -1));
    if (hand) {
      const at = (s) => add(hand, mul(axis, s));
      fig.dowel(o, 'mace.shaft', W(neck), W(at(-grip - 0.6)), 0.6);
      fig.dowel(o, 'grip.collar.low', W(at(-grip - 0.6)), W(at(-grip)), 0.9);
    } else {
      fig.dowel(o, 'mace.shaft', W(neck), W(add(neck, mul(axis, mace.a))), 0.6);
    }
    return;
  }
  const axis = unit(mace.d);
  const at = (s) => add(hand, mul(axis, s));
  if (mace.b > 0) {
    fig.dowel(o, 'mace.butt', W(at(-mace.b)), W(at(-grip - 0.6)), 0.6);
    fig.dowel(o, 'grip.collar.low', W(at(-grip - 0.6)), W(at(-grip)), 0.9);
  }
  fig.dowel(o, 'grip.collar.high', W(at(grip)), W(at(grip + 0.6)), 0.9);
  fig.dowel(o, 'mace.shaft', W(at(grip + 0.6)), W(at(mace.a)), 0.6);
  maceHead(fig, at(mace.a), axis);
  fig.ball(o, 'mace.finial', W(at(mace.a + MACE_L + 0.8)), 0.8);
}

/** Head of the mace on a frame whose s = 0 is the neck, running along `dir`: lathe and knurl. */
function maceHead(fig, neck, dir) {
  const F = G.frameAlong(W(neck), W(dir));
  const profile = knots(0, MACE_L, maceR, 24);
  profile[0] = [0, 1.2, 1];
  const ribs = [
    ...G.ribsOf(F, 2, 5, 2.95, 12, fig.P, { r1: 3.4, fade: [0.1, 0.55], seams: true }),
    ...G.ribsOf(F, 5, 7, 3.4, 12, fig.P, { r1: 3.05, fade: [0.1, 0.55], seams: true }),
  ];
  fig.turned('mace', 'mace.head', F, profile, {
    slope: maceSlope,
    radius: maceR,
    extra: k.fadedSvg(ribs, { tone: 'lo' }),
  });
}

function addTail(fig, pose, drop) {
  let points;
  if (pose.tail === 'wrap') {
    // 1.75 turns round both legs on an ellipse, from z 12 down toward the pedestal
    const turns = 1.75;
    const steps = Math.round(36 * turns);
    const ring = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const phi = -Math.PI * 0.6 - t * turns * 2 * Math.PI;
      return [7.4 * Math.cos(phi), 5.2 * Math.sin(phi), 11.2 - 5 * t];
    });
    points = [[0, -6.6, 22 + drop], [-1.5, -9.6, 18], [-4.5, -9.4, 14], ...ring];
  } else {
    points = pose.tail.map(([r, f, u], i) => [r, f, i === 0 ? u + drop : u]);
  }
  const rootR = 1.7;
  const tuftR = pose.tuft;
  const raw = points.map(W);
  const smooth = G.fillet(raw, 4, 8, { P: fig.P, tube: TAIL_R });
  const first = unit(sub(smooth[1], smooth[0]));
  const last = smooth[smooth.length - 1];
  const end = unit(sub(last, smooth[smooth.length - 2]));
  const route = [add(smooth[0], mul(first, rimOn(rootR, TAIL_R))), ...smooth.slice(1, -1), last];
  fig.ball('tail', 'tail.root', raw[0], rootR);
  fig.tube('tail.tube', 'tail', route, TAIL_R, {
    maxLength: 7,
    rings: { pitch: 2.4, fade: [0.1, 0.55] },
    touch: ['tail.root*', 'tail.tuft*'],
  });
  fig.ball('tail', 'tail.tuft', add(last, mul(end, rimOn(tuftR, TAIL_R))), tuftR);
}

// ---------------------------------------------------------------- face

/** Eye outline on the head sphere: an ellipse of (w, h) face units around (fx, fy). */
function eyeLine(fig, headC, basis, fx, fy, w, h, droop = 0) {
  const pts = [];
  for (let i = 0; i < 18; i += 1) {
    const t = (i / 18) * 2 * Math.PI;
    const px = fx + (Math.cos(t) * w) / 2;
    const py = fy + (Math.sin(t) * h) / 2 + droop * Math.max(0, Math.sign(fx - 50) * Math.cos(t) > 0 ? 1 : 0);
    pts.push(faceWorld(headC, basis, HEAD_R, px, py, 0.02));
  }
  return k.lineSvg(
    k.pathOf(
      pts.map((p) => k.iso(p, fig.P)),
      true,
    ),
    { tone: 'hi' },
  );
}

/** T02 section 4, Hanuman: eyes, pupils, brows, sindoor, extras. */
function faceMarks(fig, emotion, headC, basis) {
  const { P } = fig;
  const world = (fx, fy, lift = 0.05) => faceWorld(headC, basis, HEAD_R, fx, fy, lift);
  const screen = (p) => k.iso(p, P);
  const parts = [];
  const eyes = {
    idle: { w: 16, h: 11, y: 46, pupil: 4, dy: 0, dx: 0 },
    happy: { w: 16, h: 9, y: 46, pupil: 4, dy: -1, dx: 0 },
    excited: { w: 16, h: 16, y: 44, pupil: 5, dy: 0, dx: 0 },
    scared: { w: 18, h: 18, y: 45, pupil: 3, dy: 0, dx: 2 },
    sad: { w: 16, h: 9, y: 46, pupil: 4, dy: 1, dx: 0 },
  }[emotion];
  const pupils = [];
  for (const cx of [36, 64]) {
    parts.push(eyeLine(fig, headC, basis, cx, eyes.y, eyes.w, eyes.h, emotion === 'sad' ? 2 : 0));
    const towards = cx < 50 ? eyes.dx : -eyes.dx;
    pupils.push(screen(world(cx + towards, eyes.y + eyes.dy)));
  }
  parts.push(k.dotsSvg(pupils, { size: 0.5, tone: 'hi' }));

  const brow = {
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
  }[emotion];
  for (const [x0, y0, x1, y1, x2, y2] of brow) {
    parts.push(
      k.lineSvg(k.pathOf([world(x0, y0), world(x1, y1), world(x2, y2)].map(screen)), {
        tone: 'mid',
        free: true,
      }),
    );
  }

  // sindoor mark: a closed lozenge on the forehead, filled
  const lozenge = [
    [50, 28],
    [51.5, 31],
    [50, 34.2],
    [48.5, 31],
  ];
  parts.push(
    `<path class="iso-line" data-tone="hi" data-free="" style="fill:var(--anatomy-hi);fill-opacity:.8" d="${k.pathOf(
      lozenge.map(([x, y]) => screen(world(x, y - 6))),
      true,
    )}"/>`,
  );

  if (emotion === 'excited') {
    for (const [fx, fy, sign] of [
      [2, 22, -1],
      [98, 18, 1],
    ]) {
      const c = world(fx, fy, 1.6);
      const centre = screen(c);
      const rays = [
        [-1, -0.2],
        [-0.6, -0.9],
        [0.1, -1],
        [0.7, -0.8],
      ].map(([x, y]) => [x * sign * -1, y]);
      parts.push(k.dotsSvg([centre], { size: 0.5, tone: 'hi' }));
      for (const [x, y] of rays) {
        const dx = (x * 1.2 * fig.ks) / 1;
        const dy = (y * 1.2 * fig.ks) / 1;
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
    const start = [
      [72, 36],
      [78, 33],
      [84, 36],
    ];
    for (const [fx, fy] of start) {
      const from = screen(world(fx, fy, 0.9));
      const to = [from[0] + 1.1 * fig.ks, from[1] + 2.0 * fig.ks];
      parts.push(
        k.lineSvg(k.pathOf([from, to]), { tone: 'hi', free: 'start' }),
        k.dotsSvg([to], { size: 0.5, tone: 'hi' }),
      );
    }
  }
  if (emotion === 'sad') parts.push(k.dotsSvg([screen(world(34, 56, 0.1))], { size: 0.6, tone: 'hi' }));
  return parts.join('');
}

/** Mouth and nose on the muzzle sphere. Lon/lat in degrees on the muzzle, from the T02 mouth shapes (Hanuman: 6 units wider). */
function muzzleMarks(fig, emotion, muzzleC, basis) {
  const { P } = fig;
  const r = MUZZLE_R;
  const onMuzzle = (lon, lat, lift = 0.04) => {
    const lo = lon * DEG;
    const la = lat * DEG;
    const dir = add(
      add(mul(basis.F, Math.cos(la) * Math.cos(lo)), mul(basis.R, Math.cos(la) * Math.sin(lo))),
      mul(basis.Z, Math.sin(la)),
    );
    return local(add(muzzleC, mul(dir, r + lift)));
  };
  const screen = (p) => k.iso(p, P);
  const curve = (halfWidth, cornerLat, bulge, n = 12) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = (i / n) * 2 - 1;
      return onMuzzle(halfWidth * t, cornerLat - bulge * (1 - t * t));
    });
  const parts = [];
  parts.push(k.dotsSvg([screen(onMuzzle(0, 38, 0.1))], { size: 0.6, tone: 'hi' }));
  const line = (points) => k.lineSvg(k.pathOf(points.map(screen)), { tone: 'hi', free: true });
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
      parts.push(
        `<path class="iso-line" data-tone="hi" data-free="" style="fill:var(--anatomy-shade-0)" d="${k.pathOf([...top, ...bottom].map(screen), true)}"/>`,
      );
      break;
    }
    case 'scared': {
      const oval = Array.from({ length: 16 }, (_, i) => {
        const t = (i / 16) * 2 * Math.PI;
        return onMuzzle(15 * Math.cos(t), -10 + 11 * Math.sin(t));
      });
      parts.push(
        `<path class="iso-line" data-tone="hi" data-free="" style="fill:var(--anatomy-shade-0)" d="${k.pathOf(oval.map(screen), true)}"/>`,
      );
      break;
    }
    default:
      parts.push(line(curve(30, -11, -8)));
  }
  return parts.join('');
}
