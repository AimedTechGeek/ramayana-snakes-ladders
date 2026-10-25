// Shared palette + tiny SVG helpers for the T23 art generator.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const P = {
  saffron: '#F39C2B',
  gold: '#E9C12F',
  indigo: '#3A3F9E',
  deepIndigo: '#1C1F4D',
  parchment: '#F3E3B8',
  ink: '#2A1A0F',
  leaf: '#4C8C3F',
  river: '#3F8FB5',
  blood: '#8E3B3B',
  ramaAccent: '#3F6FC2',
  sitaAccent: '#D15587',
  lakshmanaAccent: '#2E9E6B',
  hanumanAccent: '#E4572E',
  // T03 local colours
  meadow: '#6FA560',
  forest6: '#3F7A36',
  forest7: '#33692E',
  ochre: '#C98B4B',
  purple: '#7B3B6E',
  // T02 skin tones
  sitaSkin: '#F2C29B',
  sitaSkinShade: '#D9A27B',
  lakSkin: '#F0B57C',
  lakSkinShade: '#C98E5A',
  hanSkin: '#F0A96B',
};

const parse = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0').toUpperCase()).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** T02: token mixed 22% toward ink. */
export const shade = (h) => hex(mix(parse(h), parse(P.ink), 0.22));
/** T02: token mixed 18% toward white (metal highlights only). */
export const tint = (h) => hex(mix(parse(h), [255, 255, 255], 0.18));

export const INK = P.ink;

/** Common outline attributes. */
export const line = (w, colour = INK) =>
  `stroke="${colour}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

export function svgDoc(size, body, note) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<!-- ${note} | palette: docs/design/T02-style-guide.md (hex tokens inlined) -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">\n` +
    body +
    `\n</svg>\n`
  );
}

export function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return content.length;
}

export const r1 = (n) => Math.round(n * 10) / 10;
