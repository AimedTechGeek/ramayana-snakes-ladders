// Board background (T03 §1-2): 672x672, 56px cells, square 1 bottom-left, row bands by chapter.
// Keep-out: top-left 26x20 of every cell (numbers), centre 30x30 calm (tokens).
import { P, shade, tint, INK, line, svgDoc, write } from './common.mjs';
import { boardDefs, use } from './board-motifs.mjs';

const CELL = 56;
const L = line(1.5);
const L1 = line(1);

const cx = (c) => (c - 1) * CELL; // left edge of column c (1..12)
const cy = (r) => (12 - r) * CELL; // top edge of row r (1..12, bottom = 1)

// Slot anchors inside a cell (motif base point). BR/BL grow upward from y=54.
const SLOT = { BR: [46, 54], BL: [11, 54], TR: [44, 18], MR: [49, 40] };
const at = (id, c, r, slot) => use(id, cx(c) + SLOT[slot][0], cy(r) + SLOT[slot][1]);

const BAND = {
  1: P.meadow,
  2: P.meadow,
  3: P.meadow,
  4: P.parchment, // T03 says gold; parchment chosen because a full gold band was garish next to the numbers
  5: P.leaf,
  6: P.forest6,
  7: P.forest7,
  8: P.ochre,
  9: P.ochre,
  10: P.river,
  11: P.deepIndigo,
  12: P.deepIndigo,
};

function bands() {
  const out = [];
  for (let r = 1; r <= 12; r++)
    out.push(`<rect x="0" y="${cy(r)}" width="672" height="${CELL}" fill="${BAND[r]}"/>`);
  // row 4: plaza c1-c6 gold, c7-c8 meadow, c9-c12 forest edge
  out.push(`<rect x="${cx(7)}" y="${cy(4)}" width="112" height="56" fill="${P.meadow}"/>`);
  out.push(`<rect x="${cx(9)}" y="${cy(4)}" width="224" height="56" fill="${P.leaf}"/>`);
  // row 10: indigo night sky over the sea
  out.push(`<rect x="0" y="${cy(10)}" width="672" height="20" fill="${P.indigo}"/>`);
  return out.join('\n');
}

function grid() {
  const out = [];
  for (let r = 1; r <= 12; r++) {
    const col = r >= 11 ? P.indigo : shade(BAND[r]); // deepIndigo rows: shade() is invisible, use indigo
    const y = cy(r);
    let v = '';
    for (let c = 1; c <= 12; c++) v += `M${cx(c)} ${y} L${cx(c)} ${y + CELL} `;
    out.push(`<path d="${v}M0 ${y + 1} L672 ${y + 1}" fill="none" stroke="${col}" stroke-width="2"/>`);
    if (r === 4) {
      // right part of row 4 uses the green shade
      let v2 = '';
      for (let c = 7; c <= 12; c++) v2 += `M${cx(c)} ${y} L${cx(c)} ${y + CELL} `;
      out.push(
        `<path d="${v2}M${cx(7)} ${y + 1} L672 ${y + 1}" fill="none" stroke="${shade(P.meadow)}" stroke-width="2"/>`,
      );
    }
  }
  out.push(`<rect x="1" y="1" width="670" height="670" fill="none" stroke="${INK}" stroke-width="2"/>`);
  return out.join('\n');
}

