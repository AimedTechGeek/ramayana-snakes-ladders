// Materials and story identity of the nine stone bridges (T42 spec 6.3). Every bridge is stone; the story lives in the
// stone tint, the parapet and the ornaments. A material is a css class that redefines the kit's tone tokens from
// `tones(hex)` (spec section 2): four shades, a top and a line colour, so every solid keeps four-tone shading.
import { mixHex } from '../common.mjs';
import { INK, tones } from '../tones.mjs';

export const PAPER = '#F3E3B8';
export const SAFFRON = '#F39C2B';
export const GOLD = '#E9C12F';
export const BLOOD = '#8E3B3B';
export const MOSS = '#5F8F3A';
export const TEAK = '#A9743F';

const registry = new Map();

/** Class name of a material, registered for the sprite stylesheet. */
export function mat(hex) {
  const cls = `m${hex.slice(1).toLowerCase()}`;
  registry.set(cls, hex);
  return cls;
}

/** The hex moved `amount` (-1..1) toward ink (negative) or white (positive), at most 9 %. */
export function tint(hex, amount) {
  return amount < 0 ? mixHex(hex, INK, -amount * 0.09) : mixHex(hex, '#FFFFFF', amount * 0.09);
}

/** Deterministic -1..1 from a string, so the same stone gets the same tint on every build. */
export function hashUnit(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return (h % 2001) / 1000 - 1;
}

export function materialCss() {
  const rules = [];
  for (const [cls, hex] of registry) {
    const t = tones(hex);
    const lo = mixHex(t.line, hex, 0.35);
    const faint = mixHex(t.line, hex, 0.62);
    rules.push(
      `.${cls}{--anatomy-paper:${t.shades[2]};--anatomy-face:${t.shades[3]};--anatomy-top:${t.top};` +
        `--anatomy-shade-0:${t.shades[0]};--anatomy-shade-1:${t.shades[1]};--anatomy-shade-2:${t.shades[2]};` +
        `--anatomy-shade-3:${t.shades[3]};--anatomy-hi:${t.line};--anatomy-mid:${mixHex(t.line, hex, 0.18)};` +
        `--anatomy-lo:${lo};--anatomy-faint:${faint};--anatomy-dot:${t.line}}`,
    );
  }
  rules.push('.moss{stroke-width:.35}');
  return rules.join('\n');
}

/**
 * Story table (spec 6.3). `stone` is the body colour; `rail` the parapet kind; `foot` and `top` the ornaments that
 * stand on the abutments; `tint` colours the rail material.
 */
export const STORIES = {
  vishwamitra: {
    stone: '#8E8A80',
    rail: 'timber',
    railHex: TEAK,
    moss: 0.5,
    foot: 'kamandalu',
    top: 'bowstring',
  },
  'shiva-bow': { stone: '#D9BE82', rail: 'bow', railHex: GOLD, moss: 0.05, foot: null, top: 'star' },
  wedding: {
    stone: '#E8B9CB',
    rail: 'garland',
    railHex: '#E8B9CB',
    moss: 0.1,
    foot: 'garland',
    top: 'crowns',
  },
  guha: { stone: '#8FA3A8', rail: 'oar', railHex: TEAK, moss: 0.45, foot: null, top: null },
  shabari: { stone: '#7F8A5F', rail: 'vine', railHex: '#7F8A5F', moss: 1, foot: 'basket', top: null },
  'hanuman-meeting': {
    stone: '#C98B4B',
    rail: 'rope',
    railHex: '#E4572E',
    moss: 0.15,
    foot: 'mace',
    top: 'tail',
  },
  sugriva: { stone: '#CF975B', rail: 'pillar', railHex: '#CF975B', moss: 0.1, foot: null, top: 'crown' },
  'hanuman-leap': { stone: '#658DA2', rail: 'wave', railHex: '#3F8FB5', moss: 0.2, foot: null, top: 'tufts' },
  'rama-setu': { stone: '#8AA0A6', rail: 'blocks', railHex: '#8AA0A6', moss: 0.6, foot: 'prints', top: null },
};
