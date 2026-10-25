// Token medallions (T02 §5) + favicon. viewBox 0 0 64 64.
import { P, shade, tint, INK, line, svgDoc, write } from './common.mjs';

const L2 = line(2); // interior
const L25 = line(2.5); // outline

// Idle face per T02 §4 in the 100x100 face box; `wide` adds 6 units each side to the mouth (Hanuman).
function idleFace(wide = false) {
  const m = wide ? 6 : 0;
  return [
    // eye whites (almonds)
    `<ellipse cx="36" cy="46" rx="8" ry="5.5" fill="${P.parchment}" ${L2}/>`,
    `<ellipse cx="64" cy="46" rx="8" ry="5.5" fill="${P.parchment}" ${L2}/>`,
    `<circle cx="36" cy="46" r="4" fill="${INK}"/>`,
    `<circle cx="64" cy="46" r="4" fill="${INK}"/>`,
    `<circle cx="34.5" cy="44.5" r="1.5" fill="${P.parchment}"/>`,
    `<circle cx="62.5" cy="44.5" r="1.5" fill="${P.parchment}"/>`,
    // brows
    `<path d="M26 34 Q36 30 46 32" fill="none" ${line(4)}/>`,
    `<path d="M54 32 Q64 30 74 34" fill="none" ${line(4)}/>`,
    // mouth: gentle curve, bulge 3 down
    `<path d="M${38 - m} 66 Q50 72 ${62 + m} 66" fill="none" ${line(3)}/>`,
  ].join('\n');
}

// Head circle centre (50,50) r=42 in face coords, with one hard shade on the right.
function head(skin, skinShade) {
  return (
    `<circle cx="50" cy="50" r="42" fill="${skin}"/>` +
    `<path d="M74 16 A42 42 0 0 1 74 84 A30 42 0 0 0 74 16Z" fill="${skinShade}"/>`
  );
}

function medallion(accent, inner, note) {
  const body = [
    `<circle cx="32" cy="32" r="29.5" fill="${accent}" ${L25}/>`,
    // hard shadow tone, lower-right
    `<path d="M51.5 12.5 A29.5 29.5 0 0 1 12.5 51.5 A33 33 0 0 0 51.5 12.5Z" fill="${shade(accent)}"/>`,
    `<circle cx="32" cy="32" r="26" fill="none" stroke="${P.gold}" stroke-width="4"/>`,
    `<path d="M14 18 A24 24 0 0 1 24 10" fill="none" stroke="${tint(P.gold)}" stroke-width="1.5" stroke-linecap="round"/>`,
    `<g transform="translate(13 15) scale(0.4)">`,
    inner,
    `</g>`,
  ].join('\n');
  return svgDoc(64, body, note);
}

// ---------- Rama ----------
function rama() {
  const bow =
    // bow tip at left, outside the head
    `<path d="M-14 10 Q-30 50 -14 95" fill="none" stroke="${P.gold}" stroke-width="7" stroke-linecap="round"/>` +
    `<path d="M-14 10 Q-30 50 -14 95" fill="none" ${line(2)}/>` +
    `<path d="M-14 10 L-14 95" fill="none" ${line(2)}/>`;
  const hair =
    `<path d="M8 40 Q10 8 50 6 Q90 8 92 40 Q75 24 50 22 Q25 24 8 40Z" fill="${INK}"/>` +
    // top-knot
    `<circle cx="50" cy="2" r="12" fill="${INK}"/>`;
  const crown =
    `<path d="M14 30 Q50 14 86 30 L86 38 Q50 24 14 38Z" fill="${P.gold}" ${L2}/>` +
    `<path d="M20 31 Q40 22 50 21" fill="none" stroke="${tint(P.gold)}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<circle cx="50" cy="26" r="5" fill="${P.saffron}" ${L2}/>`;
  const ears =
    `<circle cx="9" cy="54" r="7" fill="${P.ramaAccent}" ${L2}/>` +
    `<circle cx="91" cy="54" r="7" fill="${shade(P.ramaAccent)}" ${L2}/>` +
    `<circle cx="9" cy="64" r="3.5" fill="${P.gold}" ${line(1.5)}/>` +
    `<circle cx="91" cy="64" r="3.5" fill="${P.gold}" ${line(1.5)}/>`;
  const inner =
    bow +
    ears +
    head(P.ramaAccent, shade(P.ramaAccent)) +
    `<circle cx="50" cy="50" r="42" fill="none" ${line(5)}/>` +
    hair +
    crown +
    idleFace();
  return medallion(P.ramaAccent, inner, 'Token: Rama (blue face, gold crown band, bow tip at left)');
}

