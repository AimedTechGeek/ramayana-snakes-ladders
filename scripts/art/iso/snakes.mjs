// T40.5: the thirteen snakes as low tubes with crossing humps and carved heads (T40 spec 3.3).
// addSnakes(scene, level) puts each snake of a level into the recorded scene: a tapering body along its jumps.mjs
// route (hump z already added), a turned head at the route start, its ring texture, and its villain motif.
// Bodies take the `ink-<id>` class and heads the `hink-<id>` class (spec 7.3).
//
// Deviations from the spec table (also reported in the task notes):
//   heads       the head profile peaks at 1.4 R (spec 1.5 R) and its axis stands 1.4 R above the tile, so the head
//               rests on the tile and tops out at 11.6 for Ravana (R 4); the body rises 0.4 R over its first 14 units.
//   ravana      the crown tiers are 0.6 / 0.5 / 0.4 R (spec 1.1 / 0.9 / 0.7 R) and 0.8 thick, to stay under the 12 cap
//               on a dome; the nine small heads (0.3 scale, not 0.45) stand on the tile around the neck at the
//               spec's angles, each pushed out until it clears the body and its neighbours.
//   motifs      sizes the spec leaves open (collar radii, antler reach, the wheel's ring width) are chosen to match
//               the head; dots and rings that sit on the head are drawn on it, not as separate solids.

import * as A from '../anatomy/audit.mjs';
import * as k from '../anatomy/iso-kit.mjs';
import * as G from '../anatomy/lathe.mjs';
import { jumpPaths, snakeRadiusAt } from './jumps.mjs';
import { upright } from './scene.mjs';
import { TOP_Z } from './world.mjs';

const UP = [0, 0, 1];
const NECK = 14;
const HEAD = [
  [0, 1],
  [3, 1.3, 1],
  [7, 1.4, 1],
  [11, 1.05, 1],
  [14, 0],
];
const ARROW = [
  [0, 1],
  [2, 1.6],
  [9, 0],
];
const RISE = 1.4;
const rad = (deg) => (deg * Math.PI) / 180;
const smooth = (t) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};
const onSphere = (r, tube) => Math.sqrt(r * r - tube * tube);
const { add3, sub3, mul3, unit3, cross3, dot3 } = G;

// ---------------------------------------------------------------- textures (spec 3.3 table)

const bands = (pitch) => ({ pitch, steps: 4, tone: 'lo' });
const diamonds = (twist, pitch = 12) => ({ pitch, twist, cross: true, steps: 4, tone: 'lo' });
const TEXTURE = {
  tataka: bands(6),
  manthara: diamonds(1),
  kaikeyi: 'spots',
  viradha: bands(6),
  shurpanakha: bands(6),
  'golden-deer': 'spots',
  abduction: 'spots',
  kabandha: bands(6),
  'indrajit-arrows': diamonds(0),
  prahasta: bands(5),
  kumbhakarna: bands(8),
  brahmastra: diamonds(2),
  ravana: [diamonds(0), bands(10)],
};

// ---------------------------------------------------------------- the body route

/**
 * The jumps.mjs centreline on the tile (z = TOP_Z + r), with the neck rise (the head stands taller than the body).
 * The crossing humps are not taken from jumps.mjs's z: liftOver below makes them from the real shapes, so heads,
 * ladder tops and stacked crossings are all cleared, and wide enough not to fold on screen.
 */
function bodyRoute(path, rise) {
  const R = path.radius;
  let arc = 0;
  return path.points.map((p, i) => {
    if (i) arc += Math.hypot(p[0] - path.points[i - 1][0], p[1] - path.points[i - 1][1]);
    const lift = (rise - 1) * R * (1 - smooth(arc / NECK));
    return [p[0], p[1], TOP_Z + snakeRadiusAt(R, arc / path.length) + lift];
  });
}

/** What a snake must clear: the recorded shapes of every ladder and earlier snake (drawn before it, so below it). */
function shapesBelow(scene, ids) {
  const below = (shape) => ids.some((id) => (shape.name ?? '').startsWith(`${id}.`));
  return [...scene.R.solids, ...scene.R.tubes]
    .filter(below)
    .map((shape) => ({ shape, bounds: A.boundsOf(shape) }));
}

const CLEAR = 0.5;
// The spec's 12 cap (HARD_CAP) cannot hold where three snakes cross in one place: three layers of tubes of radius 2.1 or
// more stack to more than 12. A body rises only as far as it must to clear what is below; this is the sanity bound.
const CAP = 24;

