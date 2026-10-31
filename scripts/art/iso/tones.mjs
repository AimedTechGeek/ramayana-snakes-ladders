// tones(hex): the four-tone material formula of T42 spec section 2 (one formula for every region and prop).
//   top = hex; shade-3 = hex 12 % toward white; shade-2 = hex; shade-1 = hex 12 % toward ink; shade-0 = hex 26 % toward
//   ink; lines = hex 55 % toward ink.
import { mixHex } from './common.mjs';

export const INK = '#2A1A0F';

/** `{ top, shades: [shade-0, shade-1, shade-2, shade-3], lines }` of a '#RRGGBB' material colour. */
export function tones(hex) {
  return {
    top: hex,
    shades: [mixHex(hex, INK, 0.26), mixHex(hex, INK, 0.12), hex, mixHex(hex, '#FFFFFF', 0.12)],
    lines: mixHex(hex, INK, 0.55),
  };
}
