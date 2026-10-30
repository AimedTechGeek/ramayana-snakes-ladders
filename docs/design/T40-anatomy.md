# T40 — Anatomy redesign: the board as a crafted isometric object

Scope: every drawn thing in the game (board, snakes, ladders, tokens, heroes, HUD, screens) redone
in the anatomy style: one invented crafted object built from many small precise parts, four-tone
isometric shading, 0.6 px lines, one `lit` accent, light theme first. Phaser stays; all 3D is
generated at BUILD time by Node scripts on the vendored anatomy kit (`scripts/art/anatomy/`:
`iso-kit.mjs`, `lathe.mjs`, `tube.mjs`, `audit.mjs`) and exported as standalone SVGs that Phaser
rasterises into textures. Fixed camera, no rotation.

Read first: `T02-style-guide.md` (RESPECT RULES, section 4 face geometry: still binding),
`T03-board-art.md` (snake and ladder identities), `T05-emotion-timing.md` (tween catalogue, kept),
`src/game/iso/boardIso.ts` + `scripts/art/iso-board.mjs` (projection twin, kept, retuned here),
anatomy `SKILL.md`, `references/craft.md`, `references/kit.md`.

Decisions already made by the owner and not reopened: build-time SVG solids; heroes are
figurines, not machines; the four seat colours are the only colour exception plus one `lit`
accent for the current player; speech bubbles stay as a UI overlay; square numbers stay; snakes
and ladders are low relief and tokens always draw above the board layer; light theme first;
vertical slice = iso board (3 difficulties) + Hanuman (5 emotions) + tokens hopping in the real game.

Numbers in this document are world units unless marked `px` (logical canvas pixels at 1280x720).
World: `x` right along a row, `y` toward the viewer (row 1 is nearest), `z` up. One square = 56.

---

## 1. Concept and parts list

**In one sentence:** the board is a *carved teak chaupar-table from a temple courtyard*: a heavy
plinth on four turned feet, inlaid with 144 bone tiles in a brass-rimmed frame, a brass maker's
plate on the front face, the Ayodhya gate (a small torana) standing on the rim beside square 1 and
the coronation parasol (chhatra) standing at the far corner above square 144. It reads as
Ramayana because its two landmarks are the two ends of the epic's journey (the gate of Ayodhya
you leave by, the royal parasol you arrive under) and because the 13 snakes and 9 ladders inlaid
on it keep their T03 identities as carved pieces.

Tone rules (craft.md section 4): plinth and feet `lo`, rim and frame `mid`, playing surface and
story furniture `hi`, the current player's figurine `lit`. Grooves `faint`, minor ticks `lo`,
major ticks `mid`. Screws are dots 0.45–0.55.

### 1.1 Base (plinth)

| # | Part | Count | World size / position | Tone | Kit primitive |
|---|---|---|---|---|---|
| B1 | Halo | 1 | under plan `{x:-22,y:-22,w:716,d:716,r:10}` at z −22 | halo | `haloOf(plan, -22, 16, P)` |
| B2 | Foot flange | 4 | r 13, h 1.6, z −22..−20.4, centres inset 34 from plinth corners | lo | `cylinder(x,y,13,-22,1.6,P,40)` |
| B3 | Foot (waisted) | 4 | profile `[[−20.4,10.5],[−18.4,9.4,1],[−16,10.8]]` on a vertical frame | mid | `G.solidOf(profile, frameAlong([x,y,0],[0,0,1]), P)` |
| B4 | Plinth slab | 1 | plan B1, z −16..0, bevel 1.6, steps 8 | lo | `slabOf(plan,-16,16,P,8,1.6)` |
| B5 | Lid seam | 1 | visible near half of the plan at z −8, drawn as the slab's `inner` | faint | `sideSeam(plan,-8,P,8)` |
| B6 | Plinth top groove | 1 | `insetPlan(plan, 6)` at z 0 | faint | `planOutline` |
| B7 | Plinth top screws | 4 | ring r 2.2 + dot .5 at `corners(plan, 11)`, z 0 | lo / dot | `ring` + `dotsSvg` |
| B8 | Maker's plate | 1 | on the front face: plan `{x:276,y:694,w:120,d:0.8,r:0.4}`, z −12..−4 | mid | `slabOf(...,-12,8,P,2)` |
| B9 | Plate rule lines | 3 | on the plate's front face, lengths 72 / 48 / 60 from x 290, at z −6.5 / −8 / −9.5, `free` | lo | `segment` with `free: true` |
| B10 | Plate screws | 2 | dots .45 at x 282 and 390, z −8 on the plate face | dot | `dotsSvg` |
| B11 | Corner caps | 4 | slab 12x12x1.4 r 2 on the rim corners (plan inset 2 from each plinth corner), z 3.6..5.0 | mid | `slabOf` |
| B12 | Corner cap screws | 4 | dot .5 at each cap centre, z 5.0 | dot | `dotsSvg` |

### 1.2 Structure (rim frame)

