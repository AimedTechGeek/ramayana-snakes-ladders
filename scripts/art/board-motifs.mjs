// Reusable board motifs as <defs> symbols (each drawn around its own origin, roughly 20x24 max).
import { P, shade, tint, INK, line } from './common.mjs';

const L = line(1.5);
const L1 = line(1);

/** Each def is drawn centred on (0,0) horizontally with its base at y=0, growing upward. */
export function boardDefs() {
  const d = {
    // mango tree: round canopy, ink trunk
    tree:
      `<path d="M-1 0 L-1 -8 L1 -8 L1 0Z" fill="${INK}"/>` +
      `<circle cx="0" cy="-13" r="7.5" fill="${P.leaf}" ${L}/>` +
      `<path d="M0 -20.5 A7.5 7.5 0 0 1 0 -5.5 A5 7.5 0 0 0 0 -20.5Z" fill="${shade(P.leaf)}"/>`,
    // sal tree: tall narrow canopy (forest). colour via fill of <use> is not possible, so 3 variants below
    sal5: salTree(P.leaf),
    sal6: salTree(P.forest6),
    sal7: salTree(P.forest7),
    dark: salTree(shade(P.leaf)),
    // sage hut: parchment roof, shade walls, smoke curl
    hut:
      `<rect x="-7" y="-9" width="14" height="9" fill="${shade(P.parchment)}" ${L}/>` +
      `<path d="M-9 -9 L0 -17 L9 -9Z" fill="${P.parchment}" ${L}/>` +
      `<path d="M0 -17 L9 -9 L4 -9Z" fill="${shade(P.parchment)}"/>` +
      `<rect x="-2" y="-5" width="4" height="5" fill="${INK}"/>` +
      `<path d="M5 -18 Q9 -21 6 -24 Q3 -27 7 -29" fill="none" stroke="${P.parchment}" stroke-width="1.5" stroke-linecap="round"/>`,
    // rice-field stripes (three short lines)
    rice: `<path d="M-9 0 L9 0 M-9 -4 L9 -4 M-9 -8 L9 -8" fill="none" stroke="${shade(P.meadow)}" stroke-width="1.5" stroke-linecap="round"/>`,
    // boulder
    rock:
      `<path d="M-9 0 Q-10 -8 -3 -10 Q6 -12 9 -4 Q10 0 6 0Z" fill="${shade(P.ochre)}" ${L}/>` +
      `<path d="M2 -11 Q7 -10 9 -4 Q10 0 6 0 L5 0 Q6 -7 2 -11Z" fill="${shade(shade(P.ochre))}"/>`,
    // crevice crack
    crack: `<path d="M-8 0 L-4 -4 L-5 -8 L0 -11 L2 -15" fill="none" stroke="${shade(P.ochre)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    // sitting monkey silhouette
    monkey:
      `<path d="M-7 0 Q-8 -8 -2 -9 L-2 -12 Q-4 -18 2 -18 Q7 -17 6 -11 L5 -9 Q10 -7 8 0Z" fill="${P.hanumanAccent}" ${L1}/>` +
      `<path d="M8 -2 Q14 -4 12 -12 Q11 -16 14 -16" fill="none" stroke="${P.hanumanAccent}" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="0" cy="-14" r="1" fill="${INK}"/><circle cx="3.5" cy="-14" r="1" fill="${INK}"/>`,
    // hidden eyes in the dark
    eyes: `<circle cx="-3" cy="-3" r="1.6" fill="${P.gold}" ${L1}/><circle cx="3" cy="-3" r="1.6" fill="${P.gold}" ${L1}/>`,
    // hanging vine from above (drawn downward from y=0)
    vine:
      `<path d="M0 0 Q3 6 0 12 Q-3 18 1 24" fill="none" stroke="${shade(P.leaf)}" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M1 8 L4 7 M-1 16 L-4 15 M1 22 L4 21" fill="none" stroke="${shade(P.leaf)}" stroke-width="2" stroke-linecap="round"/>`,
    // flame
    flame:
      `<path d="M-6 0 Q-8 -8 -2 -12 Q-1 -8 2 -10 Q6 -16 6 -8 Q8 -2 3 0Z" fill="${P.saffron}" ${L}/>` +
      `<path d="M-2 0 Q-4 -5 0 -8 Q3 -5 2 0Z" fill="${P.gold}"/>`,
    // Lanka tower with blood banner
    tower:
      `<rect x="-5" y="-16" width="10" height="16" fill="${P.gold}" ${L}/>` +
      `<path d="M1 -16 L5 -16 L5 0 L1 0Z" fill="${shade(P.gold)}"/>` +
      `<path d="M-6 -16 L-6 -19 L-3 -19 L-3 -16 M-1.5 -16 L-1.5 -19 L1.5 -19 L1.5 -16 M3 -16 L3 -19 L6 -19 L6 -16" fill="${P.gold}" ${L1}/>` +
      `<path d="M0 -19 L0 -27" ${L1}/><path d="M0 -27 L8 -24 L0 -21Z" fill="${P.blood}" ${L1}/>`,
    // arrow lying on the ground
    arrow:
      `<path d="M-9 0 L9 -4" ${line(1.5)}/><path d="M9 -4 L5 -1 M9 -4 L6 -6" fill="none" ${L1}/>` +
      `<path d="M-9 0 L-11 -4 L-6 -2Z" fill="${P.parchment}" ${L1}/>`,
    // onion dome with gold finial
    dome:
      `<path d="M-8 0 L-8 -6 Q-8 -14 0 -17 Q8 -14 8 -6 L8 0Z" fill="${P.saffron}" ${L}/>` +
      `<path d="M0 -17 Q8 -14 8 -6 L8 0 L4 0 L4 -6 Q4 -13 0 -17Z" fill="${shade(P.saffron)}"/>` +
      `<path d="M0 -17 L0 -21" ${line(2, P.gold)}/><circle cx="0" cy="-22" r="1.5" fill="${P.gold}"/>`,
    // gold filigree strip (palace terrace)
    filigree:
      `<path d="M-12 0 Q-9 -5 -6 0 Q-3 -5 0 0 Q3 -5 6 0 Q9 -5 12 0" fill="none" stroke="${P.gold}" stroke-width="1.5"/>` +
      `<path d="M-12 -2 L12 -2" stroke="${P.gold}" stroke-width="1"/>`,
    // berries
    berries:
      `<path d="M-6 0 Q-2 -6 4 -3" fill="none" stroke="${P.leaf}" stroke-width="1.5"/>` +
      `<circle cx="-5" cy="-2" r="2" fill="${P.blood}" ${L1}/><circle cx="-1" cy="-5" r="2" fill="${P.blood}" ${L1}/><circle cx="3" cy="-2" r="2" fill="${P.blood}" ${L1}/>`,
    // banana bunch
    bananas:
      `<path d="M-6 -2 Q-4 -10 4 -10 M-4 0 Q-2 -8 6 -8 M-2 2 Q0 -6 8 -6" fill="none" stroke="${P.gold}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M-6 -2 Q-4 -10 4 -10 M-4 0 Q-2 -8 6 -8 M-2 2 Q0 -6 8 -6" fill="none" ${L1}/>`,
  };
  return (
    `<defs>\n` +
    Object.entries(d)
      .map(([id, body]) => `<g id="${id}">${body}</g>`)
      .join('\n') +
    `\n</defs>`
  );
}

function salTree(fill) {
  return (
    `<path d="M-1 0 L-1 -9 L1 -9 L1 0Z" fill="${INK}"/>` +
    `<path d="M-7 -8 Q-8 -20 0 -24 Q8 -20 7 -8 Q0 -10 -7 -8Z" fill="${fill}" ${L}/>` +
    `<path d="M0 -24 Q8 -20 7 -8 Q4 -9 0 -9.5 Q4 -14 0 -24Z" fill="${shade(fill)}"/>`
  );
}

/** Place a def at (x, y). */
export const use = (id, x, y) => `<use href="#${id}" x="${x}" y="${y}"/>`;
export { tint };
