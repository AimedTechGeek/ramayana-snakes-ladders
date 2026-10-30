// Node twin of src/game/iso/world.ts (T40 spec section 2.1). Keep the two identical.

export const CELL = 56;
export const SIZE = 672;
export const RIM = 22;
export const BASE_H = 16;
export const FOOT_H = 6;
export const FIELD_Z = 1.2;
export const TOP_Z = 2.4;
export const RIM_Z = 3.6;
export const SILL_D = 18;
export const FIELD_C_OFFSET = [0, -9];
export const FIG_H = 80;
export const HEADROOM = 84;

export const FAN_WORLD = {
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
