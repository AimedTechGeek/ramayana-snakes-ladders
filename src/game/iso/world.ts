// World constants of the isometric board (T40 spec section 2.1). Mirrored in scripts/art/iso/world.mjs: keep the two identical.
// World: x to the right along a row, y toward the viewer (row 0 is the nearest row), z up. Units are world units.

export const CELL = 56;
export const SIZE = 672;
export const RIM = 22;
export const BASE_H = 16;
export const FOOT_H = 6;
export const FIELD_Z = 1.2;
export const TOP_Z = 2.4;
export const RIM_Z = 3.6;
export const SILL_D = 18;
/** FIELD_C is the tile centre (cx, cy) plus this offset: the standing-field centre sits 9 units nearer the row behind. */
export const FIELD_C_OFFSET: readonly [number, number] = [0, -9];
export const FIG_H = 80;
export const HEADROOM = 84;

export type WorldOffset = readonly [number, number];

/** Offsets from FIELD_C for the tokens sharing one square, keyed by how many share it. */
export const FAN_WORLD: Record<1 | 2 | 3 | 4, readonly WorldOffset[]> = {
  1: [[0, 0]],
  2: [
    [-9, 0],
    [9, 0],
  ],
  3: [
    [-9, -6],
    [9, -6],
    [0, 6],
  ],
  4: [
    [-9, -6],
    [9, -6],
    [-9, 6],
    [9, 6],
  ],
};
