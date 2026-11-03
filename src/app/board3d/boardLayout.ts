// Pure layout of the diorama board (T44 spec 2, T45.1 terraces): where every block stands, how tall it is, which of
// the 14 block variants it uses, where its number chip is pinned, the row-end stairs, and the ground height anywhere on
// the board. Units: 1 u = one block pitch; y up; the front field plate top is y = 0 and every row behind it is a
// terrace TERRACE_RISE higher (`terraceY`); x right; z toward the viewer (row 1 is nearest). No three, no React.
// Mount points for other parts: TRAY_ANCHOR (the die and its tray), PROPS_ORIGIN (props and landmarks live in this
// same frame; `blockTopY(square)` is where something stands on a block).

import { gridOf } from '../../game/layout';
import { patternOf, regionOf, seedOf, type RegionName } from '../../game/board/blockRules';

export const SQUARES = 144;
export const COLUMNS = 12;
export const BLOCK_HALF = 0.46;
/** Blocks are authored at this height in board.glb; the block shader slides the top region to the real height. */
export const BLOCK_H0 = 0.3;
export const SLAB_HALF = 6.3;
export const SLAB_HEIGHT = 0.9;
export const PLINTH_HALF = 6.8;
export const PLINTH_TOP_Y = -0.9;
export const PLINTH_BOTTOM_Y = -1.35;
/** A water surface floats this far above its block. */
export const WATER_LIFT = 0.01;
/** The sea row's bed above its terrace (T45.1; T44 had 0.14 on a flat board). */
export const SEA_BED = 0.22;
/** The rim strip around the 12 x 12 grid is this wide (slab edge to the first block row). */
export const RIM_HALF = 6.0;

/** The oak ledge that carries the dice tray: x0, x1, z0, z1 on the plinth top. */
export const LEDGE = { x0: 6.8, x1: 8.2, z0: 4.8, z1: 6.8 } as const;
/** die.py's tray floor: its teak base sits this far below the felt (the tray origin). */
export const TRAY_BASE = 0.12;
/**
 * The middle of the die tray's felt: the die (T44.7) and its tap box hang from here. The tray stands on the plain oak
 * ledge (T44.14: it used to sink in with its felt level with the ledge top, which hid the indigo felt).
 */
export const TRAY_ANCHOR: readonly [number, number, number] = [7.55, PLINTH_TOP_Y + TRAY_BASE, 5.8];
/** The scene origin of props and landmarks (T44.4): positions are (squareCentre x, blockTopY, squareCentre z). */
export const PROPS_ORIGIN: readonly [number, number, number] = [0, 0, 0];

export const VARIANT_NAMES: readonly string[] = (
  ['mithila', 'ayodhya', 'dandaka', 'ganga', 'kishkindha', 'sea', 'lanka'] as const
).flatMap((region) => [`${region}-a`, `${region}-b`]);

const WATER: ReadonlySet<RegionName> = new Set<RegionName>(['ganga', 'sea']);

/** Block centre of a square, three units: [x, z]. */
export function squareCentre(square: number): [number, number] {
  const { row, column } = gridOf(square);
  return [column - 5.5, 5.5 - row];
}

/** Inverse of squareCentre for a grid cell (row 0 nearest the viewer). */
export function squareAt(row: number, column: number): number {
  return row * COLUMNS + (row % 2 === 0 ? column : COLUMNS - 1 - column) + 1;
}

/**
 * T45.1: each board row (12 squares) is a terrace this much above the row in front of it, so the board climbs from the
 * gate (row 0, y = 0) to the throne (row 11). Tuned so Fit still frames the board, throne and tray on 1280 x 720 and
 * 844 x 390, and so every row's lowest block top stays above the previous row's highest.
 */
export const TERRACE_RISE = 0.135;
export const ROWS = 12;

/** The board row (0 nearest the viewer .. 11) of a square. */
export function rowOf(square: number): number {
  return gridOf(square).row;
}

