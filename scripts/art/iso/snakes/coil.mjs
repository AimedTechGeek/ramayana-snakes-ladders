// Route of a standing coil (T42 spec 5.1 C2-C5, N1), in the figurine local frame (right, forward, up) with the origin on
// the ground at the coil centre. One tube from the tail tip to the head base:
//   ring 1  the ground spiral, z = R, radius r_h -> r_h - pitch (pitch = 2R + 0.25, so the spiral never sinks into itself
//           and its inner turn covers the centre: no hollow, no post)
//   ring 2  z = 3R, resting on ring 1;   ring 3  z = 5R, resting on ring 2 (the top, ending at the back-left)
//   two short climbing crossovers join the rings; each rises first and moves outward after, so it clears the turn below
//   neck    a Catmull-Rom S from the end of ring 3: up, back, then forward to the head base
// 3.5 turns in all: the spec's ground spiral plus 2.5 stacked turns.

import { local } from '../figurines/common.mjs';

const DEG = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Start angle of the tail tip (front-right, local angle from +right toward +forward) and the collar angle (back-left). */
export const TAIL_ANGLE = 45;
export const COLLAR_ANGLE = 225;

/** Centre-line points (local) of the three rings and crossovers, tail tip first, ending at the back-left. */
export function ringPoints(R, rh) {
  const pitch = 2 * R + 0.25;
  const rIn = Math.max(2.45 * R, rh - pitch);
  const r2 = rIn + 0.1;
  const r2End = r2 - 0.15;
  const r3 = r2 - 0.3;
  const z1 = R;
  const z2 = 3 * R;
  const z3 = 5 * R;
  const pts = [];
  // the coil winds clockwise seen from above (angle mirrored): both climbs happen while the body heads away from the viewer
  const at = (theta, r, z) => pts.push([r * Math.cos((theta - 90) * DEG), -r * Math.sin((theta - 90) * DEG), z]);
  const step = 3;
  // ring 1: the ground spiral, inward over 300 degrees (the inner turn covers the centre, the bend stays wider than the tube)
  for (let th = 45; th < 345; th += step) at(th, rh - ((rh - rIn) * (th - 45)) / 300, z1);
  // crossover 1: 120 degrees, rises first, then moves out to ring 2
  for (let th = 345; th < 465; th += step) {
    const t = (th - 345) / 120;
    at(th, rIn + (r2 - rIn) * t, z1 + (z2 - z1) * smooth(0, 1, t));
  }
  for (let th = 465; th < 765; th += step) at(th, r2 - (0.15 * (th - 465)) / 300, z2);
  for (let th = 765; th < 855; th += step) {
    const t = (th - 765) / 90;
    at(th, r2End + (r3 - r2End) * t, z2 + (z3 - z2) * smooth(0, 1, t));
  }
  for (let th = 855; th <= 945; th += step) at(th, r3 - (0.2 * (th - 855)) / 90, z3);
  // the tail tip lies on the ground: its centre height follows its radius (0.45 R at the tip to R after 10 units)
  let walked = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) walked += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (walked < 10 && pts[i][2] === z1) pts[i][2] = R * (0.45 + 0.55 * smooth(0, 10, walked));
  }
  return pts;
}

/** Smallest gap between turns of the route (centre distance minus both radii) over points more than 4 R apart along it. */
export function minTurnGap(world, radiusAt, step) {
  let worst = Infinity;
  const skip = Math.ceil((4 * radiusAt(0.5)) / step);
  for (let i = 0; i < world.length; i++) {
    for (let j = i + skip; j < world.length; j++) {
      const d = Math.hypot(world[i][0] - world[j][0], world[i][1] - world[j][1], world[i][2] - world[j][2]);
      worst = Math.min(worst, d - radiusAt(i / world.length) - radiusAt(j / world.length));
    }
  }
  return worst;
}

/** Centripetal Catmull-Rom through `ctrl` (first and last are the tangent guides), `per` samples per span. */
export function catmull(ctrl, per = 14) {
  const out = [];
  const knot = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) ** 0.5;
  for (let i = 1; i < ctrl.length - 2; i++) {
    const [p0, p1, p2, p3] = [ctrl[i - 1], ctrl[i], ctrl[i + 1], ctrl[i + 2]];
    const t0 = 0;
    const t1 = t0 + knot(p0, p1);
    const t2 = t1 + knot(p1, p2);
    const t3 = t2 + knot(p2, p3);
    for (let s = 0; s < per; s++) {
      const t = t1 + ((t2 - t1) * s) / per;
      const mix = (a, b, ta, tb) => a.map((v, k) => ((tb - t) / (tb - ta)) * v + ((t - ta) / (tb - ta)) * b[k]);
      const a1 = mix(p0, p1, t0, t1);
      const a2 = mix(p1, p2, t1, t2);
      const a3 = mix(p2, p3, t2, t3);
      const b1 = mix(a1, a2, t0, t2);
      const b2 = mix(a2, a3, t1, t3);
      out.push(mix(b1, b2, t1, t2));
    }
  }
  out.push([...ctrl[ctrl.length - 2]]);
  return out;
}

/**
 * The whole route in local coordinates plus the index where the neck begins.
 * `rise` is the head base height above the top ring (spec 14, Ravana 16); `swing` shifts the head base sideways.
 */
export function bodyRoute(R, rh, { rise = 14, aim = [0, 5] } = {}) {
  const ring = ringPoints(R, rh);
  const ringEnd = ring[ring.length - 1];
  const guide = ring[ring.length - 4];
  const rel = (dx, dy, dz) => [ringEnd[0] + dx, ringEnd[1] + dy, ringEnd[2] + dz];
  const tl = Math.hypot(ringEnd[0] - guide[0], ringEnd[1] - guide[1]) || 1;
  const tx = (ringEnd[0] - guide[0]) / tl;
  const ty = (ringEnd[1] - guide[1]) / tl;
  const base = rel(6.5, 3, rise);
  const yaw = Math.hypot(aim[0] - base[0], aim[1] - base[1]) || 1;
  const ahead = [base[0] + (4 * (aim[0] - base[0])) / yaw, base[1] + (4 * (aim[1] - base[1])) / yaw, base[2] - 0.5];
  const ctrl = [guide, ringEnd, rel(tx * 3.2, ty * 3.2 - 1, rise * 0.45), rel(-1.5, -5, rise * 0.92), base, ahead];
  const neck = catmull(ctrl, 16);
  return { ring, neck, ringEnd, end: neck[neck.length - 1], route: [...ring.slice(0, -1), ...neck] };
}

/** World points of a local route. */
export const toWorld = (pts) => pts.map((p) => local(p));