/**
 * The route lifted wherever its body would sink into something below it (a ladder's top, a snake's head, a body
 * that jumps.mjs found no crossing with): each shortfall becomes a cosine hump, as the spec's crossing humps are,
 * wider for taller ones. Returns the route and the ids of everything the body passes over close enough to need a
 * `touch` entry in the audit (a deliberate crossing).
 */
function liftOver(route, path, below) {
  const R = path.radius;
  const arcs = [0];
  for (let i = 1; i < route.length; i++) arcs.push(arcs[i - 1] + G.len3(sub3(route[i], route[i - 1])));
  const total = arcs[arcs.length - 1];
  // the body next to a collar wears a ring a third wider than itself
  const radiusAt = (i) => snakeRadiusAt(R, arcs[i] / total) * (arcs[i] < 16 ? 1.3 : 1);
  const z = route.map((p) => p[2]);
  const gapOf = (p, r, { shape, bounds }) => {
    for (let a = 0; a < 3; a++)
      if (p[a] < bounds.min[a] - r - 3 || p[a] > bounds.max[a] + r + 3) return Infinity;
    return A.sdf(shape, p) - r;
  };
  for (let pass = 0; pass < 4; pass++) {
    const need = route.map((p, i) =>
      Math.max(0, ...below.map((item) => CLEAR - gapOf([p[0], p[1], z[i]], radiusAt(i), item))),
    );
    if (!need.some((v) => v > 0.01)) break;
    const bumps = need
      .map((v, j) => ({ j, v, half: Math.max(4 * radiusAt(j), 2.6 * v + 8) }))
      .filter(({ v }) => v > 0.01);
    for (let i = 0; i < route.length; i++) {
      let lift = 0;
      for (const { j, v, half } of bumps) {
        const d = Math.abs(arcs[i] - arcs[j]);
        if (d < half) lift = Math.max(lift, v * 0.5 * (1 + Math.cos((Math.PI * d) / half)));
      }
      z[i] += lift;
    }
  }
  const lifted = route.map((p, i) => [
    p[0],
    p[1],
    Math.min(z[i], TOP_Z + CAP - snakeRadiusAt(R, arcs[i] / total)),
  ]);
  const over = new Set();
  let worst = Infinity;
  for (let i = 0; i < route.length; i += 2) {
    for (const item of below) {
      const gap = gapOf(lifted[i], radiusAt(i), item);
      if (gap < 0.5 * radiusAt(i) + 0.4) over.add(item.shape.name.split('.')[0]);
      if (gap < worst) worst = gap;
    }
  }
  return { route: lifted, over: [...over], worst };
}

/** Everything a motif needs about one snake. */
function contextOf(scene, path, route, rise, below) {
  const R = path.radius;
  const total = G.pathLength(route);
  const rLocal = (arc) => snakeRadiusAt(R, arc / total);
  const bodyAt = (arc) => ({ p: G.pointAlong(route, arc), t: G.tangentAlong(route, arc) });
  const sideAt = (arc) => unit3(cross3(bodyAt(arc).t, UP));
  return {
    scene,
    id: path.id,
    path,
    R,
    rise,
    route,
    total,
    rLocal,
    bodyAt,
    sideAt,
    below,
    gaps: [],
    decorators: [],
    touch: [],
  };
}

// ---------------------------------------------------------------- the head

/**
 * A turned head along `axis` (horizontal, pointing away from the body) from `origin`. `scale` shrinks both length
 * and radius (the nine small heads). Returns the frame and the analytic profile for the motifs.
 */
