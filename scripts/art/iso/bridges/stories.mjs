// Parapets, ornaments, flora and the numeral stele of each bridge (spec 6.2 numeral, 6.3 story identity). Every ornament
// is a small real part standing on another part: prisms in the plane of the route, turned lathe parts, spheres and
// straight rods (cylinders) that end on posts. Nothing floats and nothing is a line drawn in the air.
import { mixHex, NUMERAL_STROKES } from '../common.mjs';
import { TOP_Z } from '../world.mjs';
import { BLOOD, GOLD, hashUnit, MOSS, mat, PAPER, SAFFRON, TEAK } from './materials.mjs';

const lerp = (a, b, t) => a + (b - a) * t;
const INK = '#2A1A0F';
const BONE = '#F3E3B8';
const LEAF = '#4C8C3F';
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm3 = (a) => Math.hypot(a[0], a[1], a[2]);

/** Squares whose block carries the light numeral ink (spec section 2: ganga, sea and lanka regions). */
export const isBoneSquare = (square) => [49, 50, 71, 72, 73, 74].includes(square) || square >= 109;

export function addStory(c) {
  const { id, geo, story, R, P, k, G, A, put, putFloor, world, faceLine, chunks, bounds, deckV, stone } = c;
  const kind = story.rail;
  // Rods, balls and ornaments belong to the rail assembly with the posts they hang on, so their contacts are not sinks.
  const owner = 'rail';
  const part = (name) => c.parts.add(name.replace(/[#:.].*$/, ''));

  // ---------------------------------------------------------------- part helpers
  /** Route point at arc s shifted `t` across (left positive) and `h` above the deck top. */
  const edge = (s, t, h) => {
    const p = geo.sample(Math.min(geo.Lp, Math.max(0, s)));
    return [p.x - p.dy * t, p.y + p.dx * t, TOP_Z + (s < 0 || s > geo.Lp ? 3 : deckV(s)) + h];
  };

  function ball(name, centre, r, cls, extra = {}) {
    const label = R.nameFor(name);
    const shape = R.solid(A.ball(centre, r, { name: `${label}.shape`, owner, ...extra }));
    R.put({
      piece: owner,
      at: centre,
      bias: 0,
      svg: k.solidSvg(G.sphereOf(centre, r, P), { tone: 'hi', className: cls }),
      shapes: [shape],
      name: label,
      centre,
    });
    part(name);
  }

  /** A straight rod from a to b. `rings` draws a pitch of ring lines (rope, bark). */
  function rod(name, a, b, r, cls, { rings = 0, ground = false } = {}) {
    const length = norm3(sub3(b, a));
    if (length < 0.2) return;
    const F = G.frameAlong(a, G.unit3(sub3(b, a)));
    const paths = G.disc(0, length, r, F, P, { steps: 14 });
    let inner = '';
    if (rings) {
      let d = '';
      for (let s = rings / 2; s < length - 0.2; s += rings) d += G.arcOf(F, s, r, P, { steps: 10 });
      inner = k.lineSvg(d, { tone: 'faint' });
    }
    const label = R.nameFor(name);
    const shape = R.solid(
      A.disc(F, 0, length, r, { name: `${label}.shape`, owner, ...(ground ? { ground: true } : {}) }),
    );
    const centre = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    R.put({
      piece: owner,
      at: centre,
      bias: 0,
      svg: k.solidSvg(paths, { tone: 'hi', className: cls, inner }),
      shapes: [shape],
      name: label,
      centre,
    });
    part(name);
  }

  /** A turned part standing on `base` with its axis along `axis` (profile [s, r] pairs). */
  function turned(name, base, profile, cls, axis = [0, 0, 1], { inner = '', ground = false } = {}) {
    const F = G.frameAlong(base, axis);
    const paths = G.solidOf(profile, F, P, { steps: 20 });
    const label = R.nameFor(name);
    const shape = R.solid(
      A.solid(F, profile, { name: `${label}.shape`, owner, ...(ground ? { ground: true } : {}) }),
    );
    const top = profile[profile.length - 1][0] / 2;
    const centre = [base[0] + axis[0] * top, base[1] + axis[1] * top, base[2] + axis[2] * top];
    R.put({
      piece: owner,
      at: centre,
      bias: 0,
      svg: k.solidSvg(paths, { tone: 'hi', className: cls, inner }),
      shapes: [shape],
      name: label,
      centre,
    });
    part(name);
  }

  /** A point on the abutment top: lateral t, along u, relative to the block's own frame. */
  const onFoot = (t, u, h = 0) => world(c.footFrame, t, u, 3 + h);
  const onTop = (t, u, h = 0) => world(c.topFrame, t, u, 3 + h);

  // ---------------------------------------------------------------- posts
  const count = Math.max(1, Math.round(geo.Lp / 16));
  const postBounds = [];
  for (let q = 0; q <= count; q++) {
    const target = (geo.Lp * q) / count;
    let best = 0;
    bounds.forEach((s, i) => {
      if (Math.abs(s - target) < Math.abs(bounds[best] - target)) best = i;
    });
    if (!postBounds.includes(best)) postBounds.push(best);
  }
  const noPosts = kind === 'blocks';
  const pillar = kind === 'pillar';
  const postHalf = pillar ? 1.6 : 1;
  const postHeight = pillar ? 6 : 4;
  const vAt = (s) => (s < 0 || s > geo.Lp ? 3 : deckV(s));
  const posts = [];
  const postAt = new Set(noPosts ? [] : postBounds);
  for (const i of noPosts ? [] : postBounds) {
    const s = bounds[i];
    const p = geo.sample(s);
    const F = c.frameAlong([p.x, p.y, TOP_Z], p.dx, p.dy);
    const bl = vAt(s - postHalf);
    const br = vAt(s + postHalf);
    const top = Math.max(bl, br) + postHeight;
    const cls = kind === 'timber' ? c.tone(`post${i}`, TEAK, 0.8) : c.dressed(`post${i}`);
    const end = i === 0 || i === bounds.length - 1;
    for (const side of [-1, 1]) {
      const t0 = side > 0 ? (pillar ? 4.6 : 5.3) : -7.1;
      const t1 = side > 0 ? 7.1 : pillar ? -4.6 : -5.3;
      const poly = [
        [-postHalf, bl],
        [postHalf, br],
        [postHalf, top],
        [-postHalf, top],
      ];
      const bands =
        kind === 'timber'
          ? []
          : [
              [-postHalf, top - 1.1],
              [postHalf, top - 1.1],
            ];
      put('rail', `post.${i}.${side}`, F, poly, t0, t1, {
        mat: cls,
        inner: bands.length ? faceLine(F, t0, t1, bands, 'faint') : '',
      });
      const cap = [
        [-postHalf - 0.4, top],
        [postHalf + 0.4, top],
        [postHalf + 0.4, top + 0.6],
        [-postHalf - 0.4, top + 0.6],
      ];
      put('rail', `postcap.${i}.${side}`, F, cap, t0 - 0.4, t1 + 0.4, { mat: c.dressed(`cap${i}.${side}`) });
      const tm = (t0 + t1) / 2;
      const finial = world(F, tm, 0, top + 0.6 + 0.8);
      ball(
        `finial.${i}.${side}`,
        finial,
        0.8,
        mat(kind === 'timber' ? GOLD : mixHex(stone, '#FFFFFF', 0.25)),
      );
      posts.push({ i, s, side, top: top + 0.6, F, tm, end, finial });
    }
  }

  // ---------------------------------------------------------------- rails: stone kerbs or timber rails between the posts
  const lowKerb = kind !== 'timber';
  for (const ch of chunks) {
    const { F, length, topV } = ch;
    const trimA = postAt.has(ch.i) ? postHalf : 0;
    const trimB = postAt.has(ch.i + 1) ? postHalf : 0;
    const u0 = trimA;
    const u1 = length - trimB;
    if (u1 - u0 < 0.8) continue;
    const rise = kind === 'blocks' ? 2.2 : lowKerb ? 1.4 : 2.5;
    // Rama Setu's low blocks stand on the bed beside the stepping slabs; every other rail stands on the deck.
    const base = (u) => (kind === 'blocks' ? Math.max(topV(u) - 1.3, 3) : topV(u));
    for (const side of [-1, 1]) {
      const t0 = kind === 'blocks' ? (side > 0 ? 5.5 : -6.6) : side > 0 ? 6 : -7;
      const t1 = kind === 'blocks' ? (side > 0 ? 6.6 : -5.5) : side > 0 ? 7 : -6;
      const poly = [
        [u0, base(u0)],
        [u1, base(u1)],
        [u1, topV(u1) + rise],
        [u0, topV(u0) + rise],
      ];
      let inner = faceLine(
        F,
        t0,
        t1,
        [
          [u0, topV(u0) + 0.7],
          [u1, topV(u1) + 0.7],
        ],
        'faint',
      );
      if (kind === 'timber')
        inner = [0.8, 1.7]
          .map((dv) =>
            faceLine(
              F,
              t0,
              t1,
              [
                [u0, topV(u0) + dv],
                [u1, topV(u1) + dv],
              ],
              'faint',
            ),
          )
          .join('');
      if (kind === 'pillar' || kind === 'blocks') {
        const mid = (u0 + u1) / 2;
        const vm = (topV(u0) + topV(u1)) / 2 + rise / 2;
        const ring = (r) =>
          Array.from({ length: 17 }, (_, q) => [
            mid + Math.cos((q / 16) * 6.2832) * r,
            vm + Math.sin((q / 16) * 6.2832) * r * 0.8,
          ]);
        if (kind === 'pillar')
          inner += faceLine(F, t0, t1, ring(0.8), 'lo', true) + faceLine(F, t0, t1, ring(0.4), 'lo', true);
        if (kind === 'blocks')
          inner += [3.2, 6.4]
            .map((du) =>
              u0 + du < u1 - 0.6
                ? faceLine(
                    F,
                    t0,
                    t1,
                    [
                      [u0 + du, topV(u0 + du)],
                      [u0 + du, topV(u0 + du) + rise],
                    ],
                    'faint',
                  )
                : '',
            )
            .join('');
      }
      const cls =
        kind === 'timber' ? c.tone(`rail${ch.i}.${side}`, TEAK, 0.7) : c.dressed(`rail${ch.i}.${side}`);
      put('rail', `rail.${ch.i}.${side}`, F, poly, t0, t1, { mat: cls, inner });
    }
  }

  // ---------------------------------------------------------------- Rama Setu: stepping slabs 16 x 11 with 2-unit gaps
  if (kind === 'blocks') {
    let first = true;
    for (let sa = 1; sa + 16 <= geo.Lp - 0.5; sa += 18) {
      const sb = sa + 16;
      const pieces = [sa, ...geo.bandCuts.filter((s) => s > sa + 0.4 && s < sb - 0.4), sb];
      for (let q = 0; q + 1 < pieces.length; q++) {
        const { F, length } = c.chordFrame(pieces[q], pieces[q + 1]);
        const t0 = deckV(pieces[q]);
        const t1 = deckV(pieces[q + 1]);
        const topV = (u) => lerp(t0, t1, u / length);
        const b0 = Math.max(t0 - 1.3, 3);
        const b1 = Math.max(t1 - 1.3, 3);
        let inner = '';
        if (length > 5) {
          // The inscribed name: a hi ring r .8 on every slab, in the piece that holds the slab's middle.
          const mid = length / 2;
          const ring = Array.from({ length: 25 }, (_, n) =>
            k.iso(
              world(
                F,
                Math.cos((n / 24) * 6.2832) * 0.8,
                mid + Math.sin((n / 24) * 6.2832) * 0.8,
                topV(mid + Math.sin((n / 24) * 6.2832) * 0.8),
              ),
              P,
            ),
          );
          inner = k.lineSvg(k.pathOf(ring, true), { tone: 'hi' });
        }
        put(
          'deck',
          `slab.${sa}.${q}`,
          F,
          [
            [0, b0],
            [length, b1],
            [length, t1],
            [0, t0],
          ],
          -5.5,
          5.5,
          { mat: c.tone(`slab${sa}`, stone, 1), inner },
        );
        if (first && q === 0) {
          for (const dt of [-1.3, 1.3])
            ball(`print.${dt}`, world(F, dt, length / 2, topV(length / 2) + 0.3), 0.4, mat('#3A2A1A'));
          first = false;
        }
      }
    }
  }

  // ---------------------------------------------------------------- story rails (rods between the posts)
  const spans = [];
  for (let q = 0; q + 1 < postBounds.length; q++)
    spans.push([bounds[postBounds[q]], bounds[postBounds[q + 1]]]);
  const sides = [-1, 1];
  const rodHex = story.railHex;
  const railTone = (name) => c.tone(name, rodHex, 0.5);
  const tRail = (side) => side * 6.2;

  if (kind === 'timber') {
    // Cord collars on every post and a bowstring tied across the last two posts (spec 6.3).
    for (const p of posts) {
      for (const dv of [0.6, 1.9]) {
        const half = postHalf + 0.28;
        const poly = [
          [-half, p.top - 0.6 - dv - 0.35],
          [half, p.top - 0.6 - dv - 0.35],
          [half, p.top - 0.6 - dv],
          [-half, p.top - 0.6 - dv],
        ];
        const t0 = (p.side > 0 ? 5.3 : -7.1) - 0.25;
        const t1 = (p.side > 0 ? 7.1 : -5.3) + 0.25;
        put('rail', `cord.${p.i}.${p.side}.${dv}`, p.F, poly, t0, t1, { mat: mat('#D9C79C') });
      }
    }
  }
  if (kind === 'bow') {
    for (const side of sides) {
      const point = (s) => edge(s, side * (8.3 + 5 * Math.sin((Math.PI * s) / geo.Lp)), 3.4);
      const joints = [...postBounds.map((i) => bounds[i])];
      for (let q = 0; q + 1 < joints.length; q++) {
        const mid = (joints[q] + joints[q + 1]) / 2;
        rod(`bow.${side}.${q}.a`, point(joints[q]), point(mid), 0.9, railTone('bow'));
        rod(`bow.${side}.${q}.b`, point(mid), point(joints[q + 1]), 0.9, railTone('bow'));
        ball(`bowjoint.${side}.${q}`, point(mid), 1.15, railTone('bowjoint'));
      }
      joints.forEach((s, q) => {
        ball(`bowend.${side}.${q}`, point(s), 1.15, railTone('bowend'));
        // The string: a thin rod from the post top out to the limb.
        const post = posts.find((p) => p.s === s && p.side === side);
        if (post)
          rod(
            `bowstring.${side}.${q}`,
            [post.finial[0], post.finial[1], post.finial[2] - 0.2],
            point(s),
            0.25,
            mat(BONE),
          );
      });
    }
  }
  if (kind === 'garland') {
    for (const [a, b] of spans) {
      for (const side of sides) {
        const pts = [0, 1, 2, 3, 4].map((q) => {
          const s = lerp(a + postHalf, b - postHalf, q / 4);
          return edge(s, tRail(side), 3.2 - 1.6 * Math.sin((Math.PI * q) / 4));
        });
        for (let q = 0; q < 4; q++) rod(`swag.${side}.${q}`, pts[q], pts[q + 1], 0.5, mat(SAFFRON));
        pts.forEach((p, q) =>
          ball(
            `marigold.${side}.${q}`,
            [p[0], p[1], p[2]],
            q % 2 ? 0.65 : 0.55,
            mat(q % 2 ? '#F8C34A' : '#E4572E'),
          ),
        );
      }
    }
  }
  if (kind === 'oar') {
    for (const [a, b] of spans) {
      for (const side of sides)
        rod(
          `oar.${side}`,
          edge(a + postHalf, tRail(side), 2.6),
          edge(b - postHalf, tRail(side), 2.6),
          0.8,
          mat(TEAK),
        );
    }
    // Paddle blades hang on the first span, outside the rail; rope ties lie across the deck.
    const [a0, b0] = spans[0];
    for (const side of sides) {
      const mid = (a0 + b0) / 2;
      const p = geo.sample(mid);
      const F = c.frameAlong([p.x, p.y, TOP_Z], p.dx, p.dy);
      const v = deckV(mid) + 2.6;
      const t0 = side > 0 ? 7.0 : -8.4;
      put(
        owner,
        `blade.${side}`,
        F,
        [
          [-3, v - 1.5],
          [3, v - 1.5],
          [3, v + 1.5],
          [-3, v + 1.5],
        ],
        t0,
        t0 + 1.4,
        { mat: mat(TEAK) },
      );
    }
    posts
      .filter((p) => p.side > 0 && !p.end)
      .forEach((p) => {
        rod(`tie.${p.i}`, edge(p.s, -5.3, 0.45), edge(p.s, 5.3, 0.45), 0.35, mat('#C7B793'));
      });
  }
  if (kind === 'vine') {
    for (const [a, b] of spans) {
      for (const side of sides) {
        const pts = [0, 1, 2, 3, 4, 5].map((q) => {
          const s = lerp(a + postHalf, b - postHalf, q / 5);
          return edge(s, tRail(side) + Math.sin(q * 1.7 + a) * 0.5, 3.1 + Math.sin(q * 2.3 + b) * 0.7);
        });
        for (let q = 0; q < 5; q++) rod(`vine.${side}.${q}`, pts[q], pts[q + 1], 0.6, mat(LEAF));
        pts.forEach((p, q) => {
          if (hashUnit(`${id}:berry${a}.${side}.${q}`) > -0.1)
            ball(`berry.${side}.${q}`, [p[0], p[1], p[2] + 0.55], 0.5, mat(BLOOD));
        });
      }
    }
  }
  if (kind === 'rope') {
    for (const [a, b] of spans) {
      for (const side of sides) {
        rod(
          `rope.${side}`,
          edge(a + postHalf, tRail(side), 2.6),
          edge(b - postHalf, tRail(side), 2.6),
          0.65,
          mat(rodHex),
          { rings: 1.1 },
        );
      }
    }
    for (const p of posts) {
      const a = edge(p.s - postHalf - 0.9, tRail(p.side), 2.6);
      const b = edge(p.s - postHalf, tRail(p.side), 2.6);
      rod(`fur.${p.i}.${p.side}`, a, b, 1.15, mat('#B07A45'), { rings: 0.5 });
    }
  }
  if (kind === 'wave') {
    for (const [a, b] of spans) {
      const n = Math.max(2, Math.round((b - a - 2 * postHalf) / 4));
      for (const side of sides) {
        let prev = null;
        for (let q = 0; q <= n; q++) {
          const s = lerp(a + postHalf, b - postHalf, q / n);
          const pt = edge(s, tRail(side), 3.7 + 1.2 * Math.sin((s / 8) * Math.PI));
          if (prev) rod(`wave.${side}.${q}`, prev, pt, 0.8, railTone('wave'));
          if (prev && q < n) ball(`wavejoint.${side}.${q}`, pt, 0.95, railTone('wavej'));
          prev = pt;
        }
      }
    }
  }
  if (kind === 'pillar') {
    // Crown discs sit on the end pillars' finials through the top ornament below.
  }

  // ---------------------------------------------------------------- foot and top ornaments (spec 6.3)
  const lateral = 5.4;
  switch (story.foot) {
    case 'kamandalu':
      turned(
        'kamandalu',
        onFoot(-lateral, -4.4),
        [
          [0, 1.2],
          [0.5, 1.5, 1],
          [1.7, 1.9, 1],
          [2.7, 1.45, 1],
          [3.2, 0.7],
          [4.4, 0.7],
          [4.9, 1.0],
          [4.9, 0.8],
        ],
        mat('#C9A24A'),
      );
      break;
    case 'basket':
      turned(
        'basket',
        onFoot(lateral, -4.2),
        [
          [0, 1.5],
          [0.4, 1.9, 1],
          [1.4, 2.35, 1],
          [2.1, 2.4],
          [2.1, 2.1],
        ],
        mat('#B88A4A'),
        [0, 0, 1],
        {
          inner: k.lineSvg(G.arcOf(G.frameAlong(onFoot(lateral, -4.2), [0, 0, 1]), 1.0, 2.2, P, {}), {
            tone: 'faint',
          }),
        },
      );
      for (let q = 0; q < 3; q++)
        ball(
          `basketberry.${q}`,
          onFoot(lateral + (q - 1) * 0.9, -4.2 + (q % 2) * 0.7, 2.5),
          0.55,
          mat(BLOOD),
        );
      break;
    case 'mace': {
      const a = onFoot(-lateral, -5.4, 0.4);
      const b = onFoot(-lateral, -2.2, 0.4);
      rod('mace.shaft', a, b, 0.4, mat(TEAK));
      ball('mace.head', world(c.footFrame, -lateral, -1.25, 3 + 1.0), 1.0, mat(GOLD));
      break;
    }
    case 'garland': {
      const pts = [0, 1, 2, 3, 4].map((q) =>
        world(c.footFrame, 7.55, lerp(-5.4, 5.4, q / 4), 1.9 - 1.1 * Math.sin((Math.PI * q) / 4)),
      );
      for (let q = 0; q < 4; q++) rod(`loop.${q}`, pts[q], pts[q + 1], 0.45, mat(SAFFRON));
      pts.forEach((p, q) => ball(`loopdot.${q}`, p, 0.6, mat(q % 2 ? '#F8C34A' : '#E4572E')));
      break;
    }
    case 'prints':
      break;
    default:
  }
  switch (story.top) {
    case 'bowstring': {
      const ends = posts.filter((p) => p.side < 0).slice(-2);
      if (ends.length === 2)
        rod(
          'bowstring',
          [ends[0].finial[0], ends[0].finial[1], ends[0].finial[2] - 0.6],
          [ends[1].finial[0], ends[1].finial[1], ends[1].finial[2] - 0.6],
          0.25,
          mat(BONE),
        );
      break;
    }
    case 'star': {
      const centre = onTop(0, 5.0);
      const spokes = Array.from({ length: 6 }, (_, q) => {
        const a = (q / 6) * Math.PI * 2;
        return k.segment(
          [centre[0], centre[1], centre[2]],
          world(c.topFrame, Math.sin(a) * 3.4, 5.0 + Math.cos(a) * 3.4, 3),
          P,
        );
      });
      void spokes;
      break;
    }
    case 'crowns': {
      for (const p of posts.filter((q) => q.end && q.s > 1)) {
        turned(
          `crown.${p.side}`,
          [p.finial[0], p.finial[1], p.finial[2] + 0.8],
          [
            [0, 1.6],
            [0.45, 1.6],
          ],
          mat(GOLD),
        );
      }
      break;
    }
    case 'crown': {
      turned(
        'crown',
        onTop(lateral, 5.6),
        [
          [0, 2.0],
          [0.8, 2.0],
          [0.8, 1.6],
          [1.4, 1.2],
        ],
        mat(GOLD),
      );
      for (const dt of [-1.9, 1.9])
        turned(
          `ear.${dt}`,
          onTop(lateral + dt, 5.6 - 3.4),
          [
            [0, 0.7],
            [1.8, 0.7],
          ],
          mat(mixHex(stone, '#FFFFFF', 0.2)),
        );
      break;
    }
    case 'tail': {
      const base = onTop(-lateral, 5.4, 0.35);
      const turns = 1.5;
      let prev = null;
      for (let q = 0; q <= 16; q++) {
        const a = (q / 16) * turns * Math.PI * 2;
        const r = lerp(0.8, 2.6, q / 16);
        const p = world(c.topFrame, -lateral + Math.cos(a) * r, 5.4 + Math.sin(a) * r, 3.35);
        if (prev) rod(`tail.${q}`, prev, p, 0.7, mat('#B07A45'));
        prev = p;
      }
      void base;
      ball('tuft', [prev[0], prev[1], prev[2] + 0.2], 1.1, mat('#8A5A33'));
      break;
    }
    case 'tufts': {
      const last = posts.filter((p) => p.s > geo.Lp - 1 && p.side > 0)[0];
      if (last) {
        for (const deg of [-35, -12, 12, 35]) {
          const a = (deg * Math.PI) / 180;
          const base = [last.finial[0], last.finial[1], last.finial[2] + 0.2];
          const dir = [last.F.u[0] * Math.sin(a), last.F.u[1] * Math.sin(a), Math.cos(a)];
          rod(
            `tuft.${deg}`,
            base,
            [base[0] + dir[0] * 4, base[1] + dir[1] * 4, base[2] + dir[2] * 4],
            0.6,
            mat(PAPER),
          );
        }
      }
      break;
    }
    default:
  }

  // ---------------------------------------------------------------- flora: moss rims and flowers that live on the stone
  const turf = mat(MOSS);
  const bloom = [SAFFRON, '#F3E3B8', '#D15587'];
  // Tufts stand just outside the pier; guha's boat prows reach 9.8, so there they stand beyond the prow tip.
  const flowerT = id === 'guha' ? 11 : 7.7;
  c.archInfo.slice(0, -1).forEach((a) => {
    for (const side of sides) {
      for (let q = 0; q < 3; q++) {
        const jit = hashUnit(`${id}:tuft${a.j}.${side}.${q}`);
        const at = world(a.F, side * (flowerT + jit * 0.3), a.length + (q - 1) * 0.9, 0);
        turned(
          `tuft.${a.j}.${side}.${q}`,
          at,
          [
            [0, 0.7],
            [0.9, 0.12],
          ],
          turf,
          [0, 0, 1],
          { ground: true },
        );
      }
      const at0 = world(
        a.F,
        side * (flowerT + hashUnit(`${id}:tuft${a.j}.${side}.0`) * 0.3),
        a.length - 0.9,
        0,
      );
      if (hashUnit(`${id}:flower${a.j}${side}`) > -0.3)
        ball(
          `flower.${a.j}.${side}`,
          [at0[0], at0[1], TOP_Z + 0.7 + 0.4],
          0.45,
          mat(bloom[(a.j + (side > 0 ? 1 : 0)) % 3]),
        );
    }
  });

  // ---------------------------------------------------------------- the numeral stele
  addStele(c, { putFloor });
}

/** The top square's number engraved upright on a stone stele that stands on the sill beside the top abutment. */
function addStele(c, { putFloor }) {
  const { geo, k, P } = c;
  const digits = [...String(geo.to)];
  const advance = 10;
  const glyphW = 8 + (digits.length - 1) * advance;
  const scale = Math.min(0.62, 12 / glyphW);
  const w = glyphW * scale + 3.2;
  const height = 14 * scale + 3.4;
  const d = geo.sample(geo.Lp);
  const side = d.dx > 0 ? 1 : -1;
  // Inner edge 11.4 from the square centre (the turned block reaches 10.6), outer edge inside the 27-unit tile.
  const x0 = side > 0 ? geo.T[0] + 11.4 : geo.T[0] - 11.4 - w;
  const y0 = geo.T[1] + 3.2;
  const plan = [
    [x0, y0],
    [x0 + w, y0],
    [x0 + w, y0 + 1.7],
    [x0, y0 + 1.7],
  ];
  const ink = isBoneSquare(geo.to) ? BONE : INK;
  const strokes = [];
  digits.forEach((digit, index) => {
    for (const stroke of NUMERAL_STROKES[digit]) {
      const pts = stroke.map(([u, v]) =>
        k.iso([x0 + 1.6 + (index * advance + u) * scale, y0 + 1.72, TOP_Z + 1.5 + v * scale], P),
      );
      strokes.push(k.pathOf(pts, false));
    }
  });
  const engraved = `<path class="iso-line" style="stroke:${ink};stroke-width:.85" d="${strokes.join('')}"/>`;
  putFloor('stele', 'stele', plan, TOP_Z, TOP_Z + height, {
    mat: c.dressed('stele'),
    ground: true,
    inner: engraved,
  });
}
