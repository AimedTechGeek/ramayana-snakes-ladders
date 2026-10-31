// Mithila (rows 1-3, squares 1-36): meadow, rice paddies, mango groves, Janaka's palace, a sage's hut and the plough.
// `lamp` is shared with Ayodhya (regions lists both). Props are drawn on a tile top, z = 0, ground point at the origin.
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const mangoTree = prop(
  { kind: 'mango-tree', regions: ['mithila'], zone: 'side', anim: 'sway', variety: true },
  (p) => {
    p.cone({ x: 0, y: 0, r: 3.2, r1: 1.7, h: 2.2, mat: C.bark, steps: 12 });
    p.turn({
      x: 0,
      y: 0,
      z: 1.6,
      profile: [
        [0, 1.7, 1],
        [5, 1.2, 1],
        [10, 1.3],
      ],
      mat: C.trunk,
      steps: 14,
    });
    p.rod({ from: [0, 0, 7], to: [-2.6, -1, 10.6], r: 0.6, mat: C.trunk });
    p.rod({ from: [0, 0, 7.4], to: [2.8, 0.2, 10.8], r: 0.6, mat: C.trunk });
    p.ball({ x: -2.6, y: -1.4, z: 12.6, r: 3, mat: C.leafDark });
    p.ball({ x: 2.7, y: -0.6, z: 12.8, r: 3, mat: C.mango });
    p.ball({ x: 0.2, y: 2.2, z: 12.2, r: 3.3, mat: C.leaf });
    p.ball({ x: -0.6, y: -0.6, z: 16.4, r: 3.6, mat: C.mangoLight });
    p.ball({ x: 1.6, y: 1, z: 17.2, r: 2.4, mat: C.sage });
    for (const [x, y, z] of [
      [-3.8, 1.6, 10.6],
      [3.4, 3.2, 10.8],
      [1.4, -2.8, 14],
      [-1.8, 3.4, 14.4],
    ])
      p.ball({ x, y, z, r: 0.85, mat: C.saffron, steps: 14, bias: 3 });
  },
);

const riceStripes = prop(
  { kind: 'rice-stripes', regions: ['mithila'], zone: 'back', anim: 'none', squares: [2, 3], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 10, d: 6, h: 0.9, mat: C.mud, r: 0.6, steps: 3 });
    p.box({ x: 0, y: 0, z: 0.9, w: 8.6, d: 4.6, h: 0.3, mat: C.waterLight, r: 0.4 });
    for (const y of [-1.7, 0, 1.7]) {
      p.box({ x: 0, y, z: 1.2, w: 8, d: 1.1, h: 0.7, mat: C.moss, r: 0.3 });
      for (const x of [-3, 0, 3])
        p.cone({ x, y, z: 1.9, r: 0.75, h: 3.2, mat: x === 0 ? C.sage : C.mangoLight, steps: 6 });
    }
  },
);

const sageHut = prop(
  {
    kind: 'sage-hut',
    regions: ['mithila'],
    zone: 'side',
    anim: 'smoke',
    emit: [0, 0, 15],
    squares: [24],
    variety: true,
  },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 4, rOut: 5, h: 0.8, mat: C.stone, steps: 20, open: false });
    p.cyl({ x: 0, y: 0, z: 0.8, r: 4.2, h: 5.4, mat: C.mud, steps: 22, seams: [3.2] });
    p.box({ x: 2.2, y: 3.4, z: 0.8, w: 2.4, d: 0.8, h: 3.4, mat: C.bark, r: 0.3 });
    p.turn({
      x: 0,
      y: 0,
      z: 6,
      profile: [
        [0, 5.3],
        [0.5, 5.6],
        [7.2, 0],
      ],
      mat: C.thatch,
      steps: 22,
      smooth: false,
    });
    p.ball({ x: 0, y: 0, z: 13.5, r: 0.9, mat: C.clay, steps: 12 });
    p.turn({
      x: -4.4,
      y: 3.2,
      profile: [
        [0, 0.9],
        [1.2, 1.5, 1],
        [2.4, 0.9, 1],
        [2.7, 1],
      ],
      mat: C.clay,
      steps: 12,
    });
    p.cone({ x: 4.6, y: 3.6, r: 0.55, h: 2.4, mat: C.sage, steps: 6 });
    p.cone({ x: 5.3, y: 3.1, r: 0.5, h: 1.9, mat: C.mangoLight, steps: 6 });
  },
);

const plough = prop(
  { kind: 'plough', regions: ['mithila'], zone: 'back', anim: 'none', squares: [30], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 9.4, d: 5.4, h: 1, mat: C.mud, r: 0.7, steps: 3 });
    p.box({ x: -3, y: 0, z: 1, w: 0.9, d: 0.9, h: 4.6, mat: C.teak, r: 0.2 });
    p.box({ x: 0.5, y: 0, z: 2.2, w: 9, d: 0.9, h: 0.9, mat: C.trunk, r: 0.2 });
    p.box({ x: -3.8, y: 0, z: 5.2, w: 2, d: 0.8, h: 0.8, mat: C.teak, r: 0.2 });
    p.box({ x: 4.2, y: 0, z: 3, w: 0.8, d: 4.4, h: 0.8, mat: C.trunk, r: 0.2 });
    p.prism({
      ring: [
        [-1.4, -1.1],
        [-1.4, 1.1],
        [2.2, 0],
      ],
      z: 1,
      h: 1.2,
      mat: C.stoneDark,
    });
    p.rod({ from: [4.2, -2, 3.4], to: [4.2, -2.1, 4.6], r: 0.35, mat: C.straw });
    p.rod({ from: [4.2, 2, 3.4], to: [4.2, 2.1, 4.6], r: 0.35, mat: C.straw });
  },
);