function makeHead(
  ctx,
  { name, origin, axis, scale = 1, length = 1, profile = HEAD, eyes = 'open', extraInner = '', extra = '' },
) {
  const { scene, id, R } = ctx;
  const lift = dot3(axis, UP);
  const up = unit3(sub3(UP, mul3(axis, lift)));
  const side = unit3(cross3(axis, up));
  const F = G.frameOf(origin, axis, up, side);
  const sk = scale * length;
  const world = profile.map(([s, r, soft]) => (soft ? [s * sk, r * R * scale, 1] : [s * sk, r * R * scale]));
  const curve = G.profileCurve(world);
  const radiusAt = (s) => curve.radius(s);
  const surface = (s, deg) => G.pointOf(F, s, radiusAt(s), rad(deg));
  const facing = (s, deg) => G.facingOf(F, rad(deg), scene.P, curve.slope(s));
  const dots = [];
  const lines = [];
  if (eyes !== 'none') {
    for (const deg of [-40, 40]) {
      if (facing(6 * sk, deg) < 0.05) continue;
      if (eyes === 'open') dots.push(scene.at(surface(6 * sk, deg)));
      else
        lines.push(
          G.arcOf(F, 6 * sk, radiusAt(6 * sk), scene.P, {
            slope: curve.slope(6 * sk),
            from: rad(deg - 7),
            to: rad(deg + 7),
            trim: 0,
          }),
        );
    }
  }
  const mouth =
    profile === HEAD
      ? k.lineSvg(G.arcOf(F, 10 * sk, radiusAt(10 * sk), scene.P, { slope: curve.slope(10 * sk) }), {
          tone: 'faint',
        })
      : '';
  const eyeLines = lines.length ? k.lineSvg(lines.join(''), { tone: 'hi' }) : '';
  scene.turned(
    name,
    F,
    world,
    { tone: 'hi', className: `hink-${id}` },
    {
      // the nine small heads are about a pixel across: flat facets, no smooth shading
      smooth: scale < 0.5 ? false : { rows: 1, error: 1.5, fineness: 1.2 },
      steps: scale < 0.5 ? 10 : 16,
      inner: mouth + eyeLines + extraInner,
      extra: (dots.length ? scene.Dots(dots, { size: 0.45, tone: 'hi' }) : '') + extra,
    },
  );
  return { F, side, curve, radiusAt, surface, facing, origin, axis, scale, length: sk };
}

/** The longest head length (a fraction of the profile's) that keeps clear of every ladder and earlier snake. */
function headLength(ctx, origin, axis, profile) {
  for (const length of [1, 0.85, 0.7, 0.55, 0.4]) {
    const curve = G.profileCurve(
      profile.map(([s, r, soft]) => (soft ? [s * length, r * ctx.R, 1] : [s * length, r * ctx.R])),
    );
    let clear = true;
    for (let s = 0; s <= curve.s1 && clear; s += 1) {
      const p = add3(origin, mul3(axis, s));
      // a lower tube must also keep half its radius clear of the head, like any other pass
      clear = ctx.below.every(
        ({ shape }) =>
          A.sdf(shape, p) - curve.radius(s) >
          (shape.kind === 'tube' ? 0.5 * Math.max(...shape.radii) + 0.1 : 0.15),
      );
    }
    if (clear) return length;
  }
  return 0.4;
}

/** The main head at the start of the route, along the body's own heading and as long as the neighbours allow. */
function mainHead(ctx, options = {}) {
  const { route } = ctx;
  const axis = mul3(G.tangentAlong(route, 0), -1);
  const length = headLength(ctx, route[0], axis, options.profile ?? HEAD);
  return makeHead(ctx, { name: `${ctx.id}.head`, origin: route[0], axis, length, ...options });
}

// ---------------------------------------------------------------- shared motif parts

/** A rigid limb tube leaving the surface at `start` and ending on a ball (tangle, antlers, arms). */
function limb(ctx, name, points, radius, dotR) {
  const { scene, id } = ctx;
  const route = points.length > 2 ? G.fillet(points, 1.4, 6) : points;
  const last = route[route.length - 1];
  const dir = unit3(sub3(last, route[route.length - 2]));
  const centre = add3(last, mul3(dir, onSphere(dotR, radius)));
  scene.tube(`${id}.${name}`, route, radius, {
    className: `ink-${id}`,
    maxLength: 20,
    spacing: 2,
    tone: 'hi',
    limp: false,
    ends: [false, true],
    caps: [true, false],
    touch: [`${id}.*`, 'tile.*', 'stand.*'],
  });
  scene.ball(
    `${id}.${name}-dot`,
    centre,
    dotR,
    { tone: 'hi', className: `ink-${id}` },
    { symbol: `${id}.${name}-dot` },
  );
}

/** A collar round the body at `arc` that hides the body under it (the tube is gapped there). */
function collar(ctx, name, arc, thickness, outer, { inner = () => '' } = {}) {
  const { scene, id } = ctx;
  const { p, t } = ctx.bodyAt(arc);
  const r = ctx.rLocal(arc);
  const F = G.frameAlong(p, t);
  ctx.gaps.push([arc - thickness / 2, arc + thickness / 2]);
  scene.band(
    `${id}.${name}`,
    F,
    -thickness / 2,
    thickness / 2,
    r,
    r * outer,
    { tone: 'hi', className: `hink-${id}` },
    { steps: 32, inner: inner(F, r * outer) },
  );
  return F;
}

