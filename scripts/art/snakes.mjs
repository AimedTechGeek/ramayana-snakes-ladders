// Snake heads (T03 §4), viewBox 0 0 64 64, pointing up; neck leaves at the bottom edge. Plus palette.json.
import { P, shade, tint, INK, line, svgDoc, write } from './common.mjs';

const L2 = line(2);
const L25 = line(2.5);
const L15 = line(1.5);

export const SNAKES = {
  tataka: { body: shade(P.leaf), belly: P.blood, pattern: 'bands' },
  manthara: { body: P.deepIndigo, belly: P.blood, pattern: 'diamonds' },
  kaikeyi: { body: P.purple, belly: P.blood, pattern: 'spots' },
  viradha: { body: P.ochre, belly: P.blood, pattern: 'bands' },
  shurpanakha: { body: P.blood, belly: shade(P.blood), pattern: 'bands' },
  'golden-deer': { body: P.gold, belly: P.blood, pattern: 'spots' },
  abduction: { body: P.deepIndigo, belly: P.blood, pattern: 'spots' },
  kabandha: { body: shade(P.leaf), belly: P.blood, pattern: 'bands' },
  'indrajit-arrows': { body: P.indigo, belly: tint(P.indigo), pattern: 'diamonds' },
  prahasta: { body: P.ochre, belly: P.blood, pattern: 'bands' },
  kumbhakarna: { body: shade(P.ochre), belly: P.parchment, pattern: 'bands' },
  brahmastra: { body: P.saffron, belly: P.blood, pattern: 'diamonds' },
  ravana: { body: P.deepIndigo, belly: P.blood, pattern: 'diamonds' },
};

/** Base head: rounded wedge, neck 20 wide at the bottom, head 32 wide. */
function baseHead(body, belly, opts = {}) {
  const { sleepy = false, w = 1 } = opts;
  const bodyShade = shade(body);
  const hx = 32;
  const left = hx - 16 * w;
  const right = hx + 16 * w;
  const headPath = `M22 64 L22 44 Q${left - 2} 36 ${left} 24 Q${left + 2} 8 32 6 Q${right - 2} 8 ${right} 24 Q${right + 2} 36 42 44 L42 64Z`;
  const parts = [
    `<path d="${headPath}" fill="${body}" ${L25}/>`,
    // hard shade, right side
    `<path d="M32 6 Q${right - 2} 8 ${right} 24 Q${right + 2} 36 42 44 L42 64 L35 64 L35 44 Q40 36 38 24 Q37 12 32 6Z" fill="${bodyShade}"/>`,
    // belly stripe on the neck
    `<path d="M27 64 L27 48 Q32 44 37 48 L37 64Z" fill="${belly}" ${L15}/>`,
    // nostrils + closed sideways mouth
    `<circle cx="29" cy="11" r="1.3" fill="${INK}"/>`,
    `<circle cx="35" cy="11" r="1.3" fill="${INK}"/>`,
    `<path d="M${left + 4} 17 Q32 20 ${right - 4} 17" fill="none" ${L15}/>`,
  ];
  if (sleepy) {
    parts.push(
      `<path d="M20 27 Q25 31 30 27" fill="none" ${L2}/>`,
      `<path d="M34 27 Q39 31 44 27" fill="none" ${L2}/>`,
    );
  } else {
    parts.push(
      `<ellipse cx="25" cy="26" rx="4" ry="5.5" fill="${P.gold}" ${L15}/>`,
      `<ellipse cx="39" cy="26" rx="4" ry="5.5" fill="${P.gold}" ${L15}/>`,
      `<path d="M25 22 L25 30" ${line(2)}/>`,
      `<path d="M39 22 L39 30" ${line(2)}/>`,
    );
  }
  return parts.join('\n');
}