// ---------- rows 1-3: Bala Kanda / Mithila ----------
function mithila() {
  const o = [];
  // Sarayu riverbank along row 1's bottom edge
  o.push(`<rect x="0" y="662" width="672" height="10" fill="${P.river}"/>`);
  o.push(
    `<path d="M0 662 ${Array.from({ length: 24 }, (_, i) => `Q${i * 28 + 14} ${i % 2 ? 666 : 658} ${i * 28 + 28} 662`).join(' ')}" fill="${P.river}" stroke="${shade(P.river)}" stroke-width="1.5"/>`,
  );
  o.push(
    `<path d="M60 667 L80 667 M150 668 L166 668 M300 667 L318 667 M420 668 L440 668 M560 667 L580 667" stroke="${P.parchment}" stroke-width="1.5" stroke-linecap="round"/>`,
  );
  // parchment paths: from the gate along row 1's bottom strip, and along row 3's bottom strip
  o.push(
    `<path d="M50 652 Q120 646 200 652 T336 652" fill="none" stroke="${P.parchment}" stroke-width="4" stroke-linecap="round"/>`,
  );
  o.push(
    `<path d="M0 556 Q100 548 200 554 T420 552 T560 556" fill="none" stroke="${P.parchment}" stroke-width="4" stroke-linecap="round"/>`,
  );
  // row 1
  for (const c of [3, 7, 11]) o.push(at('tree', c, 1, 'BR'));
  for (const c of [2, 5, 9, 12]) o.push(at('rice', c, 1, 'BL'));
  // row 2: sage huts with smoke, trees, rice
  for (const c of [2, 6, 10]) o.push(at('hut', c, 2, 'BR'));
  for (const c of [4, 9]) o.push(at('tree', c, 2, 'BR'));
  for (const c of [1, 7, 12]) o.push(at('rice', c, 2, 'BL'));
  // row 3: plough at c6, Janaka's palace at the right end, trees, rice
  for (const c of [3, 8]) o.push(at('tree', c, 3, 'BR'));
  for (const c of [2, 5, 9]) o.push(at('rice', c, 3, 'BL'));
  o.push(plough(cx(6) + 46, cy(3) + 52));
  o.push(palace(cx(11) + 26, cy(3) + 54));
  return o.join('\n');
}

function plough(x, y) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<path d="M-10 -2 L4 -12 L8 -16 M-2 -8 L-6 -8 M4 -12 L10 -4" fill="none" ${line(2)}/>` +
    `<path d="M-10 -2 L-4 0 L-2 -4Z" fill="${shade(P.parchment)}" ${L1}/>` +
    `</g>`
  );
}

function palace(x, y) {
  // gold silhouette spanning c11-c12 bottom strips (~60 wide)
  return (
    `<g transform="translate(${x} ${y})">` +
    `<path d="M-2 0 L-2 -10 L4 -10 L4 -16 Q8 -22 12 -16 L12 -10 L22 -10 L22 -14 L26 -14 L26 -10 L34 -10 L34 -18 Q40 -26 46 -18 L46 -10 L54 -10 L54 -6 L58 -6 L58 0Z" fill="${P.gold}" ${L}/>` +
    `<path d="M8 -22 Q12 -20 12 -16 L12 -10 L8 -10Z M40 -26 Q46 -22 46 -18 L46 -10 L40 -10Z" fill="${shade(P.gold)}"/>` +
    `<path d="M8 -22 L8 -25 M40 -26 L40 -30" ${line(1.5, P.saffron)}/>` +
    `</g>`
  );
}

// ---------- row 4: Ayodhya / exile ----------
function ayodhya() {
  const o = [];
  const y = cy(4);
  // ramparts along the bottom strip of c1-c5 (saffron wall, crenellated)
  const w = 5 * CELL;
  let cren = '';
  for (let i = 0; i < w / 10; i++)
    cren += `L${i * 10} ${y + 44} L${i * 10} ${y + 41} L${i * 10 + 5} ${y + 41} L${i * 10 + 5} ${y + 44} `;
  o.push(
    `<path d="M0 ${y + 56} L0 ${y + 44} ${cren}L${w} ${y + 44} L${w} ${y + 56}Z" fill="${P.saffron}" ${L}/>`,
  );
  o.push(`<path d="M0 ${y + 50} L${w} ${y + 50}" stroke="${shade(P.saffron)}" stroke-width="1.5"/>`);
  o.push(
    `<path d="M${w} ${y + 44} L${w + 4} ${y + 44} L${w + 4} ${y + 56} L${w} ${y + 56}Z" fill="${shade(P.saffron)}" ${L1}/>`,
  );
  // domes on the wall
  for (const c of [2, 4]) o.push(at('dome', c, 4, 'MR'));
  o.push(at('dome', 1, 4, 'MR'));
  // Kaikeyi's window at c3 (square 46)
  o.push(kaikeyiWindow(cx(3) + 44, y + 40));
  // chariot at c7
  o.push(chariot(cx(7) + 42, y + 52));
  // first dark trees c9-c12
  for (const c of [9, 10, 11, 12]) o.push(at('dark', c, 4, 'BR'));
  o.push(at('rice', 8, 4, 'BL'));
  o.push(at('eyes', 11, 4, 'BL'));
  return o.join('\n');
}

function kaikeyiWindow(x, y) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<path d="M-7 10 L-7 -2 Q0 -10 7 -2 L7 10Z" fill="${P.indigo}" ${L}/>` +
    `<path d="M-5 9 L-5 -1 Q-1 -6 2 -4 L2 9Z" fill="${P.blood}" ${L1}/>` +
    `<path d="M-2 -2 L-2 9" stroke="${shade(P.blood)}" stroke-width="1"/>` +
    `</g>`
  );
}