/** A point on the body's back: arc position, lateral offset (world units) and the surface above it. */
function onBack(ctx, arc, lateral) {
  const { p } = ctx.bodyAt(arc);
  const r = ctx.rLocal(arc);
  const lift = Math.sqrt(Math.max(0, r * r - lateral * lateral));
  return add3(add3(p, mul3(ctx.sideAt(arc), lateral)), mul3(UP, lift));
}

/** Dots .5 every 8 units, alternating sides at 0.5 R from the centreline (the 'spots' texture). */
function spots(ctx) {
  const { scene, R, total } = ctx;
  const arcs = [];
  for (let a = 22; a < total - 6; a += 8) arcs.push(a);
  ctx.decorators.push((piece) => {
    const mine = arcs.map((a, i) => ({ a, i })).filter(({ a }) => a >= piece.from && a < piece.to);
    if (!mine.length) return '';
    const points = mine.map(({ a, i }) =>
      scene.at(onBack(ctx, a, (i % 2 ? 1 : -1) * 0.5 * R * (1 - 0.55 * (a / total)))),
    );
    return scene.Dots(points, { size: 0.5, tone: 'hi' });
  });
}

// ---------------------------------------------------------------- motifs (spec 3.3, one per snake)

const MOTIFS = {
  tataka(ctx, head) {
    // a tangle: five short tubes from the head top, each ending in a dot
    [-30, -15, 0, 15, 30].forEach((deg, i) => {
      const s = (5 + (i % 2) * 1.5) * head.length;
      const start = head.surface(s, deg);
      const out = unit3(sub3(head.surface(s, deg), add3(head.origin, mul3(head.axis, s))));
      const wobble = mul3(head.side, (i - 2) * 0.9);
      const a = add3(start, add3(mul3(out, 3), mul3(UP, 1.6)));
      const b = add3(a, add3(mul3(out, 2), add3(wobble, mul3(head.axis, (i % 2 ? -1 : 1) * 1.2))));
      limb(ctx, 'tangle', [start, a, b], 0.4, 0.6);
    });
  },
  manthara(ctx) {
    // shawl: a collar behind the head with three fold ribs ending on its two faces
    collar(ctx, 'shawl', 6.5, 1.6, 1.3, {
      inner: (F, r) =>
        k.lineSvg(G.ribsOf(F, -0.8, 0.8, r, 3, ctx.scene.P, { seams: true, phase: 0.5 }), { tone: 'faint' }),
    });
  },
  kaikeyi(ctx) {
    // two bangles behind the head, the body gapped under them
    collar(ctx, 'bangle', 4, 1.2, 1.28);
    collar(ctx, 'bangle', 8, 1.2, 1.28);
  },
  viradha(ctx, head) {
    clubBeside(ctx, head);
  },
  shurpanakha(ctx, head) {
    // a nose ring at the snout and three nail marks on the back, each ending on two band rings
    const { scene } = ctx;
    const ring = k.lineSvg(
      G.circleOf(
        G.frameOf(add3(head.origin, mul3(head.axis, 13.4 * head.length)), head.axis, head.F.u, head.side),
        0,
        0.75,
        scene.P,
        20,
      ),
      { tone: 'hi' },
    );
    scene.R.items[scene.R.items.length - 1].svg += ring;
    const a0 = 30;
    const marks = [-0.4, 0, 0.4].map((w) => [onBack(ctx, a0, w * ctx.R), onBack(ctx, a0 + 6, w * ctx.R)]);
    ctx.decorators.push((piece) => {
      if (a0 < piece.from || a0 + 6 > piece.to) return '';
      return k.lineSvg(marks.map(([p, q]) => k.pathOf([scene.at(p), scene.at(q)])).join(''), { tone: 'lo' });
    });
  },
  'golden-deer'(ctx, head) {
    // deer mask: two antler tubes of three points each from the head top, ending in dots
    [-1, 1].forEach((sign) => {
      const start = head.surface(6.5 * head.length, sign * 28);
      const a = add3(start, add3(mul3(head.side, sign * 2), mul3(UP, 3)));
      const b = add3(a, add3(mul3(head.side, sign * 1.5), add3(mul3(UP, 2.5), mul3(head.axis, -1.5))));
      limb(ctx, 'antler', [start, a, b], 0.35, 0.5);
    });
  },
  abduction(ctx, head) {
    // a wooden wheel lying flat beside the head, and three feather slabs along the body
    const { scene, id } = ctx;
    const [x, y] = add3(head.origin, add3(mul3(head.side, 1.4 * ctx.R + 4.6), mul3(head.axis, 4)));
    const spokes = k.lineSvg(G.spokesOf(upright(x, y), TOP_Z, 0.8, 2.4, 6, scene.P), { tone: 'lo' });
    scene.band(
      `${id}.wheel`,
      upright(x, y),
      TOP_Z,
      TOP_Z + 0.6,
      2.4,
      3.0,
      { tone: 'mid', className: `open hink-${id}` },
      { open: true, steps: 28, inner: spokes },
    );
    scene.disc(
      `${id}.hub`,
      upright(x, y),
      TOP_Z,
      TOP_Z + 0.6,
      0.8,
      { tone: 'hi', className: `hink-${id}` },
      { steps: 12 },
    );
    [40, 60, 80].forEach((arc) => {
      const top = onBack(ctx, arc, 0);
      const tangent = ctx.bodyAt(arc).t;
      const across = ctx.sideAt(arc);
      const centre = [top[0], top[1]];
      const angle = Math.atan2(across[1], across[0]);
      const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
      const plan = k
        .roundedPlan({ x: -1.5, y: -0.5, w: 3, d: 1, r: 0.2 }, 1)
        .map(([px, py]) => [centre[0] + px * cos - py * sin, centre[1] + px * sin + py * cos]);
      void tangent;
      scene.prism(`${id}.feather`, plan, top[2], 0.4, { tone: 'hi', className: `hink-${id}` }, {});
    });
  },
  kabandha() {
    // headless: the head is replaced below (see addSnake); the arms leave the sides
  },
  'indrajit-arrows'(ctx) {
    // a two-loop bow-knot at the neck: two small open tori side by side on the back
    const { scene, id } = ctx;
    for (const w of [-1.3, 1.3]) {
      const p = onBack(ctx, 7.5, w);
      scene.band(
        `${id}.loop`,
        upright(p[0], p[1]),
        p[2],
        p[2] + 0.8,
        0.8,
        1.2,
        { tone: 'hi', className: `open hink-${id}` },
        { open: true, steps: 18 },
      );
    }
  },
  prahasta(ctx, head) {
    // helmet crest: a thin slab standing on the head top
    const { scene, id } = ctx;
    const top = add3(
      head.origin,
      add3(mul3(head.axis, 7 * head.length), mul3(UP, head.radiusAt(7 * head.length))),
    );
    const angle = Math.atan2(head.axis[1], head.axis[0]);
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
    const plan = k
      .roundedPlan({ x: -3, y: -0.5, w: 6, d: 1, r: 0.2 }, 1)
      .map(([px, py]) => [top[0] + px * cos - py * sin, top[1] + px * sin + py * cos]);
    scene.prism(`${id}.crest`, plan, top[2] - 0.45, 1.65, { tone: 'hi', className: `hink-${id}` }, {});
  },
  kumbhakarna(ctx, head) {
    // a drum standing beside the head: a cylinder with two band lines
    const { scene, id } = ctx;
    const [x, y] = add3(head.origin, add3(mul3(head.side, -(1.4 * ctx.R + 3.4)), mul3(head.axis, 5)));
    const rings = [0.8, 1.8].map((z) => k.sideArc(x, y, 2, TOP_Z + z, scene.P, 20)).join('');
    scene.cyl(
      `${id}.drum`,
      x,
      y,
      2,
      TOP_Z,
      2.6,
      { tone: 'hi', className: `hink-${id}` },
      { steps: 20, inner: k.lineSvg(rings, { tone: 'faint' }) },
    );
  },
  brahmastra() {
    // the arrowhead is the head itself (see addSnake)
  },
  ravana(ctx, head) {
    ravanaHeads(ctx, head);
  },
};

