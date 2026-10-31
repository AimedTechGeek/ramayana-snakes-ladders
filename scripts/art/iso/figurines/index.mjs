// Figurine build (T43 spec sections 2, 3, 5). Hanuman is an articulated character: 61 frames (SW idle 3 + 4 emotions, then
// walk 8, run 6, leap 4 for each of SE, NW, NE) drawn at the board camera, packed into the sheet `hanuman-s` at factor 4
// with the per-frame meta of spec 5. The T40 standalone files `hanuman-<emotion>[-lit]-<s|m|l>` (SVG sources under art-src,
// PNGs through raster.mjs, figurines.json) are rebuilt from the SW rest poses with the same names so the runtime keeps
// loading them until T43.2 switches to the sheet; the lit variants equal the plain ones (the lit marker is a ring now).
//
//   build.mjs [--audit] [--svg dir]      FIG_ONLY=walk.SE.0,SW.happy  restricts the frames (comma list of names)

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as A from '../../anatomy/audit.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import { boardProjection } from '../../iso-board.mjs';
import { buildAtlas, FACTORS } from '../atlas.mjs';
import { cropProjection, exportSvg, writeManifest, writeSvg } from '../common.mjs';
import { materialCss } from '../props/kit.mjs';
import { CLIPS, FACINGS, frameName, frameSpecs } from './clips.mjs';
import { createFigure, SIZES } from './common.mjs';
import { buildHanuman, MATERIALS } from './hanuman.mjs';
import { frameFor, solvePose } from './rig.mjs';

export const FACTOR = FACTORS.coarse;
export const SHEET = 'hanuman-s';
/** Logical px of clear space around the drawing inside a frame (the atlas adds its own 2 device px of padding). */
const PAD = 1;
const ATLAS_PADDING = 2;

/** Ball-and-dowel joints meet on a circle by construction: each is in front of the other on opposite sides of it. */
const JOINTS = [
  ['muzzle*', 'head*'],
  ['elbow.*', 'arm.*'],
  ['shoulder.*', 'arm.*'],
  ['hand.*', 'arm.*'],
  ['hand.*', 'grip.*'],
  ['tail.*', 'tail.*'],
  ['tail:*', 'tail.*'],
  ['toe.*', 'ankle.*'],
  ['knee.*', 'thigh.*'],
  ['knee.*', 'shin.*'],
  ['ankle.*', 'shin.*'],
  ['ankle.*', 'foot.*'],
  ['ankle.*', 'anklet.*'],
  ['toe.*', 'foot.*'],
  ['thigh.*', 'hem*'],
  ['thigh.*', 'loincloth*'],
  ['hem*', 'loincloth*'],
  ['belt*', 'belt.knot*'],
  ['arm.fore.*', 'elbow.*'],
  ['arm.fore.*', 'hand.*'],
  ['arm.fore.*', 'grip.*'],
  ['arm.fore.*', 'mace.*'],
  ['grip.*', 'mace.*'],
  ['sash:*', 'torso*'],
  ['tail:*', 'shin.*'],
  ['tail:*', 'thigh.*'],
  ['sash:*', 'ruff*'],
  ['sash*', 'shoulder.*'],
  ['sash*', 'arm.upper.*'],
  ['head*', 'arm.fore.*'],
  ['head*', 'elbow.*'],
];

/** Lines the tail may cross on screen (it is a long free tube far from them in depth). */
const CROWD = [
  ['sash*', 'sash*'],
  ['sash*', 'arm.fore.*'],
  ['tail*', 'sash*'],
  ['tail*', 'thigh*'],
  ['tail*', 'shin*'],
];

/** Frames the audit runs on (spec section 8): idle 1, the four emotions, walk / run / leap 0 and 2 per facing. */
const KEY_INDEXES = { walk: [0, 2], run: [0, 2], leap: [0, 2] };
export const isKey = (spec) =>
  spec.clip === 'idle'
    ? spec.index === 1
    : spec.facing === 'SW' || KEY_INDEXES[spec.clip].includes(spec.index);

const round = (value, places = 3) => Math.round(value * 10 ** places) / 10 ** places;

/** Projection of a figure at `size`, wide enough for any pose; the real crop comes from the drawing. */
function wideView(facing, size) {
  const base = { ...boardProjection(), scale: SIZES[size] / Math.sqrt(1.6) };
  const { loc } = frameFor(facing);
  const corners = [];
  for (const l of [-45, 45])
    for (const t of [-50, 50]) for (const u of [-3, 100]) corners.push(loc([l, t, u]));
  const crop = cropProjection(base, corners, 4);
  return { ...crop, anchor: k.iso([0, 0, 0], crop.projection), k: SIZES[size] };
}

