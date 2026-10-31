// Ayodhya (row 4, squares 37-48): sandstone plaza, ramparts and domes in saffron and gold, a chariot, a fountain and the
// first dark trees of the forest edge. `lamp` (shared with Mithila) lives in mithila.mjs.
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const R = [0.819, -0.574];

const rampart = prop(
  { kind: 'rampart', regions: ['ayodhya'], zone: 'side', anim: 'none', squares: [48, 47], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 9, d: 32, h: 10, mat: C.sand, seams: [3.4, 6.8], inlay: 0.8, r: 0.5 });
    p.box({ x: 0, y: 0, z: 7.6, w: 9.6, d: 32.6, h: 0.9, mat: C.gold, r: 0.4 });
    for (let i = 0; i < 6; i++)
      p.box({ x: 0, y: -12.5 + i * 5, z: 10, w: 6.4, d: 2.8, h: 2.4, mat: C.sandDark, r: 0.4 });
    for (const y of [-15, 15]) {
      p.cyl({ x: 0, y, r: 3.4, h: 14, mat: C.sand, steps: 18, seams: [4.6, 9.4] });
      p.cyl({ x: 0, y, z: 14, r: 3.9, h: 0.9, mat: C.gold, steps: 18 });
      p.cone({ x: 0, y, z: 14.9, r: 3.6, h: 3.4, mat: C.saffron, steps: 18 });
    }
    p.rod({ from: [0, -15, 18.2], to: [0, -15, 21], r: 0.28, mat: C.goldDark, steps: 6 });
    p.ball({ x: 0, y: -15, z: 21.1, r: 0.6, mat: C.gold, steps: 10 });
  },
);

const dome = prop(
  { kind: 'dome', regions: ['ayodhya'], zone: 'side', anim: 'none', squares: [45], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 11, d: 11, h: 2.4, mat: C.sandDark, r: 0.6, seams: [1.2] });
    p.box({ x: 0, y: 0, z: 2.4, w: 9, d: 9, h: 3.2, mat: C.plaster, r: 0.5, inlay: 0.9 });
    for (const [x, y] of [
      [-4.2, -4.2],
      [4.2, -4.2],
      [-4.2, 4.2],
      [4.2, 4.2],
    ]) {
      p.cyl({ x, y, z: 5.6, r: 0.75, h: 2.4, mat: C.plaster, steps: 10 });
      p.cone({ x, y, z: 8, r: 1.1, h: 1.4, mat: C.gold, steps: 10 });
    }
    p.cyl({ x: 0, y: 0, z: 5.6, r: 3.6, h: 2.6, mat: C.plaster, steps: 22, seams: [1.3] });
    p.turn({
      x: 0,
      y: 0,
      z: 8.2,
      profile: [
        [0, 3.9],
        [1, 3.85, 1],
        [2, 3.4, 1],
        [3, 2.6, 1],
        [3.8, 1.6, 1],
        [4.4, 0.6, 1],
        [4.7, 0],
      ],
      mat: C.gold,
      steps: 26,
    });
    p.rod({ from: [0, 0, 12.8], to: [0, 0, 15.4], r: 0.3, mat: C.goldDark, steps: 6 });
    p.ball({ x: 0, y: 0, z: 15.6, r: 0.75, mat: C.saffron, steps: 12 });
  },
);

const chariot = prop(
  { kind: 'chariot', regions: ['ayodhya'], zone: 'side', anim: 'none', squares: [42], variety: true },
  (p) => {
    for (const x of [-3.5, 3.5]) {
      p.wheel({ at: [x, 0, 3.4], axis: [1, 0, 0], r: 3.4, thick: 0.9, mat: C.teak, steps: 26 });
      p.wheel({
        at: [x + Math.sign(x) * 0.25, 0, 3.4],
        axis: [1, 0, 0],
        r: 2.4,
        thick: 0.9,
        mat: C.bark,
        steps: 22,
      });
      p.wheel({
        at: [x + Math.sign(x) * 0.6, 0, 3.4],
        axis: [1, 0, 0],
        r: 1,
        thick: 0.9,
        mat: C.gold,
        steps: 14,
      });
    }
    p.rod({ from: [-3.4, 0, 3.4], to: [3.4, 0, 3.4], r: 0.45, mat: C.goldDark, steps: 8, bias: -1 });
    p.box({ x: 0, y: 0, z: 3.2, w: 6.4, d: 8.6, h: 1, mat: C.teak, r: 0.5, inlay: 0.8 });
    p.box({ x: -2.9, y: -0.2, z: 4.2, w: 0.7, d: 7.4, h: 2.2, mat: C.sand, r: 0.3 });
    p.box({ x: 2.9, y: -0.2, z: 4.2, w: 0.7, d: 7.4, h: 2.2, mat: C.sand, r: 0.3 });
    p.box({ x: 0, y: 3.9, z: 4.2, w: 6.4, d: 0.8, h: 3.4, mat: C.gold, r: 0.3, seams: [1.7] });
    p.box({ x: 0, y: 9, z: 3.4, w: 0.9, d: 10, h: 0.9, mat: C.trunk, r: 0.3 });
    p.box({ x: 0, y: 13.4, z: 3.1, w: 5.2, d: 0.9, h: 0.9, mat: C.gold, r: 0.3 });
    p.ball({ x: -2.6, y: 13.4, z: 3.55, r: 0.75, mat: C.goldDark, steps: 10 });
    p.ball({ x: 2.6, y: 13.4, z: 3.55, r: 0.75, mat: C.goldDark, steps: 10 });
    p.rod({ from: [0, -3.4, 4.2], to: [0, -3.4, 17], r: 0.35, mat: C.teak, steps: 8 });
    p.panel({
      points: [
        [0, -3.4, 16.6],
        [5.2 * R[0], -3.4 + 5.2 * R[1], 15.8],
        [3.8 * R[0], -3.4 + 3.8 * R[1], 14.6],
        [5.2 * R[0], -3.4 + 5.2 * R[1], 13.4],
        [0, -3.4, 12.8],
      ],
      mat: C.saffron,
    });
  },
);

