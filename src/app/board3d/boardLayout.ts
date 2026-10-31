// Pure layout of the diorama board (T44 spec 2): where every block stands, how tall it is, which of the 14 block
// variants it uses, where its number chip is pinned, and the ground height anywhere on the board. Units: 1 u = one
// block pitch; y up; the field plate top is y = 0; x right; z toward the viewer (row 1 is nearest). No three, no React.
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

/** Height of a block's top face (spec 1.1 table); a water block's bed is that high, its surface WATER_LIFT above. */
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
      return 0.14;
    case 'lanka':
      return gridOf(square).row + 1 === 11 ? 0.32 : 0.38;
  }
}

export function isWaterSquare(square: number): boolean {
  return WATER.has(regionOf(square));
}

/** The height a token or prop stands at on this block. */
export function blockTopY(square: number): number {
  return blockHeight(square) + (isWaterSquare(square) ? WATER_LIFT : 0);
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

function cellHeight(row: number, column: number): number {
  if (row < 0 || row >= COLUMNS || column < 0 || column >= COLUMNS) return 0;
  return blockTopY(squareAt(row, column));
}

/** Ground height (y) at board position (x, z): block tops with a smooth ramp over each groove, 0 on the rim strip,
 *  the plinth top beyond the slab. Tokens, bridges and props stand at `groundHeightAt + lift`. */
export function groundHeightAt(x: number, z: number): number {
  if (Math.abs(x) > SLAB_HALF || Math.abs(z) > SLAB_HALF) return PLINTH_TOP_Y;
  if (Math.abs(x) >= RIM_HALF || Math.abs(z) >= RIM_HALF) return 0;
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
