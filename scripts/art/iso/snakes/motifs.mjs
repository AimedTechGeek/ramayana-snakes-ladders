// Head motifs and props beside the coil (T42 spec 5.5), one function per snake. Local frame (right, forward, up); the
// head sprite owns every `head.*` part, the coil sprite every `prop.*` part. Motifs and props follow T30 and 5.6: no hood,
// no halo or disc behind the head, no devotional marks, no fangs. Props stand in the left or right strip of the block.

import * as A from '../../anatomy/audit.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { mixHex } from '../common.mjs';
import { local } from '../figurines/common.mjs';
import { GOLD, PARCHMENT, SAFFRON } from './data.mjs';
import { addPrism, addRing, addTube, addTurned, colourClass } from './parts.mjs';

const WOOD = '#8A5A2B';
const BONE = '#E8D8A8';
const STONE = '#B8A47A';

const { add3: add, sub3: sub, mul3: mul, unit3: unit, cross3: cross, dot3: dot } = G;
const at = (r, f, u = 0) => local([r, f, u]);
const rad = (deg) => (deg * Math.PI) / 180;

// ---------------------------------------------------------------- planning (before the body sweep exists)

/** Gaps in the body route for collars that wrap the neck: [distance of the centre from the route end, half thickness]. */
const WRAPS = {
  shawl: [[12.5, 1.3]],
  bangles: [
    [10.0, 0.55],
    [13.4, 0.55],
  ],
  bowknot: [[12.0, 0.7]],
};

/** Gaps (arc-length spans) the body route needs for this snake's neck collars. */
export function planMotifs(spec, total) {
  return (WRAPS[spec.motif] ?? []).map(([fromEnd, half]) => [total - fromEnd - half, total - fromEnd + half]);
}

// ---------------------------------------------------------------- helpers

/** A ring on the neck at `fromEnd` units before the end of the body route. */
function neckRing(fig, ctx, { name, fromEnd, thick, outer, hex, steps }) {
  const f = ctx.sweep.frameAt(ctx.sweep.total - fromEnd);
  addRing(fig, {
    owner: 'body',
    name: `head.${name}`,
    F: G.frameAlong(f.c, f.T),
    s0: -thick / 2,
    s1: thick / 2,
    rIn: f.r + 0.04,
    rOut: outer(f.r),
    hex,
    steps,
  });
}

/** Surface point/normal/frame of the head at (s, a). */
const onHead = (head, s, a, lift = 0) => head.sweep.surf(s, a, lift);

/** Rectangle polygon centred at local (r, f), w along right, d along forward, turned by `turn` degrees. */
function rect(r, f, w, d, turn = 0) {
  const c = Math.cos(rad(turn));
  const s = Math.sin(rad(turn));
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, y]) => [r + x * c - y * s, f + x * s + y * c]);
}

/** A slab standing on the tile. */
function slab(fig, name, r, f, w, d, h, hex, turn = 0, z0 = 0) {
  addPrism(fig, { name: `prop.${name}`, at: [0, 0], polygon: rect(r, f, w, d, turn), z0, height: h, hex });
}

/** A lathe standing on the tile at local (r, f), axis up. */
function standing(fig, name, r, f, profile, hex, z0 = 0) {
  const F = G.frameOf(at(r, f, z0), [0, 0, 1], local([1, 0, 0]), local([0, 1, 0]));
  addTurned(fig, { name: `prop.${name}`, F, profile, hex });
}

/** A flat ring or disc lying on the tile. */
function flatRing(fig, name, r, f, rIn, rOut, h, hex, z0 = 0) {
  const F = G.frameOf(at(r, f, z0), [0, 0, 1], local([1, 0, 0]), local([0, 1, 0]));
  addRing(fig, { name: `prop.${name}`, F, s0: 0, s1: h, rIn, rOut, hex });
}

/**
 * A lathe lying with its axis along the local level direction `dir`, lowest point on the tile; `from` = distance of the
 * profile origin from (r, f) along the axis; `tilt` raises the end of the axis (radians).
 */
