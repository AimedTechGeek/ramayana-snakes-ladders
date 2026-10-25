# T03 — Board Art

Scope: the 12x12 board background, the 9 ladders, the 13 snakes, and the two landmark
squares. Follows the palette, outline and shading rules in `T02-style-guide.md`.

Board geometry (from `T04-ux.md`): 672x672 px at canvas (24,24), 56px cells. Square 1 is
bottom-left, numbering is boustrophedon (row 1 left->right, row 2 right->left, ...), 144
is top-left. In this document `cN rM` means column N (1 = left) in row M (1 = bottom).

Cell pixel origin for `cN rM`: `x = 24 + (N-1)*56`, `y = 24 + (12-M)*56`.

## 1. Row regions

Each row band is a 672x56 strip. Bands blend into each other with a 1-cell overlap of motif
(e.g. the last forest row has a few rocks; the first Kishkindha row keeps two trees).
Cell borders: 2px `shade(band colour)` grid lines; numbers in `ink`, 14px Nunito 700,
top-left of each cell with 4px inset, on a tiny `parchment` chip (22x16, 55% alpha).
Numbers never sit under a token.

| Rows | Chapter | Base fill | Motifs (flat cutouts, 1-2 per cell max, never under numbers) |
|---|---|---|---|
| 1-3 | Bala Kanda / Mithila | `tint(leaf)` meadow green `#6FA560` with `parchment` paths | Rice-field stripes, mango trees, Sarayu riverbank strip along row 1's bottom edge (`river`), Janaka's palace silhouette in `gold` on row 3's right end, a small plough (Sita's birth) at r3 c6, sage huts with smoke on row 2 |
| 4 | Ayodhya / exile | Left half `gold` city plaza; right half fading to `leaf` forest edge | Ayodhya ramparts and domes in `saffron`/`gold` on c1-c5 (note row 4 runs right->left, so the story still reads: palace near 48 is where exile begins); a chariot at c7; the first dark trees at c9-c12; Kaikeyi's window at c3 (snake 46) |
| 5-7 | Dandaka forest (snake-heavy) | `leaf` darkened: r5 `#4C8C3F`, r6 `#3F7A36`, r7 `#33692E` (progressively deeper) | Dense sal trees, hanging vines, hidden eyes (`gold` dots) in gaps, Panchavati hut at r6 c6, Ganga crossing (`river` diagonal band) under ladder 49->74 at r5-r7 c1-c2, Jatayu silhouette circling at r7 c5 |
| 8-9 | Kishkindha (ladders) | Ochre rock `#C98B4B` with `shade` crevices | Boulders, a waterfall (`river`) at r8 c12 beside ladder 85->108, monkey-silhouette friezes (`hanumanAccent`) on rock edges, Rishyamukha hill at r9 c1, cave mouth at r8 c6, bananas and berries (Shabari) around 85 |
| 10-12 | Lanka / war | `indigo` night sky over `river` sea for r10; `deepIndigo` with `gold` city for r11-r12 | r10: ocean waves and the stone causeway (Rama Setu) crossing c6-c12 under ladder 101->127; r11: Lanka's golden walls, towers with `blood` banners, scattered arrows; r12: palace terraces with `gold` filigree, fires (`saffron` flame cutouts), a broken ten-headed banner near 138, the coronation hall at 144 |

Row 12 is an even row, so it runs right->left: 133 is at c12 and 144 at c1. Place the
battlefield (133-137) on the right and let the city calm toward the throne on the left.

Local colour used below: `ochre` = `#C98B4B` (Kishkindha rock); `shade(ochre)` per T02.

## 2. Landmark squares

