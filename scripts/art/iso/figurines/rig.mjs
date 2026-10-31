// The skeleton of Hanuman (T43 spec 1.3) and its forward kinematics. Pure math, no drawing: a frame spec of clips.mjs
// (joint angles) goes in, joint positions in the character's local frame (l = to his right, t = forward, u = up; origin =
// the root's ground point) come out. The root is solved, not set: the planted foot's sole touches u = 0 and, for a
// walk or run contact, the planted leg's hip pitch is solved so the ankle lands exactly on the table's planted offset
// along `t`. hanuman.mjs draws the result, frameFor(facing) maps it into the board's world.

const DEG = Math.PI / 180;

export const SKEL = {
  rootU: 25,
  hipU: 24.5,
  hipL: 3.0,
  thigh: 11,
  shin: 9.9,
  footR: 1.8,
  footBack: 1.4,
  footToeC: 1.6,
  shoulderL: 5.8,
  shoulderU: 49,
  upperArm: 9,
  forearm: 8.5,
  headU: 61.5,
  tailRoot: [-5.2, -3.0, 26],
  tailLengths: [5.07, 7.57, 10.3, 11.0, 8.9],
  /** Cumulative share of the tail's total curl at each of its five segments (the spec rest chain at curl 160). */
  tailTurn: [0, 29.5 / 90, 59.5 / 90, 70 / 90, 1],
  tailTurnTotal: 90 / 160,
  tailHeading: 78,
  /** Anatomical range of the foot against the shin (+ = toes up), degrees away from a foot square to the shin. */
  ankleRange: [-55, 25],
  /** Arms leave the body this many degrees outward (clears the torso and the mace). */
  abduction: { L: 7, R: 10 },
};

/** Local frame to world for one of the four facings (spec section 2): `t` is the world direction walked. */
export const FACING_AXES = { SE: [1, 0], SW: [0, 1], NW: [-1, 0], NE: [0, -1] };

