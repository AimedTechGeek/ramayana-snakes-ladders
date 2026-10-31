export const INK: string;
export interface Tones {
  top: string;
  /** [shade-0, shade-1, shade-2, shade-3], dark to light */
  shades: string[];
  line: string;
}
export function tones(hex: string): Tones;
