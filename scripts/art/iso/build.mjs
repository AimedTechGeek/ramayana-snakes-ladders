// node build.mjs <out dir> [--audit] [--debug] (npm run art:iso, through tsx): writes the isometric art into
// public/assets/iso/. T40.2 wrote the sample (ten tiles with numerals); T40.3 adds the board base; the ladder,
// snake, figurine and die tasks add their files here. --audit runs the anatomy audit on every board (about a
// minute each); --debug wraps every item in a <g data-name> for the line check's reports.
import { join } from 'node:path';
import { boxCorners, depthOf, slabOf, solidSvg } from '../anatomy/iso-kit.mjs';
import { boardProjection, squareWorld } from '../iso-board.mjs';
import { addBase } from './board.mjs';
import { cropProjection, exportSvg, numeralSvg, writeSvg } from './common.mjs';
import { createScene } from './scene.mjs';
import { CELL, FIELD_Z, SIZE, TOP_Z } from './world.mjs';

const out = process.argv[2];
if (!out) throw new Error('usage: node build.mjs <out dir> [--audit] [--debug]');
const flags = new Set(process.argv.slice(3));

// Squares 8..17: the end of row 1, the turn, the start of row 2. Every digit 0-9 occurs, two-digit numbers throughout,
// and both tile tops (even and odd (row + column)) appear.
const SAMPLE_SQUARES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

function tileOf(square) {
  const [cx, cy] = squareWorld(square);
  const column = Math.round((cx - CELL / 2) / CELL);
  const row = Math.round((SIZE - cy - CELL / 2) / CELL);
  return { square, cx, cy, row, column };
}

function sampleTiles() {
  const base = boardProjection();
  const tiles = SAMPLE_SQUARES.map(tileOf);
  const rows = tiles.map((t) => t.row);
  const first = Math.min(...rows);
  const last = Math.max(...rows);
  const columns = tiles.map((t) => t.column);
  const left = Math.min(...columns) * CELL;
  // The field plate under the sample tiles (rows count up from the near edge; world y grows toward the viewer).
  const plate = {
    x: left,
    y: SIZE - (last + 1) * CELL,
    w: (Math.max(...columns) + 1) * CELL - left,
    d: (last - first + 1) * CELL,
    r: 0,
  };
  const { projection, width, height } = cropProjection(base, boxCorners(plate, 0, TOP_Z), 10);

  const body = [solidSvg(slabOf(plate, 0, FIELD_Z, projection, 2), { tone: 'mid' })];
  const drawn = [...tiles].sort(
    (a, b) => depthOf([a.cx, a.cy, TOP_Z], projection) - depthOf([b.cx, b.cy, TOP_Z], projection),
  );
  for (const t of drawn) {
    const tile = { x: t.column * CELL + 1, y: t.cy - CELL / 2 + 1, w: CELL - 2, d: CELL - 2, r: 1 };
    body.push(
      solidSvg(slabOf(tile, FIELD_Z, TOP_Z - FIELD_Z, projection, 2), {
        tone: 'hi',
        className: (t.row + t.column) % 2 ? 'sq-b' : undefined,
        inner: numeralSvg(String(t.square), t.cx, t.cy, projection),
      }),
    );
  }
  return exportSvg({ width, height, label: 'Sample of ten numbered board tiles', body });
}

writeSvg(join(out, 'sample-tiles.svg'), sampleTiles());
console.log(`wrote ${join(out, 'sample-tiles.svg')}`);

function boardBase() {
  const scene = createScene();
  addBase(scene);
  const tiles = scene.R.items.filter((item) => item.name.startsWith('tile.')).length;
  const { solids, tubes, marks } = scene.stats;
  console.log(
    `board base: ${solids + marks} placed parts (${solids - tiles} solids besides ${tiles} tiles, ${tubes} tube chunks, ${marks} strokes, ticks, rings and dots)`,
  );
  const label =
    'A carved teak chaupar board on a plinth: 144 numbered bone tiles in a brass-rimmed frame, a ruler along the near and left edges, the Ayodhya gate by square 1 and the coronation parasol by square 144.';
  return scene.finish({ label, audit: flags.has('--audit'), debug: flags.has('--debug') });
}

writeSvg(join(out, 'board-base.svg'), boardBase());
console.log(`wrote ${join(out, 'board-base.svg')}`);