/** viradha: a club lying beside the head, handle end and head end both resting on the tile. */
function clubBeside(ctx, head) {
  const { scene, id } = ctx;
  const origin = add3(head.origin, add3(mul3(head.side, 1.4 * ctx.R + 2.6), mul3(head.axis, -1)));
  const tilt = Math.asin(1.0 / 10);
  const axis = unit3([head.axis[0] * Math.cos(tilt), head.axis[1] * Math.cos(tilt), Math.sin(tilt)]);
  const F = G.frameAlong([origin[0], origin[1], TOP_Z + 0.8], axis);
  scene.turned(
    `${id}.club`,
    F,
    [
      [0, 0.8],
      [6, 0.8],
      [7, 1.6, 1],
      [10, 1.8, 1],
      [12, 0],
    ],
    { tone: 'hi', className: `hink-${id}` },
    {
      smooth: false,
      steps: 14,
    },
  );
}

/** ravana: nine small heads fanned round the neck at the spec's angles, each pushed out until it clears. */
function ravanaHeads(ctx, head) {
  const { scene, id, R, route } = ctx;
  const scale = 0.3;
  const back = unit3([route[10][0] - route[0][0], route[10][1] - route[0][1], 0]);
  const placed = [];
  const clear = (x, y, margin) => {
    const bodyOk = route.every(
      (q, i) => i % 3 || Math.hypot(q[0] - x, q[1] - y) > snakeRadiusAt(R, i / route.length) + margin,
    );
    const headOk =
      Math.hypot(x - head.origin[0] - head.axis[0] * 7, y - head.origin[1] - head.axis[1] * 7) >
      1.4 * R + margin - 1;
    return (
      bodyOk && headOk && placed.every(([px, py]) => Math.hypot(px - x, py - y) > 2 * 1.4 * R * scale + 1.2)
    );
  };
  [-20, 20, -40, 40, -60, 60, -80, 80, 100].forEach((deg, i) => {
    const dir = unit3([
      back[0] * Math.cos(rad(deg)) - back[1] * Math.sin(rad(deg)),
      back[0] * Math.sin(rad(deg)) + back[1] * Math.cos(rad(deg)),
      0,
    ]);
    let rho = 1.6 * R;
    while (
      !clear(head.origin[0] + dir[0] * rho, head.origin[1] + dir[1] * rho, 1.4 * R * scale + 0.8) &&
      rho < 40
    )
      rho += 0.5;
    const x = head.origin[0] + dir[0] * rho;
    const y = head.origin[1] + dir[1] * rho;
    placed.push([x, y]);
    const z = TOP_Z + RISE * R * scale;
    const small = makeHead(ctx, { name: `${id}.minor`, origin: [x, y, z], axis: dir, scale, eyes: 'open' });
    // a crown: a short filled collar on the head top
    const top = add3(small.origin, add3(mul3(small.axis, 3 * scale), mul3(UP, small.radiusAt(3 * scale))));
    scene.band(
      `${id}.minor-crown`,
      upright(top[0], top[1]),
      top[2] - 0.2,
      top[2] + 0.6,
      0.4,
      0.9,
      { tone: 'hi', className: `hink-${id}` },
      { steps: 14, symbol: `${id}.minor-crown` },
    );
    void i;
  });
  // the main head wears a three-tier crown: stacked discs on its dome
  const top = add3(
    head.origin,
    add3(mul3(head.axis, 6 * head.length), mul3(UP, head.radiusAt(6 * head.length))),
  );
  [0.6, 0.5, 0.4].forEach((f, tier) => {
    const z = top[2] - 0.2 + tier * 0.8;
    scene.band(
      `${id}.crown`,
      upright(top[0], top[1]),
      z,
      z + 0.8,
      0.2 * R * f,
      R * f,
      { tone: 'hi', className: `hink-${id}` },
      { steps: 24 },
    );
  });
}

