// Types for tones.mjs, so tests can import it under strict tsc.
export const INK: string;
export function tones(hex: string): {
  top: string;
  shades: [string, string, string, string];
  line: string;
};
