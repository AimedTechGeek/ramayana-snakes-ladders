// Dandaka (rows 5-7, squares 49-84): the deep sal forest: trees, vines, undergrowth, Rama's leaf hut at Panchavati and
// the reeds of the Ganga banks. Jatayu (air band) is a flap sprite of the shared sheet, not a prop here.
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const ellipsoid = (centre, half, radius, rows = 8) =>
  Array.from({ length: rows + 1 }, (_, i) => {
    const t = -1 + (2 * i) / rows;
    return [
      centre + half * t,
      i === 0 || i === rows ? 0 : radius * Math.sqrt(1 - t * t),
      i === 0 || i === rows ? 0 : 1,
    ];
  });

const salTree = prop(
  { kind: 'sal-tree', regions: ['dandaka'], zone: 'side', anim: 'sway', variety: true },
  (p) => {
    p.cone({ x: 0, y: 0, r: 3, r1: 1.3, h: 2.4, mat: C.bark, steps: 12 });
    p.cyl({ x: 0, y: 0, z: 1.8, r: 1.25, h: 10, mat: C.trunk, steps: 12, seams: [4, 7.4] });
    p.rod({ from: [0, 0, 8], to: [-2.4, -0.4, 11], r: 0.55, mat: C.trunk });
    p.rod({ from: [0, 0, 8.6], to: [2.4, 0.6, 11.4], r: 0.55, mat: C.trunk });
    p.turn({ x: 0, y: 0, z: 0, profile: ellipsoid(14.4, 6.8, 4.5), mat: C.sal, steps: 22 });
    p.turn({ x: -1.4, y: 1.2, z: 0, profile: ellipsoid(17.4, 3.8, 2.7), mat: C.leaf, steps: 18 });
    p.turn({ x: 1.6, y: -1.2, z: 0, profile: ellipsoid(11.8, 2.4, 2.4, 6), mat: C.leafDark, steps: 16 });
    p.ball({ x: 0.4, y: 0.4, z: 20.2, r: 1.5, mat: C.mangoLight, steps: 16 });
  },
);

const vinePost = prop(
  { kind: 'vine-post', regions: ['dandaka'], zone: 'side', anim: 'sway', variety: true },
  (p) => {
    const tip = (u, z) => [0.819 * u, -0.574 * u, z];
    const [a, b] = [tip(-3.6, 14.2), tip(3.6, 13.6)];
    p.cone({ x: 0, y: 0, r: 2.9, r1: 1.7, h: 2, mat: C.bark, steps: 12 });
    p.cyl({ x: 0, y: 0, z: 1.6, r: 1.7, h: 8.8, mat: C.trunk, steps: 14, seams: [3.5, 7] });
    p.rod({ from: [0, 0, 9.4], to: a, r: 0.85, r1: 0.55, mat: C.bark });
    p.rod({ from: [0, 0, 9.8], to: b, r: 0.85, r1: 0.55, mat: C.bark });
    p.ball({ x: a[0], y: a[1], z: a[2] + 1.4, r: 2.1, mat: C.sal, steps: 16 });
    p.ball({ x: b[0], y: b[1], z: b[2] + 1.4, r: 1.9, mat: C.leaf, steps: 16 });
    const strands = [
      [a, 0.9, 7.4, C.leaf],
      [a, -0.9, 6.2, C.mangoLight],
      [b, 0.9, 6.6, C.mangoLight],
      [b, -0.9, 7.8, C.leaf],
    ];
    for (const [t, du, drop, mat] of strands) {
      const x = t[0] + 0.819 * du;
      const y = t[1] - 0.574 * du;
      p.rod({ from: [x, y, t[2] - 0.6], to: [x, y, t[2] - 0.6 - drop], r: 0.28, mat: C.leafDark, steps: 6 });
      for (const f of [0.35, 0.7, 1])
        p.ball({ x: x + (f === 0.7 ? 0.7 : -0.2), y, z: t[2] - 0.6 - drop * f, r: 0.75, mat, steps: 10 });
    }
  },
);

const hiddenEyes = prop(
  { kind: 'hidden-eyes', regions: ['dandaka'], zone: 'back', anim: 'flicker', variety: true },
  (p) => {
    p.ball({ x: -2.4, y: -1, z: 2.4, r: 2.4, mat: C.leafDark });
    p.ball({ x: 2.4, y: -1, z: 2.6, r: 2.5, mat: C.sal });
    p.ball({ x: 0, y: -1.2, z: 4.4, r: 2.4, mat: C.leaf });
    for (const x of [-1, 1]) {
      p.ball({ x, y: 1.4, z: 3.3, r: 0.7, mat: C.gold, steps: 12, bias: 1 });
      p.dots({ points: [[x + 0.1, 2.05, 3.3]], mat: C.ink, size: 0.28, bias: 1.1 });
    }
    p.ball({ x: -1.8, y: 1.4, z: 1, r: 1, mat: C.leafDark, bias: 2 });
    p.ball({ x: 1.8, y: 1.4, z: 0.9, r: 0.9, mat: C.sal, bias: 2 });
  },
);