// ---------------------------------------------------------------- a snake

function addSnake(scene, path, earlier) {
  const id = path.id;
  const headless = id === 'kabandha';
  const arrow = id === 'brahmastra';
  const rise = arrow ? 1.6 : RISE;
  // the body rises over everything below it that jumps.mjs found no crossing with
  const below = shapesBelow(scene, earlier);
  const lifted = liftOver(bodyRoute(path, rise), path, below);
  const route = lifted.route;
  const ctx = contextOf(scene, path, route, rise, below);
  ctx.passes = lifted.worst;
  const texture = TEXTURE[id];
  if (texture === 'spots') spots(ctx);
  const partners = [...new Set([...path.humps.map((h) => h.over), ...lifted.over])].filter((p) => p !== id);
  ctx.touch = [`${id}.*`, 'tile.*', 'stand.*', ...partners.map((p) => `${p}.*`)];
  for (const partner of partners) scene.allowCrowd(`${id}.*`, `${partner}.*`);
  scene.allowCrowd(`${id}.*`, `${id}.*`);
  // head
  let head = null;
  if (headless) {
    kabandhaCap(ctx);
  } else if (arrow) {
    head = mainHead(ctx, { profile: ARROW, eyes: 'none' });
  } else {
    head = mainHead(ctx, { eyes: id === 'kumbhakarna' ? 'closed' : 'open' });
  }
  if (head) MOTIFS[id]?.(ctx, head);
  // body
  scene.tube(`${id}.body`, route, (t) => snakeRadiusAt(path.radius, t), {
    className: `ink-${id}`,
    maxLength: 80,
    spacing: id === 'abduction' ? 3 : path.humps.length || lifted.over.length ? 6 : 9,
    gaps: ctx.gaps,
    breaks: path.breaks,
    rings: typeof texture === 'string' ? undefined : texture,
    decorate: ctx.decorators.length ? (piece) => ctx.decorators.map((fn) => fn(piece)).join('') : undefined,
    tone: 'hi',
    limp: true,
    ends: [true, false],
    touch: ctx.touch,
  });
  // what rides on the body or the head is held by them
  scene.hold(
    ...['head', 'bangle', 'shawl', 'feather', 'loop', 'crest', 'crown', 'minor-crown'].map(
      (part) => `${id}.${part}`,
    ),
  );
  return { partners, worst: lifted.worst, headLength: head?.length };
}

