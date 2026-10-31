// Lanka (rows 11-12, squares 121-144): golden walls and towers with blood banners under a night sky, arrows, fires, the
// torn banner of the battlefield and the coronation dais at 144 (no lamps or offerings, no halo: T40 section 9 item 8).
import { prop } from './kit.mjs';
import { C } from './palette.mjs';

const R = [0.819, -0.574];
const at = (u, z, y0 = 0) => [R[0] * u, R[1] * u + y0, z];
const STONE = '#6C73C4';
const STONE_DARK = '#4A50A0';
const WINDOW = '#14163F';

const lankaWall = prop(
  { kind: 'lanka-wall', regions: ['lanka'], zone: 'side', anim: 'none', squares: [121, 132], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 10.4, d: 34, h: 1.8, mat: STONE, r: 0.6, seams: [0.9] });
    p.box({ x: 0, y: 0, z: 1.8, w: 8.4, d: 31, h: 8.8, mat: C.gold, r: 0.5, seams: [3.4, 6.2], inlay: 0.9 });
    p.box({ x: 0, y: 0, z: 10.6, w: 9.2, d: 31.8, h: 1, mat: C.goldDark, r: 0.4 });
    for (let i = 0; i < 6; i++)
      p.box({ x: 0, y: -12 + i * 4.8, z: 11.6, w: 6.2, d: 2.6, h: 2.4, mat: C.gold, r: 0.4 });
    for (const y of [-14.6, 14.6]) {
      p.cyl({ x: 0, y, r: 3, h: 15, mat: C.gold, steps: 16, seams: [4.8, 10.4] });
      p.cyl({ x: 0, y, z: 15, r: 3.5, h: 0.9, mat: C.goldDark, steps: 16 });
      p.cone({ x: 0, y, z: 15.9, r: 3.4, h: 5.2, mat: C.bloodLight, steps: 16 });
    }
    for (const y of [-6, 0, 6]) p.box({ x: 4.25, y, z: 4.6, w: 0.3, d: 1.6, h: 2.6, mat: WINDOW, r: 0.2 });
  },
);

const towerBanner = prop(
  {
    kind: 'tower-banner',
    regions: ['lanka'],
    zone: 'side',
    anim: 'sway',
    squares: [125, 129],
    variety: true,
  },
  (p) => {
    p.box({ x: 0, y: 0, w: 8, d: 8, h: 1.6, mat: STONE_DARK, r: 0.5 });
    p.box({ x: 0, y: 0, z: 1.6, w: 6, d: 6, h: 11, mat: STONE, r: 0.4, seams: [3.6, 7.2] });
    p.box({ x: 0, y: 3.05, z: 4.4, w: 1.6, d: 0.3, h: 2.8, mat: WINDOW, r: 0.2 });
    p.box({ x: 3.05, y: 0, z: 8, w: 0.3, d: 1.6, h: 2.8, mat: WINDOW, r: 0.2 });
    p.box({ x: 0, y: 0, z: 12.6, w: 8, d: 8, h: 0.9, mat: C.gold, r: 0.4 });
    p.pyramid({ x: 0, y: 0, z: 13.5, half: 3.2, h: 4.2, mat: C.goldDark });
    p.rod({ from: [0, 0, 17.4], to: [0, 0, 21.4], r: 0.3, mat: C.gold, steps: 6 });
    p.panel({
      points: [at(0.3, 21, 0), at(5.2, 20.6, 0), at(3.9, 19.2, 0), at(5.2, 17.8, 0), at(0.3, 17.4, 0)],
      mat: C.blood,
    });
    p.panel({
      points: [at(0.3, 21, 0), at(5.2, 20.6, 0), at(5, 20, 0), at(0.3, 20.2, 0)],
      mat: C.gold,
      bias: 0.5,
    });
  },
);