| Square | Position | Concept |
|---|---|---|
| 1 | c1 r1 | **Ayodhya gate.** A `gold` arch with `saffron` doors ajar, two `parchment` lamps, a `leaf` mango garland. The cell number "1" sits on a `gold` chip instead of parchment. Tokens start off-board (shown on their seat cards) and enter at square 1 on their first move, so the gate is the only cell with an open bottom edge: the border is interrupted by a `parchment` road leading in. |
| 144 | c1 r12 | **Pattabhishekam, Rama's coronation.** The cell is a 56x56 throne room: `deepIndigo` interior, a `gold` throne with a `saffron` cushion, a parasol (chhatra) above, two `parchment` lamp flames, a lotus garland. The number "144" is rendered as a `gold` plaque under the throne. On win, a 3-cell radius of `gold` confetti dots plays over rows 11-12. |

## 3. Ladders (foot -> top)

Common rules: rails 6px, rungs 4px, both with 2px `ink` outline. A ladder's rails run from
the centre of the foot cell to the centre of the top cell as straight lines; rungs are
evenly spaced, one per crossed cell. Ladders render above the background, below snakes,
below tokens. Each ladder has a small `parchment` story label (the name below) on a
scroll at the foot, 12px, only shown on hover/long-press (v1 may omit).

| Foot -> Top | Cells | Jump | Name | Visual concept |
|---|---|---|---|---|
| 4 -> 25 | c4 r1 -> c1 r3 | 21 | Vishwamitra's training | Plain `parchment` wooden rails bound with cord; sage's staff and a kamandalu (water pot) at the foot; a bow-string wraps the top rung. |
| 20 -> 43 | c5 r2 -> c6 r4 | 23 | Breaking Shiva's bow | Rails are the two halves of the great bow (`gold` with `ink` grain), rungs are `indigo` bowstring segments; a burst mark (`saffron`) where the bow snapped at the top. |
| 26 -> 52 | c2 r3 -> c4 r5 | 26 | Wedding of Rama and Sita | Rails of `sitaAccent` rose silk draped on `gold` poles; rungs are marigold garlands (`saffron` ovals); two tiny crowns at the top. |
| 49 -> 74 | c1 r5 -> c2 r7 | 25 | Guha ferries them across the Ganga | A wooden boat hull (`shade(parchment)`) is the lower half; rails are oars; rungs are rope. Drawn over the `river` band. |
| 85 -> 108 | c12 r8 -> c12 r9 | 23 | Shabari's devotion | Vertical, short. Rails are berry branches (`leaf`), rungs are rows of `blood`-red berries on `parchment` leaves; a small basket at the foot. |
| 88 -> 113 | c9 r8 -> c8 r10 | 25 | Meeting Hanuman | Rails of `hanumanAccent` fur-trimmed rope, rungs `gold`; a tiny mace icon at the foot and a tail curl at the top rung. |
| 92 -> 118 | c5 r8 -> c3 r10 | 26 | Alliance with Sugriva | Two `ochre` rock pillars as rails, rungs are clasped-hands motifs (`gold`); a crown with a monkey-ear silhouette at the top. |
| 95 -> 122 | c2 r8 -> c2 r11 | 27 | Hanuman's leap to Lanka | Vertical, the longest. Rails are two `river` wave columns; rungs are `parchment` clouds; a small flying Hanuman silhouette at the top rung; the sea band is visible behind. |
| 101 -> 127 | c5 r9 -> c7 r11 | 26 | Building Rama Setu | Rails of stacked `ochre` stones with `ink` mortar lines; rungs are floating rocks with "Rama" marks (`saffron` dots); a squirrel at the foot. |

## 4. Snakes (head -> tail)

Common rules: snakes are drawn as a single smooth S-curve body 18px wide (12px for the
small ones), `ink` 3px outline, flat belly stripe in `blood`, 2 scale rows implied by
`shade` crescents every 20px. Heads are a rounded wedge with `gold` slit eyes; the head
sits on the HEAD square, the tail tip on the TAIL square. Snakes render above ladders.
Villain motifs are flat cutouts placed on the head cell, never covering the number.
No snake has fangs showing at the player (mouth closed or sideways).

