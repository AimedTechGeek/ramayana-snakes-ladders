// One standing snake as a figure (T42 spec 5.1): the coil, the neck with its collar and the head, recorded for the audit
// and drawn as two sprites (coil, head). `buildSnake(id, variant)` returns the depth-sorted items and the geometry the
// manifest needs; index.mjs rasterises them. Local frame = figurine frame (right, forward, up), origin on the ground at
// the coil centre, drawn at the board camera x 5 (one SVG unit = one device pixel of the fine factor).

import * as A from '../../anatomy/audit.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import * as G from '../../anatomy/lathe.mjs';
import { boardProjection } from '../../iso-board.mjs';
import { DEG, createFigure } from '../figurines/common.mjs';
import { FIELD_C_OFFSET } from '../world.mjs';
import { mixHex } from '../common.mjs';
import { INK } from '../tones.mjs';
import { bodyRoute, toWorld } from './coil.mjs';
import { SNAKES } from './data.mjs';
import { HEAD_LEN, JAW_AT, featuresSvg, headSetup, interiorColour, jawSetup, openRegions, seamSvg } from './head.mjs';
import { addMotifs, addProps, planMotifs } from './motifs.mjs';
import { addSweep, colourClass } from './parts.mjs';
import { SPACING, breaksFor, makeSweep, paintOf, resetIds } from './sweep.mjs';

export const FINE = 5;
const OUT_ORIGIN = [600, 900];
const COLLAR_HALF = 0.6;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Board camera at the fine factor, with the world origin (coil ground centre) at OUT_ORIGIN. */
export function snakeView() {
  const base = boardProjection();
  const projection = { ...base, scale: base.scale * FINE, origin: OUT_ORIGIN };
  return { projection, width: 1200, height: 1000, anchor: k.iso([0, 0, 0], projection), k: G.scaleOf(projection) };
}

/** Strike target in the local frame (right, forward): FIELD_C of the head square, 14 world units in front of the coil centre. */
export const TARGET_LOCAL = (() => {
  const world = [FIELD_C_OFFSET[0], FIELD_C_OFFSET[1] + 14];
  const a = boardProjection().azimuth * DEG;
  const right = [Math.sin(a), -Math.cos(a)];
  const forward = [Math.cos(a), Math.sin(a)];
  return [world[0] * right[0] + world[1] * right[1], world[0] * forward[0] + world[1] * forward[1]];
})();

/** First break position at or after `s` on the pattern grid (halfway between stations). */
function snapToGrid(spec, s) {
  const { pitch } = spec;
  return (Math.ceil((s - pitch / 2) / pitch) + 0) * pitch + pitch / 2;
}

