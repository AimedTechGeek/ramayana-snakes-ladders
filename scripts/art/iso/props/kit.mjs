// Drawing kit of the region props (T42.3): a lean recorder on top of the anatomy kit. A prop is drawn with its
// ground point at the world origin and every height counted from TOP_Z (z = 0 is the tile top), with the board's own
// camera, so the sprite sits on a block exactly like the tile and figurines do. Every helper records the true extent of
// what it draws (height, footprint, lowest z, solid count) so the builder can enforce the zone limits from geometry
// instead of trusting numbers typed by hand.

import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { boardProjection } from '../../iso-board.mjs';
import { exportSvg, mixHex } from '../common.mjs';
import { tones } from '../tones.mjs';
import { TOP_Z } from '../world.mjs';

export { k, G };
export const P = { ...boardProjection(), origin: [0, 0] };
export const DEG = Math.PI / 180;
const SHADES = 4;

const upright = (x, y, z, turn = 0) =>
  G.frameOf(
    [x, y, TOP_Z + z],
    [0, 0, 1],
    [Math.cos(turn), Math.sin(turn), 0],
    [-Math.sin(turn), Math.cos(turn), 0],
  );

/** CSS of one material: the four tones of tones(hex), lines in the dark line tone, the crease a step lighter. */
export function materialCss(hex) {
  const t = tones(hex);
  const faint = mixHex(t.line, t.top, 0.45);
  const shades = t.shades.map((v, i) => `--anatomy-shade-${i}:${v}`).join(';');
  return `.m${hex.slice(1)}{--anatomy-top:${t.top};--anatomy-paper:${t.shades[2]};${shades};--anatomy-hi:${t.line};--anatomy-mid:${t.line};--anatomy-lo:${t.line};--anatomy-faint:${faint};--anatomy-dot:${t.line}}`;
}

const NUMBER = /-?\d*\.?\d+/g;

/** Screen bounds of every M/L path and circle of an svg body (what the kit writes), in logical px. */
function screenBounds(svg) {
  const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const take = (x, y, r = 0) => {
    box.x0 = Math.min(box.x0, x - r);
    box.x1 = Math.max(box.x1, x + r);
    box.y0 = Math.min(box.y0, y - r);
    box.y1 = Math.max(box.y1, y + r);
  };
  for (const [, d] of svg.matchAll(/ d="([^"]*)"/g)) {
    if (/[^MLZ0-9 .-]/.test(d)) throw new Error(`unsupported path command in ${d.slice(0, 40)}`);
    const n = d.match(NUMBER)?.map(Number) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) take(n[i], n[i + 1]);
  }
  for (const [, cx, cy, r] of svg.matchAll(/<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="([\d.]+)"/g))
    take(Number(cx), Number(cy), Number(r));
  return box;
}

/**
 * Painter's order of boxes seen from +x +y +z: A is behind B when A ends before B starts along x, y or z and B never
 * does that to A. Pairs whose screen boxes do not overlap, or that conflict, fall back to the depth key. The order is
 * then a topological sort that always takes the free item with the smallest key.
 */
function paintOrder(items) {
  const screen = items.map((item) => screenBounds(item.svg));
  const touches = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const before = items.map(() => new Set());
  const EPS = 1e-6;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (!touches(screen[i], screen[j])) continue;
      const [a, b] = [items[i].bounds, items[j].bounds];
      const ab = a[1] <= b[0] + EPS || a[3] <= b[2] + EPS || a[5] <= b[4] + EPS;
      const ba = b[1] <= a[0] + EPS || b[3] <= a[2] + EPS || b[5] <= a[4] + EPS;
      if (ab && !ba) before[j].add(i);
      else if (ba && !ab) before[i].add(j);
    }
  }
  const out = [];
  const done = new Set();
  while (out.length < items.length) {
    let pick = -1;
    for (let i = 0; i < items.length; i++) {
      if (done.has(i)) continue;
      const free = [...before[i]].every((j) => done.has(j));
      if (
        free &&
        (pick < 0 || items[i].key < items[pick].key || (items[i].key === items[pick].key && i < pick))
      )
        pick = i;
    }
    if (pick < 0) {
      for (let i = 0; i < items.length; i++)
        if (!done.has(i) && (pick < 0 || items[i].key < items[pick].key)) pick = i;
    }
    done.add(pick);
    out.push(items[pick]);
  }
  return out;
}