// ---------- Sita ----------
function sita() {
  const hairBack = `<path d="M8 50 Q8 6 50 6 Q92 6 92 50 Q80 30 50 28 Q20 30 8 50Z" fill="${INK}"/>`;
  // braid over her left shoulder (viewer's right... "braid on left" = her left, drawn on viewer's left)
  const braid =
    `<path d="M14 60 Q4 80 10 104" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/>` +
    `<circle cx="11" cy="72" r="2.5" fill="${P.parchment}"/>` +
    `<circle cx="8" cy="86" r="2.5" fill="${P.parchment}"/>` +
    `<circle cx="10" cy="99" r="2.5" fill="${P.parchment}"/>` +
    `<path d="M4 92 L16 92" ${line(3, P.gold)}/>`;
  const crown =
    `<path d="M16 32 Q50 18 84 32 L84 37 Q50 24 16 37Z" fill="${P.gold}" ${L2}/>` +
    `<circle cx="50" cy="28" r="3.5" fill="${P.sitaAccent}" ${line(1.5)}/>`;
  const lotus =
    `<g transform="translate(86 78)">` +
    `<path d="M0 10 L0 28" ${line(3, P.leaf)}/>` +
    `<path d="M0 -10 Q-16 -8 -14 8 Q-6 14 0 10 Q6 14 14 8 Q16 -8 0 -10Z" fill="${P.sitaAccent}" ${L2}/>` +
    `<path d="M0 -14 Q-9 -4 -6 8 Q0 12 6 8 Q9 -4 0 -14Z" fill="${tint(P.sitaAccent)}" ${L2}/>` +
    `</g>`;
  const inner =
    hairBack +
    braid +
    `<circle cx="9" cy="54" r="6" fill="${P.sitaSkin}" ${L2}/>` +
    `<circle cx="91" cy="54" r="6" fill="${P.sitaSkinShade}" ${L2}/>` +
    head(P.sitaSkin, P.sitaSkinShade) +
    `<circle cx="50" cy="50" r="42" fill="none" ${line(5)}/>` +
    `<path d="M10 44 Q12 16 50 14 Q88 16 90 44 Q72 28 50 27 Q28 28 10 44Z" fill="${INK}"/>` +
    crown +
    idleFace() +
    `<circle cx="56" cy="60" r="2" fill="none" stroke="${P.gold}" stroke-width="1.5"/>` +
    lotus;
  return medallion(P.sitaAccent, inner, 'Token: Sita (fair face, braid at left, lotus at right)');
}

// ---------- Lakshmana ----------
function lakshmana() {
  const collar =
    `<path d="M8 86 Q50 70 92 86 L92 110 L8 110Z" fill="${P.lakshmanaAccent}" ${L2}/>` +
    `<path d="M8 96 Q50 80 92 96" fill="none" stroke="${P.gold}" stroke-width="3"/>`;
  const hair =
    `<path d="M8 42 Q10 8 50 6 Q90 8 92 42 Q75 26 50 24 Q25 26 8 42Z" fill="${INK}"/>` +
    `<circle cx="50" cy="3" r="11" fill="${INK}"/>`;
  const headband =
    `<path d="M10 36 Q50 22 90 36 L90 44 Q50 30 10 44Z" fill="${P.saffron}" ${L2}/>` +
    `<path d="M90 38 L102 30 L100 42Z" fill="${P.saffron}" ${L2}/>`;
  const inner =
    collar +
    `<circle cx="9" cy="54" r="6" fill="${P.lakSkin}" ${L2}/>` +
    `<circle cx="91" cy="54" r="6" fill="${P.lakSkinShade}" ${L2}/>` +
    head(P.lakSkin, P.lakSkinShade) +
    `<circle cx="50" cy="50" r="42" fill="none" ${line(5)}/>` +
    hair +
    headband +
    idleFace();
  return medallion(P.lakshmanaAccent, inner, 'Token: Lakshmana (saffron headband, emerald collar)');
}

