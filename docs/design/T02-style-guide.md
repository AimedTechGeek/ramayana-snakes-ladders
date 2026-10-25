# T02 — Visual Style Guide

Scope: every hand-authored SVG asset in v1 (heroes, faces, tokens, dice, UI frame) and the
colour/line rules the board art (`T03-board-art.md`) must also follow.

Look in one sentence: **flat 2D vector cutouts in the spirit of Amar Chitra Katha comics —
bold dark outlines, warm saffron / indigo / gold, one hard-edged shadow tone per shape, no
gradients, no soft shading.**

## 1. Palette tokens

Use these names in SVG as CSS variables or as `id`s of `<solidColor>`-style swatches so a
future AI-art upgrade can re-skin without touching geometry.

| Token | Hex | Use |
|---|---|---|
| `saffron` | `#F39C2B` | Primary UI accent, buttons, highlights, Hanuman's dhoti, ladders' rope |
| `gold` | `#E9C12F` | Crowns, jewellery, ladder rungs, dice border, medallion rings |
| `indigo` | `#3A3F9E` | Primary UI frame lines, text on parchment, Lanka sky |
| `deepIndigo` | `#1C1F4D` | Night sky, deepest shadows, modal scrim (at 70% alpha) |
| `parchment` | `#F3E3B8` | Panels, dice body, bubble background, manuscript leaves |
| `ink` | `#2A1A0F` | ALL outlines, body text, pips, pupils |
| `leaf` | `#4C8C3F` | Forest fills, Mithila fields |
| `river` | `#3F8FB5` | Ganga, ocean, Rama Setu water |
| `blood` | `#8E3B3B` | Snake bellies/markings and villain accents only. Muted on purpose. |
| `ramaAccent` | `#3F6FC2` | Rama's skin (sky-blue) and seat colour |
| `sitaAccent` | `#D15587` | Sita's sari (rose) and seat colour |
| `lakshmanaAccent` | `#2E9E6B` | Lakshmana's dhoti/sash (emerald) and seat colour |
| `hanumanAccent` | `#E4572E` | Hanuman's sindoor-orange fur trim/loincloth and seat colour |

Derived tones (compute, do not hand-pick):

| Derived | Rule |
|---|---|
| `shade(x)` | token mixed 22% toward `ink` — the single shadow tone for each fill |
| `tint(x)` | token mixed 18% toward `#FFFFFF` — used only for gold/metal highlights |
| `disabled` | `parchment` at 55% alpha over `deepIndigo` |

Contrast rules: `ink` text on `parchment` (AAA), `parchment` text on `indigo`/`deepIndigo`
(AA+). Never put `saffron` text on `gold` or `gold` on `parchment`.

## 2. Line and shading rules

| Rule | Value |
|---|---|
| Hero figure canvas | `viewBox="0 0 200 300"`, feet at y=290, head centre around y=60 |
| Outline weight | 5 units in the 200x300 viewBox (= 2.5% of width); scales with the figure. Interior detail lines 3 units. Face features 3 units (brows 4). |
| Line colour | Always `ink`. No coloured outlines. |
| Line joins/caps | `stroke-linejoin="round"`, `stroke-linecap="round"` |
| Shading | Exactly one `shade()` shape per fill, hard-edged, placed as if light comes from upper-left. No gradients, no blur, no opacity shading. |
| Highlights | Only on metal (crowns, mace, bow tips, jewellery): one `tint(gold)` sliver. |
| Textures | None. Pattern is implied by outline (e.g. 3 fold lines on a dhoti). |
| Layer order (figure) | back-arm/tail -> body -> front-arm/props -> head (separate layer) -> face (separate layer) |
| File naming | `heroes/<hero>/body.svg`, `heroes/<hero>/face-<emotion>.svg`, `tokens/<hero>.svg`, `ui/dice-<1..6>.svg`, `ui/frame-*.svg` |

Head and face are separate layers because emotions are expressed by swapping the face layer
(5 expressions) and running a tween on the whole figure; the body never changes.

## 3. Hero visual descriptions

All heroes share: large head (about 1/4 of total height), simple 4-finger hands, bare feet,
gold anklets. Proportions are cute-heroic, not chibi: 4 heads tall.

### Rama

| Part | Spec |
|---|---|
| Skin | `ramaAccent` sky-blue, shade tone on the right side of the face and limbs |
| Hair | `ink` top-knot (jata) with a small gold crown band and a single `saffron` jewel |
| Costume | Yellow-gold dhoti (`gold`) with `saffron` border, bare chest, `indigo` upper sash across one shoulder |
| Attributes | Longbow Kodanda in left hand (height = 220 units, `gold` limbs, `ink` string), quiver strap over right shoulder |
| Jewellery | Gold armlets, necklace with one large pendant, earrings |
| Posture | Upright, weight even, chin level. Never leans back or slouches. |
| Token icon | Blue face with gold crown band, bow tip visible at left |

### Sita

