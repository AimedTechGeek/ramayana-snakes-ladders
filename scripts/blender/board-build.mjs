// Builds board.glb (T45.1 terraces): writes the terrace heights, the row-end stairs, the sea channel lip and the
// waterfall sheets from src/app/board3d/boardLayout.ts to a scratch JSON, then runs scripts/blender/board.py headless,
// so the steps the heroes climb (groundHeightAt) and the stone steps in the GLB are the same numbers.
//   npm run blender:board
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BLOCK_HALF,
  COLUMNS,
  PLINTH_TOP_Y,
  ROWS,
  ROW_END_STAIRS,
  SLAB_HALF,
  STAIR_HALF_WIDTH,
  TERRACE_RISE,
  blockTopY,
  isWaterSquare,
  squareAt,
  squareCentre,
  terraceY,
} from '../../src/app/board3d/boardLayout.ts';
import { regionOf } from '../../src/game/board/blockRules.ts';

const OUT = 'public/models/board/board.glb';
const scratch = join(tmpdir(), 'rsl-board-input.json');
const GAP = 0.5 - BLOCK_HALF;
const SEA_ROW = 9;

/** A sheet of falling water: `profile` is [n, y] down the fall (n along the other horizontal axis), across a0..a1. */
function sheet(across, a0, a1, profile) {
  return { across, a0, a1, profile };
}

// Ganga down the risers: wherever a water block has a water block straight behind it on the next row up. A row-end
// stair on the same column (72 -> 73) splits the sheet around its steps.
const falls = [];
for (let row = 0; row < ROWS - 1; row++)
  for (let column = 0; column < COLUMNS; column++) {
    const lower = squareAt(row, column);
    const upper = squareAt(row + 1, column);
    if (!isWaterSquare(lower) || !isWaterSquare(upper)) continue;
    const [x, z] = squareCentre(lower);
    const groove = z - 0.5;
    const top = blockTopY(upper);
    const bottom = blockTopY(lower);
    const profile = [
      [groove - GAP - 0.005, top + 0.004],
      [groove - GAP + 0.03, top - 0.03],
      [groove + 0.01, top - (top - bottom) * 0.55],
      [groove + GAP + 0.03, bottom + 0.012],
      [groove + GAP + 0.07, bottom + 0.004],
    ];
    const stair = ROW_END_STAIRS.find((s) => s.lower === lower);
    const spans = stair
      ? [
          [x - 0.42, stair.x - STAIR_HALF_WIDTH - 0.02],
          [stair.x + STAIR_HALF_WIDTH + 0.02, x + 0.42],
        ]
      : [[x - 0.42, x + 0.42]];
    for (const [a0, a1] of spans) falls.push(sheet('x', a0, a1, profile));
  }

// Spills over the board's side, down the staircase cross-section and the slab onto the plinth's oak step: both
// ends of the sea channel and the lowest Ganga block on the west edge.
function sideSpill(square) {
  const [x, z] = squareCentre(square);
  const sign = Math.sign(x);
  const water = blockTopY(square);
  const rim = terraceY(Math.floor((square - 1) / COLUMNS));
  const at = (d) => sign * d;
  falls.push(
    sheet('z', z - 0.25, z + 0.25, [
      [at(BLOCK_HALF + x * sign - 0.01), water + 0.004],
      [at(BLOCK_HALF + x * sign + 0.03), water - 0.04],
      [at(6.0), rim + 0.02],
      [at(SLAB_HALF - 0.02), rim + 0.012],
      [at(SLAB_HALF + 0.03), rim - 0.06],
      [at(SLAB_HALF + 0.035), -0.6],
      [at(SLAB_HALF + 0.045), PLINTH_TOP_Y + 0.04],
      [at(SLAB_HALF + 0.16), PLINTH_TOP_Y + 0.006],
    ]),
  );
}
const seaEnds = [squareAt(SEA_ROW, 0), squareAt(SEA_ROW, COLUMNS - 1)];
seaEnds.forEach(sideSpill);
for (let row = 0; row < ROWS; row++) {
  const west = squareAt(row, 0);
  const below = row > 0 ? squareAt(row - 1, 0) : 0;
  if (isWaterSquare(west) && !(below && isWaterSquare(below)) && row !== SEA_ROW) sideSpill(west);
}

// The sea channel's front lip: a low stone dam in the groove in front of the sea row, open only where the 108 -> 109
// stair climbs into it.
const seaFront = squareCentre(squareAt(SEA_ROW, 0))[1] + 0.5;
const seaTop = blockTopY(squareAt(SEA_ROW, 0));
const gaps = ROW_END_STAIRS.filter((s) => Math.abs(s.zGroove - seaFront) < 1e-6).map((s) => [
  s.x - STAIR_HALF_WIDTH,
  s.x + STAIR_HALF_WIDTH,
]);

// Water at the board's side edges colours the cross-section of that row's terrace.
const edgeWater = [];
for (let row = 1; row < ROWS; row++)
  for (const [column, side] of [
    [0, 'W'],
    [COLUMNS - 1, 'E'],
  ])
    if (isWaterSquare(squareAt(row, column))) edgeWater.push({ row, side });

const input = {
  rise: TERRACE_RISE,
  terraces: Array.from({ length: ROWS }, (_, row) => terraceY(row)),
  stairs: ROW_END_STAIRS.map((s) => ({
    ...s,
    halfWidth: STAIR_HALF_WIDTH,
    base: terraceY(Math.floor((s.lower - 1) / COLUMNS)),
    region: regionOf(s.upper),
  })),
  seaLip: { z: seaFront, y0: terraceY(SEA_ROW - 1), y1: seaTop + 0.028, gaps },
  falls,
  edgeWater,
};
writeFileSync(scratch, JSON.stringify(input));

const result = spawnSync(
  process.execPath,
  ['scripts/blender/run.mjs', 'scripts/blender/board.py', OUT, '--layout', scratch],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