/** The same projection moved so the drawing's box sits PAD inside a frame whose sides are whole device pixels. */
function tightView(view, box, size, whole = false) {
  const quarter = (v) => Math.round(v * FACTOR) / FACTOR;
  const dx = quarter(PAD - box[0]);
  const dy = quarter(PAD - box[1]);
  const projection = {
    ...view.projection,
    origin: [view.projection.origin[0] + dx, view.projection.origin[1] + dy],
  };
  const grid = whole ? 1 : FACTOR;
  const width = Math.ceil((box[2] + dx + PAD) * grid) / grid;
  const height = Math.ceil((box[3] + dy + PAD) * grid) / grid;
  return { projection, width, height, anchor: k.iso([0, 0, 0], projection), k: SIZES[size] };
}

/** Standalone light SVG with the material rules added to the kit's style block. */
const exportWithMaterials = ({ width, height, label, body }) =>
  exportSvg({ width, height, label, body, css: Object.values(MATERIALS).map(materialCss).join('\n') });

/**
 * Draw one frame. Depth keys are settled once at `settleSize` (the most exact is `l`; the audit runs on that figure),
 * then the frame is drawn at `size` twice: wide, to measure the drawing, and at the tight crop.
 */
export function renderFrame(
  spec,
  { size = 's', audit = false, settleSize = size, label, whole = false } = {},
) {
  const pose = solvePose(spec);
  const make = (view, sizeOf, keys) => {
    const fig = createFigure({ size: sizeOf, lit: false, label: label ?? `Hanuman, ${spec.key}`, view });
    buildHanuman(fig, pose, spec.facing, spec.face);
    return { fig, body: fig.finish({ keys }) };
  };
  const settled = make(wideView(spec.facing, settleSize), settleSize);
  const keys = settled.fig.keys;
  const result = audit ? A.audit(settled.fig.R, settled.fig.P, { allow: JOINTS, crowd: CROWD }) : null;
  const wide = wideView(spec.facing, size);
  const measured = settleSize === size ? settled : make(wide, size, keys);
  const view = tightView(wide, A.markupBox(measured.body.join('')), size, whole);
  const final = make(view, size, keys);
  const [x0, y0, x1, y1] = A.markupBox(final.body.join(''));
  return {
    spec,
    pose,
    view,
    fig: final.fig,
    audit: result,
    svg: exportWithMaterials({
      width: view.width,
      height: view.height,
      label: final.fig.label,
      body: final.body,
    }),
    margin: Math.min(x0, y0, view.width - x1, view.height - y1),
    partCount: final.fig.partCount(),
    settled: settled.fig,
  };
}

/** Lowest point (world u) of the recorded soles of the planted feet: the shapes the figure recorded, not the rig's maths. */
function recordedSoleU({ spec, fig }) {
  const feet = spec.planted.foot === 'both' ? ['L', 'R'] : [spec.planted.foot];
  const names = feet.flatMap((side) => [`foot.${side}.shape`, `toe.${side}.shape`]);
  const solids = fig.R.solids.filter((shape) => names.includes(shape.name));
  if (solids.length !== names.length) throw new Error(`${spec.key}: sole shapes not recorded`);
  return Math.min(...solids.map((shape) => A.boundsOf(shape).min[2]));
}

/** Frame px (atlas padding included) of a local ground point in a rendered frame. */
function groundPx({ spec, view }, point) {
  const [x, y] = k.iso(frameFor(spec.facing).loc(point), view.projection);
  return { x: round(x * FACTOR + ATLAS_PADDING), y: round(y * FACTOR + ATLAS_PADDING) };
}

/** The meta of spec 5 plus what the clip test needs: solved bob, recorded sole, planted point in px, crop margin. */
function frameMeta(rendered) {
  const { spec, pose } = rendered;
  const meta = {
    clip: spec.clip,
    facing: spec.facing,
    index: spec.index,
    planted: spec.planted
      ? { foot: spec.planted.foot, offset: round(pose.planted.offset) }
      : { foot: null, offset: null },
    air: spec.air ? 1 : 0,
    bob: round(pose.bob),
    rootU: round(pose.rootU),
    soleU: null,
    marginPx: round(rendered.margin * FACTOR, 2),
    parts: rendered.partCount,
  };
  if (spec.planted) {
    meta.soleU = round(recordedSoleU(rendered));
    const feet = spec.planted.foot === 'both' ? ['L', 'R'] : [spec.planted.foot];
    const ankles = feet.map((side) => pose.legs[side].ankleP);
    const mean = [
      ankles.reduce((sum, a) => sum + a[0], 0) / ankles.length,
      ankles.reduce((sum, a) => sum + a[1], 0) / ankles.length,
      0,
    ];
    meta.plantedLocal = [round(mean[0]), round(mean[1])];
    meta.plantedPx = groundPx(rendered, mean);
  }
  if (spec.air) meta.lift = 0.15;
  return meta;
}