/** Everything of one snake. variant: 'closed' | 'open'. */
export function buildSnake(id, variant = 'closed') {
  const spec = SNAKES[id];
  if (!spec) throw new Error(`no snake ${id}`);
  resetIds();
  const view = snakeView();
  const fig = createFigure({ size: 's', label: `${id} snake`, view });
  const { R, rh } = spec;
  const paint = paintOf(spec.body);
  const specPaint = { ...spec, paint };
  const patterns = spec.patterns.map((p) => ({ ...p, pitch: spec.pitch }));

  // ground and halo
  const ground = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const outer = rh + R;
  fig.R.solid(A.disc(ground, -0.5, 0, 60, { name: 'stand.ground', ground: true }));
  const halo = k.haloOf({ x: -outer, y: -outer, w: 2 * outer, d: 2 * outer, r: outer }, 0, 0.1, fig.P);
  fig.backdrop.push(`<path class="iso-halo" style="filter:blur(${(1.1 * fig.k).toFixed(2)}px);transform:none" d="${halo}"/>`);

  // the ground turn leaves a dimple in the centre: the snake's own inner coil fills it (a low dome, never a post)
  const rIn = Math.max(2.45 * R, rh - (2 * R + 0.25));
  fig.ball('body', 'prop.centre', [0, 0, rIn - R], rIn - R, { className: colourClass(fig, mixHex(spec.body, INK, 0.12)), meta: { seated: true } });

  // route from the tail tip to the neck end; the rise is calibrated so that the head top meets the table
  let rise = spec.rise;
  let built;
  let head;
  for (let pass = 0; pass < 4; pass++) {
    built = bodyRoute(R, rh, { rise, aim: TARGET_LOCAL });
    head = headSetup(specPaint, built.end, TARGET_LOCAL, fig.P);
    const error = spec.top - head.top;
    if (Math.abs(error) < 0.05) break;
    rise += error;
  }

  // body sweep with the collar on the pattern grid
  const route = toWorld(built.route);
  const ringLength = G.pathLength(G.resample(toWorld(built.ring), SPACING));
  const total0 = G.pathLength(G.resample(route, SPACING));
  const hint = (s) => {
    const kappa = smooth(ringLength, total0, s);
    return G.add3(G.mul3([0, 0, -1], 1 - kappa), G.mul3(head.down(), kappa));
  };
  const radius = (u) => {
    const s = u * total0;
    const tail = 0.45 + 0.55 * smooth(0, 10, s);
    return R * tail * (1 - 0.15 * smooth(ringLength, total0, s));
  };
  const probe = makeSweep(route, radius, fig.P, { down: hint, fallback: head.D });
  let sCollar = ringLength;
  for (let s = ringLength; s < probe.total; s += 0.4) {
    if (probe.tangentAt(s)[2] > 0.75) {
      sCollar = s;
      break;
    }
  }
  sCollar = snapToGrid(spec, sCollar);
  const sweep = probe;
  const breaks = [...new Set([...breaksFor({ pitch: spec.pitch }, sweep.total), sCollar])].sort((a, b) => a - b);
  addSweep(fig, {
    owner: 'body',
    name: 'body',
    sweep,
    paint,
    patterns,
    touch: ['stand.ground'],
    ends: [false, false],
    maxLength: spec.pitch,
    breaks,
    gaps: [[sCollar - COLLAR_HALF, sCollar + COLLAR_HALF], ...planMotifs(spec, sweep.total)],
    spriteOf: (piece) => (piece.from >= sCollar - 1e-6 ? 'head' : 'coil'),
  });

  // the head
  const upper = (piece) => piece;
  const headPaint = paint;
  const jaw = variant === 'open' ? jawSetup(head) : null;
  addHead(fig, { spec: specPaint, head, headPaint, variant, jaw, upper });

  // collar where the neck leaves the coil
  const cf = sweep.frameAt(sCollar);
  const F = G.frameAlong(cf.c, cf.T);
  const collarTone = mixHex(spec.body, INK, 0.2);
  fig.ring('body', 'head.collar', F, -COLLAR_HALF, COLLAR_HALF, cf.r + 0.05, cf.r * 1.15 + 0.1, {
    tone: 'hi',
    className: colourClass(fig, collarTone),
  });

  addMotifs(fig, { spec: specPaint, head, sweep, sCollar, jaw, variant, paint });
  addProps(fig, { spec: specPaint, head, sweep });

  return { spec, fig, built, head, paint, rise, sweep, sCollar, jaw, variant };
}

