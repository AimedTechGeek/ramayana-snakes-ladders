// The head of a standing snake (T42 spec 5.1 N1-N3): a lathe of the T40 profile swept along the strike direction, cocked
// 32 degrees about its axis so that the camera sees the near flank, the mouth line and one eye in profile and the other
// at the limb (a head seen exactly from above shows no mouth, and an open jaw would drop out of sight behind it).
// Closed: the whole lathe with the mouth seam. Open: the lathe cut at the mouth plane from the hinge (s 4) to the snout;
// the lower part, the full lathe turned down 25 degrees about the hinge, is clipped to its side of the plane and the
// wedge between the two lips is the dark mouth interior. No fangs, no teeth.

import * as G from '../../anatomy/lathe.mjs';
import { iso, pathOf } from '../../anatomy/iso-kit.mjs';
import { mixHex } from '../common.mjs';
import { INK } from '../tones.mjs';
import { local, DEG } from '../figurines/common.mjs';
import { makeSweep, paintOf, surfaceColour } from './sweep.mjs';

export const HEAD_LEN = 14;
export const JAW_AT = 4;
/** Kabandha's cap is a short stout disc on the neck end. */
export const CAP_LEN = 3.2;
export const JAW_OPEN = 28;
export const HEAD_PITCH = 30;
/** Angle between the dorsal line and the viewing direction: the camera sees the near flank (mouth, eye) in profile. */
export const HEAD_PROFILE = 62;
/** The idle head turns this far (degrees, + = toward screen-right) from the line to the token; the strike turns it back. */
export const HEAD_YAW = -70;
/** The seam lies this far from the dorsal line, toward the belly. */
export const SEAM_ANGLE = 88 * DEG;
const BACK_INSET = 2.5;

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/** Radius of the head at u (0..1 of its length): a round skull (r 1.4 R at s 7), a rounded snout, a closed back. */
export function headRadius(R, { snout = 1.5, width = 1.3, kind = 'round' } = {}) {
  const rmax = width * R;
  const ease = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  if (kind === 'cap') return (u) => R * (0.85 + 0.55 * ease(0, 1.4, u * CAP_LEN));
  if (kind === 'arrow') {
    // the arrowhead profile of spec 5.5 [[0,1],[2,1.6],[9,0]] stretched to the head length: widest at 3.1, straight to the tip
    return (u) => {
      const s = u * HEAD_LEN;
      if (s <= 3.1) return R * (0.9 + 0.7 * Math.sin(((Math.PI / 2) * s) / 3.1));
      return 1.6 * R * Math.max(0, 1 - (s - 3.1) / (HEAD_LEN - 3.1)) ** 0.92;
    };
  }
  return (u) => {
    const s = u * HEAD_LEN;
    if (s <= 7) {
      const x = 1 - s / 7;
      return rmax * Math.sqrt(Math.max(0, 1 - x * x));
    }
    const x = (s - 7) / 7;
    return rmax * Math.sqrt(Math.max(0, 1 - x ** snout));
  };
}

const unit = G.unit3;
const cross = G.cross3;
const dot = G.dot3;
const add = G.add3;
const mul = G.mul3;
const sub = G.sub3;

/** Rotate point p about the axis through `origin` along unit `axis` by `angle` (Rodrigues). */
function rotate(p, origin, axis, angle) {
  const v = sub(p, origin);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const rotated = add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c)));
  return add(origin, rotated);
}

/**
 * Where the head goes: from the neck end `neckEnd` (local) toward `target` (local r, f). Returns world geometry
 * and the sweep of the closed head.
 */
export function headSetup(spec, neckEnd, target, P) {
  const yaw = Math.atan2(target[1] - neckEnd[1], target[0] - neckEnd[0]) + (Number(process.env.HYAW ?? spec.yaw ?? HEAD_YAW)) * DEG;
  const pitch = Number(process.env.HPITCH ?? spec.headPitch ?? HEAD_PITCH) * DEG;
  const heading = spec.aim === 'camera' ? Math.PI / 2 : yaw;
  const dLocal = [Math.cos(heading) * Math.cos(pitch), Math.sin(heading) * Math.cos(pitch), -Math.sin(pitch)];
  const D = local(dLocal);
  const cap = spec.head?.kind === 'cap';
  const len = cap ? CAP_LEN : HEAD_LEN;
  const start = sub(local(neckEnd), mul(D, cap ? 0 : BACK_INSET));
  const end = add(start, mul(D, len));
  const V = G.viewOf(P);
  // dorsal: turned HEAD_PROFILE degrees from the view direction (as seen across the head), on the upper side
  const seen = unit(sub(V, mul(D, dot(V, D))));
  const turn = unit(cross(D, seen));
  const phi = (spec.profile ?? HEAD_PROFILE) * DEG;
  const candidates = [1, -1].map((sign) => unit(add(mul(seen, Math.cos(phi)), mul(turn, sign * Math.sin(phi)))));
  const dorsal = candidates[0][2] >= candidates[1][2] ? candidates[0] : candidates[1];
  const side = unit(cross(D, dorsal));
  const radius = headRadius(spec.R, spec.head ?? {});
  const down = () => mul(dorsal, -1);
  const sweep = makeSweep([start, add(start, mul(D, len / 2)), end], radius, P, { down, fallback: [0, 1, 0] });
  let top = -Infinity;
  for (let s = 0; s <= len; s += 0.4) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) top = Math.max(top, sweep.surf(s, a).p[2]);
  }
  return { start, end, D, dorsal, side, sweep, radius, down, top, hinge: JAW_AT };
}

