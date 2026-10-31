// Kishkindha (rows 8-9, squares 85-108): ochre rock country with a cave, a waterfall, Rishyamukha hill, banana plants,
// Shabari's berries and basket, and a carved frieze stone. Every figure is plain and dignified (T02 respect rules).
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const boulder = prop(
  { kind: 'boulder', regions: ['kishkindha'], zone: 'back', anim: 'none', variety: true },
  (p) => {
    p.faceted({
      x: 0,
      y: 0.2,
      profile: [
        [0, 2.3],
        [2.2, 2.6],
        [4.4, 1.7],
        [5.2, 1.1],
      ],
      sides: 7,
      jitter: 0.4,
      mat: C.ochre,
      turn: 0.3,
    });
    p.faceted({
      x: -3.4,
      y: 0.8,
      profile: [
        [0, 1.4],
        [1.2, 1.6],
        [2.6, 0.9],
      ],
      sides: 6,
      jitter: 0.4,
      mat: C.ochreDark,
      turn: 0.8,
    });
    p.faceted({
      x: 3.4,
      y: 1.2,
      profile: [
        [0, 1.1],
        [0.9, 1.2],
        [1.9, 0.6],
      ],
      sides: 5,
      jitter: 0.3,
      mat: C.rock,
      turn: 0.2,
    });
    p.cone({ x: 0, y: 0.2, z: 5.2, r: 1.1, r1: 0.4, h: 0.6, mat: C.moss, steps: 8, bias: 1 });
    p.cone({ x: -1.4, y: 2.2, r: 0.5, h: 2.2, mat: C.straw, steps: 6 });
    p.cone({ x: -0.7, y: 2.4, r: 0.45, h: 1.8, mat: C.thatch, steps: 6 });
  },
);

const caveMouth = prop(
  { kind: 'cave-mouth', regions: ['kishkindha'], zone: 'side', anim: 'none', squares: [90], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 11, d: 10, h: 8, mat: C.ochre, r: 1.4, steps: 3, seams: [2.6, 5.4] });
    p.faceted({
      x: -0.3,
      y: -0.8,
      z: 8,
      profile: [
        [0, 4.8],
        [3, 4.5],
        [6.2, 3.3],
      ],
      sides: 7,
      jitter: 0.25,
      mat: C.ochreDark,
      turn: 0.4,
    });
    p.faceted({
      x: 0.4,
      y: -0.9,
      z: 14.2,
      profile: [
        [0, 3.3],
        [2.4, 2.8],
        [4.8, 0],
      ],
      sides: 6,
      jitter: 0.2,
      mat: C.ochre,
      turn: 0.9,
    });
    const arch = [[-2.4, 5.06, 0.2]];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i * Math.PI) / 10;
      arch.push([Math.cos(a) * 2.4, 5.06, 3.8 + Math.sin(a) * 3]);
    }
    arch.push([2.4, 5.06, 0.2]);
    p.panel({ points: arch, mat: '#3A2A22' });
    p.box({ x: -3, y: 5.2, w: 1.2, d: 0.9, h: 4.6, mat: C.ochreDark, r: 0.3, bias: 0.5 });
    p.box({ x: 3, y: 5.2, w: 1.2, d: 0.9, h: 4.6, mat: C.ochreDark, r: 0.3, bias: 0.5 });
    p.box({ x: 0, y: 5.2, z: 6.6, w: 7.2, d: 0.9, h: 1.1, mat: C.ochreDark, r: 0.3, bias: 0.5 });
    p.cone({ x: -3.2, y: 1, z: 14.2, r: 0.7, h: 2.6, mat: C.mangoLight, steps: 6 });
    p.cone({ x: 3.2, y: -1.4, z: 14.2, r: 0.6, h: 2.2, mat: C.leaf, steps: 6 });
    p.ball({ x: 3.8, y: 3.2, z: 0.9, r: 0.9, mat: C.stone, steps: 10 });
  },
);

