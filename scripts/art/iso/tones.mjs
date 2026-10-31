// The tone formula of the living board (T42 spec section 2). One hex gives the four shading tones and the line tone:
//   top = hex; shade-3 = hex 12 % toward white; shade-2 = hex; shade-1 = hex 12 % toward ink; shade-0 = hex 26 % toward
//   ink; lines = hex 55 % toward ink. `ink` is #2A1A0F.
import { mixHex } from './common.mjs';

export const INK = '#2A1A0F';

/** @param {string} hex '#RRGGBB' @returns {{ top: string, shades: string[], lines: string }} shades = [shade-0 .. shade-3] */
export function tones(hex) {
  return {
    top: hex,
    shades: [mixHex(hex, INK, 0.26), mixHex(hex, INK, 0.12), hex, mixHex(hex, '#FFFFFF', 0.12)],
    lines: mixHex(hex, INK, 0.55),
  };
}