const panchavatiHut = prop(
  {
    kind: 'panchavati-hut',
    regions: ['dandaka'],
    zone: 'side',
    anim: 'smoke',
    emit: [0, 0, 15],
    squares: [66],
    variety: true,
  },
  (p) => {
    p.box({ x: 0, y: 0, w: 10.4, d: 10.4, h: 0.9, mat: C.mud, r: 0.6, seams: [0.45] });
    p.box({ x: 0, y: 0, z: 0.9, w: 7.8, d: 7.8, h: 5.2, mat: C.straw, r: 0.4, seams: [2.6] });
    p.box({ x: 0, y: 4.1, z: 0.9, w: 2.2, d: 0.5, h: 3.4, mat: C.bark, r: 0.2 });
    p.box({ x: 4.1, y: 0.4, z: 2.6, w: 0.5, d: 1.8, h: 1.8, mat: C.bark, r: 0.2 });
    p.pyramid({ x: 0, y: 0, z: 5.9, half: 5.2, h: 6.8, mat: '#B9A24A' });
    p.rod({ from: [0, 0, 12.4], to: [0, 0, 14], r: 0.3, mat: C.bark, steps: 6 });
    p.ball({ x: 0, y: 0, z: 14.2, r: 0.6, mat: C.leaf, steps: 10 });
    for (const [x, y, z] of [
      [-4.6, 4.6, 0.9],
      [-4.6, 3.4, 0.9],
      [-4.6, 4, 2.2],
    ])
      p.rod({ from: [x - 1, y, z + 0.5], to: [x + 1, y, z + 0.5], r: 0.55, mat: C.trunk, steps: 8 });
  },
);

const rock = prop({ kind: 'rock', regions: ['dandaka'], zone: 'back', anim: 'none', variety: true }, (p) => {
  p.faceted({
    x: -2.6,
    y: 0.2,
    profile: [
      [0, 2],
      [1.4, 2.3],
      [3, 1.5],
      [3.4, 1.1],
    ],
    sides: 6,
    jitter: 0.32,
    mat: C.stone,
    turn: 0.3,
  });
  p.faceted({
    x: 0.5,
    y: -0.4,
    profile: [
      [0, 2.4],
      [2, 2.7],
      [4.2, 1.8],
      [4.8, 1.2],
    ],
    sides: 7,
    jitter: 0.32,
    mat: C.rock,
    turn: 0.9,
  });
  p.faceted({
    x: 2.9,
    y: 0.8,
    profile: [
      [0, 1.5],
      [1, 1.7],
      [2.1, 0.9],
    ],
    sides: 5,
    jitter: 0.4,
    mat: C.stoneDark,
    turn: 0.1,
  });
  p.cone({ x: 0.5, y: -0.4, z: 4.8, r: 1.3, r1: 0.5, h: 0.6, mat: C.moss, steps: 8, bias: 1 });
  p.cone({ x: -3.4, y: 1.8, r: 0.55, h: 2.2, mat: C.mangoLight, steps: 6 });
});

const fern = prop({ kind: 'fern', regions: ['dandaka'], zone: 'back', anim: 'sway', variety: true }, (p) => {
  const mats = [C.leafDark, C.leaf, C.sal, C.mangoLight];
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + 0.3;
    const [cx, cy] = [Math.cos(angle), Math.sin(angle)];
    const length = i % 2 ? 3 : 3.6;
    const tip = [cx * length, cy * length * 0.8, 3.4 + (i % 3) * 0.5];
    const mid = [cx * length * 0.55, cy * length * 0.45, 3.4];
    const side = [-cy * 0.9, cx * 0.9];
    p.panel({
      points: [
        [0, 0, 0],
        [mid[0] + side[0], mid[1] + side[1], mid[2]],
        tip,
        [mid[0] - side[0], mid[1] - side[1], mid[2]],
      ],
      mat: mats[i % mats.length],
    });
  }
  p.ball({ x: 0, y: 0, z: 0.9, r: 0.9, mat: C.sage, steps: 10, bias: 3 });
});

const reed = prop(
  {
    kind: 'reed',
    regions: ['dandaka', 'ganga'],
    zone: 'back',
    anim: 'sway',
    squares: [49, 50, 71, 72, 73, 74],
    variety: true,
  },
  (p) => {
    p.box({ x: 0, y: 0, w: 6, d: 3, h: 0.8, mat: C.mud, r: 1, steps: 3 });
    const stems = [
      [-2.4, 0.4, -3.2, 0.8, 9.4, C.sage],
      [-1, -0.6, -1.6, -0.9, 10.4, C.mangoLight],
      [0.2, 0.6, 0.4, 0.9, 11, C.sage],
      [1.4, -0.4, 2.4, -0.9, 9.8, C.mangoLight],
      [2.6, 0.5, 3.8, 0.7, 8.6, C.sage],
    ];
    for (const [x, y, tx, ty, h, mat] of stems) {
      p.rod({ from: [x, y, 0.6], to: [tx, ty, h], r: 0.4, r1: 0.22, mat, steps: 7 });
    }
    for (const [x, y, z] of [
      [-1.6, -0.9, 9.4],
      [2.4, -0.9, 8.8],
    ])
      p.rod({ from: [x, y, z - 1.8], to: [x + 0.1, y, z], r: 0.62, r1: 0.5, mat: C.bark, steps: 8 });
    p.panel({
      points: [
        [0.6, 0.6, 1],
        [2.2, 0.8, 5.4],
        [4.2, 1.4, 6.6],
        [3, 1, 3.6],
      ],
      mat: C.leaf,
    });
  },
);

export const DANDAKA = [salTree, vinePost, hiddenEyes, panchavatiHut, rock, fern, reed];
