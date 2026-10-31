// node bridges/index.mjs [out dir] [--audit] [--only=<id>[,<id>]] (npm run art:bridges): builds bridges-<level>.png / .json /
// .meta.json for the three levels (spec 6.1: Easy 9 bridges, Medium 7, Hard 6). One sprite per bridge and row band
// (spec 6.4). Run through tsx: the jump list comes straight from src/core/boards.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardFor } from '../../../../src/core/boards.ts';
import { buildAtlases } from '../atlas.mjs';
import { buildBridge } from './build.mjs';
import { auditBridges } from './audit.mjs';
import { renderSegments } from './render.mjs';

const LEVELS = ['easy', 'medium', 'hard'];
const FACTOR = 4;

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'public/assets/iso';
const audit = args.includes('--audit');
const only = args
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',');

const levelIds = Object.fromEntries(
  LEVELS.map((level) => [
    level,
    boardFor(level)
      .ladders.map((j) => j.id)
      .filter((id) => !only || only.includes(id)),
  ]),
);
const ids = [...new Set(Object.values(levelIds).flat())];
console.log(`building ${ids.length} bridges`);
const built = {};
for (const id of ids) {
  const started = Date.now();
  built[id] = buildBridge(id);
  built[id].segments = renderSegments(built[id]);
  console.log(
    `${id}: ${built[id].R.items.length} items, ${built[id].parts.size} part kinds, ${built[id].segments.length} segments, ${Date.now() - started} ms`,
  );
}

if (audit) {
  const failed = auditBridges(built);
  process.exitCode = failed ? 1 : 0;
}

const sheets = LEVELS.map((level) => ({
  sheet: `bridges-${level}`,
  options: { outDir: out, maxSize: 1024, factor: FACTOR },
  frames: levelIds[level].flatMap((id) =>
    built[id].segments.map((s, order) => ({
      name: s.name,
      svg: s.svg,
      width: s.width,
      height: s.height,
      factor: FACTOR,
      anchor: s.anchor,
      meta: {
        bridge: id,
        row: s.row,
        order,
        world: s.world,
        depthKey: s.depthKey,
        crossed: s.crossed,
      },
    })),
  ),
}));

const results = await buildAtlases(sheets);
for (const result of results) {
  const level = result.sheet.replace('bridges-', '');
  const metaFile = join(out, `${result.sheet}.meta.json`);
  const sidecar = JSON.parse(readFileSync(metaFile, 'utf8'));
  sidecar.bridges = Object.fromEntries(
    levelIds[level].map((id) => {
      const { geo, segments } = built[id];
      return [
        id,
        {
          from: geo.from,
          to: geo.to,
          length: Math.round(geo.Lp * 1000) / 1000,
          h: geo.h,
          openings: geo.openings,
          bow: geo.bow,
          segments: segments.map((s) => s.name),
          crossed: geo.crossed,
          deck: geo.deck,
          route: geo.route,
        },
      ];
    }),
  );
  writeFileSync(metaFile, `${JSON.stringify(sidecar, null, 2)}\n`);
  const px = Object.values(result.frames).reduce((sum, f) => sum + f.w * f.h, 0);
  console.log(
    `${result.sheet}: ${result.width}x${result.height}, ${Object.keys(result.frames).length} frames, ${(px / 1000).toFixed(0)}k px used`,
  );
}