/** kabandha: the head is a stout cap disc with two eye dots on its flat face; the arms leave the sides behind it. */
function kabandhaCap(ctx) {
  const { scene, id, route, path } = ctx;
  const axis = mul3(G.tangentAlong(route, 0), -1);
  const up = unit3(sub3(UP, mul3(axis, dot3(axis, UP))));
  const F = G.frameOf(route[0], axis, up, unit3(cross3(axis, up)));
  const r = 1.4 * path.radius;
  const eyes =
    dot3(axis, scene.V) > 0.05 ? [60, -60].map((deg) => scene.at(G.pointOf(F, 3, 0.35 * r, rad(deg)))) : [];
  scene.disc(
    `${id}.head`,
    F,
    0,
    3,
    r,
    { tone: 'hi', className: `hink-${id}` },
    { steps: 28, extra: eyes.length ? scene.Dots(eyes, { size: 0.45, tone: 'hi' }) : '' },
  );
  kabandhaArms(ctx, F);
}

/** kabandha: two arm tubes leave the sides behind the cap and end in hand balls. */
function kabandhaArms(ctx, cap) {
  [-1, 1].forEach((sign) => {
    const arc = 8;
    const { p } = ctx.bodyAt(arc);
    const side = mul3(ctx.sideAt(arc), sign);
    const r = ctx.rLocal(arc);
    const start = add3(p, mul3(side, r));
    const a = add3(start, add3(mul3(side, 4), mul3(cap.a, 3)));
    const b = add3(a, add3(mul3(side, 3), mul3(cap.a, 3.5)));
    limb(
      ctx,
      'arm',
      [
        [start[0], start[1], TOP_Z + 0.6],
        [a[0], a[1], TOP_Z + 0.6],
        [b[0], b[1], TOP_Z + 0.9],
      ],
      0.6,
      0.9,
    );
  });
}

/**
 * Every snake of a level, shortest first so the longest (Ravana) is drawn last (jumps.mjs order). Returns the ids,
 * the smallest clearance any body keeps over what is below it, and the highest body top above the tiles (the
 * spec's 12 cap is exceeded only where three bodies stack).
 */
export function addSnakes(scene, level) {
  const paths = jumpPaths(level);
  const ids = [];
  let worst = Infinity;
  paths.forEach((path, index) => {
    if (path.kind !== 'snake') return;
    const earlier = paths.slice(0, index).map((p) => p.id);
    worst = Math.min(worst, addSnake(scene, path, earlier).worst);
    ids.push(path.id);
  });
  const peak = Math.max(
    ...scene.R.tubes
      .filter((tube) => tube.name.endsWith('.body'))
      .flatMap((tube) => tube.points.map((p, i) => p[2] - TOP_Z + tube.radii[i])),
  );
  return { ids, worst, peak };
}