| # | Part | Count | World size / position | Tone | Kit primitive |
|---|---|---|---|---|---|
| S1 | Rim bars | 4 | front `{x:-22,y:672,w:716,d:22,r:2}`, back `{x:-22,y:-22,w:716,d:22,r:2}`, left `{x:-22,y:0,w:22,d:672,r:0}`, right `{x:672,y:0,w:22,d:672,r:0}`; inner faces flush with the field plate; z 0..3.6, bevel 1.0 | mid | `slabOf(...,0,3.6,P,4,1.0)`; draw back, left, right, front |
| S2 | Rim inner seam | 1 | outline of the field `{x:0,y:0,w:672,d:672,r:0}` at z 3.6 (where the bars' inner faces meet their tops) | lo | `planOutline` |
| S3 | Front ruler ticks | 84 | on the front bar top (z 3.6), hanging from its inner edge y 672.8 toward +y: minor 2.0 every 8 units, major 3.6 every 7th (x = multiples of 56 = tile edges) | lo / mid | `topTicks(0,672,8,7,672.8,3.6,[2,3.6],P,'x')` |
| S4 | Left ruler ticks | 84 | same on the left bar, hanging from x −0.8 toward −x | lo / mid | `topTicks(...,'y')` |
| S5 | Ruler end screws | 4 | dots .45 at both ends of each ruler | dot | `dotsSvg` |
| S6 | Chapter plates | 5 | on the right bar top: plan `{x:677,y:yc-7,w:12,d:14,r:1}` z 3.6..4.4, `yc` = 588 (rows 1–3 Mithila), 476 (row 4 Ayodhya), 364 (rows 5–7 forest), 224 (rows 8–9 Kishkindha), 84 (rows 10–12 Lanka) | mid | `slabOf` + `planOutline(insetPlan(plate,1.6),4.4)` faint |
| S7 | Chapter plate rules | 15 | 3 rule lines per plate along y, lengths 8 / 6 / 7, `free` | lo | `lineOnTop` |
| S8 | Chapter plate screws | 10 | 2 dots .4 per plate | dot | `dotsSvg` |
| S9 | Rim end screws | 8 | ring r 1.8 + dot .45 near each bar end (inset 8), z 3.6 | lo / dot | `ring` + `dotsSvg` |

### 1.3 Playing surface

| # | Part | Count | World size / position | Tone | Kit primitive |
|---|---|---|---|---|---|
| F1 | Field plate | 1 | `{x:0,y:0,w:672,d:672,r:0}` z 0..1.2 (shows through the grooves) | mid | `slabOf(...,0,1.2,P,2)` |
| F2 | Tiles | 144 | each `{x:c*56+1, y:(11-r)*56+1, w:54, d:54, r:1}` z 1.2..2.4 (TOP_Z = 2.4); `c`,`r` from `gridOf` | hi | `slabOf(...,1.2,1.2,P,2)`; drawn back to front by `depthOf` |
| F3 | Tile alternation | 144 | tiles with `(r+c)` even keep `--anatomy-top` #FFFFFF; odd tiles get `--anatomy-top` #F4F4F1 (class `sq-b`) | — | CSS class on the solid group |
| F4 | Number sill digits | 144 | single-stroke numerals (section 2.5) on the near strip of each tile: digit 8 wide x 14 tall, advance 10, baseline at `cy+26`, top at `cy+12`, string centred on `cx`; stroke-width 0.9, `free` ends | mid | `onTop` polylines |
| F5 | Ganga inlay | 6 tiles | tiles 49, 50, 71, 72, 73, 74: three sine lines (amplitude 1.2, period 14) running x-edge to x-edge of the tile top at y = cy−18, cy−10, cy−2 | faint | `onTop` ending on the tile outline |
| F6 | Sea inlay | 12 tiles | row 10 (squares 109–120): same three waves | faint | `onTop` |
| F7 | Ayodhya threshold | 1 | `planOutline(insetPlan(tile1, 3), 2.4)` | hi | `planOutline` |
| F8 | Coronation dais ring | 1 | `ringBand` r 16 / 13 at z 2.4..2.8 centred on tile 144's field centre `(28, 19)` | hi | `G.ringBand(2.4,2.8,13,16,F,P)` |
| F9 | Dais lotus ring | 1 | ring r 10 at z 2.4 | lo | `ring` |
| F10 | Dais spokes | 8 | from r 10 to r 13 at z 2.8 (end on F9 and F8) | lo | `G.spokesOf` |

### 1.4 Edge furniture (story landmarks)

| # | Part | Count | World size / position | Tone | Kit primitive |
|---|---|---|---|---|---|
| E1 | Torana posts | 2 | r 2.2, z 3.6..25.6 at `(-11, 626)` and `(-11, 662)` on the left bar | hi | `cylinder(x,y,2.2,3.6,22,P,20)` |
| E2 | Post beads | 4 | `ringBand` r 2.6 / 2.2 h 0.8 at z 8 and z 21 on each post | hi | `G.ringBand` |
| E3 | Lintel | 1 | `{x:-14.5,y:623,w:7,d:42,r:1}` z 25.6..28.6, bevel .6 | hi | `slabOf` |
| E4 | Lintel finials | 2 | spheres r 1.4 at `(-11, 626, 30)` and `(-11, 662, 30)` on short pins r .6 z 28.6..28.6+1.4 | hi | `G.sphereOf` + `cylinder` |
| E5 | Garland | 1 | tube r 0.6 from post to post through `(-8, 644, 20)`, filleted (bend 3), gapped under the beads | hi | `tubePieces` |
| E6 | Parasol post | 1 | r 1.4, z 3.6..44 at `(-11, -11)` (back-left rim corner cap) | hi | `cylinder` |
| E7 | Parasol dome | 1 | smooth profile (s = z) `[[40,13],[41.5,12.6,1],[44,9.5,1],[46.5,5,1],[48,0]]` with `smooth:{slope}` | hi | `G.solidOf` |
| E8 | Parasol fringe | 1 | `ringBand` r 13.2 / 12.6 z 39.2..40 | hi | `G.ringBand` |
| E9 | Parasol ribs | 8 | `ribsOf` on the dome s 40.5..47.5 with `fade:[0.1,0.55]` | lo | `G.ribsOf` + `fadedSvg` |
| E10 | Parasol finial | 1 | sphere r 1.5 at z 49.5 on a pin r .5 | hi | `G.sphereOf` |

Totals: 12 + 9 + 10 + 10 = **41 part types; 113 placed parts** (feet 8, plinth furniture 22,
rim bars and their plates, screws and rulers 49, dais 11, gate and parasol 22) **plus the 144
tiles, 144 numerals and 18 inlays, about 420 instances in all** before snakes and ladders
(section 3 adds 9 ladders of 6–14 parts and 13 snakes of 6–20 parts per board). Every part sits on
another part: feet on the halo, plinth on the feet, rim on the plinth, tiles on the field plate,
furniture on the rim, digits and inlays on tile tops, ticks on bar edges.

---

## 2. World and camera

### 2.1 World constants (new `src/game/iso/world.ts`, mirrored in `scripts/art/iso/world.mjs`)

| Constant | Value | Meaning |
|---|---|---|
| `CELL` | 56 | square pitch |
| `SIZE` | 672 | field |
| `RIM` | 22 | rim + plinth margin around the field (plinth plan −22..694) |
| `BASE_H` | 16 | plinth thickness (z −16..0) |
| `FOOT_H` | 6 | feet (z −22..−16) |
| `FIELD_Z` | 1.2 | field plate top |
| `TOP_Z` | 2.4 | tile top: tokens stand here |
| `RIM_Z` | 3.6 | rim top |
| `SILL_D` | 18 | depth of the number sill on the near side of a tile (y cy+10..cy+28) |
| `FIELD_C` | (cx, cy−9) | standing-field centre of a tile (the 38-deep strip behind the sill) |
| `FAN_WORLD` | 1: (0,0); 2: (−9,0),(9,0); 3: (−9,−6),(9,−6),(0,6); 4: (−9,−6),(9,−6),(−9,6),(9,6) | world offsets from `FIELD_C` for `count` tokens, replaces px `fanOffset` |
| `FIG_H` | 80 | figurine height, feet point to crown tip |
| `HEADROOM` | 84 | fit box top = `TOP_Z + HEADROOM` |

A pedestal of r 7 at any fan offset stays inside the standing field: x within ±16 (< 27), y
within −9±13 (< +10 where the sill begins).

### 2.2 Camera (`src/game/iso/camera.json`, replaces the scaffold values)

```json
{ "azimuth": 55, "elevation": 50, "cell": 56, "columns": 12,
  "rim": 22, "baseHeight": 16, "footHeight": 6, "topZ": 2.4, "headroom": 84,
  "rect": { "x": 0, "y": 0, "width": 784, "height": 720 }, "pad": 12 }
```

`boardProjection()` fits `boxCorners({x:-rim, y:-rim, w:716, d:716, r:0}, -(baseHeight+footHeight), topZ+headroom)`
into `rect` with `{ pad, azimuth, elevation }`. Do **not** pass fitProjection's `headroom` option
(the scaffold did; that option reserves label space and is not what we want).

| Result | Value |
|---|---|
| `scale` | 0.60252 |
| `k` (px per world unit) | 0.7621 |
| `origin` | (329.11, 102.57) |
| Object bounding box on screen | x 12..772, y 42..678 |
| Square top on screen | rhombus 59.4 px wide x 45.5 px tall; row direction leans 28.2° down-right; x-edge 39.7 px, y-edge 36.3 px |
| 1 unit of z | 0.490 px |
| Figurine 80 units | 39.2 px |
| Relief 8 units (fattest snake) | 3.9 px |

Why azimuth 55°: at 45° the field is a symmetric diamond and rows lean 37°; at 55° rows lean 28°
(they still read as rows of twelve) and the front face of the plinth (row-1 side, the Ayodhya
gate side, 550 projected units) is wider than the right face (386), so the maker's plate faces the
viewer. Why elevation 50° (anatomy's default is 30°): the mechanism here is the top face, as in the
ripple tank (44°); at 30° a tile top is only 32 px tall and a flat 14-unit numeral is 4 px, at 50°
the top is 45.5 px tall and the numeral 9 px while a 80-unit figurine still rises 39 px (at 60° it
would drop to 30 px and read as a pawn).

### 2.3 Where things land on screen (`squareScreen`, tile centre at `TOP_Z`)

| Square | World (x, y, z) | Screen px | Depth key |
|---|---|---|---|
| 1 | (28, 644, 2.4) | (65.1, 418.8) — left corner | 351.3 |
| 12 | (644, 644, 2.4) | (449.6, 625.0) — near corner | 578.4 |
| 133 | (644, 28, 2.4) | (718.9, 330.4) — right corner | 254.0 |
| 144 | (28, 28, 2.4) | (334.4, 124.2) — far corner | 26.9 |
| Field corner far | (0, 0, 2.4) | (329.1, 101.4) | |
| Field corner right | (672, 0, 2.4) | (748.6, 326.4) | |
| Field corner left | (0, 672, 2.4) | (35.4, 422.8) | |
| Field corner near | (672, 672, 2.4) | (454.9, 647.8) | |

The journey therefore starts at the left point, runs the first row down toward the viewer, and
zigzags up to the far point under the parasol.

### 2.4 Screen rects at 1280x720

| Region | Rect px | Notes |
|---|---|---|
| Page | (0, 0, 1280, 720) | fill `page` #F2F2EF (also the Phaser `backgroundColor` / letterbox) |
| Card | (8, 8, 1264, 704) | fill `card` #FBFBFA, 1 px `mid` outline |
| Board stage (`camera.rect`) | (0, 0, 784, 720) | the diorama texture, drawn at (0,0) origin top-left |
| HUD column | (792, 40, 464, 640) | seat plates + controls (section 6) |
| Card corners | fig (20, 16) · title right-aligned at (1260, 16) · hint (20, 690) · readout right-aligned at (1260, 690) | 14 px mono |

### 2.5 Numeral strokes (single-stroke engraving font, grid 8 wide x 14 tall, v up)

Polylines, one per stroke; coordinates `(u, v)`; placed with `x = x0 + u`, `y = cy + 26 − v`,
`z = TOP_Z`. Stroke `mid`, `stroke-width: .9`, `data-free="both"`.

| Digit | Strokes |
|---|---|
| 0 | (2,0) (6,0) (8,2) (8,12) (6,14) (2,14) (0,12) (0,2) (2,0) |
| 1 | (2,11) (4,14) (4,0) · (1,0) (7,0) |
| 2 | (0,11) (2,14) (6,14) (8,12) (8,9) (0,0) (8,0) |
| 3 | (0,14) (8,14) (4,8) (7,8) (8,6) (8,2) (6,0) (2,0) (0,2) |
| 4 | (6,0) (6,14) (0,4) (8,4) |
| 5 | (8,14) (0,14) (0,8) (5,8) (8,6) (8,2) (6,0) (2,0) (0,2) |
| 6 | (7,14) (3,14) (0,11) (0,2) (2,0) (6,0) (8,2) (8,6) (6,8) (0,8) |
| 7 | (0,14) (8,14) (3,0) |
| 8 | (2,8) (0,10) (0,12) (2,14) (6,14) (8,12) (8,10) (6,8) (2,8) (0,6) (0,2) (2,0) (6,0) (8,2) (8,6) (6,8) |
| 9 | (8,6) (2,6) (0,8) (0,12) (2,14) (6,14) (8,12) (8,3) (6,0) (1,0) |

Justification for numbers in the drawing: a game board's numerals are the object's own dial
digits (craft.md section 10, "text the machine displays is part of the object"), not labels about
the drawing; they are engraved with the same strokes as the ticks, live only on the sill of their
tile, and never float. Readability: 14 units deep = 9.1 px along the slant at 1x, 18 device px on
iPad Pro. The seat plate's position readout (section 6) and the card readout corner give the exact
square at all times, so the engraved number is a scan aid, not the only source.

### 2.6 Depth layers in Phaser (`setDepth`)

| Layer | Depth | Content |
|---|---|---|
| Board texture | 0 | one image per difficulty, origin (0,0) at (0,0) |
| Token shadows | 500 | halo ellipses on the tile |
| FX (dust, sparkle) | 900 | |
| Tokens | 1000 + `depthKey([x+dx, y+dy, TOP_Z])` (range 1027..1585) | re-set every frame while moving |
| HUD plates, die, chips | 5000 | |
| Speech bubbles | 6000 | |
| Modals / Win / Rotate | 9000 | |

---

## 3. Snakes and ladders in low relief

Common rules. All jump parts stand on the tile tops (`z ≥ TOP_Z`). Ladders are drawn after the
tiles, snakes after the ladders, snakes shortest first so the longest (Ravana) is on top (T30 fix
kept). Each ladder runs from `FIELD_C(foot)` to `FIELD_C(top)`; each snake from `FIELD_C(head)` to
`FIELD_C(tail)` along the same cubic Bézier the runtime uses (`snakeCurve`: swing = min(0.25 x
length, 0.66 x 56) sideways at 1/3 and 2/3), computed in world units by a shared module
`src/game/iso/jumps.ts` with a Node twin `scripts/art/iso/jumps.mjs` and a test that both agree.

| Relief | Height above `TOP_Z` | Rule |
|---|---|---|
| Ladder rails (slab) | 1.0 | `extrude` of a rotated rounded rectangle, 2.4 wide |
| Ladder rails (tube: rope, vine, bow) | 2 x r = 1.6–2.0 | centreline at `TOP_Z + r` |
| Ladder rungs | 0.8 (slab) or 2 x 0.5 (tube) | end flush on the rails' inner faces |
| Ladder knots / tee balls | 2.6 | `sphereOf` r 1.3 |
| Stepping stones | 1.4 | `slabOf` 16x11 r 4 |
| Tail ladder (hanuman-leap) | 3.2 | tube r 1.6 |
| Snake body | 2 x r: thin 4.4, standard 5.6, Kumbhakarna 6.8, Ravana 8.0 | tube centreline at `TOP_Z + r(t)`, radius tapers to 0.45 r at the tail |
| Snake head piece | 1.5 r above the body top, max 11.6 (Ravana) | lathe along the route tangent at the head |
| Crossing hump | over a snake: `2·r_lower + 0.6`; over a ladder: the ladder's relief at the crossing + 0.6 (3.8 over the tail ladder 95→122); cosine profile, half-length `4·r_upper` along the route, added to the upper snake's centreline z | the later-drawn (longer) snake climbs over |
| Hard cap | 12 units (5.9 px) | nothing on the field exceeds it; tokens draw above the board anyway |

Crossings: compute 2D intersections of the sampled centrelines (and of snakes against ladder
rails) before building tubes; add the hump to the upper route's z at that arc length; pass a
`breaks` entry at the crossing so the hump chunk sorts over the lower item. Known crossings: Hard
board Ravana 138→78 over brahmastra, kumbhakarna, prahasta, indrajit-arrows and ladder 95→122
(T03 section 5, T30 minor). Record every tube with `R.route` and run `node build.mjs --audit` to
zero (clearance, crowding, depth order) per difficulty.

### 3.1 Colour treatment: tinted inks, not full colour

Decision: body fills stay anatomy greys (`.tb-body` shade-2, `.tb-shine` top, `.tb-shade` shade-0;
slabs paper + four shades). Each snake's **edge lines, ring texture and head outline** take an ink
tint = its T03 body colour mixed 50% toward `mid` #8A8A8F; its head's crease lines take body mixed
35% toward `hi` #26262A. Each ladder's rail outlines take rail colour mixed 50% toward `mid`, rung
outlines take rung colour mixed 50% toward `mid`. Justification: 22 fully coloured pieces would
turn the board into the colour riot anatomy rejects and would drown the one `lit` accent; a 50%
desaturated ink keeps the board monochrome at arm's length yet lets a player trace "the green one"
or "the dark blue one" on a second look, which is the T30 readability need. Snakes keep a
stronger ink than ladders so the hierarchy of the current game (snakes drawn over ladders) stays.
Hex values are in section 7.

### 3.2 Ladders (foot → top, `FIELD_C` to `FIELD_C`)

| id | Squares | Style | Rails | Rungs | Pieces at foot / top | Parts |
|---|---|---|---|---|---|---|
| vishwamitra | 4→25 | wood | 2 slabs 2.4 wide, 1.0 tall, 9 apart (centre ±4.5), `extrude` rotated plan r .8 | round rungs: `G.disc` r 0.7 along the rung axis every 22 units, flush on rail inner faces | foot: kamandalu (lathe `[[0,2.2],[1.2,2.6,1],[3.2,2.0,1],[3.6,1.0],[4.2,1.0]]` r-profile, h 4.2, with a spout disc r .5) at 8 units left of the foot; top: bowstring: a `hi` line wrapping the top rung (sideArc) | 2 + n + 4 |
| shiva-bow | 20→43 | bow | 2 tubes r 1.0 bowed 14 outward at mid-length (3-point fillet), rings pitch 6 (`lo`) | strings: `segment` lines `hi` every 22, ends on the rail tubes | top: burst star: 6 spokes r 2..5 from a dot at the top end (`G.spokesOf`) | 2 + n + 7 |
| wedding | 26→52 | rope | 2 tubes r 0.9 with `rings:{pitch:1.8, twist:1.2}` (rope lay), wave ±1.6 along the length | tubes r 0.6 every 22, ending on knot balls `sphereOf` r 1.3 at each rail (rails gapped under the knots) | top: two crown discs r 1.6 h 1.0 with 4 knurl lines each; foot: garland loop tube r .5 | 2 + 3n + 2 |
| guha | 49→74 | rope | as wedding but rails are oars: each rail ends at the foot in a paddle slab 6x3x0.8 | rope rungs | foot: boat hull: `extrude` of a lens polygon 22x9, h 0.8, under the first 20 units of the ladder; drawn over the Ganga inlay | 2 + 3n + 3 |
| shabari | 85→108 | vine | 2 tubes r 0.8, wave ±2.2 opposite phases, `rings` off | tubes r 0.5 every 22 ending on the rails (tee balls r 1.0) | leaves: `G.prismOf` leaf polygon 4x2 h .6 alternating sides every 12 along each rail (ends on the rail by its stem segment); foot: basket: lathe cup r 2.4 h 2.2 with knurl 14 | 2 + 3n + 2m + 1 |
| hanuman-meeting | 88→113 | rope | rope rails as wedding, `rings` pitch 2.2 (fur) | rope rungs, knots | foot: tiny mace lying flat (shaft tube r .5 length 8 + head lathe r 1.6); top: tail curl: tube r .7 spiral 1.5 turns r 2..4 ending in a tuft sphere r .9 | 2 + 3n + 4 |
| sugriva | 92→118 | stone | 2 rows of pillar blocks: slabs 4x4x2.0 r .6 every 6 units along each rail line (mortar = the gaps) | slabs 1.6 wide x 0.8 tall spanning the rows, a `lo` ring r 0.8 at each rung centre (the clasped hands) | top: crown disc r 2 h 1 with two ear cylinders r .7 h 1.2 | 2m + 2n + 3 |
| hanuman-leap | 95→122 | tail | one tube r 1.6 bowed 22 outward at mid-length, `rings:{pitch:2.2, fade:[0.1,0.55]}` (fur) | none | top: tuft: 4 tubes r .6 length 5 fanning ±35° from the tip, each ending on a terminal dot; foot: nothing (the tail root is the tube's cap) | 1 + 8 |
| rama-setu | 101→127 | stone | stepping stones: slabs 16x11x1.4 r 4 every 24, alternating ±3 sideways; faint mortar outline inset 1.6 on each top | gaps | each stone carries a `hi` ring r 0.8 (the inscribed name); foot: a dot pair (the squirrel's footprints) on the first stone | 3m + 1 |

n = number of rungs = `max(2, floor(length/22))`; m = number of stones/blocks.

### 3.3 Snakes (head → tail)

Head piece: `G.solidOf` along the route tangent at s = 0 pointing away from the body (profile in
`[s, r]` with r in units of the body radius R): `[[0,1],[3,1.35,1],[7,1.5,1],[11,1.1,1],[14,0]]`,
`smooth:{slope}`; two eye dots .45 at s 6, ±40° from the top; one mouth seam `arcOf` at s 10
(closed mouth, T03: no fangs). Villain motif = small carved pieces on or beside the head, nothing
drawn on the body except the ring texture. Body: `tubePieces(route, r(t), P, { maxLength: 30,
breaks, rings })` with `r(t) = R·(1 − 0.55·t)`; tail ends in its elliptical cap.

| id | Squares | R | Texture (`rings`) | Head motif | Extra parts |
|---|---|---|---|---|---|
| tataka | 17→6 | 2.8 | bands pitch 6 | a tangle: 5 short tubes r .4 from the head top ending in dots | 6 |
| manthara | 37→19 | 2.2 | diamonds `cross:true, twist:1` | shawl: a `ringBand` collar r 1.3R/1.1R behind the head, 3 fold ribs | 4 |
| kaikeyi | 46→28 | 2.8 | spots: dots .5 every 8 alternating sides at 0.5 R from the centreline | two bangles: `ringBand` collars at s −4 and −8 behind the head (body gapped under them) | 2 |
| viradha | 58→40 | 3.0 | bands pitch 6 | club: lathe `[[0,.8],[6,.8],[7,1.6,1],[10,1.8,1],[12,0]]` lying beside the head | 1 |
| shurpanakha | 64→47 | 2.8 | bands pitch 6 | nose ring: a `hi` ring r .7 at the snout; 3 "nail marks": short `lo` lines across the back ending on the ring arcs | 4 |
| golden-deer | 70→56 | 2.8 | spots | deer mask: two antler tubes r .35, 3 points each, from the head top ending in dots | 2 |
| abduction | 76→55 | 3.0 | spots | wooden wheel lying flat beside the head: ring r 3 (`mid`), hub dot, 6 spokes (ends on hub and rim); 3 feather slabs 3x1x.4 along the body | 1 + 3 + 3 (T30 major: never a disc behind the head) |
| kabandha | 82→68 | 3.0 | bands pitch 6 | headless: the head piece is replaced by a stout cap disc r 1.4R with two eye dots on its flat face; two arm tubes r .6 out to the sides ending in hand spheres r .9 | 5 |
| indrajit-arrows | 114→96 | 2.6 | diamonds `cross:true` | two-loop bow-knot: two tori as `ringBand` r 1.2/.8 at the neck, side by side | 2 |
| prahasta | 120→110 | 3.0 | bands pitch 5 (armour scallops) | helmet crest: a thin slab 1x6x1.2 standing on the head top | 1 |
| kumbhakarna | 124→106 | 3.4 | bands pitch 8 | closed eyes: eye dots replaced by two short `lo` arcs; a drum: lathe r 2 h 2.6 with 2 bands beside the head | 3 |
| brahmastra | 130→119 | 2.2 | diamonds `twist:2` (lightning) | arrowhead: the head profile replaced by `[[0,1],[2,1.6],[9,0]]` (a sharp cone) | 0 |
| ravana | 138→78 | 4.0 | diamonds `cross:true` + bands pitch 10 | ten heads: the main head plus 9 small heads (profile scaled 0.45 R) fanned behind it at ±20°, ±40°, ±60°, ±80°, 100° on a quarter-circle of r 1.6 R, each with a crown `ringBand`; the main head wears a 3-tier crown (`ringBand` r 1.1R, 0.9R, 0.7R stacked 1.0 each) | 9 + 9 + 3 |

Only `ravana` fires `snakeBig` (unchanged).

---

## 4. Figurines

### 4.1 Shared construction

A figurine is a **Channapatna-style turned-wood lacquer toy**: stacked lathe profiles on a
vertical axis (pedestal, skirt, torso, head, headgear) with tube arms and small turned props. Its
local frame: origin at the feet point (pedestal bottom centre), `R` = screen-right on the floor
`(sin55°, −cos55°, 0)`, `V` = toward the viewer `(cos55°, sin55°, 0)`, `Z` up. Positions below are
`(right, forward, up)` in that frame. The build renders each variant with the same azimuth and
elevation as the board.

| # | Part | Size / position | Tone | Primitive |
|---|---|---|---|---|
| S1 | Halo | ellipse under r 7 at z 0 | halo | `haloOf({x:-7,y:-7,w:14,d:14,r:7}, 0, 0.1)` blur 4 px |
| S2 | Pedestal base | disc r 7.0, z 0..1.2, bevel .6 | mid | `G.disc` |
| S3 | Pedestal bead | `ringBand` r 7.2 / 6.6, z 1.2..1.8 | lo | `G.ringBand` |
| S4 | **Seat band** | `ringBand` r 6.6 / 6.0, z 1.8..3.4, class `seat-<hero>` overriding `--anatomy-top`, `--anatomy-shade-0..3` with the seat colour set (section 7) | colour | `G.ringBand` |
| S5 | Pedestal top | disc r 6.0, z 3.4..4.0 | mid | `G.disc` |
| S6 | Pedestal seat ring | ring r 5.0 at z 4.0 | faint | `circleOf` |
| S7 | Skirt (dhoti / sari / loincloth) | lathe from z 4 to 26, hero profile below | hi | `G.solidOf` smooth |
| S8 | Hem band | `ringBand` r (skirt r at z 4) + .2 / −.2, z 4..5.2 | hi | `G.ringBand` |
| S9 | Waist band | `ringBand` r 3.9 / 3.6, z 26..27.2 | hi | `G.ringBand` |
| S10 | Torso | lathe `[[27.2,3.6],[30,4.4,1],[38,4.6,1],[44,3.8,1],[46,3.0]]` | hi | `G.solidOf` smooth |
| S11 | Neck | disc r 1.8, z 46..48 | hi | `G.disc` |
| S12 | Head | sphere r 7 at (0, 0, 55) | hi | `G.sphereOf` |
| S13 | Eyes | ring r 1.1 + pupil dot .5 at face (36,46) and (64,46) through the sphere map | lo / dot | polygon + dots |
| S14 | Brows | 3-point polylines from T02 section 4 per emotion, `free` | mid | `segment` |
| S15 | Mouth | arc from T02 section 4 per emotion (`excited`: closed outline, filled shade-0), `free` ends | mid | polyline |
| S16 | Shoulder joints | spheres r 2.0 at (±4.6, 0, 44) | hi | `G.sphereOf` |
| S17 | Upper arms | tubes r 1.5 shoulder → elbow (pose) | hi | `tubePieces` |
| S18 | Forearms | tubes r 1.5 elbow → hand (pose), gapped under armlets | hi | `tubePieces` |
| S19 | Hands | spheres r 1.9 at the hand point (pose) | hi | `G.sphereOf` |
| S20 | Anklets | 2 `arcOf` on the skirt at z 5.6 (front half) | hi | `G.arcOf` |
| S21 | Earrings | dots .5 at face (8,50) and (92,50) (not Hanuman) | dot | `dotsSvg` |
| S22 | Prop (bow / lotus / bow / mace) | hero tables | hi | hero tables |
| S23 | Headgear | hero tables, top ≤ 80 | hi | hero tables |
| S24 | Lit variant | the same build with `lit: true` on S2–S23 (seat band excluded) | lit | `solidSvg(..., { lit })` |

**Face mapping onto the sphere.** T02's 100x100 face box `(fx, fy)` → `lon = (fx − 50)/50 · 55°`,
`lat = (50 − fy)/50 · 55°`, point `= C + r·(cos lat·cos lon·V + cos lat·sin lon·R + sin lat·Z)`,
projected with `iso()`. Head tilt (nod) rotates `V` and `Z` about `R` by the pose angle; side tilt
rotates `R` and `Z` about `V`. Rama and Sita `scared` use `idle` brows and no extras (T02 rule).
Extras (Hanuman and Lakshmana only): `excited` sparkles = 4 lines of 1.2 from a dot at face
(4,22) and (96,18); `scared` sweat = 3 `wireSvg` of length 2 from the right brow ending in dots;
`sad` tear = dot .6 at face (34,56).

### 4.2 Hanuman (46 parts)

| # | Part | Spec |
|---|---|---|
| H1–H24 | Shared S1–S24 | head r 7.2; neck replaced by H6; mouth 6 face-units wider each side; brows per T02 |
| H25–26 | Legs | two cylinders r 1.8 z 4..17 at (±2.6, 0) (skirt S7 is short, see H27); anklets S20 become `ringBand` r 2.1/1.8 z 5..5.8 on each leg |
| H27 | Loincloth | lathe `[[16,4.4],[17,5.0,1],[24,4.6,1],[26,3.8]]`, hem band at z 16..17 |
| H28 | Fur ruff | `ringBand` r 2.8 / 1.8, z 46..48 (replaces S11) |
| H29 | Muzzle | sphere r 3.4 at (0, 5.6, 52) |
| H30 | Nose | dot .6 at the muzzle front top |
| H31–32 | Ears | discs r 3.0 t 1.2 along `R` at (±7.6, 0, 56); inner dot .5 each |
| H33 | Sindoor mark | closed lozenge 1.2x3 on the forehead at face (50, 22) |
| H34 | Tail | tube r 1.3 from (0, −4, 24) through pose points to the tuft, `rings` pitch 2.4 fade |
| H35 | Tail tuft | sphere r 2.2 at the tail end |
| H36 | Sacred thread | tube r .35 on the torso surface (r_torso + .5) from (−3.8, 1.8, 45) to (3.2, 1.0, 29), 5 points |
| H37–38 | Armlets | collars disc r 1.9 t .8 on each upper arm (arm gapped) |
| H39 | Mace shaft | tube r .6 from the right hand along the pose axis, length 22 |
| H40 | Mace head | lathe along the shaft `[[0,1.2],[1,2.6,1],[5,3.4,1],[8.5,2.6,1],[9.5,0]]` |
| H41 | Mace knurl | `ribsOf` 12 on the head s 2..7 |
| H42 | Mace finial | sphere r .8 at the tip |
| H43 | Grip collars | 2 discs r .9 t .6 on the shaft (gapped) |
| H44 | Belt knot | sphere r 1.1 at the waist band front |
| H45–46 | Knee beads | `ringBand` r 2.0/1.8 at z 12 on each leg |

Idle pose: mace over the right shoulder (hand at (6.4, 2.2, 40), shaft axis up-back 20° so the
head sits at (7.5, −3, 60)); left arm down, hand at (−6.4, 1.6, 30); tail from (0,−4,24) out to
(7,−6,30), up to (8,−4,52), curling to the tuft at (5,−2,64); head level.

### 4.3 Rama (46 parts)

| # | Part | Spec |
|---|---|---|
| R1–R24 | Shared | skirt `[[4,4.8],[6,5.4,1],[16,4.9,1],[24,4.2,1],[26,3.7]]`; S20 anklets; S21 earrings |
| R25 | Crown band | `ringBand` r 5.4 / 5.0, z 59.6..61 (rim on the sphere) |
| R26 | Crown jewel | dot .6 `hi` at the band front |
| R27 | Top-knot (jata) | lathe `[[61,3.8,1],[64,4.4,1],[67,3.2,1],[69,1.2,1],[70,0]]` smooth |
| R28 | Tilak | vertical line face (50,30)→(50,37), `free` |
| R29 | Necklace | `arcOf` on the torso at z 43.5 |
| R30 | Pendant | disc r 1.0 t .4 on the torso front at z 41.5 |
| R31 | Sash | tube r .5 on the torso surface from the left shoulder (−4,1,45) to the right hip (3.6,2,28), 5 points |
| R32–34 | Dhoti folds | 3 `ribsOf` on the skirt, s 6..24, `seams:true`, fade |
| R35–36 | Armlets | collars r 1.9 t .8 on both upper arms |
| R37 | Bow Kodanda | tube r .55, 3 points (−8, 1, 6) (−13, 1, 40) (−8, 1, 72), fillet 12; gapped under R39 |
| R38 | Bowstring | `segment` `hi` from (−8,1,6) to (−8,1,72) |
| R39 | Grip collar | disc r 1.0 t 2.2 at the left hand (−8, 1, 38) |
| R40 | Quiver | lathe cylinder r 1.6 from (3.5, −3.5, 30) to (5.5, −4.5, 52) (tilted) |
| R41 | Arrow tips | 3 dots .5 above the quiver mouth |
| R42 | Quiver strap | tube r .35 over the right shoulder to the left hip on the torso surface |
| R43–44 | Quiver bands | collars r 1.8 t .6 at 30% and 70% of the quiver |
| R45 | Belt knot | sphere r 1.1 at the waist band front |
| R46 | Blessing hand mark | ring r .6 `faint` on the right palm (visible in happy/excited) |

Idle pose: left hand holds the bow at (−8,1,38); right arm down, hand at (6.4, 1.6, 30); head
level; weight even. Rama never leans back, never bends the knees.

### 4.4 Sita (47 parts)

| # | Part | Spec |
|---|---|---|
| T1–T24 | Shared | skirt (sari) `[[4,5.2],[6,5.8,1],[18,5.4,1],[26,3.9]]`; hem band r 5.4/5.2 z 4..5.6 |
| T25 | Hair cap | lathe cap on the head r 7.2, z 58..62.2 |
| T26 | Braid | tube r 1.6 from (0,−6,56) over the left shoulder (−5,−1,48) to the hip (−5.5, 2.5, 28), `rings:{pitch:2.4, twist:1.5}` |
| T27 | Braid tie | collar r 1.8 t .8 at the braid end |
| T28 | Tassel | lathe `[[0,.8],[2,1.4,1],[3.5,0]]` below the tie |
| T29 | Jasmine | 3 dots .6 `hi` along the braid at 30 / 50 / 70% |
| T30 | Pallu | tube r .9 over the left shoulder from (−4, 2, 46) to (5, 3, 30) on the torso surface |
| T31–35 | Pleats | 5 `ribsOf` on the sari front, s 6..24, `seams:true`, fade |
| T36 | Neckline | `arcOf` on the torso at z 45 (front half) |
| T37 | Thin crown | `ringBand` r 5.3 / 5.0, z 59.8..60.6 |
| T38 | Nose ring | ring r .5 `hi` at face (53, 56) |
| T39–42 | Bangles | 2 collars per forearm r 1.9 t .6 |
| T43 | Lotus stem | tube r .35 from the right hand up 7 (pose) |
| T44 | Lotus | lathe along the stem `[[0,.8],[1.2,2.6,1],[2.8,3.2,1],[3.6,2.2,1],[4,0]]` |
| T45 | Petals | `ribsOf` 6 on the lotus s .8..3.4 |
| T46 | Belt knot | sphere r 1.0 at the waist band front |
| T47 | Toe ring | dot .5 on the hem front |

Idle pose: right hand at (6.2, 2.4, 30) holding the lotus; left hand at (−6.2, 1.6, 30); head
side-tilt 3° toward the lotus. Hands low. No weapon.

### 4.5 Lakshmana (43 parts)

| # | Part | Spec |
|---|---|---|
| L1–L24 | Shared | skirt `[[4,4.8],[6,5.2,1],[20,4.6,1],[26,3.8]]`; no earrings (S21 omitted; count kept by L41) |
| L25 | Headband | `ringBand` r 6.9 / 6.6, z 57.4..58.6 |
| L26 | Top-knot | lathe `[[62,3,1],[65,3.4,1],[68,1.5,1],[69,0]]` |
| L27 | Sash | tube r .6 from the right shoulder (4,1,45) to the left hip (−3.6,2,28) |
| L28–29 | Dhoti folds | 2 `ribsOf` s 6..24, seams, fade |
| L30 | Armlet | collar r 1.9 t .8 on the right upper arm |
| L31 | Wrist guard | collar r 1.8 t 1.6 on the right forearm |
| L32 | Short bow | tube r .5, points (8, 1, 14) (12, 1, 40) (8, 1, 64), fillet 10; gapped under L34 |
| L33 | Bowstring | `segment` `hi` tip to tip |
| L34 | Grip collar | disc r 1.0 t 2.2 at the right hand (8, 1, 38) |
| L35 | Quiver | tilted cylinder r 1.5 from (−3.5,−3.5,30) to (−5.5,−4.5,50) |
| L36 | Arrow tips | 3 dots .5 |
| L37 | Quiver strap | tube r .35 over the left shoulder to the right hip |
| L38–39 | Quiver bands | 2 collars r 1.7 t .6 |
| L40 | Belt knot | sphere r 1.1 |
| L41 | Chest mark | `hi` ring r .8 on the torso front at z 40 (the sash clasp) |
| L42–43 | Knee creases | 2 `arcOf` on the skirt at z 14 and 15.4 (front half) |

Idle pose: right hand on the bow at (8,1,38); left hand on the hip at (−6.2, 1.5, 27), elbow out
at (−8.5, 0.5, 36); feet apart (legs are hidden in the skirt: widen the skirt base r by +0.4);
head level, chin 2° up.

### 4.6 Emotion variants (pre-rendered pose + face). Face geometry: T02 section 4

| Hero | idle | happy | excited | scared | sad |
|---|---|---|---|---|---|
| Hanuman | as 4.2 | head side-tilt 6°; mace raised 10 (hand at (6.4,2.2,50)); tail tip up to (5,−2,70); left hand to chest (−3,5,42) | both arms up: mace hand (6,1,62), mace vertical to z 92 clipped at 80 by shortening the shaft to 16; left hand (−6,1,60) open; tail straight up to (3,−3,74), tuft r 2.6; mouth open; sparkles | knees bent: legs h 4..15, loincloth and torso lowered 2, skirt r x1.08; hands over the eyes at (±2.8, 7, 56); tail wrapped round the legs (two turns at z 8 and 11, r 5.2); sweat | head nod −8°; mace lowered, head on the ground at (9, 3, 4) shaft up to the hand (6.4,2,28); left hand at (−6.4,1.6,30); tail drooping to (6,−3,8) tuft on the pedestal; tear |
| Rama | as 4.3 | right hand raised to the chest in abhaya mudra (6, 4.5, 42), palm forward (R46 visible); head level; smile | right hand raised high (6.5, 3, 58), palm forward; bow upright; head level; eyes wide (T02 excited) but **no** sparkles, no open mouth beyond T02's closed grin: use the `happy` mouth | concern: `idle` pose, head nod −3°, `idle` brows, right hand to the heart (3, 5, 40); no sweat | head nod −6°; right hand to the heart; bow lowered 4 (grip at z 34); `sad` mouth, no tear |
| Sita | as 4.4 | lotus raised to the chest (4.5, 5, 42); head tilt 4°; smile | añjali: both hands together at the chest (0, 5.2, 42) with the lotus held between them pointing up; head level; `excited` eyes, `happy` mouth; no sparkles | concern: `idle` pose, left hand to the heart (−3, 5, 40), `idle` brows | head nod −5°; hands together low at (0, 4, 30); lotus down; `sad` mouth, no tear |
| Lakshmana | as 4.5 | bow raised: grip at (8,1,46); left fist at the chest (−3, 5, 42); grin | bow raised high: grip at (8.5, 1, 58), bow top 84 → shorten the bow to (8,1,30)–(8,1,78); left fist pumped at (−6, 2, 62); sparkles | arms crossed: hands at (±4, 5, 40) crossing; head tilt back 6° (nod +6); bow leaning on the right shoulder; sweat | arms crossed, head nod −8°; `sad` mouth; tear |

What stays as Phaser tweens: the whole T05 catalogue, applied to the figurine sprite container
exactly as `Character.ts` does today, with these substitutions because the figurine is one sprite
(no head or hand layer):

| Tween | Now | On the figurine |
|---|---|---|
| nod, salute, sigh | head layer rotates | whole figure rotates ±3° about its feet point (nod), ±4° (salute), scale breath 1.03/0.97 (sigh); the pose variant carries the head angle |
| clap, bless | hand layer moves | clap: scale pulse 1.00→1.04 x4; bless: the ring glow = 1 px `mid` circle expanding from the chest, alpha 1→0 |
| cower | hand layer rises | the `scared` variant has the hands over the eyes; the tween keeps the 88% squash and −6° lean |
| all airborne tweens | shadow shrinks to 70% | unchanged, on the halo sprite |

### 4.7 Sprite sizes and anchor

The build writes every variant at three scales and a manifest `public/assets/iso/figurines.json`
`{ "<hero>.<emotion>.<lit|plain>.<size>": { "w", "h", "anchorX", "anchorY", "k" } }` where
`(anchorX, anchorY)` is the feet point (0,0,0) in the SVG's viewBox. Phaser sets
`setOrigin(anchorX / w, anchorY / h)` so the feet land exactly on `squareScreen()` + fan offset.

| Size | Use | k (px/unit) | Display height of 80 units | viewBox (about) | Raster (DPR 2) |
|---|---|---|---|---|---|
| `s` | board token | 0.7621 (= board k) | 39.2 px | 30 x 50 | 60 x 100 |
| `m` | seat plate, Setup portrait, Gallery | 1.711 | 88 px | 60 x 108 | 120 x 216 |
| `l` | Win screen winner (others use `m`) | 5.83 | 300 px | 200 x 368 | 400 x 736 |

Files: `public/assets/iso/fig/<hero>-<emotion>[-lit]-<s|m|l>.svg` (4 x 5 x 2 x 3 = 120 files,
3–12 KB each). Load `s` and `m` for the seated heroes in BoardScene, `l` lazily in WinScene.

---

## 5. Tokens on the board

Decision: **the figurine is the token.** One object per player everywhere (board, seat plate, Win
screen); no medallion. The board token shows the same emotion texture as the seat figurine (a
texture-key swap is free) but plays no reaction tween (T05: the token only hops).

| Rule | Value |
|---|---|
| Resting point | `worldOffsetScreen(square, dx, dy)` with `(dx, dy) = FAN_WORLD[count][i]` added to `FIELD_C` (i = index among tokens sharing the square, seat order) |
| Step hop | 120 ms (fast 40): x/y lerp `Sine.easeOut`; `z = 14 · 4t(1−t)` added through `toScreen([x, y, TOP_Z + z])`; depth re-set each frame |
| Landing squash | 60 ms: scaleX 1.06, scaleY 0.92, then back, `Quad.easeOut` (≤ 15 %, T02) |
| Entry from the seat | from the seat plate figurine's feet point to square 1, 360 ms, arc height 40 |
| Ladder glide | straight world line foot → top at `z = TOP_Z + 2.2`, `max(400, 25·|jump|)` ms as today (500 default), `Sine.easeInOut`; trail = `mid` dots |
| Snake glide | along the shared 3D Bézier (section 3) at `z = TOP_Z + 2·r(t)`, 700 ms `Quad.easeIn`; puff = `lo` dots at the tail |
| Void slide | straight line at `TOP_Z`, 500 ms |
| Shadow | separate image `shadow-s.svg` (blurred ellipse 14 x 8 units, `halo` colour at .32) at the resting point on the tile, scale 0.7 at hop apex |
| Depth | `1000 + depthKey([x+dx, y+dy, TOP_Z])`; shadows at 500; two tokens on one square differ by ≥ 3.2 in key |
| Lit | the current player's token and seat figurine use the `-lit` textures from `TurnStarted` until the next `TurnStarted` |
| Re-fan | on arrival, every token sharing the square tweens to its new fan slot over 80 ms (as today) |

---

## 6. HUD and screens as an anatomy card

The whole canvas is the card. The anatomy plate corners map to the game:

| Card corner | Game content | Style |
|---|---|---|
| `Fig` (top-left) | `FIG 1 · MOKSHA PATAM` (static, i18n key `ui.fig`) | 14 px mono, `text` #57575A |
| `title` (top-right) | `RAMAYANA · <EASY|MEDIUM|HARD> BOARD` | 14 px mono, `strong` #18181A |
| `hint` (bottom-left) | `ui.rollHint` / `ui.tripleSix` / winner line (what `setHint` shows today) | 14 px mono, `text` |
| `readout` (bottom-right) | live: `<name> · <from> → <to>` after each move, `rolled 6 · roll again`, `ladder +25`, `snake −18` | 14 px mono tabular, `text` |

Typography: UI = `"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace` (add Plex Mono via
Google Fonts, OFL, to CREDITS); Devanagari strings fall back to `"Noto Sans Devanagari"`. The
title face Yatra One stays for the game title on Boot and Win only. Minimum 14 px (T04).

Plates: fill `card` #FBFBFA, 1 px `mid` outline, radius 0, no shadow. Primary button: 1.5 px `lit`
black outline, 16 px mono uppercase, `strong` text. Secondary / chip: 1 px `mid` outline, 14 px
mono, `text`; active toggle: fill `hi` #26262A, text `card`. Pressed: translate 1 px down.
Disabled: outline `faint`, text `muted`. Toggle state also changes the glyph (T04).

### 6.1 Board screen (1280x720)

| Element | Rect px | Notes |
|---|---|---|
| Board diorama | (0, 0, 784, 720) | texture `board-<level>` at origin (0,0) |
| Seat plate j = 0..3 | (792, 40 + 108j, 464, 100) | occupied seats only, in seat order |
| · figurine | feet point at (838, top + 94), size `m` (88 px) | emotion + lit textures |
| · seat swatch | (896, top + 16, 10, 10) filled with the seat colour, 1 px `mid` outline | colour exception |
| · name | (912, top + 12) 18 px mono `strong` | ellipsis past 240 px |
| · hero · controller | (912, top + 38) 14 px mono `text` | `Hanuman · Bot · Hard` |
| · position readout | right-aligned at (1240, top + 12), 16 px mono tabular | `SQ 057`; gate glyph `⌂` before the first move; `1ST`.. after retiring |
| · active | outline 1.5 px `lit`; figurine `-lit` texture | one at a time |
| Speech bubble | (880, top + 56, 376, 36) | overlay, depth 6000; card fill, 1 px `hi` outline, tail to the figurine's head at (846, top + 30); 16 px text shrinking to 11 for long lines |
| Die plate | (792, 484, 128, 128) | the iso die (6.2) centred at (856, 548) |
| Turn banner | (936, 488) 18 px mono `strong` | `<name>'s turn`, seat swatch 10 x 10 before it |
| Roll hint | (936, 516) 14 px mono `text` | hidden on bot turns |
| Fast chip | (936, 560, 100, 44) | `» FAST` / `»» FAST` |
| Mute chip | (1044, 560, 100, 44) | `♪ MUTE` / `✕ MUTED` |
| Menu chip | (1152, 560, 104, 44) | |
| Card corners | section 6 table | |

Pause modal (unchanged rects from T04 4.4): scrim = `page` colour at 60 %, panel plate (400, 160,
480, 400), buttons as above.

### 6.2 The die as a crafted object

One SVG per face value, `public/assets/iso/die-<1..6>.svg`, viewBox 96 x 96, k = 2.0, same azimuth
and elevation as the board, rasterised 192 x 192.

| Part | Spec |
|---|---|
| Tray | disc r 20 h 2.4, bevel .8, `knurl` 72 on the rim band z 1.2..2.4, `lo`; seat ring r 13 `faint` on top |
| Die | `slabOf({x:-12,y:-12,w:24,d:24,r:4}, 2.4, 24, P, 6, 1.2)`, tone `hi`; three visible faces: top, +x (right), +y (front) |
| Pips | engraved ring r 1.8 `lo` + dot .5 `mid` on a 3 x 3 grid with centres at ±6.5; the 6-face's pips are `hi` with a second ring r 2.4 |
| Face assignment (top → front, right) | 1→(2,3), 2→(3,6), 3→(1,2), 4→(2,6), 5→(3,1), 6→(2,4); any set with no two visible faces summing to 7 is acceptable |
| Halo | under the tray |
| Roll | swap textures every 60 ms for 600 ms, rotation ±8°, scale 1.0→1.10→1.0; land with a 100 ms squash scaleY .94 |
| Enabled pulse | scale 1.00–1.04 at 1 s (was 1.05) |
| Disabled | plate outline `faint`, die alpha .5 |
| Pressed | 1 px down, halo scale .8 |

### 6.3 Boot

| Element | Rect px | Notes |
|---|---|---|
| Card frame | (8, 8, 1264, 704) | |
| Title `ui.title` | centred at (640, 150) | Yatra One 56 px `strong`, no outline |
| Hero figure | Easy board texture at 0.45 scale (353 x 324 px) centred at (640, 358) | no tokens; `Fig 0` corner label |
| Play / Resume | (480, 540, 320, 64) | primary plate |
| New Game (save exists) | (480, 616, 320, 48) | secondary plate |
| Language chip | (1112, 640, 144, 48) | secondary plate |
| Mute chip | (960, 640, 136, 48) | |

### 6.4 Setup (rects from T04 section 3 kept; restyled)

Seat columns `(24 + 312k, 104, 296, 456)` as plates. Portrait = figurine `m` idle (88 px) scaled
2.0 (176 px) with its feet at (cx + 148, 300); empty seat: the plain texture at alpha .5 and
outline `faint`. Arrows 56 x 56 secondary plates with `‹ ›`. Hero caption 22 px mono `strong`
(not hero-coloured; the seat swatch 12 x 12 sits left of it). Controller and difficulty segmented
controls = adjoining chips, active one inverted. Start = primary plate (960, 584, 296, 72).

### 6.5 Win (overlay)

| Element | Rect px | Notes |
|---|---|---|
| Scrim | full canvas | `page` colour at 60 % |
| Panel | (200, 80, 880, 560) | plate |
| Win dais | `public/assets/iso/dais.svg`: 3 turned steps r 36 / 28 / 20, h 3 each, bevel .8, `mid`, lotus ring r 16 on top; rendered k 3.6, placed with its top centre at (340, 470) | |
| Winner | figurine `l`, `excited`, `-lit`, feet at (340, 470) | win tween loops every 2.5 s (T04) |
| Title `ui.winner` | (470, 140, 560, 96) | Yatra One 36 px `strong` |
| Others | figurine `m` with their `lose` emotion, feet at (520 + 140i, 420) | rank readout `1ST` 14 px mono above each |
| Confetti | 2 x 2 px squares in `lo`, `mid` and the winner's seat colour | |
| Buttons | Play Again (470, 560, 240, 72) primary; Play On (726, 560, 200, 72); Menu (942, 560, 120, 72) | |

### 6.6 Gallery (`#gallery`)

Grid: heroes in rows at y = 250 + 150·row, emotions in columns at x = 300 + 200·col, figurine `m`
at scale 1.25; labels 14 px mono; key `L` toggles lit variants; key `A` plays the T05 tween
catalogue in sequence. Used for the T30 gate review.

### 6.7 Rotate overlay and phones

Rotate overlay: full canvas `page` fill, a plate-style phone outline (1 px `hi`, 80 x 128 at
(600, 216)) with a `hi` rotation arc, text `ui.rotate` 24 px mono at (640, 420). Behaviour
unchanged (pauses other scenes while `innerHeight > innerWidth`).

Phones in landscape: `Scale.FIT` scales the 1280x720 canvas (a 844 x 390 phone shows it at
0.54x). No layout change; the engraved numbers fall to about 5 px there, so the seat readout is
the number source on phones. Minimum tap targets stay ≥ 48 px logical (≥ 26 px CSS on that phone),
as today.

---

## 7. Tokens and colour table (light theme)

### 7.1 Anatomy light tokens (from `iso.css`, used by Phaser too)

| Token | Hex | Use in the game |
|---|---|---|
| `page` | #F2F2EF | canvas background, letterbox, Win/pause scrim at 60 % |
| `card` | #FBFBFA | plates, bubbles, buttons; `--anatomy-paper` |
| `face` / `top` | #FFFFFF | solid tops, lit fill |
| `shade-0..3` | #DCDCD9 · #E5E5E2 · #EDEDEA · #F4F4F1 | solid sides by facing; odd tiles' top = shade-3 |
| `lit-top` / `lit-shade` | #FFFFFF · #EEEEEB | lit solids |
| `hi` | #26262A | subject outlines, zero marks, bubble outline |
| `mid` | #8A8A8F | structure lines, major ticks, plate outlines, numerals |
| `lo` | #B4B4B8 | base lines, minor ticks |
| `faint` | #D4D4D6 | grooves, inset outlines, disabled outlines |
| `lit` | #000000 | the one accent: current player's figurine edges and active plate outline |
| `text` / `strong` / `muted` | #57575A · #18181A · #8C8C90 | UI text |
| `halo` | #8A8A80 at .32 | under the plinth, pedestals, tray |
| `dot` | #3A3A3E at .32 | screws, pupils |
| Tube body / shine / shade | #EDEDEA · #FFFFFF · #DCDCD9 | snake and rope bodies |

### 7.2 Seat colours (the colour exception) and their band tokens

| Hero | Seat `top` (full) | Band `shade-3` (tint 18 % to white) | Band `shade-0` (22 % to `hi`) | Band `shade-1`/`shade-2` |
|---|---|---|---|---|
| Rama | #3F6FC2 | #6289CD | #3A5FA1 | interpolate 1/3 and 2/3 between shade-0 and shade-3 |
| Sita | #D15587 | #D9749D | #AB4B73 | |
| Lakshmana | #2E9E6B | #54AF86 | #2C845D | |
| Hanuman | #E4572E | #E97554 | #BA4C2D | |

### 7.3 Snake inks (edge/rings = body mixed 50 % to `mid`; head creases = body mixed 35 % to `hi`)

| id | Body (T03) | Edge ink | Head ink |
|---|---|---|---|
| tataka | #457334 | #687F62 | #3A5831 |
| manthara | #1C1F4D | #53556E | #202141 |
| kaikeyi | #7B3B6E | #83637F | #5D3456 |
| viradha | #C98B4B | #AA8B6D | #90683F |
| shurpanakha | #8E3B3B | #8C6365 | #6A3435 |
| golden-deer | #E9C12F | #BAA65F | #A58B2D |
| abduction | #783431 | #815F60 | #5B2F2F |
| kabandha | #457334 | #687F62 | #3A5831 |
| indrajit-arrows | #3A3F9E | #626597 | #333675 |
| prahasta | #C98B4B | #AA8B6D | #90683F |
| kumbhakarna | #A6723E | #987E67 | #795737 |
| brahmastra | #F39C2B | #BF935D | #AB732B |
| ravana | #1C1F4D | #53556E | #202141 |

### 7.4 Ladder inks (rail / rung colour mixed 50 % to `mid`)

| id | Rail ink | Rung ink |
|---|---|---|
| vishwamitra | #BFB7A4 | #BAA65F |
| shiva-bow | #BAA65F | #626597 |
| wedding | #AE708B | #BF935D |
| guha | #A9A191 | #BF935D |
| shabari | #6B8B67 | #8C6365 |
| hanuman-meeting | #B7715F | #BAA65F |
| sugriva | #AA8B6D | #BAA65F |
| hanuman-leap | #658DA2 | #BFB7A4 |
| rama-setu | #AA8B6D | #987E67 |

The build emits these as CSS classes in each SVG (`.ink-tataka .iso-line, .ink-tataka .tb-ring,
.ink-tataka .iso-edge { stroke: #687F62 }`), so a palette change is one table edit.

---

## 8. Rasterisation

| Rule | Value |
|---|---|
| Export | `figureSvg({ standalone: 'light' })`; the build appends `.iso-svg path,.iso-svg circle{vector-effect:none}` so stroke widths scale with the raster like everything else (anatomy's `non-scaling-stroke` assumes a DOM-sized SVG; a 2x raster would otherwise halve the lines to 0.3 CSS px) |
| Line weights (viewBox units) | lines 0.6, numerals 0.9, needle-class accents 1.1, `.tb-ring` 0.45, seamless tone seams 0.4 — unchanged from the kit, now proportional |
| Device ratio | `DPR = Math.min(2, window.devicePixelRatio)`; texture raster size = display size x DPR |
| Renderer | Phaser game size `1280·DPR x 720·DPR`, `Scale.FIT`, each scene's main camera `setZoom(DPR)` centred on (640, 360), so Graphics and Text render at device resolution and the 2x textures map 1:1 to device pixels. Input via interactive objects is unaffected; the Setup name field (DOM element) must be checked. Fallback if this proves fragile: stay at 1x and rasterise at 1x (lines soften on retina) |
| Board | 3 files `board-easy|medium|hard.svg`, viewBox 784 x 720, about 200–260 KB each; raster 1568 x 1440 (9 MB RGBA); load only the chosen level in `BoardScene.preload` |
| Figurines | 120 files (4.7), `s` 60 x 100 and `m` 120 x 216 for seated heroes (≤ 40 textures, 3 MB); `l` 400 x 736 only in WinScene (≤ 4 textures) |
| Die | 6 files, raster 192 x 192 (1.6 MB) |
| Dais, shadow | 1 file each |
| GPU budget | ≤ 20 MB of textures on an iPad Pro; max texture side 1568 < 4096 |
| Check | `scripts/art/check.mjs` skips `public/assets/iso/` (anatomy SVGs use `<style>` and off-palette greys); a new `scripts/art/iso/check.mjs` runs the anatomy line-end check (`lines.mjs` logic ported: every line end on a stroke, dot or outline, `data-free` excepted) and asserts file size < 300 KB |

---

## 9. Respect review checklist for figurines (extends the T30 gate)

Run on the Gallery (section 6.6) at `m` and `l`, plain and lit, every emotion, both languages.

| # | Check | Pass condition |
|---|---|---|
| 1 | Rama and Sita posture | upright in all five variants; no knee bend, lean back, slump, crossed arms, hands over face; head nod within −6..0°, side tilt ≤ 4° |
| 2 | Rama and Sita faces | `scared` = `idle` brows; no sweat, tear, sparkles, open-mouth grin beyond T02's closed `happy` mouth; `excited` is a raised-hand blessing, not a jump pose |
| 3 | No halo reading | the `lit` accent is the whole figurine's edge, never a disc or ring behind a head; no parasol, dais ring or crown reads as a nimbus (the parasol stands at the board corner, not over a figure) |
| 4 | Iconography present | Rama: bow Kodanda, tilak, crown band, blue is **not** used (skin is paper; identity = band + bow + crown); Sita: lotus, braid, crown, no weapon; Lakshmana: shorter bow, headband; Hanuman: mace, tail, sindoor, ears, muzzle |
| 5 | Hanuman and Lakshmana comedy | pratfall poses only on these two (cower, tail wrap, arms crossed); nothing crude; cowering = hands over eyes |
| 6 | Pedestal and band | never hide the face; band colour matches `HEROES[hero].color` |
| 7 | Snake heads | all 13 villains, weapons or setbacks; `abduction` has a wooden wheel beside the head, nothing behind it; no snake head has a halo, crown stack that resembles a deity's mukut except Ravana's (a demon king) |
| 8 | Landmarks | torana at 1 is a gate (two posts, lintel, garland), not a shrine; dais at 144 has no lamps or offerings |
| 9 | Tweens | `reactions.json` unchanged: Rama/Sita never somersault, slump, cower, stomp, fidget, shake (T05 section 5), and the Figurine class rejects those names for them at runtime (throw in dev) |
| 10 | Text | speech lines unchanged (T30 fixes kept); Hindi `तुम`/`आप` decision still open (T30) |
| 11 | Win screen | winner lit on the dais; losers at `m` in their `lose` emotion, none fallen or kneeling |
| 12 | Native-speaker pass | two playtesters from the target audience see the Gallery and the Hard board before release |

---

## 10. Task split (dependency order, one commit each)

Acceptance for every task: `npm run verify` green (lint, tests, sim, build, smoke), and the stated
check. Build scripts live in `scripts/art/iso/`, output in `public/assets/iso/`. Model sizing:
Haiku for data/config-only tasks, Sonnet for the rest; none needs design decisions beyond this
document.

| # | Task | Model | Depends | Deliverable | Acceptance |
|---|---|---|---|---|---|
| T40.1 | Camera and world constants | Haiku | — | `camera.json` (2.2), `src/game/iso/world.ts` + `scripts/art/iso/world.mjs` (2.1), `boardIso.ts`/`iso-board.mjs` fit the plinth box without the `headroom` option; `FAN_WORLD`; tests extended | `tests/boardIso.test.ts` passes; `squareScreen(1)` ≈ (65.1, 418.8), `squareScreen(144)` ≈ (334.4, 124.2) within 0.5 px; TS and Node twins equal |
| T40.2 | Iso build infrastructure | Sonnet | T40.1 | `scripts/art/iso/common.mjs` (standalone light export, `vector-effect:none`, ink classes from 7.3/7.4, seat band classes from 7.2, numeral font 2.5, manifest writer), `src/game/iso/jumps.ts` + `scripts/art/iso/jumps.mjs` (3D Bézier + humps), `scripts/art/iso/check.mjs` (line ends, size); `npm run art:iso` | a sample SVG of ten tiles with numerals renders in Chrome; `jumps` twins agree in a test for all 22 jumps |
| T40.3 | Board base | Sonnet | T40.2 | `scripts/art/iso/board.mjs` sections 1.1–1.4 → `board-base` layer (composed into T40.4's files) | parts list count ≥ 60 printed by the script; line check 0; 4x close-ups of the gate, parasol, maker's plate, a tile corner, a ruler end read as solid parts |
| T40.4 | Ladders | Sonnet | T40.3 | section 3.2 → `board-easy|medium|hard.svg` (base + ladders, snakes added in T40.5) | each ladder's foot and top land on `FIELD_C`; relief ≤ 3.2; audit 0 on all three files |
| T40.5 | Snakes | Sonnet | T40.4 | section 3.3 incl. humps and heads; final `board-*.svg` | audit 0 (clearance, crowding, depth order) on Hard; Ravana traceable end to end; no head has anything behind it |
| T40.6 | Hanuman figurine | Sonnet | T40.2 | sections 4.1, 4.2, 4.6 row 1, 4.7 → 30 files + manifest | part count ≥ 46 printed; the five variants differ as specified; feet anchor within 0.3 px of the manifest point; line check 0 |
| T40.7 | HiDPI rendering | Sonnet | — | section 8 renderer rule in `main.ts` + a scene mixin; Setup DOM field aligned | screenshot at DPR 2 shows 1-device-px lines; all hit areas work; smoke passes |
| T40.8 | BoardScene integration (vertical slice) | Sonnet | T40.1, T40.5, T40.6, T40.7 | load `board-<level>` + Hanuman textures; `Figurine` class with `feel()` (texture swap + T05 tweens per 4.6 table); tokens per section 5 (fan, hop, glide, depth, shadow, lit); runtime number chips and `drawJumps` removed; other heroes keep the old `Character`/medallion until T40.10 | a 4-player game on Hard plays through with Hanuman seated; tokens never hidden by the board; `fanOffset` px users migrated; existing game tests pass |
| T40.9 | HUD as card | Sonnet | T40.8 | sections 6, 6.1, 6.2: plates, corners, readout, die build (`die.mjs`) + `DiceButton` swap, chips, bubble geometry | layout matches 6.1 within 2 px; die rolls with 6 textures; bubble lines ≤ 48 chars fit at ≥ 11 px |
| T40.10 | Rama, Sita, Lakshmana figurines | Sonnet x3 (one task each) | T40.6 reviewed | sections 4.3–4.5, 4.6 | checklist section 9 items 1–6 pass per hero in the Gallery |
| T40.11 | Boot, Setup, Win, Gallery, Rotate | Sonnet | T40.9, T40.10 | sections 6.3–6.7, `dais.svg`, `shadow-s.svg`; `Character.ts` and 2D tokens deleted; `assets.ts` manifest and `tests/assets.test.ts` updated | screenshots of all five screens in both languages; T04 flow unchanged |
| T40.12 | Gate, docs, credits | Haiku | T40.11 | run section 9 checklist, record in `docs/review/T40-review.md`; CREDITS (anatomy kit MIT, IBM Plex Mono OFL); README screenshots; `scripts/art/check.mjs` skips `iso/` | checklist table complete; `npm run verify` green |

Vertical slice = T40.1–T40.8. Review gate after T40.8 (board look, token readability, number
legibility) before T40.9–T40.12 start.

---

## Appendix — decisions the owner must make

| # | Question | Recommendation |
|---|---|---|
| 1 | HiDPI: render the canvas at `1280·DPR x 720·DPR` with camera zoom (crisp 0.6 px lines on iPad Pro, some input/DOM risk) or stay at 1x (lines soften on retina) | render at DPR, capped at 2 (T40.7 is isolated so it can be reverted) |
| 2 | Square numbers: engraved on the sill (9 px at 1x, 18 device px on iPad; about 5 px on phones) with the seat readout as the exact source, or upright Phaser text labels floating over the tiles | engraved; revisit after the slice if playtesters cannot find squares |
| 3 | HUD column narrows from 536 to 464 px, bubble from 432 to 376 px (long lines shrink to 11–13 px) | accept; otherwise allow two-line bubbles (36 → 52 px tall) |
| 4 | Hard board crossings: cosine humps on Ravana over four snakes and a ladder, or reroute Ravana down the left edge (T30 minor, changes `snakeCurve` for one snake) | humps; the audit proves them |
| 5 | Dark theme | out of scope; the token set makes it a later CSS-only task |
| 6 | IBM Plex Mono as the UI face (new font download, ~100 KB) or system mono (free, varies by device) | Plex Mono |
| 7 | The board token shows the hero's current emotion texture (cheap, lively) or stays `idle` as T05 says | show the emotion, no tween |
| 8 | Rama's sky-blue skin (T02) is dropped: figurine surfaces are paper and greys, Rama's identity comes from the blue seat band, the bow, the crown band and the tilak. Keeping blue skin would be a second colour exception on one hero only | drop it; if playtesters miss it, tint only Rama's `hi` outline with `#3A5FA1` (the same rule as snake inks), never a filled blue |