function lying(fig, name, r, f, dir, profile, hex, tilt = 0) {
  const rMax = Math.max(...profile.map((p) => p[1]));
  const axis = unit(local([dir[0] * Math.cos(tilt), dir[1] * Math.cos(tilt), Math.sin(tilt)]));
  addTurned(fig, { name: `prop.${name}`, F: G.frameAlong(at(r, f, rMax), axis), profile, hex });
}

// ---------------------------------------------------------------- motifs on the head and neck

const MOTIFS = {
  none() {},
  sleep() {},
  arrowhead() {},

  /** Tataka: five hair strands, drooping back and to the sides, never up. */
  hair(fig, ctx) {
    const { head } = ctx;
    const strands = [
      [2.4, 0.35],
      [3.0, -0.35],
      [3.8, 0.85],
      [3.6, -0.85],
      [4.4, 0.0],
    ];
    strands.forEach(([s, a], i) => {
      const { p, n, f } = onHead(head, s, a, -0.5);
      const sign = Math.sign(a) || 1;
      const back = mul(head.D, -1);
      const p1 = add(add(p, mul(n, 0.9)), mul(back, 0.9));
      const p2 = add(add(add(p1, mul(back, 1.0)), mul(f.e, sign * 0.6)), mul(f.v, 0.8));
      const p3 = add(add(add(p2, mul(back, 0.5)), mul(f.e, sign * 0.5)), mul(f.v, 1.1));
      addTube(fig, {
        name: `head.hair${i}`,
        route: [p, add(p, mul(n, 0.3)), p1, p2, p3],
        radius: (u) => 0.42 * (1 - 0.4 * u),
        hex: '#3A2415',
        sprite: 'head',
      });
    });
  },

  /** Manthara: a shawl collar on the neck below the head with three fold ribs. */
  shawl(fig, ctx) {
    const outer = 1.3 * ctx.spec.R;
    neckRing(fig, ctx, { name: 'shawl', fromEnd: 12.5, thick: 2.2, outer: () => outer, hex: PARCHMENT });
    const hex = mixHex(PARCHMENT, '#2A1A0F', 0.2);
    [-0.75, 0, 0.75].forEach((dz, i) => {
      const f = ctx.sweep.frameAt(ctx.sweep.total - 12.5 + dz);
      addRing(fig, {
        owner: 'body',
        name: `head.shawl-rib${i}`,
        F: G.frameAlong(f.c, f.T),
        s0: -0.17,
        s1: 0.17,
        rIn: outer - 0.1,
        rOut: outer + 0.12,
        hex,
      });
    });
  },

  /** Kaikeyi: two gold bangles on the neck. */
  bangles(fig, ctx) {
    [10.0, 13.4].forEach((fromEnd, i) =>
      neckRing(fig, ctx, { name: `bangle${i}`, fromEnd, thick: 1.1, outer: (r) => r * 1.18 + 0.1, hex: GOLD }),
    );
  },

  /** Shurpanakha: a gold nose ring at the snout, seen face-on. */
  nosering(fig, ctx) {
    const { head } = ctx;
    const side = dot(head.sweep.frameAt(7).e, head.sweep.V) >= 0 ? 1 : -1;
    const { p, f } = onHead(head, 12.9, side * 0.2, 0.05);
    const centre = add(p, mul(f.v, 0.5));
    addRing(fig, {
      owner: 'body',
      name: 'head.nosering',
      F: G.frameAlong(centre, mul(f.e, side)),
      s0: -0.14,
      s1: 0.14,
      rIn: 0.5,
      rOut: 0.85,
      hex: GOLD,
    });
  },

  /** Golden deer: two antlers with three points each, a blood band at the edge of the mask. */
  antlers(fig, ctx) {
    const { head } = ctx;
    for (const sign of [1, -1]) {
      const { p, n, f } = onHead(head, 4.8, sign * 0.5, -0.9);
      const out = mul(f.e, sign);
      const back = mul(head.D, -1);
      const p1 = add(add(p, mul(n, 1.5)), mul(out, 0.5));
      const p2 = add(add(add(p1, mul(n, 1.3)), mul(out, 0.9)), mul(back, 0.3));
      const tip = add(add(p2, mul(n, 0.9)), mul(out, 0.5));
      const common = { hex: BONE, sprite: 'head' };
      addTube(fig, { ...common, name: `head.antler${sign}`, route: [p, p1, p2, tip], radius: (u) => 0.6 * (1 - 0.4 * u) });
      const tine = (from, up, fwd, label, r) =>
        addTube(fig, {
          ...common,
          name: `head.tine${sign}${label}`,
          route: [add(from, mul(n, 0.2)), add(add(from, mul(n, up * 0.6)), mul(head.D, fwd * 0.6)), add(add(from, mul(n, up)), mul(head.D, fwd))],
          radius: (u) => r * (1 - 0.5 * u),
        });
      tine(p1, 1.4, 1.1, 'a', 0.45);
      tine(p2, 1.2, 1.0, 'b', 0.42);
    }
    const f = head.sweep.frameAt(5.6);
    const r = head.sweep.radiusAt(5.6 / 14);
    addRing(fig, { owner: 'body', name: 'head.maskband', F: G.frameAlong(f.c, f.T), s0: -0.4, s1: 0.4, rIn: r - 0.05, rOut: r + 0.2, hex: '#8E3B3B' });
  },

  /** Indrajit: a two-loop bow-knot at the neck (the serpent-noose), still one body. */
  bowknot(fig, ctx) {
    const { sweep, head } = ctx;
    const f = sweep.frameAt(sweep.total - 12.0);
    addRing(fig, { owner: 'body', name: 'head.knot', F: G.frameAlong(f.c, f.T), s0: -0.7, s1: 0.7, rIn: f.r + 0.04, rOut: f.r + 0.5, hex: '#8A91E8' });
    const toward = head.sweep.V;
    for (const sign of [1, -1]) {
      const lateral = mul(unit(cross(f.T, toward)), sign);
      const centre = add(add(f.c, mul(lateral, f.r + 1.2)), mul(toward, 0.2));
      addRing(fig, { owner: 'body', name: `head.loop${sign}`, F: G.frameAlong(centre, toward), s0: -0.25, s1: 0.25, rIn: 0.8, rOut: 1.25, hex: '#C9CCFF' });
    }
  },

  /** Prahasta: a helmet crest, a thin fin along the head's axis (never a disc). */
  crest(fig, ctx) {
    const { head } = ctx;
    const dorsal = unit(head.dorsal);
    const base = head.sweep.frameAt(7);
    const origin = add(base.c, mul(dorsal, base.r - 1.3));
    const F = G.frameOf(origin, dorsal, unit(head.D), unit(cross(dorsal, head.D)));
    const polygon = [
      [-3.2, -0.5],
      [3.2, -0.5],
      [3.2, 0.5],
      [-3.2, 0.5],
    ];
    const paths = G.prismOf(F, polygon, 0, 2.5, fig.P);
    const shape = fig.R.solid(A.prism(F, polygon, 0, 2.5, { name: 'head.crest.shape', owner: 'body' }));
    fig.put('body', 'head.crest', add(origin, mul(dorsal, 1.2)), k.solidSvg(paths, { tone: 'hi', className: colourClass(fig, GOLD) }), { shapes: [shape] });
  },

  /** Ravana: one head wearing a rakshasa crown of three angular tiers with horn-like finials. */
  crown(fig, ctx) {
    const { head, spec } = ctx;
    const R = spec.R;
    const base = onHead(head, 5.8, 0, -1.3);
    const axis = unit(base.n);
    [
      [0.8 * R, 0.5],
      [0.68 * R, 0.45],
      [0.56 * R, 0.4],
    ].forEach(([rOut, wall], i) => {
      const F = G.frameAlong(add(base.p, mul(axis, i * 0.7)), axis);
      addRing(fig, { owner: 'body', name: `head.crown${i}`, F, s0: 0, s1: 0.7, rIn: rOut - wall, rOut, hex: GOLD, steps: 8 });
    });
    const topO = add(base.p, mul(axis, 2.1));
    for (const sign of [1, -1]) {
      const side = mul(base.f.e, sign);
      const lean = unit(add(axis, mul(side, 0.45)));
      addTurned(fig, {
        owner: 'body',
        name: `head.horn${sign}`,
        F: G.frameAlong(add(topO, mul(side, 0.56 * R - 0.5)), lean),
        profile: [
          [0, 0.55],
          [0.8, 0.4],
          [1.6, 0.14],
          [1.9, 0],
        ],
        hex: mixHex(GOLD, '#FFFFFF', 0.1),
      });
    }
  },

  /** Kabandha: no head; the neck ends in a stout cap, arms out to the sides ending in hands. */
  headless(fig, ctx) {
    const { sweep, spec } = ctx;
    const f = sweep.frameAt(sweep.total - 7.5);
    for (const sign of [1, -1]) {
      const out = mul(f.e, sign);
      const p0 = add(f.c, mul(out, f.r - 0.3));
      const p1 = add(add(p0, mul(out, 3.2)), mul(f.v, 0.2));
      const p2 = add(add(p1, mul(out, 2.6)), mul(f.v, 2.4));
      addTube(fig, { name: `head.arm${sign}`, route: [p0, p1, p2], radius: 0.6, hex: spec.body, sprite: 'head' });
      fig.ball('body', `head.hand${sign}`, add(p2, mul(unit(sub(p2, p1)), 0.8)), 0.9, {
        className: colourClass(fig, mixHex(spec.body, '#FFFFFF', 0.12)),
      });
    }
  },
};