const peacock = prop(
  { kind: 'peacock', regions: ['mithila'], zone: 'back', anim: 'sway', variety: true },
  (p) => {
    const V = [0.574, 0.819];
    const R = [0.819, -0.574];
    const at = (u, f, z) => [R[0] * u + V[0] * f, R[1] * u + V[1] * f, z];
    p.rod({ from: at(-0.5, 0, 0), to: at(-0.5, 0, 2.4), r: 0.35, mat: C.stoneDark, steps: 6 });
    p.rod({ from: at(0.7, 0, 0), to: at(0.7, 0, 2.4), r: 0.35, mat: C.stoneDark, steps: 6 });
    // tail fan: seven feathers in the plane that faces the camera, behind the body
    const fan = -1.2;
    for (let i = -3; i <= 3; i++) {
      const angle = (i * 12 * Math.PI) / 180;
      const tip = at(Math.sin(angle) * 4.6, fan, 3 + Math.cos(angle) * 5.6);
      const left = at(Math.sin(angle) * 2.8 - 0.9, fan, 3 + Math.cos(angle) * 2.8);
      const right = at(Math.sin(angle) * 2.8 + 0.9, fan, 3 + Math.cos(angle) * 2.8);
      p.panel({ points: [at(0, fan, 3), left, tip, right], mat: i % 2 ? C.peacockGreen : C.peacock });
      p.ball({ x: tip[0], y: tip[1], z: tip[2] - 0.5, r: 0.75, mat: C.gold, steps: 10, bias: 1 });
    }
    const body = at(0, 0.2, 0);
    p.turn({
      x: body[0],
      y: body[1],
      z: 2.2,
      profile: [
        [0, 0.8],
        [1.2, 2.1, 1],
        [2.6, 1.6, 1],
        [3.2, 0.4],
      ],
      mat: C.peacock,
      steps: 16,
    });
    const neck = at(0, 0.5, 0);
    p.rod({
      from: [neck[0], neck[1], 4.2],
      to: [neck[0] + 0.5, neck[1] + 0.7, 7],
      r: 0.75,
      r1: 0.55,
      mat: C.peacock,
    });
    p.ball({ x: neck[0] + 0.6, y: neck[1] + 0.8, z: 7.4, r: 0.9, mat: C.peacock, steps: 14 });
    p.rod({
      from: [neck[0] + 1, neck[1] + 1.4, 7.4],
      to: [neck[0] + 1.5, neck[1] + 1.9, 7.1],
      r: 0.35,
      r1: 0,
      mat: C.saffron,
      steps: 6,
    });
    p.rod({
      from: [neck[0] + 0.6, neck[1] + 0.8, 8.2],
      to: [neck[0] + 0.4, neck[1] + 0.5, 9.6],
      r: 0.2,
      mat: C.gold,
      steps: 6,
    });
  },
);

const cow = prop({ kind: 'cow', regions: ['mithila'], zone: 'back', anim: 'none', variety: true }, (p) => {
  for (const [x, y] of [
    [-2.8, -1],
    [-2.8, 1],
    [2.6, -1],
    [2.6, 1],
  ]) {
    p.box({ x, y, z: 0.5, w: 1, d: 1, h: 2.4, mat: C.cowWhite, r: 0.3 });
    p.box({ x, y, z: 0, w: 1.1, d: 1.1, h: 0.5, mat: C.bark, r: 0.2 });
  }
  p.box({ x: -2.2, y: 0, z: 2.6, w: 3, d: 3.4, h: 3, mat: C.cowSpot, r: 0.9, steps: 3 });
  p.box({ x: 0.3, y: 0, z: 2.6, w: 3.2, d: 3.4, h: 3, mat: C.cowWhite, r: 0.9, steps: 3 });
  p.box({ x: 2.3, y: 0, z: 2.8, w: 2.6, d: 3.2, h: 2.8, mat: C.cowSpot, r: 0.9, steps: 3 });
  p.ball({ x: 1.8, y: 0, z: 5.8, r: 1.35, mat: C.cowWhite, steps: 16 });
  p.box({ x: 3.8, y: 0, z: 3.6, w: 2.6, d: 2.3, h: 2.4, mat: C.cowWhite, r: 0.8, steps: 3 });
  p.box({ x: 5, y: 0, z: 3.6, w: 1.2, d: 1.8, h: 1.2, mat: C.lotus, r: 0.5 });
  p.rod({ from: [3.6, -1.2, 5.8], to: [3.2, -2, 6.9], r: 0.35, r1: 0, mat: C.parchment, steps: 6 });
  p.rod({ from: [3.6, 1.2, 5.8], to: [3.2, 2, 6.9], r: 0.35, r1: 0, mat: C.parchment, steps: 6 });
  p.rod({ from: [-3.7, 0, 5], to: [-4.1, 0.2, 2.2], r: 0.3, mat: C.cowSpot, steps: 6 });
  for (const y of [-1.9, 0, 1.9]) p.ball({ x: 3, y, z: 3.3, r: 0.55, mat: C.saffron, steps: 10, bias: 2 });
});

