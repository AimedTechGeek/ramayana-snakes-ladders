// node/tsx scripts/art/iso/snakes/index.mjs [--audit] [--only=id,id] [--out=dir] (npm run art:snakes)
// Builds snakes-<level>.png/json/meta.json under public/assets/iso (T42 spec 5.1-5.2, 5.5): per snake a coil frame, a head
// frame closed and a head frame open, packed per level (boardFor(level).snakes). Frame names:
//   <id>.coil   anchor = ground centre of the coil
//   <id>.head.closed / <id>.head.open   anchor = the pivot (the collar point); both share one size and anchor
// The sidecar keeps the T42.1 layout (sheet, width, height, padding, frames) and adds a top-level `snakes` manifest.
import * as A from '../../anatomy/audit.mjs';
import { boardFor, LEVELS } from '../../../../src/core/boards.ts';
import { buildAtlas, openRasteriser } from '../atlas.mjs';
import * as k from '../../anatomy/iso-kit.mjs';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FINE, buildSnake, snakeView } from './model.mjs';
import { SNAKE_IDS, SNAKES } from './data.mjs';
import { auditSnake, boxOf, settleKeys, snakeCss, spriteSvg } from './sprites.mjs';

const round = (v) => Math.round(v * 100) / 100;
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name) => process.argv.includes(`--${name}`);

/** Settle, audit (when asked) and split one built variant into its sprite item lists. */
function sprites(built, { audit }) {
  const items = settleKeys(built.fig);
  if (audit) {
    const { result, excused, problems } = auditSnake(built);
    console.log(`audit ${built.spec.id} ${built.variant}: ${problems} problems, ${excused.length} excused depth cycles`);
    if (problems) console.log(A.report(result));
    if (problems) process.exitCode = 1;
  }
  return {
    coil: items.filter((i) => i.sprite !== 'head').map((i) => i.svg),
    head: items.filter((i) => i.sprite === 'head').map((i) => i.svg),
  };
}

/** Pixel-exact points of the build in view units (device px at the fine factor). */
function points(built) {
  const { P } = built.fig;
  const screen = (p) => k.iso(p, P);
  const pivot = screen(built.sweep.frameAt(built.sCollar).c);
  const mouth = screen(built.head.sweep.pointAt(11.5));
  const sB = built.sweep.total - 2.5;
  const neck = [sB, built.sCollar + (sB - built.sCollar) * 0.62, built.sCollar + (sB - built.sCollar) * 0.3].map((s) =>
    screen(built.sweep.pointAt(s)),
  );
  return { pivot, mouth, neck };
}

/** All frames of one snake: SVG sources, sizes and anchors. */
export function snakeFrames(id, { audit = false } = {}) {
  const closed = buildSnake(id, 'closed');
  const open = buildSnake(id, 'open');
  const a = sprites(closed, { audit });
  const b = sprites(open, { audit });
  const css = snakeCss(closed.fig, closed.spec);
  const cssOpen = snakeCss(open.fig, open.spec);
  const view = snakeView();
  const coilBox = boxOf([...closed.fig.backdrop, ...a.coil]);
  const headBox = boxOf(a.head);
  const headBoxOpen = boxOf(b.head);
  const box = [
    Math.min(headBox[0], headBoxOpen[0]),
    Math.min(headBox[1], headBoxOpen[1]),
    Math.max(headBox[2], headBoxOpen[2]),
    Math.max(headBox[3], headBoxOpen[3]),
  ];
  const coil = spriteSvg({ items: a.coil, backdrop: closed.fig.backdrop, box: coilBox, label: `${id} coil`, css });
  const headClosed = spriteSvg({ items: a.head, box, label: `${id} head closed`, css });
  const headOpen = spriteSvg({ items: b.head, box, label: `${id} head open`, css: cssOpen });
  const pts = points(closed);
  const [ox, oy] = view.projection.origin;
  const rel = (p) => [round(p[0] - pts.pivot[0]), round(p[1] - pts.pivot[1])];
  return {
    id,
    spec: closed.spec,
    coil: { ...coil, anchor: { x: (ox - coil.x0) / FINE, y: (oy - coil.y0) / FINE } },
    headClosed,
    headOpen,
    headAnchor: { x: (pts.pivot[0] - headClosed.x0) / FINE, y: (pts.pivot[1] - headClosed.y0) / FINE },
    manifest: {
      pivot: [round(pts.pivot[0] - ox), round(pts.pivot[1] - oy)],
      mouth: rel(pts.mouth),
      neck: pts.neck.map(rel),
    },
    headTop: closed.head.top,
    rise: closed.rise,
  };
}

async function main() {
  const only = arg('only')?.split(',');
  const out = arg('out') ?? 'public/assets/iso';
  const audit = flag('audit');
  const ids = SNAKE_IDS.filter((id) => !only || only.includes(id));
  const frames = new Map();
  for (const id of ids) {
    const started = Date.now();
    frames.set(id, snakeFrames(id, { audit }));
    console.log(`${id}: built in ${Date.now() - started} ms`);
  }
  const rasteriser = await openRasteriser();
  try {
    for (const level of LEVELS) {
      const list = boardFor(level).snakes.map((j) => j.id).filter((id) => frames.has(id));
      if (!list.length) continue;
      const specs = [];
      for (const id of list) {
        const f = frames.get(id);
        const base = { factor: FINE };
        specs.push({
          ...base,
          name: `${id}.coil`,
          svg: f.coil.svg,
          width: f.coil.width,
          height: f.coil.height,
          anchor: f.coil.anchor,
          meta: { snake: id, part: 'coil' },
        });
        for (const [state, sprite] of [['closed', f.headClosed], ['open', f.headOpen]]) {
          specs.push({
            ...base,
            name: `${id}.head.${state}`,
            svg: sprite.svg,
            width: sprite.width,
            height: sprite.height,
            anchor: f.headAnchor,
            meta: { snake: id, part: 'head', state },
          });
        }
      }
      const result = await buildAtlas(`snakes-${level}`, specs, { outDir: out, maxSize: 1024, rasteriser });
      const snakes = Object.fromEntries(
        list.map((id) => {
          const f = frames.get(id);
          const c = result.frames[`${id}.coil`];
          return [
            id,
            {
              coil: { frame: `${id}.coil`, anchor: [c.anchorX, c.anchorY] },
              head: { closed: `${id}.head.closed`, open: `${id}.head.open`, ...f.manifest },
              body: SNAKES[id].body,
              R: SNAKES[id].R,
              headTop: round(f.headTop),
            },
          ];
        }),
      );
      const metaFile = join(out, `snakes-${level}.meta.json`);
      const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
      writeFileSync(metaFile, `${JSON.stringify({ ...meta, snakes }, null, 2)}\n`);
      console.log(`snakes-${level}: ${list.length} snakes, ${result.width}x${result.height}`);
    }
  } finally {
    await rasteriser.close();
  }
}

await main();