export function addMotifs(fig, ctx) {
  (MOTIFS[ctx.spec.motif] ?? MOTIFS.none)(fig, ctx);
}

// ---------------------------------------------------------------- props beside the coil

const PROPS = {
  none() {},

  stump(fig) {
    standing(fig, 'stump', -17, 7, [[0, 2.6], [0.6, 2.9], [1.8, 2.3], [3.2, 2.0], [3.6, 1.75]], WOOD);
    standing(fig, 'stump-top', -17, 7, [[3.6, 1.7], [3.9, 1.7]], '#C9A06A');
  },

  scroll(fig) {
    lying(fig, 'scroll', 15, 7, [0.5, 0.87], [[0, 0.8], [4, 0.8]], PARCHMENT);
  },

  window(fig) {
    slab(fig, 'window-wall', 19, -4, 1.0, 8, 10, STONE);
    slab(fig, 'window-pane', 19.65, -4, 0.35, 5.2, 6.6, '#2E3A5C', 0, 2.2);
    slab(fig, 'window-curtain', 20.0, -2.6, 0.3, 2.4, 6.6, '#8E3B3B', 0, 2.2);
  },

  club(fig) {
    lying(fig, 'club', 17, -3, [0.3, 0.95], [[0, 0.85], [8.5, 0.95], [9.6, 1.9], [11.0, 2.2], [12, 1.7]], WOOD, 0);
  },

  nails(fig) {
    [[16, 8, 12], [18.2, 4.8, 25], [14.5, 11, 0]].forEach(([r, f, turn], i) => slab(fig, `nail${i}`, r, f, 0.5, 2.0, 0.4, SAFFRON, turn));
  },

  wheel(fig) {
    const [cr, cf] = [18, 4];
    // a cart wheel lying flat: an ochre rim plate, eight dark thick spokes (four diameters) over it, a raised hub
    standing(fig, 'wheel-rim', cr, cf, [[0, 3.6], [0.9, 3.6]], '#D9A25A');
    for (let i = 0; i < 4; i++) {
      const a = rad(i * 45);
      const poly = [[-2.9, -0.5], [2.9, -0.5], [2.9, 0.5], [-2.9, 0.5]].map(([x, y]) => [
        cr + x * Math.cos(a) - y * Math.sin(a),
        cf + x * Math.sin(a) + y * Math.cos(a),
      ]);
      addPrism(fig, { name: `prop.wheel-spoke${i}`, at: [0, 0], polygon: poly, z0: 0.9, height: 0.35, hex: '#6B4423' });
    }
    standing(fig, 'wheel-hub', cr, cf, [[1.25, 1.2], [2.0, 1.2]], '#8A5A2B');
    [[14.5, 11.5, 20], [17, 12.5, -15], [19.5, 11, 35]].forEach(([r, f, turn], i) => slab(fig, `feather${i}`, r, f, 3, 1, 0.4, PARCHMENT, turn));
  },

  arrows(fig) {
    [[-16, 4, 0], [-18, -3, 40], [-14, 9, -30]].forEach(([r, f, turn], i) => {
      const lean = 0.3;
      const axis = unit(local([Math.cos(rad(turn)) * Math.sin(lean), Math.sin(rad(turn)) * Math.sin(lean), Math.cos(lean)]));
      const o = at(r, f, 0.2);
      addTurned(fig, { name: `prop.arrow${i}`, F: G.frameAlong(o, axis), profile: [[0, 0.3], [9, 0.3]], hex: WOOD });
      addTurned(fig, {
        name: `prop.fletch${i}`,
        F: G.frameAlong(add(o, mul(axis, 7.2)), axis),
        profile: [[0, 0.3], [0.2, 0.7], [1.6, 0.7], [1.8, 0.3]],
        hex: PARCHMENT,
      });
    });
  },

  shield(fig) {
    const normal = unit(local([-0.45, 0.35, 0.82]));
    const F = G.frameAlong(at(-16, 5, 1.8), normal);
    addTurned(fig, { name: 'prop.shield', F, profile: [[0, 3.0], [0.5, 3.0]], hex: '#9A9CA3' });
    addTurned(fig, { name: 'prop.shield-boss', F, profile: [[0.5, 1.0], [1.1, 0.9], [1.4, 0.5]], hex: GOLD });
  },

  drum(fig) {
    standing(fig, 'drum', 17, 5, [[0, 2.4], [3, 2.4]], WOOD);
    standing(fig, 'drum-skin', 17, 5, [[3, 2.25], [3.15, 2.25]], PARCHMENT);
    for (const z of [0.7, 2.1]) flatRing(fig, `drum-band${z}`, 17, 5, 2.35, 2.6, 0.3, '#8E3B3B', z);
  },

  banner(fig) {
    const lean = 0.42;
    const dir = [0.35, 0.94];
    const pole = unit(local([dir[0] * Math.sin(lean), dir[1] * Math.sin(lean), Math.cos(lean)]));
    const base = at(18, -2, 0.02);
    addTurned(fig, { name: 'prop.pole', F: G.frameAlong(base, pole), profile: [[0, 0.55], [18, 0.5]], hex: WOOD });
    const top = add(base, mul(pole, 17.2));
    const along = unit(local([dir[1], -dir[0], 0]));
    const F = G.frameOf(add(top, mul(along, 0.1)), unit(cross(along, pole)), along, pole);
    const flag = (name, poly, z0, h, hex) => {
      const f = G.frameOf(add(F.o, mul(F.a, z0)), F.a, F.u, F.v);
      const paths = G.prismOf(f, poly, 0, h, fig.P);
      const shape = fig.R.solid(A.prism(f, poly, 0, h, { name: `${name}.shape`, owner: 'prop' }));
      fig.put('prop', name, add(f.o, mul(f.u, poly[0][0])), k.solidSvg(paths, { tone: 'hi', className: colourClass(fig, hex) }), { shapes: [shape] });
    };
    flag('prop.pennant', [[0, 0], [7.5, -0.4], [6.2, -1.8], [7.4, -3.2], [5.6, -4.6], [0, -5.2]], 0, 0.35, '#8E3B3B');
    for (let i = 0; i < 10; i++) {
      const u = 0.55 + i * 0.62;
      flag(`prop.crownmark${i}`, [[u, -1.0], [u + 0.46, -1.0], [u + 0.23, -1.9]], 0.35, 0.12, GOLD);
    }
    lying(fig, 'mace', -17, 9, [0.5, 0.86], [[0, 0.5], [9, 0.5], [9, 1.2], [10.2, 2.1], [12, 2.3], [13.6, 1.6], [14.4, 0.4]], '#4A4F5C');
  },
};

export function addProps(fig, ctx) {
  (PROPS[ctx.spec.prop] ?? PROPS.none)(fig, ctx);
}