const pathStone = prop(
  { kind: 'path-stone', regions: ['mithila'], zone: 'back', anim: 'none', variety: true },
  (p) => {
    p.box({ x: -2.8, y: -1.2, w: 3.8, d: 3, h: 0.9, mat: C.parchment, r: 1.1, steps: 3 });
    p.box({ x: 1.2, y: 0.8, w: 4.2, d: 3.2, h: 1.1, mat: C.parchment, r: 1.2, steps: 3 });
    p.box({ x: -0.6, y: 2.1, w: 2.6, d: 2, h: 0.7, mat: C.straw, r: 0.9, steps: 3 });
    p.box({ x: 3.4, y: -1.6, w: 2.4, d: 2, h: 0.7, mat: C.straw, r: 0.9, steps: 3 });
    for (const [x, y] of [
      [-4, 0.8],
      [4, 0.8],
    ]) {
      p.cone({ x, y, r: 0.7, h: 2.8, mat: C.mangoLight, steps: 6 });
      p.cone({ x, y: y + 0.9, r: 0.6, h: 2.1, mat: C.leaf, steps: 6 });
    }
  },
);

const threshold = prop(
  {
    kind: 'ayodhya-threshold',
    regions: ['mithila'],
    zone: 'side',
    anim: 'none',
    squares: [1],
    variety: false,
  },
  (p) => {
    p.box({ x: 0, y: 0, w: 8, d: 34, h: 0.5, mat: C.parchment, r: 0.5, inlay: 1 });
    for (const x of [-4.4, 4.4]) {
      for (let i = 0; i < 6; i++) p.box({ x, y: -14 + i * 5.6, w: 1.4, d: 4.2, h: 0.9, mat: C.sand, r: 0.5 });
    }
    for (const y of [-12, -4, 4, 12]) p.ball({ x: 0, y, z: 0.8, r: 0.7, mat: C.saffron, steps: 10, bias: 2 });
  },
);

const lamp = prop(
  {
    kind: 'lamp',
    regions: ['mithila', 'ayodhya'],
    zone: 'back',
    anim: 'flicker',
    squares: [1],
    variety: true,
  },
  (p) => {
    p.cyl({ x: 0, y: 0, r: 2.4, h: 1, mat: C.stoneDark, steps: 14 });
    p.cyl({ x: 0, y: 0, r: 1.5, z: 1, h: 0.8, mat: C.stone, steps: 14 });
    p.turn({
      x: 0,
      y: 0,
      z: 1.8,
      profile: [
        [0, 0.9],
        [5, 0.7, 1],
        [5.4, 0.9],
      ],
      mat: C.brass,
      steps: 12,
    });
    p.turn({
      x: 0,
      y: 0,
      z: 6.9,
      profile: [
        [0, 0.8],
        [0.2, 2.4, 1],
        [1.5, 2.9, 1],
        [1.6, 2.6],
      ],
      mat: C.brass,
      steps: 18,
    });
    p.cone({ x: 0, y: 0, z: 8.5, r: 1.3, h: 3, mat: C.saffron, steps: 12 });
    p.ball({ x: 0, y: 0, z: 9.2, r: 0.8, mat: C.gold, steps: 12 });
  },
);

const janakaPalace = prop(
  { kind: 'janaka-palace', regions: ['mithila'], zone: 'side', anim: 'none', squares: [36], variety: false },
  (p) => {
    p.box({ x: 0, y: 0, w: 11, d: 32, h: 1.6, mat: C.sandDark, r: 0.6, seams: [0.8] });
    p.box({ x: 0, y: 0, z: 1.6, w: 9, d: 28, h: 6, mat: C.sand, seams: [3], inlay: 0.9 });
    for (const y of [-10, 0, 10]) {
      p.box({ x: 0, y, z: 7.6, w: 6.4, d: 6.4, h: 3.2, mat: C.plaster, r: 0.4 });
      p.cone({ x: 0, y, z: 10.8, r: 3.8, r1: 0.6, h: y === 0 ? 5.5 : 4, mat: C.gold, steps: 16 });
    }
    p.ball({ x: 0, y: 0, z: 17.2, r: 0.9, mat: C.saffron, steps: 12 });
    for (const y of [-11, -5.5, 0, 5.5, 11])
      p.cyl({ x: 4.9, y, z: 1.6, r: 0.7, h: 5.4, mat: C.plaster, steps: 10 });
  },
);

export const MITHILA = [
  mangoTree,
  riceStripes,
  sageHut,
  lamp,
  plough,
  peacock,
  cow,
  pathStone,
  threshold,
  janakaPalace,
];
