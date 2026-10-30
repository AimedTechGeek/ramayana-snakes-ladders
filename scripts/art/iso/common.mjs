// Shared helpers of the isometric art build (T40 spec sections 2.5, 3.1, 7.2-7.4, 8): standalone light SVG export,
// ink and seat colour classes, the single-stroke numeral font, a crop helper and the manifest writer.
// Build scripts import the anatomy kit from ../anatomy and the projection from ../iso-board.mjs.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { figureSvg, ISO_CSS, iso, lineSvg, onTop } from '../anatomy/iso-kit.mjs';
import { TOP_Z } from './world.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

// ---------------------------------------------------------------- colour

const parseHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');

/** `from` mixed `amount` (0..1) of the way toward `to`; both '#RRGGBB'. Returns upper-case '#RRGGBB'. */
export function mixHex(from, to, amount) {
  const a = parseHex(from);
  const b = parseHex(to);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}

/** Anatomy light tokens the inks and seat bands mix against (spec 7.1). */
export const TOKENS = { white: '#FFFFFF', hi: '#26262A', mid: '#8A8A8F' };

/** Seat colours, the colour exception (spec 7.2). Must equal HEROES[hero].cssColor. */
export const SEAT_COLOURS = { rama: '#3F6FC2', sita: '#D15587', lakshmana: '#2E9E6B', hanuman: '#E4572E' };

/** Band tokens per hero: top = seat colour, shade-3 = 18% to white, shade-0 = 22% to hi, shade-1/2 interpolated. */
export function seatBand(hero) {
  const top = SEAT_COLOURS[hero];
  if (!top) throw new Error(`Unknown seat ${hero}`);
  const shade3 = mixHex(top, TOKENS.white, 0.18);
  const shade0 = mixHex(top, TOKENS.hi, 0.22);
  return {
    top,
    shades: [shade0, mixHex(shade0, shade3, 1 / 3), mixHex(shade0, shade3, 2 / 3), shade3],
  };
}

/** Snake inks (spec 7.3): edge/ring = body 50% to mid, head crease = body 35% to hi. Bodies from the snake palette. */
export function snakeInks() {
  const palette = readJson('../../../public/assets/snakes/palette.json');
  return Object.fromEntries(
    Object.entries(palette).map(([id, look]) => [
      id,
      { edge: mixHex(look.body, TOKENS.mid, 0.5), head: mixHex(look.body, TOKENS.hi, 0.35) },
    ]),
  );
}

/** Ladder inks (spec 7.4): rail and rung colour 50% to mid. Colours from the ladder palette. */
export function ladderInks() {
  const palette = readJson('../../../public/assets/ladders/palette.json');
  return Object.fromEntries(
    Object.entries(palette).map(([id, look]) => [
      id,
      { rail: mixHex(look.rail, TOKENS.mid, 0.5), rung: mixHex(look.rung, TOKENS.mid, 0.5) },
    ]),
  );
}

const LINES = (scope) => `${scope} .iso-line,${scope} .tb-ring,${scope} .iso-edge{stroke:`;

/**
 * Classes the build adds after the kit's own rules (so they win at equal specificity):
 * vector-effect none (spec 8), numerals, odd-tile top, seat bands, snake / ladder ink classes.
 * Usage: `.iso-solid ink-<snake>` on a snake's pieces, `hink-<snake>` on its head, `rail-<ladder>` and `rung-<ladder>`
 * on the ladder's rails and rungs, `seat-<hero>` on the seat band, `sq-b` on odd tiles.
 */
export function extraCss() {
  const rules = [
    '.iso-svg path,.iso-svg circle{vector-effect:none}',
    '.iso-numeral{stroke-width:.9}',
    '.sq-b{--anatomy-top:#F4F4F1}',
  ];
  for (const hero of Object.keys(SEAT_COLOURS)) {
    const { top, shades } = seatBand(hero);
    const vars = shades.map((v, i) => `--anatomy-shade-${i}:${v}`).join(';');
    rules.push(`.seat-${hero}{--anatomy-top:${top};${vars}}`);
  }
  for (const [id, ink] of Object.entries(snakeInks())) {
    rules.push(`${LINES(`.ink-${id}`)}${ink.edge}}`);
    rules.push(`${LINES(`.hink-${id}`)}${ink.head}}`);
  }
  for (const [id, ink] of Object.entries(ladderInks())) {
    rules.push(`${LINES(`.rail-${id}`)}${ink.rail}}`);
    rules.push(`${LINES(`.rung-${id}`)}${ink.rung}}`);
  }
  return rules.join('\n');
}

// ---------------------------------------------------------------- export

/** The kit's token and solid rules without its plate, legend and animation parts, plus extraCss(). */
function standaloneCss() {
  const end = ISO_CSS.indexOf('@keyframes');
  if (end < 0) throw new Error('iso.css layout changed: no @keyframes marker');
  return `${ISO_CSS.slice(0, end)}\n${extraCss()}\n`;
}