// ---------------------------------------------------------------- features on the lathe

const screen = (sweep, s, a, lift = 0.03) => iso(sweep.surf(s, a, lift).p, sweep.P);
const facing = (sweep, s, a) => dot(sweep.surf(s, a).n, sweep.V);

/** Visible runs of a curve a(s) or s(a) sampled as (s, a) pairs, as a path (hidden parts leave gaps). */
function visiblePath(sweep, pairs, least = 0.04) {
  let d = '';
  let pen = false;
  for (const [s, a] of pairs) {
    if (facing(sweep, s, a) < least) {
      pen = false;
      continue;
    }
    const [x, y] = screen(sweep, s, a);
    d += `${pen ? 'L' : 'M'}${(Math.round(x * 10) / 10).toFixed(1)} ${(Math.round(y * 10) / 10).toFixed(1)}`;
    pen = true;
  }
  return d;
}

const line = (d, tone = 'hi', extra = '') => (d ? `<path class="iso-line ${extra}" data-tone="${tone}" d="${d}"/>` : '');
const fill = (points, colour) => `<path d="${pathOf(points, true)}" fill="${colour}"/>`;

/** A small shape on the surface around (s, a): `rs` along the head, `ra` across (angle), as a polygon. */
function patch(sweep, s, a, rs, ra, steps = 12, lift = 0.05) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push(screen(sweep, s + rs * Math.cos(t), a + ra * Math.sin(t), lift));
  }
  return pts;
}

/** +1 or -1: the side of the head (sign of the section angle a) that faces the camera. */
export function nearSide(sweep) {
  const f = sweep.frameAt(Math.min(HEAD_LEN / 2, sweep.total / 2));
  return dot(f.e, sweep.V) >= 0 ? 1 : -1;
}

/** The mouth line: angle across the head at s (a little lower at the corner of the mouth). */
export const mouthAngle = (s) => SEAM_ANGLE + 0.12 * Math.max(0, 1 - (s - 2.4) / 6);

/**
 * The head features of the camera-facing flank: mouth line with lip ticks, nostril, brow ridge and eye (slit pupil,
 * glint). `spec.eye` = { colour, size, shut }. One SVG string drawn over the lathe; the far eye is at the limb and
 * skipped when it is not visible.
 */
export function featuresSvg(sweep, spec) {
  const { R } = spec;
  const lines = spec.paint.tones.line;
  const eye = spec.eye ?? {};
  const sgn = nearSide(sweep);
  let svg = '';
  // nostril
  if (facing(sweep, 12.3, sgn * 0.62) > 0.15) {
    const [x, y] = screen(sweep, 12.3, sgn * 0.62);
    svg += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(0.3 * R).toFixed(1)}" ry="${(0.2 * R).toFixed(1)}" fill="${lines}"/>`;
  }
  // eye and brow
  const size = eye.size ?? 0.34 * R;
  for (const sign of [sgn, -sgn]) {
    const a = sign * (eye.angle ?? 0.92);
    const s = eye.at ?? 8.2;
    if (facing(sweep, s, a) < 0.18) continue;
    const ra = size / sweep.radiusAt(s / HEAD_LEN);
    const up = -sign; // toward the dorsal line
    const brow = [
      [s - 1.7 * size, a + up * 1.15 * ra], [s - 0.1 * size, a + up * 1.55 * ra], [s + 1.9 * size, a + up * 0.95 * ra],
      [s + 1.7 * size, a + up * 0.55 * ra], [s - 0.1 * size, a + up * 1.05 * ra], [s - 1.6 * size, a + up * 0.8 * ra],
    ];
    svg += fill(brow.map(([bs, ba]) => screen(sweep, bs, ba, 0.06)), lines);
    if (eye.shut) {
      const pairs = [];
      for (let i = 0; i <= 8; i++) {
        const t = -1 + i / 4;
        pairs.push([s + size * 1.2 * t, a + up * ra * 0.45 * (1 - t * t) * -1]);
      }
      svg += line(visiblePath(sweep, pairs, 0.05), 'hi', 'eye-shut');
      continue;
    }
    const iris = eye.colour ?? '#E8B23A';
    svg += fill(patch(sweep, s, a, size * 1.1, ra * 1.0), mixHex(iris, INK, 0.5));
    svg += fill(patch(sweep, s, a, size * 0.92, ra * 0.82), iris);
    svg += fill(patch(sweep, s, a, size * 0.2, ra * 0.82), INK);
    svg += fill(patch(sweep, s - size * 0.45, a + up * ra * 0.35, size * 0.15, ra * 0.15, 8, 0.08), '#FFF8E0');
  }
  return svg;
}

