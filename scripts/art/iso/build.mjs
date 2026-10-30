// node build.mjs <out dir> (npm run art:iso, through tsx): writes the isometric art into public/assets/iso/.
// T40.2 writes only the sample (ten tiles with numerals); the board, figurine and die tasks add their files here.
import { join } from 'node:path';
import { boxCorners, depthOf, slabOf, solidSvg } from '../anatomy/iso-kit.mjs';
import { boardProjection, squareWorld } from '../iso-board.mjs';
import { cropProjection, exportSvg, numeralSvg, writeSvg } from './common.mjs';
import { CELL, FIELD_Z, SIZE, TOP_Z } from './world.mjs';

const out = process.argv[2];
if (!out) throw new Error('usage: node build.mjs <out dir>');

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
