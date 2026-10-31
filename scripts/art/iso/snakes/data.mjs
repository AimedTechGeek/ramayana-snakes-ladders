// Per-snake data (T42 spec 5.1 size table, 5.5 story identity). Bodies follow 5.5 (where palette.json differs, 5.5 wins).
// `pitch` is the pattern station spacing in world units; every pattern entry draws on stations i with i % every === 0.
// Pattern colours default to the body 35 % toward ink; `gold` marks and `pale` marks are listed explicitly.

import { mixHex } from '../common.mjs';
import { INK } from '../tones.mjs';

export const GOLD = '#E9C12F';
export const PARCHMENT = '#F3E3B8';
export const SAFFRON = '#F39C2B';
export const BLOOD_RED = '#8E3B3B';
const dark = (hex) => mixHex(hex, INK, 0.35);

/** Head-top targets by body radius (spec 5.1 table; 2.6-3.0 is 33-34, so 33.5): { test, top, rh }. */
export const SNAKE_TABLE = [
  { test: (R) => R <= 2.3, top: 29, rh: 8.0, rise: 14 },
  { test: (R) => R <= 3.1, top: 33.5, rh: 8.5, rise: 14 },
  { test: (R) => R <= 3.5, top: 36, rh: 9.0, rise: 14 },
  { test: () => true, top: 41.0, rh: 10.0, rise: 16 },
];

const entry = (id, R, body, pitch, patterns, extra = {}) => {
  const row = SNAKE_TABLE.find((r) => r.test(R));
  return { id, R, rh: row.rh, top: row.top, rise: row.rise, body, pitch, patterns, ...extra };
};

export const SNAKES = {
  tataka: entry('tataka', 2.8, '#457334', 6, [{ kind: 'bands', colour: dark('#457334'), width: 2.4 }], {
    motif: 'hair',
    prop: 'stump',
  }),
  manthara: entry('manthara', 2.2, '#1C1F4D', 4.4, [{ kind: 'diamonds', colour: GOLD, length: 3.6, span: 1.15 }], {
    motif: 'shawl',
    prop: 'scroll',
  }),
  kaikeyi: entry('kaikeyi', 2.8, '#7B3B6E', 3.2, [{ kind: 'spots', colour: mixHex('#7B3B6E', PARCHMENT, 0.55), size: 0.55 }], {
    motif: 'bangles',
    prop: 'window',
  }),
  viradha: entry(
    'viradha',
    3.0,
    '#A4703E',
    6,
    [
      { kind: 'bands', colour: dark('#A4703E'), width: 2.4 },
      { kind: 'spots', colour: INK, size: 0.4, rows: [-0.35, 0.35] },
    ],
    { motif: 'none', prop: 'club' },
  ),
  shurpanakha: entry('shurpanakha', 2.8, '#8E3B3B', 6, [{ kind: 'bands', colour: dark('#8E3B3B'), width: 2.4 }], {
    motif: 'nosering',
    prop: 'nails',
  }),
  'golden-deer': entry(
    'golden-deer',
    2.8,
    '#E9C12F',
    3.4,
    [{ kind: 'spots', colour: PARCHMENT, size: 0.6 }],
    { motif: 'antlers', prop: 'none' },
  ),
  abduction: entry('abduction', 3.0, '#783431', 3.4, [{ kind: 'spots', colour: mixHex('#783431', PARCHMENT, 0.5), size: 0.6 }], {
    motif: 'none',
    prop: 'wheel',
  }),
  kabandha: entry('kabandha', 3.0, '#457334', 6, [{ kind: 'bands', colour: dark('#457334'), width: 2.4 }], {
    motif: 'headless',
    prop: 'none',
    head: { kind: 'cap' },
    aim: 'camera',
    headPitch: 0,
  }),
  'indrajit-arrows': entry('indrajit-arrows', 2.6, '#3A3F9E', 4.2, [{ kind: 'diamonds', colour: '#8A91E8', length: 3.4, span: 1.2 }], {
    motif: 'bowknot',
    prop: 'arrows',
  }),
  prahasta: entry(
    'prahasta',
    3.0,
    '#C98B4B',
    5,
    [
      { kind: 'bands', colour: dark('#C98B4B'), width: 2.6 },
      { kind: 'bands', colour: GOLD, width: 0.5, offset: 1.9 },
      { kind: 'bands', colour: GOLD, width: 0.5, offset: -1.9 },
    ],
    { motif: 'crest', prop: 'shield' },
  ),
  kumbhakarna: entry('kumbhakarna', 3.4, '#A6723E', 8, [{ kind: 'bands', colour: dark('#A6723E'), width: 3.2 }], {
    motif: 'sleep',
    prop: 'drum',
    eye: { shut: true },
  }),
  brahmastra: entry('brahmastra', 2.2, SAFFRON, 3.6, [{ kind: 'diamonds', colour: GOLD, length: 3, span: 1.0 }], {
    motif: 'arrowhead',
    prop: 'none',
    head: { kind: 'arrow' },
  }),
  ravana: entry(
    'ravana',
    4.0,
    '#1C1F4D',
    5,
    [
      { kind: 'diamonds', colour: GOLD, length: 4.2, span: 1.15 },
      { kind: 'bands', colour: dark(GOLD), width: 1.1, every: 2 },
    ],
    { motif: 'crown', prop: 'banner', eye: { colour: '#D6362B', size: 0.34 * 4 } },
  ),
};

export const SNAKE_IDS = Object.keys(SNAKES);
