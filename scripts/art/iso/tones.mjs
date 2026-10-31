// T42 spec section 2: the tone formula of one material. top = the hex; shade-3 = hex 12 % toward white; shade-2 = hex;
// shade-1 = hex 12 % toward ink #2A1A0F; shade-0 = hex 26 % toward ink; lines = hex 55 % toward ink.
import { mixHex } from './common.mjs';

export const INK = '#2A1A0F';
const WHITE = '#FFFFFF';

/**
 * @param {string} hex '#RRGGBB'
 * @returns {{ top: string, shades: [string, string, string, string], line: string }} shades[i] is anatomy shade-i
 */
export function tones(hex) {
  return {
    top: hex,
    shades: [mixHex(hex, INK, 0.26), mixHex(hex, INK, 0.12), hex, mixHex(hex, WHITE, 0.12)],
    line: mixHex(hex, INK, 0.55),
  };
}