// ---------- villain motifs ----------
const motifs = {
  tataka: (c) =>
    [
      // wild tangle of ink hair, broken tree stump at the right
      `<path d="M30 54 L34 60 L38 54" fill="${shade(P.ochre)}" ${L15}/>`,
      `<path d="M14 24 Q4 20 8 10 Q12 16 16 10 Q18 2 24 6 Q28 -2 32 4 Q38 -2 42 6 Q48 2 50 10 Q54 16 58 10 Q62 20 52 24Z" fill="${INK}"/>`,
      baseHead(c.body, c.belly),
      `<path d="M16 22 Q10 14 16 8 M24 14 Q22 6 30 4 M40 14 Q42 6 36 4 M48 22 Q54 14 48 8" fill="none" ${line(3)}/>`,
      `<path d="M50 50 L54 58 L58 50 M52 60 L56 60" fill="none" ${line(2, shade(P.ochre))}/>`,
    ].join('\n'),

  manthara: (c) =>
    [
      // hunched parchment shawl behind the head, slumped to the right
      `<path d="M8 50 Q4 24 20 8 Q36 -4 52 10 Q64 24 60 50 Q50 40 38 40 Q22 40 8 50Z" fill="${P.parchment}" ${L25}/>`,
      `<path d="M40 2 Q64 24 60 50 Q54 44 46 42 Q54 24 40 2Z" fill="${shade(P.parchment)}"/>`,
      `<path d="M12 46 Q22 36 34 38 Q46 38 56 46" fill="none" ${L15}/>`,
      baseHead(c.body, c.belly),
      // gold zigzag on the neck
      `<path d="M24 50 L28 56 L32 50 L36 56 L40 50" fill="none" stroke="${P.gold}" stroke-width="2"/>`,
      // whisper bubble with three dots
      `<path d="M46 20 Q44 8 56 8 Q66 8 64 18 Q64 26 54 26 L50 30 L50 25 Q46 24 46 20Z" fill="${P.parchment}" ${L15}/>`,
      `<circle cx="50" cy="17" r="1.5" fill="${INK}"/><circle cx="55" cy="17" r="1.5" fill="${INK}"/><circle cx="60" cy="17" r="1.5" fill="${INK}"/>`,
    ].join('\n'),

  kaikeyi: (c) =>
    [
      // palace window with a drawn blood curtain, behind the head
      `<path d="M38 60 L38 24 Q50 8 62 24 L62 60Z" fill="${P.indigo}" ${L2}/>`,
      `<path d="M41 58 L41 26 Q50 14 59 26 L59 58Z" fill="${P.blood}" ${L15}/>`,
      `<path d="M45 30 L45 56 M50 24 L50 56 M55 30 L55 56" fill="none" ${line(1.5, shade(P.blood))}/>`,
      baseHead(c.body, c.belly),
      // two gold bangles around the neck
      `<path d="M21 49 Q32 44 43 49" fill="none" stroke="${P.gold}" stroke-width="4"/>`,
      `<path d="M21 49 Q32 44 43 49" fill="none" ${L15}/>`,
      `<path d="M21 57 Q32 52 43 57" fill="none" stroke="${P.gold}" stroke-width="4"/>`,
      `<path d="M21 57 Q32 52 43 57" fill="none" ${L15}/>`,
    ].join('\n'),

  viradha: (c) =>
    [
      // club beside the head
      `<path d="M50 60 L58 30" ${line(5, shade(P.ochre))}/>`,
      `<path d="M50 60 L58 30" ${line(2)} fill="none"/>`,
      `<ellipse cx="58" cy="24" rx="6" ry="9" fill="${shade(P.ochre)}" ${L2}/>`,
      `<circle cx="56" cy="20" r="1.2" fill="${INK}"/><circle cx="60" cy="26" r="1.2" fill="${INK}"/>`,
      baseHead(c.body, c.belly, { w: 1.1 }),
      // ink bristle marks
      `<path d="M18 34 L14 30 M20 40 L15 38 M46 34 L50 30 M44 40 L49 38 M26 8 L24 3 M38 8 L40 3" fill="none" ${L2}/>`,
    ].join('\n'),

  shurpanakha: (c) =>
    [
      baseHead(c.body, c.belly),
      // saffron fingernail marks along the neck
      `<path d="M23 52 Q26 48 29 52 M35 52 Q38 48 41 52 M29 58 Q32 54 35 58" fill="none" stroke="${P.saffron}" stroke-width="2.5" stroke-linecap="round"/>`,
      // gold nose-ring charm
      `<circle cx="37" cy="14" r="4" fill="none" stroke="${P.gold}" stroke-width="2.5"/>`,
      `<circle cx="37" cy="14" r="4" fill="none" ${line(1)}/>`,
      `<circle cx="39" cy="18" r="2" fill="${P.sitaAccent}" ${line(1)}/>`,
    ].join('\n'),

  'golden-deer': (c) =>
    [
      // antlers
      `<path d="M22 14 L16 2 M22 14 L12 10 M18 6 L14 1 M42 14 L48 2 M42 14 L52 10 M46 6 L50 1" fill="none" ${line(3, shade(P.ochre))}/>`,
      `<path d="M22 14 L16 2 M22 14 L12 10 M18 6 L14 1 M42 14 L48 2 M42 14 L52 10 M46 6 L50 1" fill="none" ${line(1)}/>`,
      baseHead(c.body, c.belly),
      // deer mask: a parchment-spotted gold muzzle with round deer ears
      `<ellipse cx="18" cy="20" rx="6" ry="4" transform="rotate(-30 18 20)" fill="${P.gold}" ${L2}/>`,
      `<ellipse cx="46" cy="20" rx="6" ry="4" transform="rotate(30 46 20)" fill="${shade(P.gold)}" ${L2}/>`,
      `<circle cx="22" cy="36" r="2.5" fill="${P.parchment}"/><circle cx="42" cy="36" r="2.5" fill="${P.parchment}"/><circle cx="32" cy="40" r="2" fill="${P.parchment}"/>`,
      // blood scales showing under the mask edge
      `<path d="M23 46 Q26 43 29 46 Q32 43 35 46 Q38 43 41 46" fill="${P.blood}" ${L15}/>`,
    ].join('\n'),

  abduction: (c) =>
    [
      // Pushpaka chariot wheel behind the head
      `<circle cx="32" cy="26" r="24" fill="${shade(P.gold)}" ${L2}/>`,
      `<circle cx="32" cy="26" r="24" fill="none" stroke="${P.gold}" stroke-width="4"/>`,
      `<path d="M32 2 L32 50 M8 26 L56 26 M15 9 L49 43 M49 9 L15 43" fill="none" stroke="${P.gold}" stroke-width="3"/>`,
      `<path d="M32 2 L32 50 M8 26 L56 26 M15 9 L49 43 M49 9 L15 43" fill="none" ${line(1)}/>`,
      baseHead(c.body, c.belly),
      // Jatayu feathers at the neck
      `<path d="M14 50 Q8 40 16 34 Q20 42 14 50Z" fill="${P.parchment}" ${L15}/>`,
      `<path d="M50 50 Q56 40 48 34 Q44 42 50 50Z" fill="${P.parchment}" ${L15}/>`,
      `<path d="M15 48 L16 36 M49 48 L48 36" fill="none" ${line(1)}/>`,
    ].join('\n'),

  kabandha: (c) =>
    [
      // headless torso with arms, eyes on the chest; the snake neck is the trunk
      `<path d="M4 30 Q2 18 14 20 L22 26 M60 30 Q62 18 50 20 L42 26" fill="none" stroke="${c.body}" stroke-width="9" stroke-linecap="round"/>`,
      `<path d="M4 30 Q2 18 14 20 L22 26 M60 30 Q62 18 50 20 L42 26" fill="none" ${L2}/>`,
      `<path d="M22 64 L22 30 Q22 14 32 12 Q42 14 42 30 L42 64Z" fill="${c.body}" ${L25}/>`,
      `<path d="M32 12 Q42 14 42 30 L42 64 L36 64 L36 30 Q38 16 32 12Z" fill="${shade(c.body)}"/>`,
      `<path d="M27 64 L27 50 Q32 46 37 50 L37 64Z" fill="${c.belly}" ${L15}/>`,
      // flat top (no head) and chest eyes
      `<path d="M20 16 Q32 8 44 16" fill="${shade(c.body)}" ${L2}/>`,
      `<ellipse cx="26" cy="32" rx="4" ry="5.5" fill="${P.gold}" ${L15}/><path d="M26 28 L26 36" ${line(2)}/>`,
      `<ellipse cx="38" cy="32" rx="4" ry="5.5" fill="${P.gold}" ${L15}/><path d="M38 28 L38 36" ${line(2)}/>`,
      `<path d="M27 43 Q32 46 37 43" fill="none" ${L15}/>`,
    ].join('\n'),

  'indrajit-arrows': (c) =>
    [
      // two slim heads braided together under a gold knot
      `<path d="M24 64 Q18 50 20 40 Q22 30 14 20 Q10 10 20 6 Q28 8 26 20 Q22 32 30 44 Q36 54 32 64Z" fill="${c.body}" ${L2}/>`,
      `<path d="M40 64 Q46 50 44 40 Q42 30 50 20 Q54 10 44 6 Q36 8 38 20 Q42 32 34 44 Q28 54 32 64Z" fill="${shade(c.body)}" ${L2}/>`,
      `<ellipse cx="17" cy="12" rx="2.5" ry="3.5" fill="${P.gold}" ${line(1)}/>`,
      `<ellipse cx="47" cy="12" rx="2.5" ry="3.5" fill="${P.gold}" ${line(1)}/>`,
      `<circle cx="21" cy="8" r="1" fill="${INK}"/><circle cx="43" cy="8" r="1" fill="${INK}"/>`,
      // gold knot
      `<path d="M24 40 Q32 30 40 40 Q32 50 24 40Z" fill="${P.gold}" ${L2}/>`,
      `<circle cx="32" cy="40" r="3" fill="${shade(P.gold)}" ${line(1)}/>`,
      `<path d="M28 36 Q32 33 36 36" fill="none" stroke="${tint(P.gold)}" stroke-width="1.5"/>`,
    ].join('\n'),

  prahasta: (c) =>
    [
      baseHead(c.body, c.belly, { w: 1.05 }),
      // armour scallops on the neck
      `<path d="M22 50 Q27 46 32 50 Q37 46 42 50 M22 57 Q27 53 32 57 Q37 53 42 57" fill="none" stroke="${P.gold}" stroke-width="2.5"/>`,
      // war helmet with a blood plume
      `<path d="M16 22 Q16 2 32 2 Q48 2 48 22 L42 20 Q32 14 22 20Z" fill="${P.gold}" ${L25}/>`,
      `<path d="M32 2 Q48 2 48 22 L42 20 Q40 10 32 6Z" fill="${shade(P.gold)}"/>`,
      `<path d="M20 10 Q24 5 30 4" fill="none" stroke="${tint(P.gold)}" stroke-width="2" stroke-linecap="round"/>`,
      `<path d="M29 4 L35 4 L36 14 L28 14Z" fill="${P.blood}" ${L15}/>`,
      `<path d="M32 4 Q30 -4 40 -2" fill="none" stroke="${P.blood}" stroke-width="4" stroke-linecap="round"/>`,
    ].join('\n'),

  kumbhakarna: (c) =>
    [
      // drum at the left
      `<rect x="2" y="42" width="14" height="18" rx="2" fill="${P.ochre}" ${L15}/>`,
      `<path d="M2 46 L16 46 M2 56 L16 56" fill="none" ${line(1)}/>`,
      `<ellipse cx="9" cy="42" rx="7" ry="2.5" fill="${P.parchment}" ${L15}/>`,
      baseHead(c.body, c.belly, { sleepy: true, w: 1.25 }),
      // sleepy "Z" as a zigzag stroke
      `<path d="M46 4 L56 4 L46 14 L56 14" fill="none" stroke="${P.parchment}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`,
      `<path d="M50 20 L55 20 L50 25 L55 25" fill="none" stroke="${P.parchment}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`,
    ].join('\n'),

  brahmastra: (c) =>
    [
      // arrowhead head
      `<path d="M22 64 L22 42 L12 42 L32 4 L52 42 L42 42 L42 64Z" fill="${c.body}" ${L25}/>`,
      `<path d="M32 4 L52 42 L42 42 L42 64 L35 64 L35 42 L36 42Z" fill="${shade(c.body)}"/>`,
      `<path d="M27 64 L27 48 Q32 44 37 48 L37 64Z" fill="${c.belly}" ${L15}/>`,
      `<ellipse cx="26" cy="30" rx="3.5" ry="5" fill="${P.gold}" ${L15}/><path d="M26 26 L26 34" ${line(2)}/>`,
      `<ellipse cx="38" cy="30" rx="3.5" ry="5" fill="${P.gold}" ${L15}/><path d="M38 26 L38 34" ${line(2)}/>`,
      // gold lightning chevrons
      `<path d="M24 50 L28 54 L32 50 L36 54 L40 50 M24 58 L28 62 L32 58 L36 62 L40 58" fill="none" stroke="${P.gold}" stroke-width="2.5"/>`,
    ].join('\n'),

  ravana: (c) => {
    // ten small crowned heads fanned behind the main head
    const fan = [];
    for (let i = 0; i < 10; i++) {
      const a = -112 + (224 / 9) * i; // degrees from straight up
      fan.push(
        `<g transform="rotate(${a} 32 40)">` +
          `<path d="M28 40 L28 10 Q28 2 32 2 Q36 2 36 10 L36 40Z" fill="${i % 2 ? shade(c.body) : c.body}" ${L15}/>` +
          `<path d="M27 8 L29 3 L31 7 L33 3 L35 7 L37 3 L37 10 L27 10Z" fill="${P.gold}" ${line(1)}/>` +
          `<circle cx="30" cy="12" r="1" fill="${P.gold}"/><circle cx="34" cy="12" r="1" fill="${P.gold}"/>` +
          `</g>`,
      );
    }
    return [
      ...fan,
      baseHead(c.body, c.belly, { w: 1.05 }),
      // crown-scales on the neck
      `<path d="M23 50 L26 46 L29 50 L32 46 L35 50 L38 46 L41 50" fill="none" stroke="${P.gold}" stroke-width="2"/>`,
      // main crown
      `<path d="M18 16 L21 4 L26 12 L32 2 L38 12 L43 4 L46 16Z" fill="${P.gold}" ${L2}/>`,
      `<path d="M20 12 L24 6" fill="none" stroke="${tint(P.gold)}" stroke-width="2" stroke-linecap="round"/>`,
      `<circle cx="32" cy="11" r="2.5" fill="${P.blood}" ${line(1)}/>`,
    ].join('\n');
  },
};

export function writeSnakes(root) {
  const out = {};
  for (const [id, c] of Object.entries(SNAKES)) {
    const svg = svgDoc(64, motifs[id](c), `Snake head: ${id} (points up, neck leaves bottom edge)`);
    out[`snakes/${id}.svg`] = write(`${root}/snakes/${id}.svg`, svg);
  }
  out['snakes/palette.json'] = write(`${root}/snakes/palette.json`, JSON.stringify(SNAKES, null, 2) + '\n');
  return out;
}