/** Top of row `row`'s terrace (the groove floor its blocks stand on); rows outside the grid clamp to 0 and 11. */
export function terraceY(row: number): number {
  return Math.min(ROWS - 1, Math.max(0, row)) * TERRACE_RISE;
}

/**
 * Height of a block's top face above its terrace (spec 1.1 table; T45.1 raised the sea bed from 0.14 so the sea row
 * clears Kishkindha's highest block); a water block's bed is that high, its surface WATER_LIFT above. This is the
 * block mesh's own height: Board.tsx stands the block on `terraceY(row)`.
 */
export function blockHeight(square: number): number {
  const seed = seedOf(square);
  switch (regionOf(square)) {
    case 'mithila':
      return 0.22;
    case 'ayodhya':
      return 0.26;
    case 'dandaka':
      return 0.22 + (((seed >>> 3) % 3) - 1) * 0.02;
    case 'ganga':
      return 0.16;
    case 'kishkindha':
      return 0.3 + (((seed >>> 5) % 5) - 2) * 0.02;
    case 'sea':
      return SEA_BED;
    case 'lanka':
      return gridOf(square).row + 1 === 11 ? 0.32 : 0.38;
  }
}

export function isWaterSquare(square: number): boolean {
  return WATER.has(regionOf(square));
}

/** The height a token or prop stands at on this block: its terrace, the block and, on water, the surface lift. */
export function blockTopY(square: number): number {
  return terraceY(rowOf(square)) + blockHeight(square) + (isWaterSquare(square) ? WATER_LIFT : 0);
}

/** Which of the 14 block meshes a square uses: `<region>-<a|b>` (the T42 pattern rule, applied to every region). */
export function variantOf(square: number): string {
  return `${regionOf(square)}-${patternOf(square)}`;
}

/** Squares per variant, in square order. */
export function squaresByVariant(): Map<string, number[]> {
  const out = new Map<string, number[]>(VARIANT_NAMES.map((name) => [name, []]));
  for (let square = 1; square <= SQUARES; square++) out.get(variantOf(square))!.push(square);
  return out;
}

