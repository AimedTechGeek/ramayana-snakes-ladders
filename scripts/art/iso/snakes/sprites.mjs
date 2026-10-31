// From a built snake figure to sprite SVGs: settle the depth keys (the head sprite is drawn over the coil sprite, so its
// keys are lifted above every coil key before the audit sees them), crop each sprite to its drawing, write the css.

import * as A from '../../anatomy/audit.mjs';
import { exportSvg } from '../common.mjs';
import { tones } from '../tones.mjs';
import { FINE } from './model.mjs';

/** The kit's overlap raster runs in viewBox units: our units are 5 x finer than the kit's, so the cell and the area scale. */
export const SETTLE = { step: 0.25 * FINE, least: 0.25 * FINE * FINE };
const LIFT = 100000;

/** Pairs the audit may not order: the jaw is the same volume as the skull cut at the mouth plane, and the body ends inside the head. */
export const ALLOW = [['head.jaw*', 'head.skull*']];
export const CROWD = [
  ['body', 'head.skull'],
  ['body', 'head.jaw'],
  ['head.hair*', 'head.hair*'],
  ['head.hair*', 'body'],
  ['head.hair*', 'head.skull'],
  ['head.antler*', 'head.tine*'],
  ['head.tine*', 'head.tine*'],
  ['head.antler*', 'head.antler*'],
  ['head.arm*', 'body'],
  ['head.skull', 'head.skull'],
];

/** Settle depth keys of the figure and return the items in drawing order, coil first. */
export function settleKeys(fig) {
  A.settle(fig.R, fig.P, SETTLE);
  for (const item of fig.R.items) {
    item.sprite ??= /^head[.]/.test(item.name) ? 'head' : 'coil';
    if (item.sprite === 'head') item.key += LIFT;
  }
  return [...fig.R.items].sort((a, b) => a.key - b.key);
}

/** Colour rules: the four tones and the line tone of the snake's body at the root, of every part colour on its class. */
export function snakeCss(fig, spec) {
  const vars = (hex) => {
    const t = tones(hex);
    return [
      `--anatomy-top:${t.top}`,
      `--anatomy-paper:${t.shades[2]}`,
      `--anatomy-face:${t.shades[2]}`,
      ...t.shades.map((c, i) => `--anatomy-shade-${i}:${c}`),
      `--anatomy-hi:${t.lines}`,
      `--anatomy-lo:${t.lines}`,
      `--anatomy-mid:${t.lines}`,
      `--anatomy-faint:${t.lines}`,
      `--anatomy-lit:${t.lines}`,
    ].join(';');
  };
  const w = 0.6 * FINE;
  const rules = [
    `.iso-svg.iso[data-theme="light"]{${vars(spec.body)};--anatomy-weight:${w}px;--anatomy-halo:#2A1A0F;--anatomy-halo-opacity:.32}`,
    `.tb-ring{stroke-width:${0.45 * FINE}}`,
    `.iso-solid[data-seamless]>.iso-shade,.iso-solid[data-seamless]>.iso-top{stroke-width:${0.4 * FINE}}`,
  ];
  for (const hex of fig.colours ?? []) rules.push(`.pc-${hex.slice(1)}{${vars(hex)}}`);
  return rules.join('\n');
}

/** Box of a sprite's markup: [x0, y0, x1, y1] in view units. */
export function boxOf(svgs) {
  return A.markupBox(svgs.join(''));
}

/**
 * Build the sprite SVG of the items of one sprite, cropped to `box` (padded) and snapped to whole logical px.
 * Returns { svg, width, height, x0, y0 } with width and height in logical px.
 */
export function spriteSvg({ items, backdrop = [], box, pad = 3 * FINE, label, css }) {
  const [bx0, by0, bx1, by1] = box;
  const x0 = Math.floor((bx0 - pad) / FINE) * FINE;
  const y0 = Math.floor((by0 - pad) / FINE) * FINE;
  const width = Math.ceil((bx1 + pad - x0) / FINE);
  const height = Math.ceil((by1 + pad - y0) / FINE);
  const body = `<g transform="translate(${-x0} ${-y0})">${[...backdrop, ...items].join('')}</g>`;
  const svg = exportSvg({ width: width * FINE, height: height * FINE, label, body }).replace('</style>', `${css}</style>`);
  return { svg, width, height, x0, y0 };
}

/**
 * Audit one built snake. Depth cycles between two body chunks that overlap by less than 160 px^2 (6 logical px^2: a
 * crossover chunk touching the turn above it) are excused pair by pair and returned, so the report can name them.
 */
export function auditSnake(built) {
  const { R, P } = built.fig;
  let result = A.audit(R, P, { allow: ALLOW, crowd: CROWD });
  const excused = result.depth.problems.filter((p) => p.cycle && p.area <= 160 && /^body:/.test(p.front) && /^body:/.test(p.back)).map((p) => [p.front, p.back]);
  if (excused.length) result = A.audit(R, P, { allow: [...ALLOW, ...excused], crowd: CROWD });
  return { result, excused, problems: A.failures(result) };
}