const waterfall = prop(
  { kind: 'waterfall', regions: ['kishkindha'], zone: 'side', anim: 'shimmer', squares: [96], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 11, d: 8, h: 9, mat: C.ochre, r: 1.2, steps: 3, seams: [3, 6] });
    p.box({ x: 0, y: -0.8, z: 9, w: 9, d: 6.4, h: 8, mat: C.ochreDark, r: 1.2, steps: 3, seams: [4] });
    p.box({ x: 0, y: 1.6, z: 17, w: 5, d: 2, h: 0.8, mat: C.ochre, r: 0.4 });
    p.panel({
      points: [
        [-1.6, 2.45, 16.8],
        [1.6, 2.45, 16.8],
        [1.6, 2.45, 9.4],
        [-1.6, 2.45, 9.4],
      ],
      mat: C.water,
    });
    p.panel({
      points: [
        [-0.5, 2.5, 16.8],
        [0.6, 2.5, 16.8],
        [0.6, 2.5, 9.6],
        [-0.5, 2.5, 9.6],
      ],
      mat: C.waterLight,
      bias: 0.2,
    });
    p.panel({
      points: [
        [-1.8, 4.05, 8.8],
        [1.8, 4.05, 8.8],
        [1.8, 4.05, 1],
        [-1.8, 4.05, 1],
      ],
      mat: C.water,
    });
    p.panel({
      points: [
        [-0.6, 4.1, 8.8],
        [0.7, 4.1, 8.8],
        [0.7, 4.1, 1],
        [-0.6, 4.1, 1],
      ],
      mat: C.waterLight,
      bias: 0.2,
    });
    p.cyl({ x: 0, y: 6.4, r: 3.6, h: 0.6, mat: C.water, steps: 22 });
    p.ring({ x: 0, y: 6.4, z: 0.6, rIn: 1.6, rOut: 2.8, h: 0.3, mat: C.foam, steps: 18 });
    for (const [x, y] of [
      [-3.8, 7.2],
      [3.8, 6],
    ])
      p.ball({ x, y, z: 0.9, r: 0.9, mat: C.stone, steps: 10 });
    p.ball({ x: -1.2, y: 5.2, z: 1, r: 0.7, mat: C.foam, steps: 10, bias: 1 });
    p.ball({ x: 1.4, y: 5.4, z: 1.1, r: 0.6, mat: C.foam, steps: 10, bias: 1 });
  },
);

const bananaPlant = prop(
  { kind: 'banana-plant', regions: ['kishkindha'], zone: 'side', anim: 'sway', variety: true },
  (p) => {
    p.cone({ x: 0, y: 0, r: 2.4, r1: 1.3, h: 1.4, mat: C.bark, steps: 12 });
    p.cyl({ x: 0, y: 0, z: 1, r: 1.25, h: 9.8, mat: C.banana, steps: 14, seams: [3, 6] });
    const tilt = [
      [-5.2, -1, 12.2, C.leafDark],
      [1.2, -4.8, 12.8, C.banana],
      [5, -0.4, 12, C.leaf],
      [-1.4, 4.8, 12.4, C.mangoLight],
      [-3.8, 3.2, 11.4, C.banana],
      [3.4, 3.6, 11.8, C.leafDark],
    ];
    for (const [dx, dy, tz, mat] of tilt) {
      const len = Math.hypot(dx, dy);
      const [sx, sy] = [-dy / len, dx / len];
      p.panel({
        points: [
          [0, 0, 10.4],
          [dx * 0.55 + sx * 1.5, dy * 0.55 + sy * 1.5, tz],
          [dx, dy, tz - 1.6],
          [dx * 0.55 - sx * 1.5, dy * 0.55 - sy * 1.5, tz],
        ],
        mat,
      });
    }
    for (const [x, y] of [
      [1.6, 1.8],
      [2.2, 1],
      [1.2, 2.5],
      [2.6, 2.2],
    ])
      p.rod({
        from: [x, y, 8.8],
        to: [x + 0.2, y + 0.2, 6],
        r: 0.5,
        r1: 0.35,
        mat: '#F2D04A',
        steps: 6,
        bias: 1,
      });
  },
);

const berryBush = prop(
  { kind: 'berry-bush', regions: ['kishkindha'], zone: 'back', anim: 'sway', squares: [85], variety: true },
  (p) => {
    p.ball({ x: -2.4, y: -0.4, z: 2.2, r: 2.2, mat: C.leafDark });
    p.ball({ x: 2.4, y: -0.2, z: 2.4, r: 2.4, mat: C.leaf });
    p.ball({ x: 0, y: -1, z: 4, r: 2.2, mat: C.mango });
    for (const [x, y, z] of [
      [-3.4, 1.4, 2],
      [-1.4, 1.8, 3],
      [1.2, 2, 2.6],
      [3.4, 1.6, 3.2],
      [0.4, 0.8, 5.6],
      [-1.8, 0.2, 5.2],
      [2.8, 0.6, 4.8],
    ])
      p.ball({ x, y, z, r: 0.65, mat: C.berry, steps: 10, bias: 2 });
  },
);

