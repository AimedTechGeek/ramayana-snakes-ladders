// Sea (row 10, squares 109-120): swells, foam, sea stacks, a stone buoy, a conch and a gull on its post. The Rama Setu
// stones are the bridge (T42 6.3), and the flying birds are flap frames of the shared sheet.
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const R = [0.819, -0.574];
const at = (u, z, f = 0) => [R[0] * u + 0.574 * f, R[1] * u + 0.819 * f, z];

const waveCrest = prop(
  { kind: 'wave-crest', regions: ['sea'], zone: 'back', anim: 'shimmer', variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 9.4, d: 5.6, h: 1.4, mat: '#2F7AA6', r: 2, steps: 4 });
    p.box({ x: -0.2, y: 0, z: 1.4, w: 7.8, d: 4.4, h: 1.4, mat: '#58AACD', r: 1.9, steps: 4 });
    p.box({ x: -0.6, y: 0, z: 2.8, w: 5.6, d: 3.2, h: 1.3, mat: C.foam, r: 1.4, steps: 4 });
    p.ball({ x: 1.6, y: 0, z: 4.3, r: 1.5, mat: C.foam, steps: 16 });
    for (const [x, y, z] of [
      [3.6, 0.6, 5.6],
      [2.4, -1, 6],
      [4.4, -0.4, 4.4],
      [-2.8, 1, 4.6],
    ])
      p.ball({ x, y, z, r: 0.45, mat: C.foam, steps: 8, bias: 1 });
  },
);

const rockStack = prop(
  { kind: 'rock-stack', regions: ['sea'], zone: 'back', anim: 'shimmer', variety: true },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 2.4, rOut: 3, h: 0.4, mat: C.foam, steps: 26 });
    const layers = [
      [0, 2.3, 3.4, '#7F7A70', 0.2],
      [3.2, 2.1, 3.4, '#9A9488', 0.7],
      [6.4, 1.5, 3, '#B5AFA2', 0.1],
    ];
    for (const [z, r, h, mat, turn] of layers)
      p.faceted({
        x: 0.1,
        y: 0,
        z,
        profile: [
          [0, r],
          [h * 0.45, r * 1.08],
          [h, r * 0.7],
        ],
        sides: 7,
        jitter: 0.22,
        mat,
        turn,
      });
    p.cone({ x: 0.1, y: 0, z: 9.3, r: 0.9, r1: 0.3, h: 0.1, mat: C.foam, steps: 8, bias: 1 });
    p.ball({ x: -4, y: 1, z: 0.9, r: 0.9, mat: '#7F7A70', steps: 10 });
  },
);

const buoyStone = prop(
  { kind: 'buoy-stone', regions: ['sea'], zone: 'back', anim: 'shimmer', variety: true },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 2.4, rOut: 3, h: 0.4, mat: C.foam, steps: 22 });
    p.cyl({ x: 0, y: 0, r: 2.6, h: 1.4, mat: C.stoneDark, steps: 16 });
    const bands = [
      [1.4, 2.4, 2.1, C.saffron],
      [3.2, 2.1, 1.8, C.white],
      [5, 1.8, 1.5, C.saffron],
      [6.8, 1.5, 1.2, C.white],
    ];
    for (const [z, r, r1, mat] of bands) p.cone({ x: 0, y: 0, z, r, r1, h: 1.8, mat, steps: 16 });
    p.cyl({ x: 0, y: 0, z: 8.6, r: 1.5, h: 0.5, mat: C.brass, steps: 12 });
    p.ball({ x: 0, y: 0, z: 9.8, r: 1.1, mat: C.gold, steps: 14 });
  },
);

const foamRing = prop(
  { kind: 'foam-ring', regions: ['sea'], zone: 'back', anim: 'shimmer', variety: true },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 2.1, rOut: 3, h: 0.6, mat: C.foam, steps: 28 });
    p.ring({ x: 0, y: 0, rIn: 0.9, rOut: 1.6, h: 0.4, mat: C.waterLight, steps: 20 });
    p.cyl({ x: 0, y: 0, r: 0.5, h: 0.5, mat: C.foam, steps: 10 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      p.ball({ x: Math.cos(a) * 2.5, y: Math.sin(a) * 2.5, z: 0.9, r: 0.5, mat: C.foam, steps: 8, bias: 1 });
    }
  },
);

const shell = prop({ kind: 'shell', regions: ['sea'], zone: 'back', anim: 'none', variety: true }, (p) => {
  p.prism({
    ring: Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return [-3 + Math.cos(a) * 2.2, 0.8 + Math.sin(a) * 1.8];
    }),
    h: 0.9,
    mat: '#F4D4C4',
    inner: '',
    bevel: 0.3,
  });
  p.turn({
    x: 1.8,
    y: -0.2,
    profile: [
      [0, 2.5],
      [1.3, 2.7, 1],
      [2.8, 1.9, 1],
      [4.2, 0],
    ],
    mat: '#F2C9B6',
    steps: 18,
  });
  p.turn({
    x: 1.8,
    y: -0.2,
    z: 2.2,
    profile: [
      [0, 1.7],
      [1, 1.8, 1],
      [2.4, 0],
    ],
    mat: '#E9B6A0',
    steps: 14,
    bias: 0.5,
  });
  p.box({ x: 3.4, y: 1.2, w: 2.2, d: 1.6, h: 0.9, mat: C.lotus, r: 0.7, steps: 3, bias: 0.4 });
  p.ball({ x: -3.2, y: -1.8, z: 0.55, r: 0.55, mat: C.white, steps: 10 });
});

const gullPerch = prop(
  { kind: 'gull-perch', regions: ['sea'], zone: 'back', anim: 'sway', variety: true },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 1.2, rOut: 2.6, h: 0.4, mat: C.foam, steps: 16 });
    p.cyl({ x: 0, y: 0, r: 0.95, h: 5.4, mat: C.trunk, steps: 10, seams: [2, 3.8] });
    p.cyl({ x: 0, y: 0, z: 5.4, r: 1.15, h: 0.5, mat: C.bark, steps: 10 });
    const [bx, by, bz] = at(0.2, 7.2);
    const tail = at(2.4, 7.5);
    const chest = at(-1.6, 7.8);
    p.rod({
      from: tail,
      to: [tail[0] + 1.4 * R[0], tail[1] + 1.4 * R[1], 7.6],
      r: 0.5,
      r1: 0.1,
      mat: '#7A8590',
      steps: 6,
    });
    p.rod({ from: [bx + R[0] * 2, by + R[1] * 2, bz], to: chest, r: 1.5, r1: 1.7, mat: C.white, steps: 14 });
    p.panel({
      points: [at(-0.8, 8.4, 0.9), at(1.8, 8.4, 0.9), at(2.8, 7.2, 0.9), at(-0.2, 6.6, 0.9)],
      mat: '#A5B0BC',
    });
    const head = at(-2.2, 9.2);
    p.ball({ x: head[0], y: head[1], z: head[2], r: 1.05, mat: C.white, steps: 14 });
    p.rod({ from: at(-3, 9.1), to: at(-4.2, 8.8), r: 0.35, r1: 0, mat: C.saffron, steps: 6 });
    p.dots({ points: [at(-2.7, 9.5, 0.9)], mat: C.ink, size: 0.28, bias: 1 });
  },
);

export const SEA = [waveCrest, rockStack, buoyStone, foamRing, shell, gullPerch];
