// The recorded board scene shared by board.mjs (base), ladders.mjs and snakes.mjs (T40.3-T40.5).
// Every drawn item is put into one anatomy recorder together with its true shape, so A.settle can measure the
// painter's order from geometry and A.auditOrExit can prove clearance, crowding and depth order (--audit).

import * as A from '../anatomy/audit.mjs';
import * as k from '../anatomy/iso-kit.mjs';
import * as G from '../anatomy/lathe.mjs';
import { tubePieces, tubeSvg } from '../anatomy/tube.mjs';
import { boardProjection, camera } from '../iso-board.mjs';
import { exportSvg } from './common.mjs';

export const Z_AXIS_U = [1, 0, 0];
export const Z_AXIS_V = [0, 1, 0];

/** A vertical frame (axis +z) with its origin on the floor under (x, y); s along it is the world z. */
export const upright = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], Z_AXIS_U, Z_AXIS_V);

export function createScene() {
  const P = boardProjection();
  const V = G.viewOf(P);
  const KS = G.scaleOf(P);
  const R = A.recorder(P);
  const back = [];
  // solids = recorded items, marks = separate strokes, ticks, rings and dots drawn on them
  const stats = { solids: 0, tubes: 0, marks: 0 };
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => {
    stats.marks += (d.match(/M/g) ?? []).length;
    return k.lineSvg(d, style);
  };
  const Dots = (points, style) => {
    stats.marks += points.length;
    return k.dotsSvg(points, style);
  };
  const record = R.solid;

  function put(name, ref, svg, shapes = [], { bias = 0, ...rest } = {}) {
    stats.solids++;
    return R.put({ name, at: ref, bias, svg, shapes, piece: 'board', ...rest });
  }

  /** A rounded slab; `ground` names it stand.* so the audit counts it as held by the floor. */
  function slab(name, plan, z, height, style = {}, options = {}) {
    const { steps = 3, bevel = 0, inner = '', extra = '', bias = 0, ground = false, ref } = options;
    const shape = record(A.slab(plan, z, height, { name: ground ? `stand.${name}` : name }, steps));
    const centre = ref ?? [plan.x + plan.w / 2, plan.y + plan.d / 2, z + height / 2];
    put(
      name,
      centre,
      S(k.slabOf(plan, z, height, P, steps, bevel), { tone: 'mid', ...style, inner }) + extra,
      [shape],
      {
        bias,
      },
    );
    return shape;
  }

  /** Any convex or concave floor outline stood on z. */
  function prism(name, ring, z, height, style = {}, options = {}) {
    const { convex = true, bevel = 0, inner = '', extra = '', bias = 0, ref } = options;
    const shape = record(A.extruded(ring, z, height, { name }));
    const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length;
    const cy = ring.reduce((a, p) => a + p[1], 0) / ring.length;
    put(
      name,
      ref ?? [cx, cy, z + height / 2],
      S(k.extrude(ring, z, height, P, { convex, bevel }), { tone: 'mid', ...style, inner }) + extra,
      [shape],
      { bias },
    );
    return shape;
  }

  function cyl(name, cx, cy, r, z, height, style = {}, options = {}) {
    const { steps = 24, bevel = 0, inner = '', extra = '', bias = 0, ground = false } = options;
    const shape = record(A.cylinder(cx, cy, r, z, height, { name: ground ? `stand.${name}` : name }));
    put(
      name,
      [cx, cy, z + height / 2],
      S(k.cylinder(cx, cy, r, z, height, P, steps, bevel), { tone: 'mid', ...style, inner }) + extra,
      [shape],
      { bias },
    );
    return shape;
  }

  /** A turned part: profile closed to the axis at both ends (G.solidOf), recorded as A.solid. */
  function turned(name, F, profile, style = {}, options = {}) {
    const {
      inner = '',
      extra = '',
      bias = 0,
      smooth,
      steps,
      bevel = 0,
      ground = false,
      radius = null,
    } = options;
    const opts = { bevel, ...(smooth !== undefined ? { smooth } : {}), ...(steps ? { steps } : {}) };
    const paths = G.solidOf(profile, F, P, opts);
    const mid = (profile[0][0] + profile[profile.length - 1][0]) / 2;
    const shape = record(A.solid(F, profile, { name: ground ? `stand.${name}` : name, radius }));
    put(name, G.add3(F.o, G.mul3(F.a, mid)), S(paths, { tone: 'mid', ...style, inner }) + extra, [shape], {
      bias,
    });
    return shape;
  }

  /** A short cylinder along the frame axis from s0 to s1. */
  function disc(name, F, s0, s1, r, style = {}, options = {}) {
    const { inner = '', extra = '', bias = 0, steps, bevel = 0 } = options;
    const paths = G.disc(s0, s1, r, F, P, { bevel, ...(steps ? { steps } : {}) });
    const shape = record(A.disc(F, s0, s1, r, { name }));
    put(
      name,
      G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)),
      S(paths, { tone: 'mid', ...style, inner }) + extra,
      [shape],
      {
        bias,
      },
    );
    return shape;
  }

  /** A collar: annulus of thickness s1 - s0 around the frame axis. */
  function band(name, F, s0, s1, rIn, rOut, style = {}, options = {}) {
    const { inner = '', extra = '', bias = 0, steps, owner, open = false } = options;
    // An open ring (a dais) cuts its bore into the fill at the end face; a collar around a part keeps it solid.
    const paths = G.ringBand(s0, s1, rIn, rOut, F, P, {
      ...(steps ? { steps } : {}),
      ...(open ? { hole: [s1, rIn] } : {}),
    });
    const shape = record(A.ring(F, s0, s1, rIn, rOut, { name, owner }));
    put(
      name,
      G.add3(F.o, G.mul3(F.a, (s0 + s1) / 2)),
      S(paths, { tone: 'mid', ...style, inner }) + extra,
      [shape],
      {
        bias,
      },
    );
    return shape;
  }

  function ball(name, c, r, style = {}, options = {}) {
    const { bias = 0, extra = '', owner } = options;
    const shape = record(A.ball(c, r, { name, owner }));
    put(name, c, S(G.sphereOf(c, r, P, { steps: 24 }), { tone: 'mid', ...style }) + extra, [shape], { bias });
    return shape;
  }

  /**
   * A tube route as depth-sorted chunks (tubePieces), each recorded with its true centreline for the audit.
   * `limp` marks a body that holds nothing up (snakes, cords).
   */
  function tube(name, route, radius, options = {}) {
    const {
      tone = 'mid',
      maxLength = 14,
      spacing = 1.2,
      gaps = [],
      breaks = [],
      rings,
      caps,
      limp = true,
      className,
    } = options;
    const total = G.pathLength(route);
    R.route(name, route, typeof radius === 'number' ? radius : radius(0), {
      gaps,
      limp,
      piece: 'board',
      ...(options.touch ? { touch: options.touch } : {}),
      ...(options.owner ? { owner: options.owner } : {}),
    });
    const pieces = tubePieces(route, radius, P, {
      maxLength,
      spacing,
      gaps,
      breaks,
      ...(rings ? { rings } : {}),
      ...(caps !== undefined ? { caps } : {}),
    });
    pieces.forEach((piece, index) => {
      stats.tubes++;
      const svg = tubeSvg(piece, { tone });
      put(
        `${name}:${index}`,
        piece.mid,
        className ? `<g class="${className}">${svg}</g>` : svg,
        [A.tube(piece.points, piece.radii)],
        {
          bias: 0.05,
          route: name,
          chunk: index,
        },
      );
    });
    return { total, pieces };
  }

  const layers = [];

  /**
   * Draw the items named `prefix*` as one merged markup block placed right after the item `after` (the items stay
   * recorded one by one, so settle and audit still see every shape). For a dense set that never overlaps itself
   * (the 144 tiles): shared paths instead of 144 groups.
   */
  function mergeLayer(prefix, after, svg) {
    layers.push({ prefix, after, svg });
  }

  /** Settle the painter's keys from geometry, sort, and wrap into a standalone light SVG. */
  function finish({ label, audit = false, debug = false }) {
    A.settle(R, P);
    R.items.sort((a, b) => a.key - b.key);
    const drawn = [];
    for (const item of R.items) {
      if (layers.some((layer) => item.name.startsWith(layer.prefix))) continue;
      drawn.push(debug ? `<g data-name="${item.name}">${item.svg}</g>` : item.svg);
      for (const layer of layers) if (layer.after === item.name) drawn.push(layer.svg);
    }
    const { width, height } = boardProjectionFrame();
    const svg = compactPaths(exportSvg({ width, height, label, body: [...back, ...drawn] }));
    if (audit) A.auditOrExit(R, P, { argv: ['--audit'] });
    return svg;
  }

  return {
    P,
    V,
    KS,
    R,
    back,
    stats,
    at,
    S,
    Ln,
    Dots,
    record,
    put,
    slab,
    prism,
    cyl,
    turned,
    disc,
    band,
    ball,
    tube,
    mergeLayer,
    finish,
  };
}

