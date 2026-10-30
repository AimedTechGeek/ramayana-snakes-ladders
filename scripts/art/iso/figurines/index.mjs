// Figurine build (T40 spec 4.7): every hero x emotion x lit|plain x size s|m|l as one standalone SVG under fig/, plus the
// manifest figurines.json with the feet anchor of each file. Depth keys are settled once per emotion (at size l, the most
// exact) and reused for the other sizes and the lit variants: the part order is the same in all of them.

import { join } from 'node:path';
import * as A from '../../anatomy/audit.mjs';
import { exportSvg, writeManifest, writeSvg } from '../common.mjs';
import { addPedestal, createFigure, SIZES } from './common.mjs';
import { buildHanuman, EMOTIONS } from './hanuman.mjs';

// Ball-and-dowel joints, a muzzle ball on the head and the crown on the head meet on a circle by construction: each is
// in front of the other on opposite sides of it, so no painter order can satisfy both (a few px^2, looked at at 4x).
const JOINTS = [
  ['muzzle*', 'head*'],
  ['elbow.*', 'arm.*'],
  ['shoulder.*', 'arm.*'],
  ['hand.*', 'arm.*'],
  ['hand.*', 'grip.*'],
  ['tail.*', 'tail.*'],
];

const HEROES = {
  hanuman: {
    emotions: EMOTIONS,
    build: buildHanuman,
    label: 'Hanuman, a turned wooden figurine with a mace',
  },
};

function make(hero, emotion, size, lit, keys) {
  const { build, label } = HEROES[hero];
  const fig = createFigure({ size, lit, label: `${label}, ${emotion}` });
  addPedestal(fig, hero);
  build(fig, emotion);
  const body = fig.finish({ keys });
  return { fig, body };
}

/** Settle the depth keys of one emotion at size l (and audit when asked). */
function settleKeys(hero, emotion, audit) {
  const { fig } = make(hero, emotion, 'l', false);
  if (audit) {
    console.log(`--- audit ${hero}.${emotion}`);
    A.auditOrExit(fig.R, fig.P, { allow: JOINTS });
  }
  return fig;
}

export function buildFigurines(
  out,
  { audit = process.argv.includes('--audit'), only = process.env.FIG_ONLY } = {},
) {
  const manifest = {};
  const summary = [];
  for (const [hero, spec] of Object.entries(HEROES)) {
    for (const emotion of spec.emotions) {
      if (only && !only.split(',').includes(emotion)) continue;
      const settled = settleKeys(hero, emotion, audit);
      const keys = settled.keys;
      for (const size of Object.keys(SIZES)) {
        for (const lit of [false, true]) {
          const { fig, body } = make(hero, emotion, size, lit, keys);
          const name = `${hero}-${emotion}${lit ? '-lit' : ''}-${size}`;
          const svg = exportSvg({ width: fig.width, height: fig.height, label: fig.label, body });
          assertInside(name, svg, fig);
          writeSvg(join(out, 'fig', `${name}.svg`), svg);
          manifest[`${hero}.${emotion}.${lit ? 'lit' : 'plain'}.${size}`] = {
            w: fig.width,
            h: fig.height,
            anchorX: round(fig.anchor[0]),
            anchorY: round(fig.anchor[1]),
            k: fig.k,
          };
        }
      }
      summary.push(`${hero}.${emotion}: ${settled.partCount()} parts, ${settled.R.items.length} items`);
    }
  }
  if (clipped.length) throw new Error(`drawing touches the viewBox edge: ${clipped.join(', ')}`);
  if (!only) writeManifest(join(out, 'figurines.json'), manifest);
  for (const line of summary) console.log(line);
  console.log(
    `tightest viewBox margin per size: ${[...tightest].map(([size, m]) => `${size} ${m.toFixed(1)} px`).join(', ')}`,
  );
  console.log(`wrote ${Object.keys(manifest).length} figurine files under ${join(out, 'fig')}`);
}

const round = (value) => Math.round(value * 1000) / 1000;

/** Nothing may be cut by the viewBox (the halo is soft and excluded); report the tightest margin. */
function assertInside(name, svg, fig) {
  const [x0, y0, x1, y1] = A.markupBox(svg);
  const margin = Math.min(x0, y0, fig.width - x1, fig.height - y1);
  if (margin < 0.5) clipped.push(`${name} (${margin.toFixed(2)} px)`);
  tightest.set(fig.size, Math.min(tightest.get(fig.size) ?? Infinity, margin));
}

const tightest = new Map();
const clipped = [];
