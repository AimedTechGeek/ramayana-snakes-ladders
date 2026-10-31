// Ganga water tiles (squares 49, 50, 71-74): lotus pads, a moored boat, river rocks, a fishing net and a ghat step.
// `reed` (shared with Dandaka) lives in dandaka.mjs.
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const R = [0.819, -0.574];

const lotusPad = prop(
  { kind: 'lotus-pad', regions: ['ganga'], zone: 'back', anim: 'shimmer', variety: true },
  (p) => {
    p.cyl({ x: -1.8, y: 0.3, r: 2.9, h: 0.5, mat: C.leaf, steps: 22 });
    p.cyl({ x: 2.8, y: -0.6, r: 2.2, h: 0.5, mat: C.leafDark, steps: 18 });
    p.cyl({ x: 1.2, y: 1.6, r: 1.6, h: 0.5, mat: C.mangoLight, steps: 16 });
    const petals = 7;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      p.rod({
        from: [-1.8 + Math.cos(a) * 0.5, 0.3 + Math.sin(a) * 0.5, 0.5],
        to: [-1.8 + Math.cos(a) * 1.7, 0.3 + Math.sin(a) * 1.7, 3.4],
        r: 0.75,
        r1: 0.1,
        mat: i % 2 ? C.lotus : '#F6B3C8',
        steps: 8,
      });
    }
    p.ball({ x: -1.8, y: 0.3, z: 1.4, r: 0.8, mat: C.gold, steps: 10, bias: 1 });
    p.rod({ from: [2.8, -0.6, 0.5], to: [2.8, -0.6, 3.4], r: 0.2, mat: C.leafDark, steps: 6 });
    p.cone({ x: 2.8, y: -0.6, z: 3, r: 0.75, h: 1.9, mat: C.lotus, steps: 8 });
  },
);

const boatPost = prop(
  { kind: 'boat-post', regions: ['ganga'], zone: 'back', anim: 'sway', variety: true },
  (p) => {
    const hull = [
      [-4.8, 0.3],
      [-3.4, 1.7],
      [3.2, 1.7],
      [4.8, 0.3],
      [3.2, -1.1],
      [-3.4, -1.1],
    ];
    const inside = hull.map(([x, y]) => [x * 0.8, 0.3 + (y - 0.3) * 0.55]);
    p.prism({ ring: hull, h: 1.8, mat: C.teak, bevel: 0.4 });
    p.prism({ ring: inside, z: 1.8, h: 0.2, mat: C.bark });
    p.box({ x: -0.8, y: 0.3, z: 1.8, w: 0.9, d: 2.6, h: 0.5, mat: C.straw, r: 0.2 });
    p.box({ x: 2, y: 0.3, z: 1.8, w: 0.9, d: 2.6, h: 0.5, mat: C.straw, r: 0.2 });
    p.cyl({ x: -2.6, y: 0.2, z: 1.9, r: 0.8, h: 1.2, mat: C.clay, steps: 10 });
    p.cyl({ x: -3.6, y: 0.5, z: 1.9, r: 0.6, h: 0.9, mat: C.clay, steps: 10 });
    p.cyl({ x: -3.4, y: -2.7, r: 0.95, h: 7, mat: C.trunk, steps: 12, seams: [2.6, 5] });
    p.ball({ x: -3.4, y: -2.7, z: 7.2, r: 0.95, mat: C.trunk, steps: 12 });
    p.cyl({ x: -3.4, y: -2.7, z: 4.6, r: 1.25, h: 0.7, mat: C.straw, steps: 12 });
    p.rod({ from: [-3.4, -2.7, 4.8], to: [4.4, 0.3, 2.1], r: 0.28, mat: C.straw, steps: 6, bias: 1 });
    p.rod({ from: [1.6, -0.4, 2], to: [3.8, 0.8, 5.8], r: 0.25, mat: C.parchment, steps: 6, bias: 1 });
  },
);