/** Pinned chip centre (spec 2.8): 0.10 u above the front-left corner, 0.05 u inside it; front-right on bridge tops. */
export function chipAnchor(square: number, onBridgeTop = false): [number, number, number] {
  const [x, z] = squareCentre(square);
  const side = onBridgeTop ? 1 : -1;
  return [x + side * (BLOCK_HALF - 0.05), blockTopY(square) + 0.1, z + (BLOCK_HALF - 0.05)];
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

/** Blend zone half-width at a block edge, in u: a token crossing the groove rides a short smooth ramp. */
const EDGE_BLEND = 0.1;

/** Neighbour offset and blend weight along one axis for a position `f` in 0..1 across a cell. */
function axisBlend(f: number): [number, number] {
  if (f > 1 - EDGE_BLEND) return [1, 0.5 * smooth((f - (1 - EDGE_BLEND)) / EDGE_BLEND)];
  if (f < EDGE_BLEND) return [-1, 0.5 * smooth((EDGE_BLEND - f) / EDGE_BLEND)];
  return [0, 0];
}

/** Off the grid: the rim strip of that row's terrace (front rim 0, back rim the top terrace). */
function cellHeight(row: number, column: number): number {
  if (row < 0 || row >= ROWS || column < 0 || column >= COLUMNS) return terraceY(row);
  return blockTopY(squareAt(row, column));
}

/** Row under a board z (row 0 spans z 5..6); clamped to the grid. */
function rowAtZ(z: number): number {
  return Math.min(ROWS - 1, Math.max(0, Math.floor(6 - z)));
}

/**
 * A row-end stair (T45.1): where the boustrophedon path turns up to the next row (12 -> 13, 24 -> 25, ... 132 -> 133,
 * alternating right and left ends), a short flight of stone steps stands on the back of the lower block and climbs
 * to the front edge of the upper one, on the walking lane (the column centre line). `groundHeightAt` follows the
 * treads, so feet land on every step; board.py builds the same steps from these numbers.
 */
export interface RowEndStair {
  lower: number;
  upper: number;
  /** Lane centre line (the column centre), three units. */
  x: number;
  /** The first riser, on the lower block's back. */
  zBottom: number;
  /** The last tread meets the upper block's front edge here. */
  zTop: number;
  /** Groove line between the two rows. */
  zGroove: number;
  yLow: number;
  yHigh: number;
  steps: number;
}

export const STAIR_HALF_WIDTH = 0.2;
/** The first riser stands this far in front of the groove line (the lower field centre is 0.34 in front of it). */
export const STAIR_RUN = 0.28;
/** A tread rises about this much; every flight has at least two. */
const STAIR_STEP = 0.05;
/** Share of a tread over which the foot rides up its riser (a short step-up, not a ramp). */
const RISER_BLEND = 0.25;

export const ROW_END_STAIRS: readonly RowEndStair[] = Array.from({ length: ROWS - 1 }, (_, row) => {
  const lower = (row + 1) * COLUMNS;
  const upper = lower + 1;
  const [x, z] = squareCentre(lower);
  const zGroove = z - 0.5;
  const yLow = blockTopY(lower);
  const yHigh = blockTopY(upper);
  return {
    lower,
    upper,
    x,
    zBottom: zGroove + STAIR_RUN,
    zTop: zGroove - (0.5 - BLOCK_HALF),
    zGroove,
    yLow,
    yHigh,
    steps: Math.max(2, Math.round((yHigh - yLow) / STAIR_STEP)),
  };
});

/** Ground on a stair's footprint (tread k at yLow + k * rise), or null off every stair. */
function stairHeightAt(x: number, z: number): number | null {
  for (const stair of ROW_END_STAIRS) {
    if (Math.abs(x - stair.x) > STAIR_HALF_WIDTH) continue;
    if (z > stair.zBottom || z < stair.zGroove - EDGE_BLEND) continue;
    if (z <= stair.zTop) return stair.yHigh;
    const s = ((stair.zBottom - z) / (stair.zBottom - stair.zTop)) * stair.steps;
    const k = Math.min(stair.steps - 1, Math.floor(s));
    const rise = (stair.yHigh - stair.yLow) / stair.steps;
    return stair.yLow + rise * (k + smooth((s - k) / RISER_BLEND));
  }
  return null;
}

/** Ground height (y) at board position (x, z): block tops with a smooth ramp over each groove, the treads of the
 *  row-end stairs, the row's terrace on the rim strip (0 at the front), the plinth top beyond the slab. Tokens,
 *  bridges and props stand at `groundHeightAt + lift`. */
export function groundHeightAt(x: number, z: number): number {
  if (Math.abs(x) > SLAB_HALF || Math.abs(z) > SLAB_HALF) return PLINTH_TOP_Y;
  if (Math.abs(x) >= RIM_HALF || Math.abs(z) >= RIM_HALF) return terraceY(z >= RIM_HALF ? 0 : rowAtZ(z));
  const stair = stairHeightAt(x, z);
  if (stair !== null) return stair;
  const gx = x + 6;
  const gz = 6 - z;
  const column = Math.min(COLUMNS - 1, Math.floor(gx));
  const row = Math.min(COLUMNS - 1, Math.floor(gz));
  const [dc, wx] = axisBlend(gx - column);
  const [dr, wz] = axisBlend(gz - row);
  const here = cellHeight(row, column);
  const side = cellHeight(row, column + dc);
  const behind = cellHeight(row + dr, column);
  const corner = cellHeight(row + dr, column + dc);
  const near = here + (side - here) * wx;
  const far = behind + (corner - behind) * wx;
  return near + (far - near) * wz;
}