export function frameFor(facing) {
  const axis = FACING_AXES[facing];
  if (!axis) throw new Error(`unknown facing ${facing}`);
  const [tx, ty] = axis;
  const right = [ty, -tx];
  const loc = ([l, t, u]) => [l * right[0] + t * tx, l * right[1] + t * ty, u];
  const dir = ([l, t, u]) => loc([l, t, u]);
  return { facing, t: [tx, ty, 0], right: [right[0], right[1], 0], loc, dir };
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => mul(a, 1 / len(a));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Ankle's t offset from the hip for a leg of hip pitch h and knee flexion k (degrees). */
const ankleReach = (h, k) => SKEL.thigh * Math.sin(h * DEG) + SKEL.shin * Math.sin((h - k) * DEG);

/** Hip pitch that puts the ankle `offset` ahead of the hip, knee flexion given. Bisection: ankleReach rises with h. */
export function hipForOffset(offset, knee) {
  let lo = -70;
  let hi = 80;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (ankleReach(mid, knee) < offset) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** One leg relative to its hip (hip = origin, u up): knee, ankle, foot dowel ends, lowest sole point. */
function legOf(angles) {
  const { hip, knee, ankle } = angles;
  const th = hip * DEG;
  const shinPitch = hip - knee;
  const kneeP = [0, SKEL.thigh * Math.sin(th), -SKEL.thigh * Math.cos(th)];
  const ankleP = add(kneeP, [
    0,
    SKEL.shin * Math.sin(shinPitch * DEG),
    -SKEL.shin * Math.cos(shinPitch * DEG),
  ]);
  const [lo, hi] = SKEL.ankleRange;
  const phiDeg = shinPitch + clamp(ankle - shinPitch, lo, hi);
  const phi = phiDeg * DEG;
  const f = [0, Math.cos(phi), Math.sin(phi)];
  const n = [0, -Math.sin(phi), Math.cos(phi)];
  const axisP = sub(ankleP, mul(n, SKEL.footR));
  const heel = add(axisP, mul(f, -SKEL.footBack));
  const toeC = add(axisP, mul(f, SKEL.footToeC));
  const lowest = Math.min(heel[2] - SKEL.footR * Math.abs(Math.cos(phi)), toeC[2] - SKEL.footR);
  return { hip, knee, ankleAngle: ankle, footPitch: phiDeg, kneeP, ankleP, axisP, heel, toeC, f, n, lowest };
}

/** Ballistic helper: rotate rest upper-body points about the hip pivot by the lean. */
function leaner(pivot, lean) {
  const c = Math.cos(lean * DEG);
  const s = Math.sin(lean * DEG);
  const rest = [0, 0, SKEL.hipU];
  const rotate = (p) => {
    const q = sub(p, rest);
    return [q[0], q[1] * c + q[2] * s, -q[1] * s + q[2] * c];
  };
  return {
    point: (p) => add(pivot, rotate(p)),
    vector: (p) => rotate(add(p, rest)),
    axis: [0, s, c],
  };
}

/** Direction of an arm segment: sagittal pitch (0 = down, 180 = up) with the outward splay of the side. */
function armDir(side, pitch, splay) {
  const sign = side === 'L' ? -1 : 1;
  const a = splay * DEG;
  const p = pitch * DEG;
  return unit([sign * Math.sin(a), Math.sin(p) * Math.cos(a), -Math.cos(p) * Math.cos(a)]);
}

/** Two-bone elbow for a hand target, bending toward `hint`. */
function elbowToward(shoulder, target, hint) {
  const reach = clamp(len(sub(target, shoulder)), 1, SKEL.upperArm + SKEL.forearm - 0.05);
  const axis = unit(sub(target, shoulder));
  const along = (SKEL.upperArm ** 2 - SKEL.forearm ** 2 + reach ** 2) / (2 * reach);
  const high = Math.sqrt(Math.max(0, SKEL.upperArm ** 2 - along ** 2));
  const away = unit(sub(hint, mul(axis, dot(hint, axis))));
  return add(add(shoulder, mul(axis, along)), mul(away, high));
}

/** Head basis (local): nod about `l` (negative = chin down), side tilt about `t`. */
export function headBasis(nodDeg = 0, tiltDeg = 0) {
  const n = nodDeg * DEG;
  const t = tiltDeg * DEG;
  const F1 = [0, Math.cos(n), Math.sin(n)];
  const Z1 = [0, -Math.sin(n), Math.cos(n)];
  const R2 = add(mul([1, 0, 0], Math.cos(t)), mul(Z1, -Math.sin(t)));
  const Z2 = add(mul(Z1, Math.cos(t)), mul([1, 0, 0], Math.sin(t)));
  return { R: R2, F: F1, Z: Z2 };
}

/** The face is painted this much further up the sphere than level: the camera looks down at 50 degrees. */
export const FACE_PITCH = 24;

/** Tail chain of the five spec segments in a vertical plane that heads back and to his left. */
function tailChain(root, { pitch, curl, yaw = 0 }, { psi = SKEL.tailHeading, lift = 0 } = {}) {
  const heading = (psi + yaw) * DEG;
  const dir = [-Math.sin(heading), -Math.cos(heading)];
  const points = [root];
  SKEL.tailLengths.forEach((length, index) => {
    const turn = (curl / 160) * SKEL.tailTurnTotal * 160 * SKEL.tailTurn[index];
    const phi = (pitch + turn) * DEG;
    const grown = index === SKEL.tailLengths.length - 1 ? length + lift : length;
    const last = points[points.length - 1];
    points.push(
      add(last, [dir[0] * grown * Math.cos(phi), dir[1] * grown * Math.cos(phi), grown * Math.sin(phi)]),
    );
  });
  return points;
}

/** The mace of a pose: where its axis runs and which parts it has. */
function maceOf(mace, hand) {
  if (mace.mode === 'held') {
    const pitch = mace.pitch * DEG;
    const roll = (mace.roll ?? 9) * DEG;
    const axis = unit([Math.sin(roll), -Math.sin(pitch), Math.cos(pitch)]);
    return { ...mace, axis, above: mace.above ?? 20, below: mace.below ?? 4, hand };
  }
  return { ...mace, hand };
}

/**
 * Solve one frame spec. Returns every joint in local coordinates plus the solved numbers the build reports and the meta
 * keeps: `bob`, `planted` ({ foot, offset, soleU }), the hip pitch adjustments.
 */
export function solvePose(spec) {
  const legAngles = { L: { ...spec.L }, R: { ...spec.R } };
  const adjust = {};
  const planted = spec.planted;
  if (planted && planted.foot !== 'both') {
    const foot = planted.foot;
    const solved = hipForOffset(planted.offset, legAngles[foot].knee);
    adjust[foot] = solved - legAngles[foot].hip;
    legAngles[foot].hip = solved;
  }
  const legs = { L: legOf(legAngles.L), R: legOf(legAngles.R) };

  // Root: planted soles at u = 0; airborne frames take the table's bob.
  let hipU;
  if (planted) {
    const feet = planted.foot === 'both' ? ['L', 'R'] : [planted.foot];
    hipU = -Math.min(...feet.map((foot) => legs[foot].lowest));
  } else hipU = SKEL.rootU + spec.bob - (SKEL.rootU - SKEL.hipU);
  const bob = hipU + (SKEL.rootU - SKEL.hipU) - SKEL.rootU;
  const pivot = [0, 0, hipU];

  const place = (side) => {
    const sign = side === 'L' ? -1 : 1;
    const hip = [sign * SKEL.hipL, 0, hipU];
    const leg = legs[side];
    const at = (p) => add(hip, p);
    return {
      ...leg,
      hipP: hip,
      kneeP: at(leg.kneeP),
      ankleP: at(leg.ankleP),
      axisP: at(leg.axisP),
      heel: at(leg.heel),
      toeC: at(leg.toeC),
      lowest: leg.lowest + hipU,
    };
  };
  const legsAt = { L: place('L'), R: place('R') };

  const lean = leaner(pivot, spec.lean);
  const headNod = (spec.head?.nod ?? 0) - 0.5 * spec.lean;
  const headBasisLocal = headBasis(headNod, spec.head?.tilt ?? 0);
  const faceBasis = headBasis(headNod + FACE_PITCH, spec.head?.tilt ?? 0);
  const headC = lean.point([0, 0, SKEL.headU]);

  // Arms.
  const arms = {};
  for (const side of ['L', 'R']) {
    const sign = side === 'L' ? -1 : 1;
    const row = side === 'L' ? spec.armL : spec.armR;
    const shoulder = lean.point([sign * SKEL.shoulderL, 0, SKEL.shoulderU]);
    let elbow;
    let hand;
    if (spec.handsAtEyes) {
      const b = faceBasis;
      hand = add(headC, add(add(mul(b.R, sign * 4.2), mul(b.F, 11.4)), mul(b.Z, 0.8)));
      elbow = elbowToward(shoulder, hand, [sign * 0.5, 0.8, -0.8]);
    } else {
      // raised arms open into a V so they clear the head and the ears
      const splay = SKEL.abduction[side] + Math.max(0, row.shoulder - 90) * 0.5;
      const pitch = row.shoulder + spec.lean;
      elbow = add(shoulder, mul(armDir(side, pitch, splay), SKEL.upperArm));
      hand = add(
        elbow,
        mul(armDir(side, pitch + row.elbow, row.shoulder > 90 ? splay : splay * 0.5), SKEL.forearm),
      );
    }
    arms[side] = { shoulder, elbow, hand };
  }

  const tailRoot = lean.point(SKEL.tailRoot);
  let tail;
  if (spec.tail.wrap) tail = { style: 'wrap', root: tailRoot, legs: legsAt };
  else if (spec.tail.droop) tail = { style: 'droop', root: tailRoot };
  else
    tail = {
      style: 'chain',
      root: tailRoot,
      points: tailChain(tailRoot, spec.tail, { psi: spec.tail.psi, lift: spec.tailLift ?? 0 }),
      tuft: spec.tuft ?? 2.2,
    };

  const mace = maceOf(spec.mace, arms.R.hand);
  return {
    spec,
    bob,
    hipU,
    rootU: SKEL.rootU + bob,
    lean,
    legs: legsAt,
    arms,
    head: { c: headC, basis: headBasisLocal, faceBasis },
    tail,
    mace,
    adjust,
    planted: planted && {
      foot: planted.foot,
      offset:
        planted.foot === 'both'
          ? mean(legsAt.L.ankleP[1], legsAt.R.ankleP[1])
          : legsAt[planted.foot].ankleP[1],
      soleU: Math.min(
        ...(planted.foot === 'both' ? ['L', 'R'] : [planted.foot]).map((foot) => legsAt[foot].lowest),
      ),
    },
  };
}

const mean = (a, b) => (a + b) / 2;