const riverRock = prop(
  { kind: 'river-rock', regions: ['ganga'], zone: 'back', anim: 'shimmer', variety: true },
  (p) => {
    p.ring({ x: -1.6, y: 0, rIn: 1.9, rOut: 3, h: 0.4, mat: C.foam, steps: 24 });
    p.ring({ x: 3.2, y: 0.4, rIn: 1, rOut: 1.8, h: 0.4, mat: C.foam, steps: 18 });
    p.faceted({
      x: -1.6,
      y: 0,
      profile: [
        [0, 1.9],
        [1.4, 2.1],
        [3, 1.4],
        [3.6, 0.9],
      ],
      sides: 7,
      jitter: 0.4,
      mat: '#9A9488',
      turn: 0.4,
    });
    p.faceted({
      x: 3.2,
      y: 0.4,
      profile: [
        [0, 1],
        [0.8, 1.1],
        [2, 0.6],
      ],
      sides: 6,
      jitter: 0.3,
      mat: C.rock,
      turn: 0.2,
    });
    p.ball({ x: -4.2, y: 1.6, z: 0.6, r: 0.6, mat: C.stone, steps: 10 });
  },
);

const netPole = prop(
  { kind: 'net-pole', regions: ['ganga'], zone: 'side', anim: 'sway', variety: true },
  (p) => {
    const at = (u, z) => [R[0] * u, R[1] * u, z];
    const [left, right] = [-3.2, 3.2];
    for (const u of [left, right]) {
      const [x, y] = at(u, 0);
      p.cyl({ x, y, r: 1.4, h: 0.8, mat: C.stoneDark, steps: 10 });
      p.cyl({ x, y, z: 0.8, r: 0.5, h: 12.6, mat: C.straw, steps: 8, seams: [4.5, 8.5] });
      p.ball({ x, y, z: 13.6, r: 0.6, mat: C.trunk, steps: 8 });
    }
    const corners = [at(left, 11.4), at(right, 11.4), at(right, 5.4), at(left, 5.4)];
    p.panel({ points: corners, mat: C.parchment });
    const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    for (const t of [0.25, 0.5, 0.75]) {
      p.line({
        points: [lerp(corners[0], corners[3], t), lerp(corners[1], corners[2], t)],
        mat: C.parchment,
        tone: 'faint',
        bias: 0.2,
      });
      p.line({
        points: [lerp(corners[0], corners[1], t), lerp(corners[3], corners[2], t)],
        mat: C.parchment,
        tone: 'faint',
        bias: 0.2,
      });
    }
    for (const t of [0.2, 0.5, 0.8]) {
      const [x, y, z] = lerp(corners[0], corners[1], t);
      p.ball({ x, y, z: z + 0.3, r: 0.5, mat: C.saffron, steps: 8, bias: 0.4 });
    }
  },
);

const ghatStep = prop(
  { kind: 'ghat-step', regions: ['ganga'], zone: 'back', anim: 'none', variety: true },
  (p) => {
    const STEP = '#CFC3A6';
    const CHEEK = '#B5A687';
    for (const x of [-4.1, 4.1]) {
      p.box({ x, y: 0, w: 1.7, d: 5.8, h: 3.8, mat: CHEEK, r: 0.4, seams: [1.9] });
      p.ball({ x, y: -1.9, z: 4.4, r: 0.65, mat: CHEEK, steps: 10 });
    }
    p.box({ x: 0, y: -1.9, w: 6.5, d: 2, h: 3, mat: STEP, r: 0.3, seams: [1.5] });
    p.box({ x: 0, y: 0.1, w: 6.5, d: 2, h: 2, mat: STEP, r: 0.3, seams: [1] });
    p.box({ x: 0, y: 2.1, w: 6.5, d: 1.7, h: 1, mat: STEP, r: 0.3 });
    p.cone({ x: -2.6, y: 2.5, z: 1, r: 0.5, h: 1.6, mat: C.mangoLight, steps: 6 });
    p.cone({ x: 2.4, y: 2.6, z: 1, r: 0.45, h: 1.3, mat: C.leaf, steps: 6 });
  },
);

export const GANGA = [lotusPad, boatPost, riverRock, netPole, ghatStep];