function svgDirArg() {
  const at = process.argv.indexOf('--svg');
  return at >= 0 ? process.argv[at + 1] : null;
}

/** Render the sheet's frames (all, or those named in `only`); audits the key frames when asked. */
export function renderSheetFrames({
  audit = process.argv.includes('--audit'),
  only = process.env.FIG_ONLY,
  svgDir = svgDirArg(),
} = {}) {
  const filter = only ? only.split(',') : null;
  const specs = frameSpecs().filter((spec) => !filter || filter.includes(frameName(spec)));
  const frames = [];
  let failed = 0;
  let parts = 0;
  const started = Date.now();
  for (const spec of specs) {
    const doAudit = audit && isKey(spec);
    const rendered = renderFrame(spec, { audit: doAudit, settleSize: 'l' });
    parts = Math.max(parts, rendered.partCount);
    if (doAudit) {
      const count = A.failures(rendered.audit);
      console.log(`--- audit ${frameName(spec)}: ${count ? `${count} problem(s)` : '0'}`);
      if (count) {
        console.log(A.report(rendered.audit, { limit: 12 }));
        failed += 1;
      }
    }
    if (rendered.margin < 0.5) {
      throw new Error(
        `${frameName(spec)}: drawing touches the frame edge (${rendered.margin.toFixed(2)} px)`,
      );
    }
    if (svgDir) writeSvg(join(svgDir, `${frameName(spec)}.svg`), rendered.svg);
    frames.push({
      name: frameName(spec),
      svg: rendered.svg,
      width: rendered.view.width,
      height: rendered.view.height,
      factor: FACTOR,
      anchor: { x: rendered.view.anchor[0], y: rendered.view.anchor[1] },
      meta: frameMeta(rendered),
    });
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  console.log(`rendered ${frames.length} frames in ${seconds} s; up to ${parts} part types in a frame`);
  return { frames, failed };
}

export async function buildSheet(frames, outDir) {
  const result = await buildAtlas(SHEET, frames, { outDir, factor: FACTOR, maxSize: 2048, minWidth: 2048 });
  const names = frames.map((frame) => frame.name).sort();
  const sidecar = { facings: FACINGS, factor: FACTOR, clips: CLIPS, frames: names };
  writeFileSync(join(outDir, `${SHEET}.clips.json`), `${JSON.stringify(sidecar, null, 2)}\n`);
  return result;
}

// ---------------------------------------------------------------- the T40 standalone files (runtime until T43.2)

const LEGACY_EMOTIONS = ['idle', 'happy', 'excited', 'scared', 'sad'];

/** `hanuman-<emotion>[-lit]-<s|m|l>.svg` under <out>/fig and figurines.json, from the SW rest poses. */
export function buildLegacy(out) {
  const manifest = {};
  const specs = frameSpecs().filter((spec) => spec.facing === 'SW');
  for (const emotion of LEGACY_EMOTIONS) {
    const spec = specs.find((s) =>
      emotion === 'idle' ? s.clip === 'idle' && s.index === 1 : s.clip === emotion,
    );
    for (const size of Object.keys(SIZES)) {
      const rendered = renderFrame(spec, {
        size,
        settleSize: 'l',
        label: `Hanuman, ${emotion}`,
        whole: true,
      });
      if (rendered.margin < 0.5)
        throw new Error(`hanuman-${emotion}-${size}: drawing touches the viewBox edge`);
      for (const lit of [false, true]) {
        writeSvg(join(out, 'fig', `hanuman-${emotion}${lit ? '-lit' : ''}-${size}.svg`), rendered.svg);
        manifest[`hanuman.${emotion}.${lit ? 'lit' : 'plain'}.${size}`] = {
          w: rendered.view.width,
          h: rendered.view.height,
          anchorX: round(rendered.view.anchor[0]),
          anchorY: round(rendered.view.anchor[1]),
          k: SIZES[size],
        };
      }
    }
  }
  writeManifest(join(out, 'figurines.json'), manifest);
  console.log(`wrote ${Object.keys(manifest).length} legacy figurine entries under ${join(out, 'fig')}`);
}