| Part | Spec |
|---|---|
| Skin | Warm fair tone `#F2C29B`, shade `#D9A27B` |
| Hair | `ink`, long braid over left shoulder with `gold` ties, jasmine dots (`parchment`) along the braid |
| Costume | `sitaAccent` rose sari with `gold` border, `saffron` blouse |
| Attributes | Lotus flower in right hand (`sitaAccent` petals, `leaf` stem). No weapons. |
| Jewellery | Gold nose ring (small), bangles, a thin crown |
| Posture | Serene, hands low, slight head tilt. Never hunched. |
| Token icon | Fair face, braid on left, lotus at right |

### Lakshmana

| Part | Spec |
|---|---|
| Skin | Golden fair `#F0B57C`, shade `#C98E5A` |
| Hair | `ink` top-knot, no crown; a plain `saffron` headband |
| Costume | `lakshmanaAccent` emerald dhoti with `gold` border, `saffron` sash |
| Attributes | Shorter bow (height 180 units) in right hand, quiver; hand on hip when idle |
| Jewellery | Minimal: one armlet, plain anklets |
| Posture | Weight forward, feet apart, elbows out. He always looks ready to move. |
| Token icon | Fair face with saffron headband, emerald collar |

### Hanuman

| Part | Spec |
|---|---|
| Fur/skin | Face and chest `#F0A96B` (warm peach), body fur `hanumanAccent` shade for the outer fur silhouette, muzzle `parchment` |
| Face | Round monkey face, wide muzzle, big round ears; `saffron` sindoor mark on forehead |
| Costume | `saffron` loincloth with `gold` border, `gold` armlets, a `leaf`-green sacred thread |
| Attributes | Mace (gada) over the right shoulder: `gold` head with `tint(gold)` highlight, `ink`-wrapped handle. Long tail curling up behind and over the left shoulder, tail tip tuft `hanumanAccent`. |
| Posture | Knees slightly bent, bouncing on toes; tail is a separate sub-layer so it can wag during tweens |
| Token icon | Monkey face with sindoor mark, tail tip curling in from the right |

## 4. Face construction (5 expressions)

Face layer `viewBox="0 0 100 100"` placed over the head (head circle centre (50,50),
radius 42). Coordinates below are in this face box. All strokes `ink`, round caps.
Pupils are `ink` filled circles; eye whites are `parchment`.

| Element | idle | happy | excited | scared | sad |
|---|---|---|---|---|---|
| Eye whites | Almonds, centres (36,46) & (64,46), 16w x 11h | Same almonds, 16 x 9 (slightly squinted) | Circles r=8 at (36,44) & (64,44) — wide open | Circles r=9 at (36,45) & (64,45) | Almonds 16 x 9, outer corners dropped 2 units |
| Pupils | r=4 at eye centre | r=4, shifted 1 up | r=5, centred | r=3, shifted toward centre (34,46) & (62,46) | r=4, shifted 1 down |
| Highlight dot | `parchment` r=1.5 at upper-left of each pupil | same | r=2 | none (flat fear) | r=1 |
| Brows (4 stroke) | Gentle arcs: from (26,34) to (46,32), from (54,32) to (74,34) | Arcs raised 2 units | Arcs raised 5 units, outer ends flicked up | Inner ends raised, outer ends dropped: from (26,36) to (46,30) and (54,30) to (74,36) | Inner ends raised (sad "A"): from (26,34) to (46,30) and (54,30) to (74,34) |
| Mouth | Short gentle curve (38,66) to (62,66), bulge 3 down | Wide smile (32,64) to (68,64), bulge 10 down, closed (no teeth) | Open grin: smile outline (32,62)-(68,62) bulge 12, filled `blood` (muted) with a `parchment` tooth bar 4 high at the top | Small open oval 10w x 8h centred (50,68), filled `blood` | Short curve (40,68) to (60,68), bulge 3 UP (gentle frown) |
| Cheeks | none | two `sitaAccent` ovals 6x4 at (28,58) & (72,58), 60% alpha | same ovals, 80% alpha | none | none |
| Extra | — | — | 2 small `gold` sparkle marks beside the head (only Hanuman & Lakshmana) | 3 short `ink` "sweat" strokes above right brow (only Hanuman & Lakshmana) | one `river` tear-drop r=2 under left eye, Hanuman & Lakshmana ONLY |

Respect rule applied to faces: Rama's and Sita's `scared` uses the same geometry but with
brows at the `idle` height (concern, not fear) and NO sweat marks; their `sad` has no tear.
Their expressions are always dignified: no tongue, no crossed eyes, no wobbling mouth.

Hanuman's face uses a wider mouth (add 6 units each side) and his ears sit outside the
head circle at (4,40) and (96,40), r=12.

## 5. Token medallion

Tokens are the pieces moved on the board. Up to 4 may share one 56px cell.