const bannerSaffron = prop(
  { kind: 'banner-saffron', regions: ['ayodhya'], zone: 'side', anim: 'sway', variety: true },
  (p) => {
    p.cyl({ x: 0, y: 0, r: 2.3, h: 1.4, mat: C.stone, steps: 16 });
    p.cyl({ x: 0, y: 0, z: 1.4, r: 1.5, h: 0.8, mat: C.stoneDark, steps: 12 });
    p.cyl({ x: 0, y: 0, z: 2.2, r: 0.55, h: 13, mat: C.teak, steps: 10, seams: [5, 9] });
    p.ball({ x: 0, y: 0, z: 15.6, r: 0.95, mat: C.gold, steps: 14 });
    p.panel({
      points: [
        [0.4, -0.3, 14.4],
        [0.4 + 4.8 * R[0], -0.3 + 4.8 * R[1], 14],
        [0.4 + 3.6 * R[0], -0.3 + 3.6 * R[1], 12.4],
        [0.4 + 4.8 * R[0], -0.3 + 4.8 * R[1], 10.8],
        [0.4, -0.3, 10.4],
      ],
      mat: C.saffron,
    });
    p.panel({
      points: [
        [0.4, -0.3, 14.4],
        [0.4 + 4.8 * R[0], -0.3 + 4.8 * R[1], 14],
        [0.4 + 4.6 * R[0], -0.3 + 4.6 * R[1], 13.3],
        [0.4, -0.3, 13.6],
      ],
      mat: C.gold,
      bias: 0.5,
    });
  },
);

const tier = (z, r, h, mat) => ({
  z,
  mat,
  profile: [
    [0, r],
    [0.6, r + 0.2],
    [h, 0],
  ],
});

const darkTree = prop(
  {
    kind: 'dark-tree',
    regions: ['ayodhya'],
    zone: 'side',
    anim: 'sway',
    squares: [37, 38, 39, 40],
    variety: true,
  },
  (p) => {
    p.cone({ x: 0, y: 0, r: 2.6, r1: 1.2, h: 1.6, mat: C.bark, steps: 10 });
    p.cyl({ x: 0, y: 0, z: 1.2, r: 1.2, h: 5, mat: C.bark, steps: 10 });
    for (const t of [
      tier(4, 5.4, 6.2, '#2D5A34'),
      tier(8.6, 4.4, 5.8, '#356B3A'),
      tier(13, 3.4, 5.4, '#3F7C42'),
      tier(16.6, 2.3, 4.6, '#4F9150'),
    ])
      p.turn({ x: 0, y: 0, z: t.z, profile: t.profile, mat: t.mat, steps: 14, smooth: false });
  },
);

const fountain = prop(
  { kind: 'fountain', regions: ['ayodhya'], zone: 'side', anim: 'shimmer', variety: true },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 4.6, rOut: 5.6, h: 1.8, mat: C.stone, steps: 28 });
    p.cyl({ x: 0, y: 0, z: 0.2, r: 4.7, h: 1.2, mat: C.water, steps: 28 });
    p.turn({
      x: 0,
      y: 0,
      z: 0.4,
      profile: [
        [0, 1.8],
        [0.6, 1.2, 1],
        [4.8, 0.9, 1],
        [5.4, 1.4],
      ],
      mat: C.sandDark,
      steps: 14,
    });
    p.turn({
      x: 0,
      y: 0,
      z: 5.6,
      profile: [
        [0, 1],
        [0.5, 3.1, 1],
        [1.3, 3.6, 1],
        [1.6, 3.3],
      ],
      mat: C.sand,
      steps: 20,
    });
    p.cyl({ x: 0, y: 0, z: 6.6, r: 2.7, h: 0.3, mat: C.water, steps: 18 });
    p.cone({ x: 0, y: 0, z: 6.9, r: 0.9, r1: 0.1, h: 6.6, mat: C.waterLight, steps: 10 });
    p.ball({ x: 0, y: 0, z: 13.9, r: 0.65, mat: C.foam, steps: 10 });
    for (const [x, y] of [
      [-2.2, -1],
      [2.2, 1],
      [1, -2.2],
      [-1, 2.2],
    ])
      p.ball({ x, y, z: 8.6, r: 0.55, mat: C.waterLight, steps: 10, bias: 1 });
  },
);

export const AYODHYA = [rampart, dome, chariot, bannerSaffron, darkTree, fountain];
