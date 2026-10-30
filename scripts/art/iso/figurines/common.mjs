// Shared construction of the four figurines (T40 spec section 4.1): the camera of the board, the local frame
// (right, forward, up) of a figurine, the turned-wood part helpers that draw and record every part, the pedestal with
// its seat band, and the head: face geometry mapped onto a sphere. Hero modules (hanuman.mjs, later rama, sita,
// lakshmana) add their own parts on top.

import * as A from '../../anatomy/audit.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { tubePieces, tubeSvg } from '../../anatomy/tube.mjs';
import { boardProjection, camera } from '../../iso-board.mjs';
import { cropProjection } from '../common.mjs';

export const DEG = Math.PI / 180;
export const RIGHT = [Math.sin(camera.azimuth * DEG), -Math.cos(camera.azimuth * DEG), 0];
export const FORWARD = [Math.cos(camera.azimuth * DEG), Math.sin(camera.azimuth * DEG), 0];

/** Spec 4.7: px per world unit of the sprite sizes. `s` is the board's own scale, so a token matches the board. */
export const SIZES = { s: G.scaleOf(boardProjection()), m: 1.711, l: 5.83 };

/** Local (right, forward, up) to world. Origin is the feet point: the pedestal's bottom centre. */
export const local = ([r, f, u]) => [r * RIGHT[0] + f * FORWARD[0], r * RIGHT[1] + f * FORWARD[1], u];

export const add = G.add3;
export const sub = G.sub3;
export const mul = G.mul3;
export const unit = G.unit3;
export const dot = G.dot3;
export const cross = G.cross3;

/** Box the sprite must fit, in local units: right, forward, up. Every variant of a size shares one crop and anchor. */
const FIT = { r: [-16, 18], f: [-14, 14], u: [-1, 82] };

/** Projection of a figurine at `size`, cropped so that the feet point sits at the returned anchor. */
export function figureProjection(size) {
  const base = { ...boardProjection(), scale: SIZES[size] / Math.sqrt(1.6) };
  const corners = [];
  for (const r of FIT.r) for (const f of FIT.f) for (const u of FIT.u) corners.push(local([r, f, u]));
  const crop = cropProjection(base, corners, size === 's' ? 2 : 4);
  const anchor = k.iso([0, 0, 0], crop.projection);
  return { ...crop, anchor, k: SIZES[size] };
}

/**
 * A figure under construction: the recorder, the drawing helpers and the sorted output.
 * Every helper records the true shape of what it draws, so `settle` and the audit see the real geometry.
 */