| Element | Spec |
|---|---|
| Canvas | `viewBox="0 0 48 48"`, rendered at 40px on the board (fits 4 in a cell with offsets) |
| Outer ring | Circle r=22 stroke `gold` 3 units, with `ink` 2-unit outline outside it |
| Fill | Hero accent colour (`ramaAccent`, `sitaAccent`, `lakshmanaAccent`, `hanumanAccent`) |
| Icon | The hero's head (simplified from token-icon row in section 3), 30 units tall, centred, `idle` face |
| Shadow | `deepIndigo` ellipse 30 x 8 at 35% alpha under the token (separate sprite so it can stay flat while the token hops) |
| Stacking offsets in a cell | 1 token: centre. 2: (-8,-8), (+8,+8). 3: (-9,-7), (+9,-7), (0,+8). 4: four corners (+-9,+-8). Render order: seat 1 lowest. |
| Active seat glow | A `saffron` ring r=26, 3 units, pulsing alpha 0.4-1.0 at 1.2s |

## 6. Dice

| Element | Spec |
|---|---|
| Canvas | `viewBox="0 0 64 64"`, rendered at 96px inside the 128px dice button |
| Body | Rounded square (radius 10), fill `parchment`, 4-unit `ink` outline, inner 2-unit `gold` line inset by 4 |
| Pips | `indigo` circles r=5 on the standard 3x3 grid (centres at 18/32/46). Six faces as six SVGs `dice-1.svg` .. `dice-6.svg`. |
| Six | The six-face pips are `saffron` instead of `indigo` so a 6 reads instantly as special |
| Rolling | Swap face every 60ms for 600ms while tweening rotation -15..+15 deg and scale 1.0->1.15->1.0; land with a 120ms squash |
| Disabled | Body at 55% alpha, no outline change |

## 7. UI frame — palm-leaf manuscript

The whole right panel and all modals use the same frame language: stacked palm-leaf strips
bound by a cord through two holes.

| Element | Spec |
|---|---|
| Panel body | `parchment` fill, 3px `ink` outline, corner radius 6 |
| Leaf texture | Four hairline (1px) `shade(parchment)` horizontal lines across each panel at 25/50/75% height — the only "texture" allowed |
| Binding holes | Two `ink` circles r=5 with `gold` eyelet rings, at 20% and 80% of the panel width, 12px from the top |
| Cord | A `blood`-coloured 3px line running through both holes and out the top, ending in a small tassel on the right |
| Corner flourish | Simple `gold` lotus-bud spiral in each corner, 18px |
| Primary button | `saffron` fill, `ink` 3px outline, `parchment` text 24px bold, radius 8; pressed = `shade(saffron)` and 2px downward offset |
| Secondary button / toggle | `parchment` fill, `indigo` 2px outline, `indigo` text 20px; active toggle = `indigo` fill with `parchment` text |
| Speech bubble | `parchment` rounded rect (radius 12), 3px `ink` outline, tail triangle toward the speaker, text `ink` 20px |
| Typeface | Headings: "Yatra One" (Google Fonts, Devanagari-flavoured Latin); body/UI: "Nunito" 600/700. Fallback: Georgia / system-ui. |

## 8. Motion style

All tweens use `Sine.easeInOut` unless listed in `T05-emotion-timing.md`. Figures never
stretch beyond 15% in any axis. Nothing rotates more than 20 degrees except Hanuman's
somersault (360). Shadows stay on the ground during hops.

## 9. AI prompt pack (future art upgrade)

Use when an image model becomes available. Keep the generated art inside the rules above
(flat, outlined, no gradients) so it can replace the SVGs one for one.

Base style suffix for every prompt:

> flat 2D vector illustration, Amar Chitra Katha comic style, bold dark brown outlines,
> cel-shaded with one hard shadow tone, warm saffron indigo and gold palette, white
> background, no gradients, no text, centered, full body

| Asset | Prompt core |
|---|---|
| Rama body | "Prince Rama, sky-blue skin, gold dhoti with saffron border, indigo sash, top-knot with small gold crown band, holding a tall golden longbow, calm noble expression, standing upright" |
| Sita body | "Princess Sita, fair skin, long black braid with jasmine, rose-pink sari with gold border, saffron blouse, holding a lotus, serene gentle smile" |
| Lakshmana body | "Prince Lakshmana, golden skin, saffron headband, emerald green dhoti, shorter bow and quiver, hand on hip, alert fiery expression" |
| Hanuman body | "Hanuman the monkey hero, warm peach face, orange fur trim, saffron loincloth, golden mace over the shoulder, long curling tail, big joyful grin" |
| Face sheet | "<hero> head only, five expressions in a row: neutral, happy, excited, scared, sad, same angle, same lighting" + suffix |
| Board region | "top-down tile of <region> (e.g. dense Dandaka forest / golden city of Lanka at night), decorative border, seamless" + suffix, no characters |
| Snake | "<villain motif> as a stylised cobra, muted red-brown belly, <accent> scales, menacing but cartoonish, curved S pose" + suffix |
| Ladder | "a ladder made of <material>, straight, nine rungs, slight perspective, decorative Indian motif on the rails" + suffix |

Negative prompt: photorealistic, 3D render, gradient, blur, text, watermark, extra limbs,
weapons pointed at viewer, gore.