// ---------- Hanuman ----------
function hanuman() {
  const tail =
    `<path d="M104 90 Q122 70 104 48 Q96 36 100 26" fill="none" stroke="${P.hanumanAccent}" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="M104 90 Q122 70 104 48 Q96 36 100 26" fill="none" ${line(2.5)}/>` +
    `<circle cx="100" cy="24" r="7" fill="${P.hanumanAccent}" ${L2}/>`;
  const ears =
    `<circle cx="4" cy="40" r="12" fill="${P.hanSkin}" ${line(4)}/>` +
    `<circle cx="4" cy="40" r="5" fill="${P.hanumanAccent}"/>` +
    `<circle cx="96" cy="40" r="12" fill="${shade(P.hanSkin)}" ${line(4)}/>` +
    `<circle cx="96" cy="40" r="5" fill="${shade(P.hanumanAccent)}"/>`;
  const fur =
    // fur silhouette ring behind the face
    `<circle cx="50" cy="50" r="46" fill="${shade(P.hanumanAccent)}" ${line(4)}/>` +
    `<path d="M16 22 L22 12 L28 22 L34 10 L40 20 L50 8 L60 20 L66 10 L72 22 L78 12 L84 22" fill="${shade(P.hanumanAccent)}" ${line(3)}/>`;
  const muzzle = `<ellipse cx="50" cy="70" rx="24" ry="15" fill="${P.parchment}" ${line(3)}/>`;
  const sindoor = `<path d="M46 20 L54 20 L52 34 L48 34Z" fill="${P.saffron}" ${line(1.5)}/>`;
  const inner =
    tail +
    fur +
    ears +
    head(P.hanSkin, shade(P.hanSkin)) +
    `<circle cx="50" cy="50" r="42" fill="none" ${line(5)}/>` +
    muzzle +
    sindoor +
    idleFace(true);
  return medallion(
    P.hanumanAccent,
    inner,
    'Token: Hanuman (monkey face, sindoor mark, tail tip from the right)',
  );
}

// ---------- Favicon: lotus ----------
function favicon() {
  const petal = (rot, fill) =>
    `<path transform="rotate(${rot} 32 40)" d="M32 40 Q20 30 24 12 Q32 2 40 12 Q44 30 32 40Z" fill="${fill}" ${line(2.5)}/>`;
  const body = [
    `<rect x="2" y="2" width="60" height="60" rx="14" fill="${P.deepIndigo}" ${line(3)}/>`,
    `<rect x="7" y="7" width="50" height="50" rx="10" fill="none" stroke="${P.gold}" stroke-width="2.5"/>`,
    `<path d="M10 46 Q32 58 54 46 Q32 52 10 46Z" fill="${P.leaf}" ${line(2)}/>`,
    petal(-56, shade(P.sitaAccent)),
    petal(56, shade(P.sitaAccent)),
    petal(-28, P.sitaAccent),
    petal(28, P.sitaAccent),
    petal(0, tint(P.sitaAccent)),
    `<circle cx="32" cy="38" r="4" fill="${P.gold}" ${line(2)}/>`,
  ].join('\n');
  return svgDoc(64, body, 'Favicon: lotus');
}

export function writeTokens(root) {
  const out = {};
  out['tokens/rama.svg'] = write(`${root}/tokens/rama.svg`, rama());
  out['tokens/sita.svg'] = write(`${root}/tokens/sita.svg`, sita());
  out['tokens/lakshmana.svg'] = write(`${root}/tokens/lakshmana.svg`, lakshmana());
  out['tokens/hanuman.svg'] = write(`${root}/tokens/hanuman.svg`, hanuman());
  out['icons/favicon.svg'] = write(`${root}/icons/favicon.svg`, favicon());
  return out;
}