/** Add the head as items: the lathe (closed, or split at the hinge for the open mouth), eyes, seam, interior. */
function addHead(fig, { spec, head, headPaint, variant, jaw }) {
  const { sweep } = head;
  const owner = 'body';
  if (spec.head?.kind === 'cap') return addCap(fig, { spec, head, headPaint, variant });
  const hinge = JAW_AT;
  if (variant === 'closed') {
    addSweep(fig, {
      owner,
      name: 'head.skull',
    ends: [false, false],
      sweep,
      paint: headPaint,
      maxLength: HEAD_LEN + 2,
      caps: true,
      spriteOf: () => 'head',
      extras: () => ({ inside: featuresSvg(sweep, spec) + seamSvg(sweep), after: '' }),
    });
    return;
  }
  // open: cranium (s 0..hinge), upper skull clipped above the mouth plane, the dark interior, the lower jaw turned down
  const regions = openRegions(head, jaw);
  addSweep(fig, {
    owner,
    name: 'head.skull',
    ends: [false, false],
    sweep,
    paint: headPaint,
    maxLength: HEAD_LEN + 2,
    breaks: [hinge],
    caps: true,
    spriteOf: () => 'head',
    extras: (piece) =>
      piece.from >= hinge - 0.01
        ? { inside: featuresSvg(sweep, spec), clip: regions.upper, after: seamSvg(sweep, { from: hinge }) }
        : { inside: '' },
  });
  addSweep(fig, {
    owner,
    name: 'head.jaw',
    ends: [false, false],
    sweep: jaw.jaw,
    paint: headPaint,
    maxLength: HEAD_LEN,
    caps: [false, true],
    spriteOf: () => 'head',
    extras: () => ({
      before: `<path d="${regions.interior}" fill="${interiorColour(spec.body)}"/>`,
      clip: regions.lower,
      after: seamSvg(jaw.jaw, { from: 0, to: HEAD_LEN - JAW_AT - 0.3, shift: JAW_AT }),
    }),
  });
}

/** Kabandha: the neck ends in a stout cap; its flat face carries two eyes and, open, a dark belly mouth (no teeth). */
function addCap(fig, { spec, head, headPaint, variant }) {
  const { sweep } = head;
  const f = sweep.frameAt(sweep.total);
  const r = sweep.radiusAt(1);
  const plane = (x, y, lift = 0.06) => k.iso(G.add3(G.add3(f.c, G.add3(G.mul3(f.e, x), G.mul3(f.d, y))), G.mul3(f.T, lift)), fig.P);
  const ellipse = (cx, cy, rx, ry, n = 16) =>
    k.pathOf(Array.from({ length: n }, (_, i) => plane(cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2))), true);
  const lines = spec.paint.tones.lines;
  const iris = '#E8B23A';
  let face = '';
  for (const sign of [1, -1]) {
    face += `<path d="${ellipse(sign * 0.46 * r, 0.3 * r, 0.3 * r, 0.26 * r)}" fill="${mixHex(iris, INK, 0.5)}"/>`;
    face += `<path d="${ellipse(sign * 0.46 * r, 0.3 * r, 0.25 * r, 0.21 * r)}" fill="${iris}"/>`;
    face += `<path d="${ellipse(sign * 0.46 * r, 0.3 * r, 0.05 * r, 0.21 * r)}" fill="${INK}"/>`;
    face += `<path d="${k.pathOf([plane(sign * 0.2 * r, 0.62 * r), plane(sign * 0.46 * r, 0.7 * r), plane(sign * 0.76 * r, 0.52 * r)])}" class="iso-line" data-tone="hi" fill="none"/>`;
  }
  const belly = variant === 'open'
    ? `<path d="${ellipse(0, -0.42 * r, 0.52 * r, 0.3 * r)}" fill="${interiorColour(spec.body)}"/><path d="${ellipse(0, -0.42 * r, 0.52 * r, 0.3 * r)}" class="iso-line" data-tone="hi" fill="none"/>`
    : `<path d="${k.pathOf(Array.from({ length: 9 }, (_, i) => plane(-0.5 * r + (r * i) / 8, -0.4 * r - 0.12 * r * (1 - ((i - 4) / 4) ** 2))))}" class="iso-line" data-tone="hi" fill="none"/>`;
  void lines;
  addSweep(fig, {
    owner: 'body',
    name: 'head.skull',
    ends: [false, false],
    sweep,
    paint: headPaint,
    maxLength: HEAD_LEN + 2,
    caps: true,
    spriteOf: () => 'head',
    extras: () => ({ inside: face + belly }),
  });
}