| Head -> Tail | Cells | Drop | Name | Visual concept |
|---|---|---|---|---|
| 17 -> 6 | c8 r2 -> c6 r1 | 11 | Tataka | Short, thick, `shade(leaf)` swamp-green with `blood` belly; a wild tangle of `ink` hair on the head cell, a broken tree. |
| 37 -> 19 | c12 r4 -> c6 r2 | 18 | Manthara's whisper | Thin `deepIndigo` snake with `gold` zigzag; the head wears a hunched `parchment` shawl, a tiny whisper-bubble "..." at the head cell. |
| 46 -> 28 | c3 r4 -> c4 r3 | 18 | Kaikeyi's two boons | `sitaAccent`-dark purple (`#7B3B6E`) body with two `gold` bangles around the neck (the two boons); head cell shows a palace window with a drawn curtain. |
| 58 -> 40 | c10 r5 -> c9 r4 | 18 | Viradha | Broad `ochre`-brown snake with `blood` belly and `ink` bristle marks; a club motif beside the head. |
| 64 -> 47 | c9 r6 -> c2 r4 | 17 | Shurpanakha's revenge | Long, nearly horizontal. `blood` body with `gold` nose-ring charm at the head; sharp `saffron` fingernail marks along the back. |
| 70 -> 56 | c3 r6 -> c8 r5 | 14 | Golden deer (Maricha) | `gold` body with `parchment` spots, the head is drawn as a deer-mask with small antlers; a disguise reveal: `blood` scales show under the mask edge. |
| 76 -> 55 | c4 r7 -> c7 r5 | 21 | Sita's abduction | `deepIndigo` body with a `gold` chariot-wheel motif at the head (Ravana's Pushpaka); Jatayu feathers scattered along the body. Respect rule: Sita herself is never drawn on the snake. |
| 82 -> 68 | c10 r7 -> c5 r6 | 14 | Kabandha | Stout `shade(leaf)` body; the head cell shows a huge torso-with-arms silhouette (no head), eyes on the chest. |
| 114 -> 96 | c7 r10 -> c1 r8 | 18 | Indrajit's Nagapasha | Two slim intertwined `indigo` snakes drawn as one braided body (the serpent-noose); `gold` knot at the head. |
| 120 -> 110 | c1 r10 -> c11 r10 | 10 | Prahasta's charge | Runs horizontally across row 10. `ochre` armoured body with `gold` plate scallops; the head carries a war-helmet crest. |
| 124 -> 106 | c4 r11 -> c10 r9 | 18 | Kumbhakarna awakens | The fattest snake (24px), `shade(ochre)` body with `parchment` belly; the head has closed sleepy eyes and a `parchment` "Z" above; drum motifs around the head cell. |
| 130 -> 119 | c10 r11 -> c2 r10 | 11 | Indrajit's Brahmastra | Slim `saffron` snake with `gold` lightning chevrons; the head is an arrowhead shape. |
| 138 -> 78 | c7 r12 -> c6 r7 | 60 | Ravana's pride (ten-headed mega-snake) | The showpiece. Body 28px, `deepIndigo` with `blood` belly and `gold` crown-scales; it cuts diagonally through Lanka, the sea and into the forest. The head square shows a fan of ten small crowned snake heads (`gold` crowns, `ink` outlines) arranged like a peacock tail behind the main head. Only this snake triggers `snakeBig`. |

Render order per cell: background -> ladders -> snakes -> landmark overlays -> tokens.

## 5. Notes for the engineer

- Ladder and snake endpoints are the only gameplay data; everything else is decorative.
- With the decided board, no ladder jump is >= 30, so `ladderBig` cannot fire; `snakeBig`
  fires only for 138 -> 78. The reaction tables still define both for completeness.
- Snake 120 -> 110 lies entirely in row 10; tokens sliding on it move horizontally.
- Ladder 95 -> 122 and snake 138 -> 78 cross visually near c6-c7 r9-r11; draw the snake
  on top and keep both endpoints unobstructed.