const arrowStack = prop(
  { kind: 'arrow-stack', regions: ['lanka'], zone: 'back', anim: 'none', squares: [123, 131], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 7.6, d: 4.2, h: 0.8, mat: STONE_DARK, r: 1, steps: 3 });
    const shafts = [
      [-3, 0.8, -3.6, 0.4, 9.6],
      [-1.8, -0.6, -2, -0.8, 10.4],
      [-0.4, 0.8, -0.2, 0.6, 9.8],
      [1, -0.4, 1.8, -0.6, 10.6],
      [2.2, 0.8, 3.2, 0.9, 9.4],
      [3.2, -0.3, 4, -0.2, 8.6],
    ];
    for (const [x, y, tx, ty, h] of shafts) {
      p.rod({ from: [x, y, 0.6], to: [tx, ty, h], r: 0.3, mat: '#D8B66A', steps: 6 });
      p.rod({
        from: [tx - (tx - x) * 0.18, ty - (ty - y) * 0.18, h - 2],
        to: [tx, ty, h],
        r: 0.62,
        r1: 0.5,
        mat: C.blood,
        steps: 6,
      });
      p.ball({ x: tx, y: ty, z: h + 0.3, r: 0.38, mat: C.gold, steps: 8 });
    }
  },
);

const fire = prop(
  {
    kind: 'fire',
    regions: ['lanka'],
    zone: 'back',
    anim: 'flicker',
    emit: [0, 0, 11.2],
    squares: [134, 136],
    variety: true,
  },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 2.2, rOut: 3, h: 1.8, mat: STONE, steps: 18 });
    p.cyl({ x: 0, y: 0, z: 0.4, r: 2.4, h: 1, mat: '#D2492B', steps: 16 });
    p.rod({ from: [-2, -0.4, 1.6], to: [2, 0.5, 1.9], r: 0.55, mat: C.bark, steps: 8 });
    p.rod({ from: [-0.8, 1.6, 1.7], to: [1, -1.7, 1.9], r: 0.5, mat: C.trunk, steps: 8 });
    p.cone({ x: 0, y: 0, z: 1.5, r: 2.3, r1: 0, h: 9, mat: '#E8552B' });
    p.cone({ x: 0.2, y: 0, z: 1.7, r: 1.8, r1: 0, h: 7, mat: C.saffron, bias: 0.3 });
    p.cone({ x: 0.3, y: 0.1, z: 1.9, r: 1.2, r1: 0, h: 5, mat: C.gold, bias: 0.6 });
    p.cone({ x: 0.3, y: 0.1, z: 2.1, r: 0.8, r1: 0, h: 3, mat: C.parchment, bias: 0.9 });
    for (const [x, y, z] of [
      [-2.4, 0.6, 8.6],
      [2.2, -0.8, 9.6],
      [1.2, 1.6, 7.2],
    ])
      p.ball({ x, y, z, r: 0.38, mat: C.gold, steps: 8, bias: 2 });
  },
);

const brokenBanner = prop(
  { kind: 'broken-banner', regions: ['lanka'], zone: 'side', anim: 'sway', squares: [137], variety: true },
  (p) => {
    p.box({ x: 0, y: 0, w: 4.6, d: 4.6, h: 1.2, mat: STONE_DARK, r: 0.6 });
    p.cyl({ x: 0, y: 0, z: 1.2, r: 0.65, h: 10.4, mat: C.teak, steps: 10, seams: [4, 8] });
    p.cone({ x: 0, y: 0, z: 11.6, r: 0.65, r1: 0.1, h: 1.4, mat: C.teak, steps: 8 });
    p.rod({ from: at(-3.6, 11.2), to: at(3.8, 11.2), r: 0.34, mat: C.goldDark, steps: 6 });
    p.ball({ x: at(-3.6, 0)[0], y: at(-3.6, 0)[1], z: 11.2, r: 0.55, mat: C.gold, steps: 8 });
    p.ball({ x: at(3.8, 0)[0], y: at(3.8, 0)[1], z: 11.2, r: 0.55, mat: C.gold, steps: 8 });
    const torn = [5.4, 6.8, 5.2, 6.4, 4.8, 6.6, 5.6, 6.2];
    const top = Array.from({ length: 9 }, (_, i) => at(-3.2 + (i * 6.4) / 8, 10.8));
    const bottom = torn.map((z, i) => at(-3.2 + ((i + 0.5) * 6.4) / 8, z)).reverse();
    p.panel({ points: [...top, at(3.2, 6), ...bottom, at(-3.2, 6.4)], mat: C.blood });
    for (let i = 0; i < 10; i++) {
      const u = -2.9 + i * 0.64;
      const base = at(u, 8.4, 0.05);
      p.panel({
        points: [base, at(u + 0.48, 8.4, 0.05), at(u + 0.24, 9.5, 0.05)],
        mat: C.gold,
        bias: 0.6,
      });
    }
    p.rod({ from: [4.6, 2.4, 0.8], to: [1.6, 4.2, 1.2], r: 0.5, r1: 0.4, mat: C.teak, steps: 8 });
  },
);