export function createFigure({ size, lit = false, label }) {
  const { projection: P, width, height, anchor, k: kPx } = figureProjection(size);
  const R = A.recorder(P);
  const V = R.V;
  const ks = G.scaleOf(P);
  const parts = new Set();
  const backdrop = [];

  const fig = { P, V, R, ks, size, lit, width, height, anchor, k: kPx, label, parts, backdrop };

  /** Add a drawn item. `part` names the part for the count; `at` seeds its depth key. */
  fig.put = (owner, name, at, svg, { bias = 0, shapes = [], route, chunk } = {}) => {
    parts.add(name.replace(/[#:].*$/, ''));
    // The pedestal base is tagged: its outline is the reference the anchor test measures the feet point against.
    const tagged = name === 'stand.base' ? `<g data-part="pedestal-base">${svg}</g>` : svg;
    R.put({ piece: owner, at, bias, svg: tagged, shapes, name: R.nameFor(name), route, chunk });
  };

  /** Facet count: the kit's 3 px per facet, capped so the l files stay under the 300 KB limit of the check. */
  const stepsOf = (r) => Math.min(G.stepsFor(r, 32, 160, ks), 56);

  const style = (tone, options) => ({
    tone,
    lit: fig.lit && !options.noLit,
    ...(options.className ? { className: options.className } : {}),
  });

  /** A turned part (solid of revolution) on frame F. */
  fig.turned = (owner, name, F, profile, options = {}) => {
    const {
      tone = 'hi',
      extra = '',
      inner = '',
      bias = 0,
      smooth,
      radius,
      slope,
      rims,
      steps,
      bevel = 0,
    } = options;
    const smoothOption = slope
      ? { slope, ...(radius ? { radius } : {}), rows: 3, error: 0.8, fineness: 0.4 }
      : smooth;
    const paths = G.solidOf(profile, F, P, {
      bevel,
      ...(smoothOption === undefined ? {} : { smooth: smoothOption }),
      ...(rims ? { rims } : {}),
      steps: steps ?? stepsOf(Math.max(...profile.map((p) => p[1]))),
    });
    const s0 = profile[0][0];
    const s1 = profile[profile.length - 1][0];
    const id = R.nameFor(`${name}.shape`);
    const shape = R.solid(
      A.solid(F, profile, {
        name: id,
        owner,
        radius,
        curve: !slope && profile.some((p) => p[2]) ? profile : undefined,
        ...(options.meta ?? {}),
      }),
    );
    fig.put(
      owner,
      name,
      add(F.o, mul(F.a, (s0 + s1) / 2)),
      k.solidSvg(paths, { ...style(tone, options), inner }) + extra,
      { bias, shapes: [shape] },
    );
    return shape;
  };

  /** A plain cylinder from point `a` to point `b` (dowel, collar, leg). */
  fig.dowel = (owner, name, a, b, r, options = {}) => {
    const { tone = 'hi', extra = '', bias = 0, bevel = 0 } = options;
    const axis = sub(b, a);
    const length = G.len3(axis);
    const F = G.frameAlong(a, unit(axis));
    const paths = G.disc(0, length, r, F, P, { bevel, steps: stepsOf(r) });
    const id = R.nameFor(`${name}.shape`);
    const shape = R.solid(A.disc(F, 0, length, r, { name: id, owner, ...(options.meta ?? {}) }));
    fig.put(
      owner,
      name,
      add(a, mul(axis, 0.5)),
      k.solidSvg(paths, { ...style(tone, options), inner: options.inner ?? '' }) + extra,
      { bias, shapes: [shape] },
    );
    return shape;
  };

  /** A ring (annulus with thickness) around axis frame F. */
  fig.ring = (owner, name, F, s0, s1, rIn, rOut, options = {}) => {
    const { tone = 'hi', extra = '', bias = 0 } = options;
    const paths = G.ringBand(s0, s1, rIn, rOut, F, P, { steps: stepsOf(rOut) });
    const id = R.nameFor(`${name}.shape`);
    const shape = R.solid(A.ring(F, s0, s1, rIn, rOut, { name: id, owner, ...(options.meta ?? {}) }));
    fig.put(
      owner,
      name,
      add(F.o, mul(F.a, (s0 + s1) / 2)),
      k.solidSvg(paths, { ...style(tone, options), inner: options.inner ?? '' }) + extra,
      { bias, shapes: [shape] },
    );
    return shape;
  };

  /** A smooth ball. `meta` can carry `seated` and `cut` for a ball sunk into its host by design. */
  fig.ball = (owner, name, c, r, options = {}) => {
    const { tone = 'hi', extra = '', bias = 0 } = options;
    const paths = G.sphereOf(c, r, P);
    const id = R.nameFor(`${name}.shape`);
    const shape = R.solid(A.ball(c, r, { name: id, owner, ...(options.meta ?? {}) }));
    fig.put(
      owner,
      name,
      c,
      k.solidSvg(paths, { ...style(tone, options), inner: options.inner ?? '' }) + extra,
      { bias, shapes: [shape] },
    );
    return shape;
  };

  /** A turned tube along a 3D route (tail, thread). Returns the chunk shapes. */
  fig.tube = (owner, name, route, r, options = {}) => {
    const {
      tone = 'hi',
      bias = 0,
      gaps = [],
      maxLength = 8,
      rings,
      touch,
      ends = [true, true],
      free = [false, false],
    } = options;
    const id = R.nameFor(name);
    R.route(id, route, r, { owner, touch, gaps, ends, free, piece: owner });
    const pieces = tubePieces(route, r, P, { maxLength, gaps, ...(rings ? { rings } : {}) });
    pieces.forEach((piece, index) =>
      fig.put(
        owner,
        `${name}:${index}`,
        piece.mid,
        tubeSvg(piece, { tone: fig.lit && !options.noLit ? 'lit' : tone }),
        {
          bias,
          shapes: [A.tube(piece.points, piece.radii)],
          route: id,
          chunk: index,
        },
      ),
    );
    parts.add(name);
    return id;
  };

  /** Settle depth keys, sort, and return the SVG string. */
  fig.finish = ({ keys } = {}) => {
    if (keys) {
      if (keys.length !== R.items.length)
        throw new Error(`depth keys do not match: ${keys.length} vs ${R.items.length}`);
      R.items.forEach((item, index) => (item.key = keys[index]));
    } else {
      A.settle(R, P);
    }
    fig.keys = R.items.map((item) => item.key);
    fig.names = R.items.map((item) => item.name);
    const sorted = [...R.items].sort((a, b) => a.key - b.key);
    return [...backdrop, ...sorted.map((item) => item.svg)];
  };

  fig.partCount = () => parts.size;
  return fig;
}

// ---------------------------------------------------------------- pedestal (spec 4.1 S1-S6)

/** Halo plus the turned pedestal with the seat band of `hero`. Everything is `stand.*` (the ground of the audit). */
export function addPedestal(fig, hero) {
  const { P } = fig;
  const axis = (z) => G.frameOf([0, 0, z], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const blur = (1.1 * fig.k).toFixed(2);
  const halo = k.haloOf({ x: -7, y: -7, w: 14, d: 14, r: 7 }, 0, 0.1, P);
  fig.backdrop.push(`<path class="iso-halo" style="filter:blur(${blur}px);transform:none" d="${halo}"/>`);
  const ground = { ground: true };
  const F = axis(0);
  fig.turned(
    'stand',
    'stand.base',
    F,
    [
      [0, 7.0],
      [1.2, 7.0],
    ],
    { tone: 'mid', bevel: 0.6, meta: ground },
  );
  fig.ring('stand', 'stand.bead', F, 1.2, 1.8, 6.6, 7.2, { tone: 'lo', meta: ground });
  fig.ring('stand', 'stand.band', F, 1.8, 3.4, 6.0, 6.6, {
    tone: 'hi',
    className: `seat-${hero}`,
    noLit: true,
    meta: ground,
  });
  fig.turned(
    'stand',
    'stand.top',
    F,
    [
      [3.4, 6.0],
      [4.0, 6.0],
    ],
    { tone: 'mid', meta: ground },
  );
  const seat = k.lineSvg(G.circleOf(axis(4.0), 0, 5.0, P), { tone: 'faint' });
  const ringShape = fig.R.solid(
    A.disc(axis(4.0), 0, 0.01, 5.0, { name: 'stand.seatring.shape', owner: 'stand', ground: true }),
  );
  fig.put('stand', 'stand.seatring', [0, 0, 4.0], seat, { bias: 0.4, shapes: [ringShape] });
}

// ---------------------------------------------------------------- head

/** Head basis after a nod (about right, negative = chin down) and a side tilt (about forward, positive = to the right). */
export function headBasis(nodDeg = 0, tiltDeg = 0) {
  const n = nodDeg * DEG;
  const t = tiltDeg * DEG;
  const F1 = [0, Math.cos(n), Math.sin(n)];
  const Z1 = [0, -Math.sin(n), Math.cos(n)];
  const R2 = add(mul([1, 0, 0], Math.cos(t)), mul(Z1, -Math.sin(t)));
  const Z2 = add(mul(Z1, Math.cos(t)), mul([1, 0, 0], Math.sin(t)));
  return { R: R2, F: F1, Z: Z2 };
}

/** Local (right, forward, up) point of offset (r, f, u) expressed in a head basis around a local centre. */
export function inBasis(centre, basis, [r, f, u]) {
  return add(centre, add(add(mul(basis.R, r), mul(basis.F, f)), mul(basis.Z, u)));
}

/**
 * T02's 100x100 face box onto the head sphere (spec 4.1): lon = (fx-50)/50*55 deg, lat = (50-fy)/50*55 deg.
 * `centre` is the local (r, f, u) head centre; the result is a world point `lift` outside the surface.
 */
export function faceWorld(centre, basis, radius, fx, fy, lift = 0, scale = 1) {
  const lon = ((fx - 50) / 50) * 55 * DEG * scale;
  const lat = ((50 - fy) / 50) * 55 * DEG;
  const d = add(
    add(mul(basis.F, Math.cos(lat) * Math.cos(lon)), mul(basis.R, Math.cos(lat) * Math.sin(lon))),
    mul(basis.Z, Math.sin(lat)),
  );
  return local(add(centre, mul(d, radius + lift)));
}

/** Unit normal (world) of the sphere at face coordinates, to test that a feature faces the camera. */
export function faceFacing(fig, centre, basis, radius, fx, fy) {
  const c = local(centre);
  const p = faceWorld(centre, basis, radius, fx, fy);
  return dot(unit(sub(p, c)), fig.V);
}