/** The board SVG's pixel frame is the camera rect, so image pixel (0, 0) is stage pixel (0, 0) (offset 0, 0). */
export function boardProjectionFrame() {
  return { width: camera.rect.width, height: camera.rect.height };
}

const NUMBER = /-?\d*\.?\d+/g;
const round1 = (v) => Math.round(v * 10) / 10;

function num(v) {
  const text = round1(v).toString();
  return text === '-0' ? '0' : text.replace(/^(-?)0\./, '$1.');
}

function joinNumbers(values) {
  let out = '';
  for (const v of values) {
    const text = num(v);
    out += (out && !text.startsWith('-') ? ' ' : '') + text;
  }
  return out;
}

/**
 * Rewrite every M/L/Z path (the kit's pathOf output, all coordinates already on a 0.1 grid) with relative line
 * segments: the same shape, about a third shorter. Paths with any other command are left alone.
 */
export function compactPaths(svg) {
  return svg.replace(/ d="([MLZ0-9 .-]*)"/g, (whole, d) => {
    let out = '';
    for (const part of d.split('M').slice(1)) {
      const closed = part.endsWith('Z');
      const points = part
        .replace(/Z$/, '')
        .split('L')
        .map((pair) => pair.match(NUMBER).map(Number));
      out += `M${joinNumbers(points[0])}`;
      const deltas = [];
      for (let i = 1; i < points.length; i++) {
        deltas.push(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      }
      if (deltas.length) out += `l${joinNumbers(deltas)}`;
      if (closed) out += 'Z';
    }
    return ` d="${out}"`;
  });
}