function chariot(x, y) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<path d="M-10 -6 L-8 -14 L6 -14 L8 -6Z" fill="${P.saffron}" ${L}/>` +
    `<path d="M-10 -6 L10 -6" ${line(1.5)}/>` +
    `<circle cx="-5" cy="-3" r="4" fill="${P.gold}" ${L}/><circle cx="5" cy="-3" r="4" fill="${P.gold}" ${L}/>` +
    `<path d="M-5 -7 L-5 1 M-9 -3 L-1 -3 M5 -7 L5 1 M1 -3 L9 -3" fill="none" ${L1}/>` +
    `<path d="M-1 -14 L-1 -20 L4 -18 L-1 -16" fill="${P.gold}" ${L1}/>` +
    `</g>`
  );
}

// ---------- rows 5-7: Dandaka forest ----------
function forest() {
  const o = [];
  // Ganga: diagonal river band from the bottom-left of c1 r5 up to c2 r7 (under ladder 49->74)
  const x0 = cx(1),
    y0 = cy(5) + CELL; // (0, 448)
  const x1 = cx(2) + 28,
    y1 = cy(7); // (84, 280)
  const hw = 13;
  o.push(
    `<path d="M${x0 - 6} ${y0} L${x0 + 2 * hw + 6} ${y0} L${x1 + hw + 20} ${y1} L${x1 - hw + 6} ${y1}Z" fill="${P.river}" stroke="${shade(P.river)}" stroke-width="2"/>`,
  );
  o.push(
    `<path d="M${x0 + 18} ${y0 - 20} q4 -6 0 -12 M${x0 + 36} ${y0 - 70} q4 -6 0 -12 M${x0 + 52} ${y0 - 120} q4 -6 0 -12" fill="none" stroke="${P.parchment}" stroke-width="1.5" stroke-linecap="round"/>`,
  );
  // row 5
  for (const c of [3, 5, 7, 10, 12]) o.push(at('sal5', c, 5, 'BR'));
  for (const c of [4, 9]) o.push(at('vine', c, 5, 'TR'));
  for (const c of [6, 11]) o.push(at('eyes', c, 5, 'BL'));
  // row 6: Panchavati hut at c6 (square 67)
  for (const c of [2, 4, 8, 10, 12]) o.push(at('sal6', c, 6, 'BR'));
  o.push(at('hut', 6, 6, 'BR'));
  for (const c of [3, 7, 11]) o.push(at('vine', c, 6, 'TR'));
  for (const c of [1, 5, 9]) o.push(at('eyes', c, 6, 'BL'));
  // row 7: Jatayu at c5, a few rocks (overlap with Kishkindha)
  for (const c of [3, 6, 8, 11]) o.push(at('sal7', c, 7, 'BR'));
  for (const c of [2, 10]) o.push(at('vine', c, 7, 'TR'));
  for (const c of [4, 12]) o.push(at('eyes', c, 7, 'BL'));
  for (const c of [7, 9]) o.push(at('rock', c, 7, 'BL'));
  o.push(jatayu(cx(5) + 44, cy(7) + 12));
  return o.join('\n');
}

function jatayu(x, y) {
  return `<path transform="translate(${x} ${y})" d="M-11 -2 Q-6 -8 -2 -3 L0 -6 L2 -3 Q6 -8 11 -2 Q5 -2 2 1 L0 5 L-2 1 Q-5 -2 -11 -2Z" fill="${INK}"/>`;
}

// ---------- rows 8-9: Kishkindha ----------
function kishkindha() {
  const o = [];
  // waterfall at the right edge of r8 c12 (beside ladder 85->108)
  o.push(
    `<rect x="660" y="${cy(8)}" width="12" height="56" fill="${P.river}" stroke="${shade(P.river)}" stroke-width="1.5"/>`,
  );
  o.push(
    `<path d="M664 ${cy(8) + 8} L664 ${cy(8) + 18} M668 ${cy(8) + 26} L668 ${cy(8) + 38} M664 ${cy(8) + 44} L664 ${cy(8) + 52}" stroke="${P.parchment}" stroke-width="1.5" stroke-linecap="round"/>`,
  );
  // Rishyamukha hill at r9 c1 (square 97): mound in the bottom strip
  o.push(
    `<path d="M${cx(1) + 2} ${cy(9) + 54} Q${cx(1) + 18} ${cy(9) + 26} ${cx(1) + 36} ${cy(9) + 40} Q${cx(1) + 46} ${cy(9) + 48} ${cx(1) + 54} ${cy(9) + 54}Z" fill="${shade(P.ochre)}" ${L}/>`,
  );
  o.push(
    `<path d="M${cx(1) + 18} ${cy(9) + 40} L${cx(1) + 16} ${cy(9) + 54} M${cx(1) + 28} ${cy(9) + 36} L${cx(1) + 30} ${cy(9) + 54}" stroke="${shade(shade(P.ochre))}" stroke-width="1.5" stroke-linecap="round"/>`,
  );
  // cave mouth at r8 c6 (square 91)
  o.push(
    `<path d="M${cx(6) + 36} ${cy(8) + 54} L${cx(6) + 36} ${cy(8) + 44} Q${cx(6) + 46} ${cy(8) + 30} ${cx(6) + 56} ${cy(8) + 44} L${cx(6) + 56} ${cy(8) + 54}Z" fill="${INK}"/>`,
  );
  o.push(
    `<path d="M${cx(6) + 38} ${cy(8) + 54} L${cx(6) + 38} ${cy(8) + 45} Q${cx(6) + 46} ${cy(8) + 34} ${cx(6) + 54} ${cy(8) + 45} L${cx(6) + 54} ${cy(8) + 54}" fill="none" stroke="${shade(P.ochre)}" stroke-width="1.5"/>`,
  );
  // row 8: two trees kept from the forest, boulders, monkeys, cracks, bananas near 85 (c12)
  for (const c of [2, 7]) o.push(at('sal7', c, 8, 'BR'));
  for (const c of [4, 9]) o.push(at('rock', c, 8, 'BR'));
  for (const c of [3, 10]) o.push(at('monkey', c, 8, 'BR'));
  for (const c of [1, 5, 8]) o.push(at('crack', c, 8, 'BL'));
  o.push(at('bananas', 11, 8, 'BL'));
  o.push(at('berries', 12, 8, 'BL'));
  // row 9
  for (const c of [3, 6, 10]) o.push(at('rock', c, 9, 'BR'));
  for (const c of [5, 8, 12]) o.push(at('monkey', c, 9, 'BR'));
  for (const c of [2, 7, 11]) o.push(at('crack', c, 9, 'BL'));
  o.push(at('berries', 12, 9, 'BL'));
  o.push(at('berries', 11, 9, 'BR'));
  return o.join('\n');
}

// ---------- rows 10-12: Lanka ----------
function lanka() {
  const o = [];
  const y10 = cy(10);
  // sea waves + foam
  let waves = '';
  for (let i = 0; i < 12; i++) {
    const x = i * 56;
    waves += `M${x + 30} ${y10 + 34} q6 -4 12 0 M${x + 6} ${y10 + 48} q6 -4 12 0 M${x + 40} ${y10 + 50} q5 -3 10 0 `;
  }
  o.push(
    `<path d="${waves}" fill="none" stroke="${shade(P.river)}" stroke-width="1.5" stroke-linecap="round"/>`,
  );
  o.push(
    `<path d="M30 ${y10 + 26} l4 0 M200 ${y10 + 40} l4 0 M470 ${y10 + 28} l4 0" stroke="${P.parchment}" stroke-width="2" stroke-linecap="round"/>`,
  );
  // stars in the r10 sky strip and rows 11-12
  const stars = [
    [100, y10 + 8],
    [330, y10 + 10],
    [600, y10 + 6],
    [60, 40],
    [200, 100],
    [420, 36],
    [560, 92],
    [650, 24],
    [290, 70],
  ];
  o.push(
    `<path d="${stars.map(([x, y]) => `M${x} ${y} l2 0`).join(' ')}" stroke="${P.parchment}" stroke-width="2" stroke-linecap="round"/>`,
  );
  // Rama Setu: stone causeway c6-c12 along the bottom strip of row 10
  let stones = '';
  for (let i = 0; i < 20; i++) {
    const x = cx(6) + 2 + i * 19.5;
    stones += `<path d="M${x} ${y10 + 44} Q${x + 2} ${y10 + 36} ${x + 9} ${y10 + 36} Q${x + 16} ${y10 + 36} ${x + 17} ${y10 + 44} Q${x + 9} ${y10 + 47} ${x} ${y10 + 44}Z" fill="${i % 2 ? shade(P.ochre) : P.ochre}" ${L1}/>`;
  }
  o.push(stones);
  o.push(
    `<path d="M${cx(6) + 10} ${y10 + 40} l3 0 M${cx(8) + 12} ${y10 + 40} l3 0 M${cx(10) + 14} ${y10 + 40} l3 0" stroke="${P.saffron}" stroke-width="2" stroke-linecap="round"/>`,
  );
  // row 11: golden walls along the bottom strip c3-c12, towers, arrows
  const y11 = cy(11);
  let cren = '';
  const xw = cx(3);
  for (let i = 0; i < 56; i++)
    cren += `L${xw + i * 10} ${y11 + 46} L${xw + i * 10} ${y11 + 43} L${xw + i * 10 + 5} ${y11 + 43} L${xw + i * 10 + 5} ${y11 + 46} `;
  o.push(
    `<path d="M${xw} ${y11 + 56} L${xw} ${y11 + 46} ${cren}L672 ${y11 + 46} L672 ${y11 + 56}Z" fill="${P.gold}" ${L}/>`,
  );
  o.push(`<path d="M${xw} ${y11 + 51} L672 ${y11 + 51}" stroke="${shade(P.gold)}" stroke-width="1.5"/>`);
  for (const c of [4, 8, 11]) o.push(at('tower', c, 11, 'BR'));
  for (const c of [6, 9, 12]) o.push(at('arrow', c, 11, 'BL'));
  // row 12: terraces (gold filigree) c2-c7, fires c8-c12 (battlefield), broken banner near 138
  const y12 = cy(12);
  for (const c of [2, 3, 4, 5, 6, 7]) o.push(use('filigree', cx(c) + 40, y12 + 53));
  for (const c of [3, 5]) o.push(at('tower', c, 12, 'BR'));
  for (const c of [8, 9, 10, 11, 12]) o.push(at('flame', c, 12, 'BR'));
  for (const c of [9, 12]) o.push(at('arrow', c, 12, 'BL'));
  o.push(brokenBanner(cx(8) + 10, y12 + 54));
  return o.join('\n');
}

function brokenBanner(x, y) {
  return (
    `<g transform="translate(${x} ${y})">` +
    `<path d="M-4 0 L2 -22" ${line(2)}/>` +
    `<path d="M2 -22 L0 -28" ${line(2)}/>` +
    `<path d="M2 -22 L14 -18 L8 -12 L4 -14Z" fill="${P.blood}" ${L1}/>` +
    `<path d="M-2 -10 L-8 -4 L-10 -8Z" fill="${P.blood}" ${L1}/>` +
    `<path d="M5 -17 l1.5 0 M8 -16 l1.5 0 M11 -17 l1.5 0" stroke="${P.gold}" stroke-width="1.5" stroke-linecap="round"/>` +
    `</g>`
  );
}

// ---------- landmarks ----------
function gate() {
  const x = cx(1),
    y = cy(1);
  return (
    `<g transform="translate(${x} ${y})">` +
    // road leading in from the open bottom edge
    `<path d="M34 56 L34 44 L52 44 L52 56Z" fill="${P.parchment}"/>` +
    // pillars + arch
    `<path d="M30 56 L30 32 Q43 16 56 32 L56 56 L51 56 L51 34 Q43 24 35 34 L35 56Z" fill="${P.gold}" ${L}/>` +
    `<path d="M51 34 Q43 24 35 34 L35 56 L51 56Z" fill="${shade(P.gold)}"/>` +
    // doors ajar
    `<path d="M36 36 Q42 28 44 36 L44 56 L36 56Z" fill="${P.saffron}" ${L1}/>` +
    `<path d="M46 56 L46 38 Q48 32 50 38 L50 56Z" fill="${shade(P.saffron)}" ${L1}/>` +
    // lamps
    `<circle cx="30" cy="28" r="2.5" fill="${P.parchment}" ${L1}/><circle cx="56" cy="28" r="2.5" fill="${P.parchment}" ${L1}/>` +
    // mango garland
    `<path d="M28 30 Q43 40 56 30" fill="none" stroke="${P.leaf}" stroke-width="2.5"/>` +
    `<circle cx="36" cy="33.5" r="1.5" fill="${P.gold}"/><circle cx="43" cy="35" r="1.5" fill="${P.gold}"/><circle cx="50" cy="33.5" r="1.5" fill="${P.gold}"/>` +
    `</g>`
  );
}

function throneRoom() {
  const x = cx(1),
    y = cy(12);
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect x="2" y="2" width="52" height="52" fill="${P.deepIndigo}" stroke="${P.gold}" stroke-width="1.5"/>` +
    // parasol (chhatra), top-right
    `<path d="M30 14 Q42 2 54 14Z" fill="${P.saffron}" ${L}/>` +
    `<path d="M42 7 Q50 8 54 14 L42 14Z" fill="${shade(P.saffron)}"/>` +
    `<path d="M42 14 L42 30" ${line(1.5, P.gold)}/>` +
    `<circle cx="42" cy="4" r="1.5" fill="${P.gold}"/>` +
    // throne: gold back, saffron cushion, gold base
    `<path d="M30 46 L30 28 Q36 22 42 28 L48 28 Q54 22 54 28 L54 46Z" fill="${P.gold}" ${L}/>` +
    `<path d="M48 28 Q54 22 54 28 L54 46 L48 46Z" fill="${shade(P.gold)}"/>` +
    `<rect x="32" y="40" width="20" height="7" rx="2" fill="${P.saffron}" ${L1}/>` +
    `<rect x="28" y="47" width="28" height="4" fill="${P.gold}" ${L1}/>` +
    `<path d="M33 30 L37 27" stroke="${tint(P.gold)}" stroke-width="1.5" stroke-linecap="round"/>` +
    // two lamp flames (left)
    `<path d="M8 40 L8 48 M14 46 L14 52" ${line(1.5, P.gold)}/>` +
    `<path d="M6 40 Q8 32 10 40Z" fill="${P.parchment}" ${L1}/><path d="M12 46 Q14 38 16 46Z" fill="${P.parchment}" ${L1}/>` +
    // lotus garland along the bottom
    `<path d="M4 54 Q28 50 54 54" fill="none" stroke="${P.leaf}" stroke-width="1.5"/>` +
    `<circle cx="12" cy="52.5" r="2" fill="${P.sitaAccent}"/><circle cx="22" cy="51.5" r="2" fill="${P.sitaAccent}"/><circle cx="34" cy="51.5" r="2" fill="${P.sitaAccent}"/><circle cx="46" cy="52.5" r="2" fill="${P.sitaAccent}"/>` +
    `</g>`
  );
}

export function writeBoard(root) {
  const body = [
    boardDefs(),
    bands(),
    mithila(),
    ayodhya(),
    forest(),
    kishkindha(),
    lanka(),
    grid(),
    gate(),
    throneRoom(),
  ].join('\n');
  const svg = svgDoc(
    672,
    body,
    'Board background 12x12 (T03). No ladders/snakes/numbers: the game draws those.',
  );
  return { 'board/background.svg': write(`${root}/board/background.svg`, svg) };
}