const goldLamp = prop(
  { kind: 'gold-lamp', regions: ['lanka'], zone: 'back', anim: 'flicker', variety: true },
  (p) => {
    p.cyl({ x: 0, y: 0, r: 2.8, h: 0.8, mat: C.goldDark, steps: 16 });
    p.cyl({ x: 0, y: 0, z: 0.8, r: 1.9, h: 0.8, mat: C.gold, steps: 16 });
    p.turn({
      x: 0,
      y: 0,
      z: 1.6,
      profile: [
        [0, 0.9],
        [1.2, 1.5, 1],
        [2.4, 0.8, 1],
        [4, 0.7, 1],
        [4.4, 1.2],
      ],
      mat: C.gold,
      steps: 14,
    });
    for (const s of [-1, 1]) {
      p.rod({
        from: [0, 0, 4.6],
        to: [s * 2.8 * R[0], s * 2.8 * R[1], 6.4],
        r: 0.3,
        mat: C.goldDark,
        steps: 6,
      });
      p.cone({ x: s * 2.8 * R[0], y: s * 2.8 * R[1], z: 6.4, r: 1, r1: 0.7, h: 0.8, mat: C.gold, steps: 10 });
      p.cone({
        x: s * 2.8 * R[0],
        y: s * 2.8 * R[1],
        z: 7.2,
        r: 0.55,
        h: 1.9,
        mat: C.saffron,
        steps: 8,
        bias: 1,
      });
    }
    p.turn({
      x: 0,
      y: 0,
      z: 6.2,
      profile: [
        [0, 0.8],
        [0.2, 2.5, 1],
        [1.5, 2.9, 1],
        [1.6, 2.6],
      ],
      mat: C.gold,
      steps: 18,
    });
    p.cone({ x: 0, y: 0, z: 7.8, r: 1.2, h: 3.4, mat: C.saffron, steps: 10 });
    p.ball({ x: 0, y: 0, z: 8.6, r: 0.7, mat: C.parchment, steps: 10, bias: 1 });
  },
);

const terraceStep = prop(
  { kind: 'terrace-step', regions: ['lanka'], zone: 'back', anim: 'none', variety: true },
  (p) => {
    p.box({ x: 0, y: -2, w: 9, d: 2, h: 3.4, mat: STONE_DARK, r: 0.4, seams: [1.7] });
    p.box({ x: 0, y: 0, w: 9, d: 2, h: 2.2, mat: STONE, r: 0.4, seams: [1.1] });
    p.box({ x: 0, y: 2, w: 9, d: 1.8, h: 1, mat: '#8D94DA', r: 0.4 });
    for (const [y, z, h] of [
      [-2, 3.4, 0.5],
      [0, 2.2, 0.5],
      [2, 1, 0.5],
    ])
      p.box({ x: 0, y, z, w: 9.2, d: 1.6, h: 0.3, mat: C.gold, r: 0.2, bias: 0.1 + h });
    for (const x of [-4, 4]) {
      p.box({ x, y: -2, z: 3.4, w: 1.1, d: 1.1, h: 1.3, mat: C.goldDark, r: 0.3 });
      p.ball({ x, y: -2, z: 5.1, r: 0.55, mat: C.gold, steps: 10 });
    }
  },
);

const dais = prop(
  { kind: 'dais', regions: ['lanka'], zone: 'centre', anim: 'none', squares: [144], variety: false },
  (p) => {
    p.ring({ x: 0, y: 0, rIn: 13.4, rOut: 16, h: 0.4, mat: C.gold, steps: 56 });
    p.ring({ x: 0, y: 0, rIn: 9.8, rOut: 11.6, h: 0.4, mat: C.goldDark, steps: 44 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      p.cyl({
        x: Math.cos(a) * 7.2,
        y: Math.sin(a) * 7.2,
        r: 1.5,
        h: 0.4,
        mat: i % 2 ? C.saffron : C.gold,
        steps: 14,
      });
    }
    p.cyl({ x: 0, y: 0, r: 3.8, h: 0.4, mat: C.gold, steps: 22 });
    p.cyl({ x: 0, y: 0, r: 1.7, h: 0.4, mat: C.saffron, steps: 14, bias: 1 });
  },
);

export const LANKA = [lankaWall, towerBanner, arrowStack, fire, brokenBanner, goldLamp, terraceStep, dais];
