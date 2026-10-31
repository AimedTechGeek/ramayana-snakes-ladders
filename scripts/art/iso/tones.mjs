// tones(hex): the four-tone body ramp of the living board (T42 spec section 2). One formula for every coloured body.
//   top = hex; shade-3 = hex 12 % toward white; shade-2 = hex; shade-1 = hex 12 % toward ink; shade-0 = hex 26 % toward
//   ink; line = hex 55 % toward ink. `shades` is ordered [shade-0, shade-1, shade-2, shade-3] (dark to light).
import { mixHex } from './common.mjs';

export const INK = '#2A1A0F';
const WHITE = '#FFFFFF';

/** @param {string} hex '#RRGGBB' @returns {{ top: string, shades: string[], line: string }} upper-case hex tones */
export function tones(hex) {
  const top = mixHex(hex, hex, 0);
  return {
    top,
    shades: [mixHex(hex, INK, 0.26), mixHex(hex, INK, 0.12), top, mixHex(hex, WHITE, 0.12)],
    line: mixHex(hex, INK, 0.55),
  };
}