const basket = prop(
  { kind: 'basket', regions: ['kishkindha'], zone: 'back', anim: 'none', squares: [85], variety: true },
  (p) => {
    p.cyl({ x: 0, y: 0, r: 2.7, h: 3.6, mat: C.straw, steps: 22, seams: [1.2, 2.4] });
    p.ring({ x: 0, y: 0, z: 3.6, rIn: 2.2, rOut: 3, h: 0.6, mat: C.teak, steps: 22 });
    p.cyl({ x: 0, y: 0, z: 3.2, r: 2.3, h: 0.9, mat: C.blood, steps: 18 });
    for (const [x, y, z] of [
      [-1, 0.2, 4.4],
      [0.9, -0.4, 4.5],
      [0.1, 1, 4.4],
      [-0.2, -1, 4.6],
      [0.2, 0.2, 5.1],
    ])
      p.ball({ x, y, z, r: 0.85, mat: C.berry, steps: 12 });
    p.ball({ x: 3.8, y: 1.6, z: 0.6, r: 0.6, mat: C.berry, steps: 10 });
    p.ball({ x: 4.2, y: -0.2, z: 0.6, r: 0.6, mat: C.berry, steps: 10 });
  },
);

const monkeyFrieze = prop(
  { kind: 'monkey-frieze-stone', regions: ['kishkindha'], zone: 'back', anim: 'none', variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 9.4, d: 3.4, h: 1.2, mat: C.stoneDark, r: 0.5 });
    p.box({ x: 0, y: 0, z: 1.2, w: 8.4, d: 2.4, h: 7, mat: '#B59C74', r: 0.5, seams: [4] });
    p.box({ x: 0, y: 0, z: 8.2, w: 9, d: 3, h: 1, mat: C.stone, r: 0.5 });
    p.panel({
      points: [
        [-3.4, 1.26, 2],
        [3.4, 1.26, 2],
        [3.4, 1.26, 7.4],
        [-3.4, 1.26, 7.4],
      ],
      mat: '#5C3B1E',
    });
    for (const x of [-2.2, 0, 2.2]) {
      // a seated figure with a raised tail: body, head, tail
      p.panel({
        points: [
          [x - 0.7, 1.3, 2.6],
          [x + 0.7, 1.3, 2.6],
          [x + 0.6, 1.3, 4.6],
          [x, 1.3, 5.2],
          [x - 0.6, 1.3, 4.6],
        ],
        mat: '#E9B16A',
        bias: 0.1,
      });
      p.panel({
        points: [
          [x - 0.5, 1.32, 5.2],
          [x + 0.5, 1.32, 5.2],
          [x + 0.5, 1.32, 6.2],
          [x - 0.5, 1.32, 6.2],
        ],
        mat: '#E9B16A',
        bias: 0.12,
      });
    }
  },
);

const hill = prop(
  {
    kind: 'rishyamukha-hill',
    regions: ['kishkindha'],
    zone: 'side',
    anim: 'none',
    squares: [97],
    variety: true,
  },
  (p) => {
    const tiers = [
      [0, 5.9, 4.4, 5.2, C.ochre],
      [4.8, 4.6, 3.3, 5, C.ochreDark],
      [9.4, 3.7, 2.5, 4.8, C.ochre],
      [14, 2.7, 0, 6.4, '#DDA86B'],
    ];
    tiers.forEach(([z, r, r2, h, mat], i) =>
      p.faceted({
        x: 0,
        y: 0,
        z,
        profile: [
          [0, r],
          [h, r2],
        ],
        sides: 9,
        jitter: 0.18,
        mat,
        turn: i * 0.5,
      }),
    );
    p.cyl({ x: 0, y: 0, z: 5.2, r: 4.3, h: 0.4, mat: C.moss, steps: 14, bias: 3 });
    p.cyl({ x: 0, y: 0, z: 9.8, r: 3.3, h: 0.4, mat: C.leaf, steps: 14, bias: 3 });
    p.rod({ from: [-2.4, 2.2, 10.2], to: [-2.4, 2.2, 13], r: 0.4, mat: C.trunk, steps: 6 });
    p.ball({ x: -2.4, y: 2.2, z: 14, r: 1.5, mat: C.mango, steps: 14 });
    p.rod({ from: [2.8, 1.6, 5.6], to: [2.8, 1.6, 8], r: 0.4, mat: C.trunk, steps: 6 });
    p.ball({ x: 2.8, y: 1.6, z: 8.8, r: 1.3, mat: C.leaf, steps: 14 });
  },
);

export const KISHKINDHA = [boulder, caveMouth, waterfall, bananaPlant, berryBush, basket, monkeyFrieze, hill];