/** The mouth line on the camera-facing flank, from the corner of the mouth to the snout. */
export function seamSvg(sweep, { from = 2.4, to = 13.8, tone = 'hi', shift = 0 } = {}) {
  const sgn = nearSide(sweep);
  const pairs = [];
  for (let i = 0; i <= 36; i++) {
    const s = from + ((to - from) * i) / 36;
    pairs.push([s, sgn * mouthAngle(s + shift)]);
  }
  return line(visiblePath(sweep, pairs, 0.03), tone, 'mouth');
}

/** Colour of the mouth interior: body 70 % toward ink (spec N3). */
export const interiorColour = (hex) => mixHex(hex, INK, 0.7);

// ---------------------------------------------------------------- open jaw

/** Head route of the open mouth: the points after the hinge turned down by `JAW_OPEN` about the lateral axis. */
export function jawSetup(setup) {
  const { start, D, sweep, dorsal } = setup;
  const axis = unit(cross(D, dorsal));
  const hingePoint = add(start, mul(D, JAW_AT));
  // turn the snout end down: about the lateral axis, positive angle moves D toward -dorsal
  const sign = dot(cross(axis, D), dorsal) > 0 ? -1 : 1;
  const angle = sign * JAW_OPEN * DEG;
  const pts = [hingePoint];
  const length = HEAD_LEN - JAW_AT;
  const rotatedEnd = rotate(add(start, mul(D, HEAD_LEN)), hingePoint, axis, angle);
  const mid = rotate(add(start, mul(D, JAW_AT + length / 2)), hingePoint, axis, angle);
  pts.push(mid, rotatedEnd);
  const radius = (u) => sweep.radiusAt((JAW_AT + u * length) / HEAD_LEN);
  const rotDorsal = rotate(add([0, 0, 0], dorsal), [0, 0, 0], axis, angle);
  const jaw = makeSweep(pts, radius, sweep.P, { down: () => mul(rotDorsal, -1), fallback: [0, 1, 0] });
  return { jaw, axis, angle, hingePoint };
}

/** Screen polyline of the mouth line of a sweep over s in [from, to] (jaw sweeps pass their own s range). */
function seamLine(sweep, sgn, from, to, shift = 0, count = 28) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const s = from + ((to - from) * i) / count;
    out.push(screen(sweep, s, sgn * mouthAngle(s + shift), 0.02));
  }
  return out;
}

/** Offset every point of a polyline by `reach` px in the direction away from the sweep axis (dorsal) or toward it (ventral). */
function reachFrom(sweep, line, from, to, towardAxis, reach) {
  const count = line.length - 1;
  return line.map((p, i) => {
    const s = from + ((to - from) * i) / count;
    const axis = iso(sweep.frameAt(Math.min(sweep.total, Math.max(0, s))).c, sweep.P);
    const dx = axis[0] - p[0];
    const dy = axis[1] - p[1];
    const length = Math.hypot(dx, dy) || 1;
    const sign = towardAxis ? 1 : -1;
    return [p[0] + (sign * reach * dx) / length, p[1] + (sign * reach * dy) / length];
  });
}

/**
 * Screen regions of the open mouth: `upper` (the part of the head above the mouth plane, for the clip of the upper
 * skull), `lower` (the part of the turned jaw below it) and `interior` (the wedge between the two lips).
 */
export function openRegions(head, jawInfo) {
  const sgn = nearSide(head.sweep);
  const { sweep } = head;
  const { jaw } = jawInfo;
  const length = HEAD_LEN - JAW_AT;
  const reach = 6 * sweep.k;
  const s0 = JAW_AT - 3;
  const s1 = HEAD_LEN + 1;
  const top = seamLine(sweep, sgn, s0, s1);
  const topUp = reachFrom(sweep, top, s0, s1, true, reach * 3);
  // the jaw sweep starts at the hinge: its s = head s - JAW_AT
  const jawTop = seamLine(jaw, sgn, 0, length + 1, JAW_AT);
  const jawDown = reachFrom(jaw, jawTop, 0, length + 1, false, reach * 3);
  const hinge = jawTop.slice(0, 1);
  const upperLip = seamLine(sweep, sgn, JAW_AT, HEAD_LEN - 0.3);
  const lowerLip = seamLine(jaw, sgn, 0, length - 0.3, JAW_AT);
  return {
    upper: pathOf([...top, ...topUp.slice().reverse()], true),
    lower: pathOf([...jawTop, ...jawDown.slice().reverse()], true),
    interior: pathOf([...upperLip, ...lowerLip.slice().reverse(), ...hinge], true),
  };
}

/** Screen points of a lip line of a sweep: (s from, to) at section angle a. */
export function lipPoints(sweep, a, from, to, offset = 0, count = 24) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const s = from + ((to - from) * i) / count;
    out.push(screen(sweep, s - offset, a, 0.02));
  }
  return out;
}

export { paintOf, surfaceColour, clamp };