/** A standalone light SVG (figureSvg `standalone: 'light'`) whose embedded style is the trimmed kit css + extraCss(). */
export function exportSvg({ width, height, label, body }) {
  const svg = figureSvg({ width, height, label, body, standalone: 'light' });
  const start = svg.indexOf('<style>');
  const end = svg.indexOf('</style>');
  if (start < 0 || end < 0) throw new Error('figureSvg standalone output has no <style>');
  return `${svg.slice(0, start)}<style>${standaloneCss()}${svg.slice(end)}`;
}

/**
 * Shift a projection so the given world points sit `pad` px inside a viewBox that starts at 0,0.
 * Returns { projection, width, height } with whole-pixel width and height.
 */
export function cropProjection(base, worldPoints, pad = 8) {
  const flat = worldPoints.map((p) => iso(p, base));
  const left = Math.min(...flat.map(([x]) => x));
  const right = Math.max(...flat.map(([x]) => x));
  const top = Math.min(...flat.map(([, y]) => y));
  const bottom = Math.max(...flat.map(([, y]) => y));
  return {
    projection: { ...base, origin: [base.origin[0] - left + pad, base.origin[1] - top + pad] },
    width: Math.ceil(right - left + pad * 2),
    height: Math.ceil(bottom - top + pad * 2),
  };
}

export function writeSvg(file, svg) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, svg.endsWith('\n') ? svg : `${svg}\n`);
}

/**
 * Write a manifest JSON with sorted keys, e.g. figurines.json `{ "<hero>.<emotion>.<lit|plain>.<size>":
 * { w, h, anchorX, anchorY, k } }`. Returns the text written.
 */
export function writeManifest(file, entries) {
  const sorted = Object.fromEntries(Object.entries(entries).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const text = `${JSON.stringify(sorted, null, 2)}\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return text;
}

// ---------------------------------------------------------------- numerals (spec 2.5)

/** Single-stroke engraving font: grid 8 wide x 14 tall, "u,v" points with v up. One string per stroke (spec 2.5). */
const FONT = {
  0: ['2,0 6,0 8,2 8,12 6,14 2,14 0,12 0,2 2,0'],
  1: ['2,11 4,14 4,0', '1,0 7,0'],
  2: ['0,11 2,14 6,14 8,12 8,9 0,0 8,0'],
  3: ['0,14 8,14 4,8 7,8 8,6 8,2 6,0 2,0 0,2'],
  4: ['6,0 6,14 0,4 8,4'],
  5: ['8,14 0,14 0,8 5,8 8,6 8,2 6,0 2,0 0,2'],
  6: ['7,14 3,14 0,11 0,2 2,0 6,0 8,2 8,6 6,8 0,8'],
  7: ['0,14 8,14 3,0'],
  8: ['2,8 0,10 0,12 2,14 6,14 8,12 8,10 6,8 2,8 0,6 0,2 2,0 6,0 8,2 8,6 6,8'],
  9: ['8,6 2,6 0,8 0,12 2,14 6,14 8,12 8,3 6,0 1,0'],
};

/** The font as polylines of [u, v] points, keyed by digit. */
export const NUMERAL_STROKES = Object.fromEntries(
  Object.entries(FONT).map(([digit, strokes]) => [
    digit,
    strokes.map((stroke) => stroke.split(' ').map((pair) => pair.split(',').map(Number))),
  ]),
);

export const NUMERAL_ADVANCE = 10;
export const NUMERAL_WIDTH = 8;
/** Baseline offset below the tile centre: digits stand on y = cy + 26 and rise 14 units toward the far side. */
export const NUMERAL_BASELINE = 26;

/** World polylines ([x, y] points, one per stroke) of a number string centred on cx, standing on cy + 26. */
export function numeralStrokes(text, cx, cy) {
  const digits = [...String(text)];
  const width = (digits.length - 1) * NUMERAL_ADVANCE + NUMERAL_WIDTH;
  const out = [];
  digits.forEach((digit, i) => {
    const strokes = NUMERAL_STROKES[digit];
    if (!strokes) throw new Error(`No numeral stroke for "${digit}"`);
    const x0 = cx - width / 2 + i * NUMERAL_ADVANCE;
    for (const stroke of strokes) out.push(stroke.map(([u, v]) => [x0 + u, cy + NUMERAL_BASELINE - v]));
  });
  return out;
}

/** A tile's engraved number as one `mid` line, `data-free="both"`, at TOP_Z. (cx, cy) is the tile centre. */
export function numeralSvg(text, cx, cy, projection, z = TOP_Z) {
  const d = numeralStrokes(text, cx, cy)
    .map((stroke) => onTop(stroke, z, projection))
    .join('');
  return lineSvg(d, { tone: 'mid', className: 'iso-numeral', free: 'both' });
}