const pointBounds = (points) => {
  const xs = points.map((q) => q[0]);
  const ys = points.map((q) => q[1]);
  const zs = points.map((q) => q[2]);
  return [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
    Math.min(...zs),
    Math.max(...zs),
  ];
};

/** Start drawing one prop. Returns the pen `p`; call `p.finish(label)` for the standalone SVG and the stats. */
export function pen() {
  const items = [];
  const mats = new Set();
  const stats = {
    parts: 0,
    z0: Infinity,
    z1: -Infinity,
    x0: Infinity,
    x1: -Infinity,
    y0: Infinity,
    y1: -Infinity,
  };
  let last = null;
  const grow = (x0, x1, y0, y1, z0, z1) => {
    last = [x0, x1, y0, y1, z0, z1];
    stats.x0 = Math.min(stats.x0, x0);
    stats.x1 = Math.max(stats.x1, x1);
    stats.y0 = Math.min(stats.y0, y0);
    stats.y1 = Math.max(stats.y1, y1);
    stats.z0 = Math.min(stats.z0, z0);
    stats.z1 = Math.max(stats.z1, z1);
  };
  const use = (hex) => {
    mats.add(hex);
    return `m${hex.slice(1)}`;
  };
  const put = (centre, svg, bias = 0) => {
    items.push({
      key: k.depthOf([centre[0], centre[1], TOP_Z + (last ? last[4] : centre[2])], P) + bias,
      n: items.length,
      svg,
      bounds: last,
    });
    last = null;
  };
  const solid = (paths, hex, centre, { inner = '', bias = 0, crease = 'faint', open = false } = {}) => {
    stats.parts++;
    const className = open ? `${use(hex)} open` : use(hex);
    put(centre, k.solidSvg(paths, { tone: 'hi', crease, className, inner }), bias);
  };

  const p = { stats, solid };

  /** A rounded box centred on (x, y), from height z up by h. `seams` are heights of belt lines, `inlay` a groove on top. */
  p.box = ({
    x,
    y,
    z = 0,
    w,
    d,
    h,
    mat,
    r = 0.5,
    steps = 2,
    bevel = 0,
    seams = [],
    inlay = 0,
    bias = 0,
    inner = '',
  }) => {
    const plan = { x: x - w / 2, y: y - d / 2, w, d, r };
    grow(plan.x, plan.x + w, plan.y, plan.y + d, z, z + h);
    let lines = inner;
    for (const s of seams) lines += k.lineSvg(k.sideSeam(plan, TOP_Z + z + s, P, steps), { tone: 'faint' });
    if (inlay)
      lines += k.lineSvg(k.planOutline(k.insetPlan(plan, inlay), TOP_Z + z + h, P, steps), { tone: 'faint' });
    solid(k.slabOf(plan, TOP_Z + z, h, P, steps, bevel), mat, [x, y, z + h / 2], { inner: lines, bias });
  };

  /** A round post, drum or pad. */
  p.cyl = ({ x, y, z = 0, r, h, mat, steps = 20, bevel = 0, seams = [], bias = 0, inner = '' }) => {
    grow(x - r, x + r, y - r, y + r, z, z + h);
    let lines = inner;
    for (const s of seams) lines += k.lineSvg(k.sideArc(x, y, r, TOP_Z + z + s, P, steps), { tone: 'faint' });
    solid(k.cylinder(x, y, r, TOP_Z + z, h, P, steps, bevel), mat, [x, y, z + h / 2], { inner: lines, bias });
  };

  /** A ball of radius r centred at height z. */
  p.ball = ({ x, y, z, r, mat, steps = 24, bias = 0 }) => {
    grow(x - r, x + r, y - r, y + r, z - r, z + r);
    solid(G.sphereOf([x, y, TOP_Z + z], r, P, { steps }), mat, [x, y, z], { bias });
  };

  /**
   * A turned part: profile [[s, r], ...] with s the height above `z` (a third element 1 marks a smooth knot).
   * Pass `smooth: false` for a faceted look.
   */
  p.turn = ({
    x,
    y,
    z = 0,
    profile,
    mat,
    steps,
    smooth,
    turn = 0,
    bias = 0,
    inner = '',
    bevel = 0,
    reach,
  }) => {
    const rMax = reach ?? Math.max(...profile.map(([, r]) => r));
    const s0 = Math.min(...profile.map(([s]) => s));
    const s1 = Math.max(...profile.map(([s]) => s));
    grow(x - rMax, x + rMax, y - rMax, y + rMax, z + s0, z + s1);
    const options = { bevel, ...(steps ? { steps } : {}), ...(smooth !== undefined ? { smooth } : {}) };
    solid(G.solidOf(profile, upright(x, y, z, turn), P, options), mat, [x, y, z + (s0 + s1) / 2], {
      bias,
      inner,
    });
  };

  /** A straight rod or leaning post from [x, y, z] to [x, y, z], radius r at the start and r1 at the end. */
  p.rod = ({ from, to, r, r1 = r, mat, steps = 10, bias = 0 }) => {
    const dir = G.sub3(to, from);
    const length = G.len3(dir);
    const F = G.frameAlong([from[0], from[1], TOP_Z + from[2]], G.unit3(dir), P);
    const rMax = Math.max(r, r1);
    grow(
      Math.min(from[0], to[0]) - rMax,
      Math.max(from[0], to[0]) + rMax,
      Math.min(from[1], to[1]) - rMax,
      Math.max(from[1], to[1]) + rMax,
      Math.min(from[2], to[2]),
      Math.max(from[2], to[2]),
    );
    const profile = [
      [0, r],
      [length, r1],
    ];
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    solid(G.solidOf(profile, F, P, { steps, smooth: false }), mat, mid, { bias });
  };

  /** A flat round disc (a wheel) with its axis along `axis`, centred on [x, y, z], thickness `thick`, radius r. */
  p.wheel = ({ at, axis, r, thick, mat, steps = 24, bias = 0, inner = '' }) => {
    const F = G.frameAlong([at[0], at[1], TOP_Z + at[2]], G.unit3(axis), P);
    const a = G.unit3(axis);
    const reach = a.map((c) => r * Math.sqrt(Math.max(0, 1 - c * c)) + (thick / 2) * Math.abs(c));
    grow(
      at[0] - reach[0],
      at[0] + reach[0],
      at[1] - reach[1],
      at[1] + reach[1],
      at[2] - reach[2],
      at[2] + reach[2],
    );
    solid(G.disc(-thick / 2, thick / 2, r, F, P, { steps }), mat, at, { bias, inner });
    return F;
  };

  /** A flat ring (a bowl rim, a foam ring, a stone kerb) standing on z with an open bore. */
  p.ring = ({ x, y, z = 0, rIn, rOut, h, mat, steps, bias = 0, open = true }) => {
    grow(x - rOut, x + rOut, y - rOut, y + rOut, z, z + h);
    const F = upright(x, y, z);
    const paths = G.ringBand(0, h, rIn, rOut, F, P, {
      ...(steps ? { steps } : {}),
      ...(open ? { hole: [h, rIn] } : {}),
    });
    solid(paths, mat, [x, y, z + h / 2], { bias, open });
  };

  /** A cone from base radius r to a point (or to top radius r1) of height h. */
  p.cone = ({ x, y, z = 0, r, r1 = 0, h, mat, steps = 20, bias = 0, inner = '' }) =>
    p.turn({
      x,
      y,
      z,
      profile: [
        [0, r],
        [h, r1],
      ],
      mat,
      steps,
      smooth: false,
      bias,
      inner,
    });

  /** A square pyramid (a roof) with axis-aligned base side 2 * half. */
  p.pyramid = ({ x, y, z = 0, half, h, mat, bias = 0 }) =>
    p.faceted({
      x,
      y,
      z,
      profile: [
        [0, half * Math.SQRT2],
        [h, 0],
      ],
      sides: 4,
      turn: Math.PI / 4,
      mat,
      bias,
    });

  /**
   * A convex polyhedron from world vertices [x, y, z above the tile top] and faces (index lists): visible faces are
   * toned by the way they face the light, their edges are creases, the hull of the projection is the outline.
   */
  p.poly3 = ({ verts, faces, mat, bias = 0 }) => {
    const abs = verts.map(([x, y, z]) => [x, y, TOP_Z + z]);
    const xs = verts.map((v) => v[0]);
    const ys = verts.map((v) => v[1]);
    const zs = verts.map((v) => v[2]);
    grow(
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
      Math.min(...zs),
      Math.max(...zs),
    );
    const centroid = abs.reduce((s, v) => G.add3(s, G.mul3(v, 1 / abs.length)), [0, 0, 0]);
    const view = G.viewOf(P);
    const shades = ['', '', '', ''];
    let top = '';
    let creases = '';
    for (const face of faces) {
      const ring = face.map((i) => abs[i]);
      let normal = [0, 0, 0];
      ring.forEach((q, i) => {
        const next = ring[(i + 1) % ring.length];
        normal = [
          normal[0] + (q[1] - next[1]) * (q[2] + next[2]),
          normal[1] + (q[2] - next[2]) * (q[0] + next[0]),
          normal[2] + (q[0] - next[0]) * (q[1] + next[1]),
        ];
      });
      normal = G.unit3(normal);
      const middle = ring.reduce((s, v) => G.add3(s, G.mul3(v, 1 / ring.length)), [0, 0, 0]);
      if (G.dot3(normal, G.sub3(middle, centroid)) < 0) normal = G.mul3(normal, -1);
      if (G.dot3(normal, view) <= 1e-6) continue;
      const d = k.pathOf(
        ring.map((q) => k.iso(q, P)),
        true,
      );
      const tone = G.toneOf(normal, P);
      if (tone >= SHADES) top += d;
      else shades[tone] += d;
      creases += d;
    }
    const hull = k.pathOf(G.hullOf(abs.map((q) => k.iso(q, P))), true);
    const [cx, cy] = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    solid(
      { fill: hull, outline: hull, crease: creases, top, shades },
      mat,
      [cx, cy, (Math.min(...zs) + Math.max(...zs)) / 2],
      { bias },
    );
  };

  /**
   * A faceted turned solid: `profile` [[s, r], ...] (s up from `z`), `sides` flat facets, optional `jitter` (0..1, a fixed
   * pseudo-random wobble of every facet radius, for rocks), a flat cap where the profile ends with r > 0. A pyramid is
   * sides 4 and profile [[0, r], [h, 0]]; the footprint follows the facets, not a circle.
   */
  p.faceted = ({ x, y, z = 0, profile, sides = 6, turn = 0, jitter = 0, mat, bias = 0 }) => {
    const wobble = (i, j) => 1 + jitter * (Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233) * 0.5);
    const verts = [];
    const rings = profile.map(([s, r], j) => {
      if (r === 0) {
        verts.push([x, y, z + s]);
        return [verts.length - 1];
      }
      return Array.from({ length: sides }, (_, i) => {
        const a = turn + (i / sides) * Math.PI * 2;
        const rr = r * wobble(i, j);
        verts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr, z + s]);
        return verts.length - 1;
      });
    });
    const faces = [];
    for (let j = 0; j + 1 < rings.length; j++) {
      const [lo, hi] = [rings[j], rings[j + 1]];
      for (let i = 0; i < sides; i++) {
        const i2 = (i + 1) % sides;
        if (lo.length === 1) faces.push([lo[0], hi[i], hi[i2]]);
        else if (hi.length === 1) faces.push([lo[i], lo[i2], hi[0]]);
        else faces.push([lo[i], lo[i2], hi[i2], hi[i]]);
      }
    }
    if (rings[0].length > 1) faces.push(rings[0]);
    const top = rings[rings.length - 1];
    if (top.length > 1) faces.push(top);
    p.poly3({ verts, faces, mat, bias });
  };

  /** Any floor outline [[x, y], ...] extruded from z up by h. */
  p.prism = ({ ring, z = 0, h, mat, convex = true, bevel = 0, bias = 0, inner = '' }) => {
    const xs = ring.map(([a]) => a);
    const ys = ring.map(([, b]) => b);
    grow(Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys), z, z + h);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    solid(k.extrude(ring, TOP_Z + z, h, P, { convex, bevel }), mat, [cx, cy, z + h / 2], { bias, inner });
  };

  /**
   * A flat piece of cloth or sheet in any plane: `points` are [x, y, z] (z above the tile top), at least three, drawn
   * as one tone chosen by the way it faces the light. It counts as a part (a flag, a pennant, a leaf).
   */
  p.panel = ({ points, mat, bias = 0 }) => {
    const abs = points.map(([x, y, z]) => [x, y, TOP_Z + z]);
    const xs = points.map((q) => q[0]);
    const ys = points.map((q) => q[1]);
    const zs = points.map((q) => q[2]);
    grow(
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
      Math.min(...zs),
      Math.max(...zs),
    );
    let normal = [0, 0, 0];
    abs.forEach((q, i) => {
      const next = abs[(i + 1) % abs.length];
      normal = [
        normal[0] + (q[1] - next[1]) * (q[2] + next[2]),
        normal[1] + (q[2] - next[2]) * (q[0] + next[0]),
        normal[2] + (q[0] - next[0]) * (q[1] + next[1]),
      ];
    });
    normal = G.unit3(normal);
    if (G.dot3(normal, G.viewOf(P)) < 0) normal = G.mul3(normal, -1);
    const d = k.pathOf(
      abs.map((q) => k.iso(q, P)),
      true,
    );
    let top = '';
    const shades = ['', '', '', ''];
    const tone = Math.max(1, G.toneOf(normal, P));
    if (tone >= SHADES) top = d;
    else shades[tone] = d;
    const n = points.length;
    const centre = points.reduce((s, q) => [s[0] + q[0] / n, s[1] + q[1] / n, s[2] + q[2] / n], [0, 0, 0]);
    solid({ fill: d, outline: d, crease: '', top, shades }, mat, centre, { bias });
  };

  /** A polyline of [x, y, z] points drawn as one thin line in a material's line tone. */
  p.line = ({ points, mat, tone = 'hi', closed = false, free, bias = 0 }) => {
    const centre = points[Math.floor(points.length / 2)];
    last = pointBounds(points);
    const d = k.pathOf(
      points.map(([x, y, z]) => k.iso([x, y, TOP_Z + z], P)),
      closed,
    );
    put(centre, `<g class="${use(mat)}">${k.lineSvg(d, { tone, free })}</g>`, bias);
  };

  /** Tiny dots (seeds, studs, eyes) at [x, y, z]; each is a dot of the material's line tone. */
  p.dots = ({ points, mat, size = 0.5, bias = 0 }) => {
    const screen = points.map(([x, y, z]) => k.iso([x, y, TOP_Z + z], P));
    last = pointBounds(points);
    put(points[0], `<g class="${use(mat)}">${k.dotsSvg(screen, { size, tone: 'hi' })}</g>`, bias);
  };

  /** The standalone SVG: drawn items in painter's order, cropped to their own screen bounds, anchor on the ground point. */
  p.finish = (label) => {
    const body = paintOrder(items)
      .map((item) => item.svg)
      .join('');
    const pad = 1.2;
    const box = screenBounds(body);
    const shiftX = Math.round(pad - Math.floor(box.x0));
    const shiftY = Math.round(pad - Math.floor(box.y0));
    const width = Math.ceil(box.x1 - box.x0 + 2 * pad) + 1;
    const height = Math.ceil(box.y1 - box.y0 + 2 * pad) + 1;
    const [ax, ay] = k.iso([0, 0, TOP_Z], P);
    const svg = exportSvg({
      width,
      height,
      label,
      body: `<g transform="translate(${shiftX} ${shiftY})">${body}</g>`,
    });
    const css = ['.iso{--anatomy-weight:.45px}', ...[...mats].sort().map(materialCss)].join('\n');
    return {
      svg: svg.replace('</style>', `${css}\n</style>`),
      width,
      height,
      anchor: { x: ax + shiftX, y: ay + shiftY },
      stats,
    };
  };
  return p;
}

/**
 * A prop kind: `spec` is { kind, regions[], zone, anim, squares?, emit? } and `fn(p)` draws it with the pen `p`.
 * `emit` is a world point [x, y, z above the tile top] where a smoke puff starts.
 */
export function prop(spec, fn) {
  return {
    ...spec,
    draw() {
      const p = pen();
      fn(p);
      return p.finish(spec.kind);
    },
  };
}
