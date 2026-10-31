# T42 — The living board: zoomable blocks, fog of war, standing snakes, stone bridges

Amendment to `T40-anatomy.md`. T40's camera/projection, rim, plinth, gate, parasol, figurines and HUD card
stay (where this document is silent, T40 holds). T40 section 3 (low-relief tube snakes and ladders with humps)
and the one-picture board are replaced by what follows. `T03-board-art.md` row regions, landmarks and the
story of every snake and ladder are kept as the content source. `T02-style-guide.md` RESPECT RULES bind.
`src/core` is untouched: the game still emits `Laddered` and `Bitten` with the jump; only the drawing changes.

Owner feedback this answers (binding): the board zooms; snakes are 3D standing coils in ONE block, hidden until
a token lands there, then they swallow the token which reappears at the tail square (no body to the tail, ever);
ladders are 3D arched stone bridges foot block → top block, hidden until a token lands on the foot, then crossed;
fog of war over every block, lifted by hopping or landing, permanent for all players; bigger, livelier blocks;
anatomy's craft kept (solid volumes, four-tone shading, 0.6 px lines, every part real), its monochrome dropped.

Units: world units as T40 (`CELL` 56, `TOP_Z` 2.4, `k` = 0.7621 logical px per unit at user zoom 1, azimuth 55°,
elevation 50°). "Logical px" = the 1280x720 canvas at user zoom 1; "device px" = logical x DPR (capped 2) x zoom.

---

## 1. Board structure: 144 block objects, not one picture

### 1.1 Decision: bigger blocks come from the camera, not from the world

| Option | Effect | Verdict |
|---|---|---|
| Raise `CELL` (56 → 90) | Every world table (FAN_WORLD, figurine sizes, FIELD_C, jumps, tests) and the three Node/TS twins change; the Fit view no longer fits 784x720 | rejected |
| Change the projection (elevation, rect) | Fit view shows the same 12x12 in the same stage; tile tops barely grow | rejected |
| **User zoom on a separate board camera** | world untouched; a block is 59x46 logical px at Fit (zoom 1), **119x91 at the default follow zoom 2.0**, 149x114 at max 2.5; figurine 39 → 78 → 98 px | **chosen** |

`camera.json` keeps every T40 value and gains:

```json
"zoom": { "min": 1.0, "follow": 2.0, "max": 2.5 },
"raster": { "fine": 5, "coarse": 4 },
"panMargin": 80
```

`raster.fine` = max zoom 2.5 x DPR 2 = device px per logical px that fine textures are rasterised at (they never
upscale); `coarse` = follow zoom 2.0 x DPR 2 for large, rarely close objects (upscaled 1.25x at max zoom, accepted).
`boardIso.ts` is unchanged: every object is still placed at `toScreen(world)` logical coordinates and the board
camera magnifies.

### 1.2 What a block is made of

A block is a group of Phaser sprites placed by the shared projection, each with its own depth. Nothing is drawn
at runtime with vector code except the numeral halo; everything is an atlas frame built by Node from the anatomy
kit, at the same azimuth/elevation as the board.

| Part | Frame (atlas) | Count per block | Depth (section 1.4) | Notes |
|---|---|---|---|---|
| Base tile | `blocks`: `<region>-a` or `-b` by seed; odd `(row+col)` tinted `0xF0F0F0` (−6 %) | 1 | `key` | the 54x54 slab (z 1.2..2.4) with the groove gap, region material drawn on its top: grass tufts, flagstones, sal roots, rock cracks, waves, night-stone |
| Row tint | tint multiplier for Dandaka rows: r5 `0xFFFFFF`, r6 `0xEBEBEB`, r7 `0xD8D8D8` | — | — | T03's deepening forest without extra frames |
| Fog tile | `blocks`: `<region>-fog` | 1 while hidden | `key + 0.2` | build-time blurred, desaturated copy (section 3.4); destroyed 420 ms after reveal |
| Mist | `shared`: `mist-1` / `mist-2` by seed, alpha 0.55, drift ±2 px over 6 s | 1 while hidden | `key + 0.4` | overhangs the rhombus by 20 % so neighbouring fog merges |
| Water shimmer | `shared`: `shimmer` (sea and Ganga tiles only) | 0–1 | `key + 0.3` | slides ±3 px, alpha 0.3–0.6, 2.4 s |
| Token shadow | `shared`: `shadow` (T40 §5) | per token | `key + 0.6` | floor decal, unchanged |
| Props | `props`: 1–2 kinds from the region set, plus landmark props on fixed squares | 1–3 once revealed | `1000 + key(prop base)` | zones in 1.3; never on the standing field core or the sill |
| Numeral | `shared`: `num-<digit>-<dark|bone>` x 1–3 digits, 1 px paper halo baked in | 1–3 | `3000` | always legible: above fog, snakes, bridges, tokens (section 3.5) |

Counts: 144 base + ≤144 fog + ≤144 mist + 18 shimmer + ≈230 props + 372 numeral glyphs ≈ 1,050 sprites, plus 52 frame
modules and ≤ 8 token sprites. All board atlases together are ≤ 12 textures, so Phaser's multi-texture batch
(16 units) draws the depth-sorted mix without flushing per texture switch.

### 1.3 Block anatomy in world units (one square, centre `(cx, cy)`)

| Zone | World rect (x from cx, y from cy) | Holds |
|---|---|---|
| Sill | x ±27, y +10..+28 | numeral (y +12..+26); on bridge top blocks the numeral moves to the abutment's front face (section 6.2) |
| Standing field core | x ±16, y −22..+4 (fan slots ±9, ±6 plus pedestal r 7) | tokens only; shifted +6 in y on bridge top blocks |
| Side strips | x −27..−17 and +17..+27, y −28..+10 | one prop each at most; height ≤ 22 (never hides more than the ankles of the token behind) |
| Back strip | x ±16, y −28..−22 | low props ≤ 12 tall (fence, flowers, bones, embers); on snake head blocks the coil instead (section 5) |
| Groove | 1 unit all round (the field plate shows) | nothing |

Variety rule, seeded by square number only (identical on every level, deterministic, tested):
`seed = (square * 2654435761) >>> 0` (Knuth hash). Pattern `a|b` = `seed & 1`. Prop count = `1 + ((seed >>> 1) & 1)`.
First prop kind = region list `[(seed >>> 2) % n]`, placed on the left side strip if `(seed >>> 17) & 1` else the
right; second kind = the list without the first, `[(seed >>> 8) % (n−1)]`, on the back strip if its height ≤ 12,
otherwise the other side strip. If the first kind equals square−1's first kind, take the next kind. Position
jitter along the strip = `((seed >>> 20) % 7) − 3` units. No mirroring (a flipped iso sprite breaks the light).
Landmark squares (1.5) add their fixed prop and drop the random second.

### 1.4 Depth bands (replaces T40 §2.6)

`key = depthKey([x, y, TOP_Z])` of the object's floor point (range 27..578 over the field; the z term is dropped so
all standing things sort by where they stand). Everything on the board is in the `board` Layer; the HUD is in the
`hud` Layer (section 4).

| Band | Depth | Content | Floor point |
|---|---|---|---|
| Floor | `0 + key (+ 0.2 / 0.3 / 0.4 / 0.6)` | base tiles, fog, shimmer, mist, token shadows | tile centre |
| Frame | `0 + key` | rim modules, corner caps, plinth faces (they stand on the halo; row-1 tokens are in the standing band so the 0.6 px rim lip never covers a foot) | module centre |
| Standing | `1000 + key` | props, snake coil and head (head = coil key + 0.5), bridge segments, tokens, dust/sparkle FX, gate posts, parasol | prop base / coil centre / segment depth point (6.4) / feet |
| Air | `2900 + key` | birds | ground point under the bird |
| Numerals | `3000` | every numeral glyph | — |
| HUD | 5000 / 6000 / 9000 | plates, die, chips / bubbles / modals (T40) | hud layer only |

Proof that tiles never cover standing things: a tile's top face lies entirely below (on screen) the far edge of the
tile in front of it; a token's pedestal (r 7 at y ≤ cy+4) stays ≥ 6 units inside its own tile (cy+28), so no tile
in the floor band overlaps a pedestal of the row behind. Within the standing band the painter's rule for upright
objects on one floor plane holds (sort by floor point); the one exception, a bridge deck over a tile, is handled by
section 6.4.

### 1.5 Landmarks and fixed props (T03 §2 and row motifs, as sprites)

| Square(s) | Prop kind | Zone | Notes |
|---|---|---|---|
| 1 | `ayodhya-threshold` (parchment road strip 8 wide from the sill to the gate side) + 2 `lamp` | back strip + both side strips | the torana itself stays on the rim (T40 E1–E5) |
| 2–3 | `rice-stripes` | side | Sarayu bank reads along row 1's near edge via the Mithila `b` pattern (water edge) |
| 24 (c1 r2), 36 (c12 r3) | `janaka-palace` (36), `sage-hut` with smoke (24) | side | T03: palace at row 3's right end |
| 30 (c6 r3) | `plough` | back | Sita's birth |
| 48, 47 (c1, c2 r4) | `rampart` | side | row 4 runs right→left, so T03's plaza (c1–c5) is squares 48..44 |
| 45 (c4 r4) | `dome` | side | 46 (Kaikeyi) keeps its strips for the snake's window prop (5.5) |
| 42 (c7 r4) | `chariot` | side | |
| 37–40 (c12..c9 r4) | `dark-tree` | side | the forest edge T03 puts at c9–c12 |
| 66 (c6 r6) | `panchavati-hut` | side | |
| 49, 50, 71, 72, 73, 74 | Ganga water tile (`ganga-a/b`) + `reed` on the banks | — | the Guha bridge crosses 71, 72 |
| 77 (c5 r7) | `jatayu` bird prop circling (air band) | air | one bird |
| 85 | `basket` + `berry-bush` | side | Shabari |
| 90 (c6 r8) | `cave-mouth` | side, height 22 | |
| 96 (c12 r8) | `waterfall` (shimmer anim) | side | beside the Shabari bridge |
| 97 (c1 r9) | `rishyamukha-hill` (height 22) | side | T03 "Rishyamukha hill at r9 c1" |
| 109–120 | sea water tiles (`sea-a/b`) | — | row 10; Rama Setu stones are the bridge (6.3) |
| 121–132 | `lanka-wall` (121, 132), `tower-banner` (125, 129), `arrow-stack` (123, 131) | side | blood banners |
| 133–137 | `fire` x2 (134, 136), `broken-banner` (137, ten crown marks in a row on torn cloth — not heads) | side | battlefield right end |
| 144 | `dais` ring (T40 F8–F10) in gold trim | centre, 2.4..2.8 tall | no lamps or offerings (T40 §9 item 8) |

Row/column to square: row r (1-based), column c (1 = left): odd r → `(r−1)·12 + c`; even r → `(r−1)·12 + 13 − c`.

### 1.6 Ambient animation (cheap Phaser tweens on prop sprites)

| Kind | Tween | Props |
|---|---|---|
| `sway` | angle ±2.5° about the base, 1.8–2.6 s (by seed), `Sine.easeInOut` yoyo, phase by seed | trees, vines, reeds, banners, grass, berry bush |
| `flicker` | alpha 0.75–1.0, random 80–140 ms steps, yoyo | lamps, fires, torches, hidden eyes (gold dots) |
| `smoke` | a `shared:puff` rises 8 px and fades over 1.6 s, emitted every 2 s | sage hut, Panchavati hut, Lanka fires |
| `shimmer` | highlight sprite slides ±3 px, alpha 0.3–0.6, 2.4 s | sea, Ganga, waterfall |
| `bird` | 2-frame flap at 6 fps; flies along its row band 14 s, loops; ≤ 5 live | Jatayu (row 7), gulls (row 10), crows (row 12), parrots (row 2), peacock on the ground (Mithila, `sway` only) |

Rules: tweens run only for revealed blocks inside the board camera's view rect plus one tile margin; the culling
list is rebuilt every 250 ms and on every camera settle; paused tweens cost nothing. `prefers-reduced-motion`
disables every ambient tween (props stand still; reveal crossfades stay). Hard limit 120 live ambient tweens;
beyond that, farthest blocks pause first.

---

## 2. Regions: palettes, materials, props

Six regions from T03's row bands (row 10 is its own region, the sea). Tones per material follow one formula in
`common.mjs` `tones(hex)`: `top` = the hex; shade-3 = hex 12 % toward white; shade-2 = hex; shade-1 = hex 12 % toward
`ink` #2A1A0F; shade-0 = hex 26 % toward ink; lines = hex 55 % toward ink (four tones, crisp lines, no gradients).
Numeral ink: `dark` = #2A1A0F with a #F3E3B8 halo on light regions; `bone` = #F3E3B8 with a #1C1F4D halo on dark ones.

| Region | Rows / squares | Base tile `top` (a / b patterns) | Lines | Numeral ink | Prop kinds (≥ 6) | Ambient |
|---|---|---|---|---|---|---|
| `mithila` | 1–3 (1–36) | #9CC46B meadow / #A9CC7A with a parchment path | #3F5A2A | dark | mango-tree, rice-stripes, sage-hut, lamp, plough, peacock, cow, parchment-path-stone | sway, smoke, flicker |
| `ayodhya` | 4 (37–48) | #E3C98D sandstone plaza / #D9BE82 with gold inlay line | #5A4420 | dark | rampart, dome, chariot, lamp, banner-saffron, dark-tree (37–40 edge), fountain | flicker, sway |
| `dandaka` | 5–7 (49–84) | #4F7F3C moss / #58893F with roots; row tints r6 0xEBEBEB, r7 0xD8D8D8 | #1F3A1A | dark | sal-tree (22 tall), vine-post, hidden-eyes, panchavati-hut, rock, fern, reed (Ganga banks), jatayu (air) | sway, flicker, bird |
| `ganga` tiles | 49, 50, 71–74 | #4E9BB8 water with wave lines | #1E3F55 | bone | reed, lotus-pad, boat-post | shimmer |
| `kishkindha` | 8–9 (85–108) | #CF975B ochre rock / #C48C52 with crevice | #5C3B1E | dark | boulder, cave-mouth, waterfall, banana-plant, berry-bush, basket, monkey-frieze-stone, hill | shimmer, sway |
| `sea` | 10 (109–120) | #3F8FB5 / #3886AC deep swell | #1E3F55 | bone | wave-crest (shimmer), rock-stack, gull (air), buoy-stone, foam-ring, shell | shimmer, bird |
| `lanka` | 11–12 (121–144) | #2A2E6B night stone / #262A62 with gold filigree line | #0F1030 | bone | lanka-wall, tower-banner, arrow-stack, fire, broken-banner, gold-lamp, terrace-step, crow (air), dais (144) | flicker, smoke, bird |

Accents shared across regions: saffron #F39C2B (flames, banners), gold #E9C12F (trim, crowns, dais), blood #8E3B3B
(Lanka banners, snake bellies, berries), parchment #F3E3B8 (paths, lamps, scroll). Fog tint target #CFCCC4 (3.4).

Frame recolour (the chaupar table becomes warm wood): plinth and feet teak `tones(#A9743F)`, rim bars brass
`tones(#C9A24A)` with `lo`/`mid` line tokens replaced by the brass line tone, maker's and chapter plates brass,
corner caps teak, torana and parasol keep anatomy paper `hi` with gold finials and a saffron fringe. Page colour
recommended linen #EFE6D3 (appendix 4); the HUD card restyle itself stays T40 §6.

---

## 3. Texture memory budget (phone: ≤ 48 MB of GPU textures, mipmaps included)

### 3.1 Rules

| Rule | Value |
|---|---|
| Fine factor (props, numerals, snakes, figurines, shared FX) | 5 device px per logical px = max zoom 2.5 x DPR 2; never upscaled |
| Coarse factor (base tiles, fog, frame modules, bridges) | 4 = follow zoom 2.0 x DPR 2; upscaled 1.25x at max zoom (flat materials and stone tolerate it) |
| Atlases | power-of-two sheets (WebGL1 mipmaps need POT); Phaser JSON-hash atlases plus a sidecar `*.meta.json` with factor, anchor and world data per frame |
| Mipmaps | on (`render.mipmapFilter: 'LINEAR_MIPMAP_LINEAR'`): at Fit zoom on a DPR 1 desktop a fine texture draws at 0.2x, which sparkles without mipmaps; cost +33 % per mipmapped sheet |
| Bytes | RGBA 4 B/px; a sheet costs its full allocation, not its used pixels |
| One asset set | the same textures on DPR 1 and 2; a DPR 1 device never shows the finest level |
| Per level | only `snakes-<level>` and `bridges-<level>` are level-specific; everything else loads once |

### 3.2 Per-kind raster sizes (logical bbox at zoom 1 → device px at its factor)

| Texture kind | Frames | Logical bbox (px) | Factor | Frame px | Pixels per frame | Frames x px |
|---|---|---|---|---|---|---|
| Base tile (`<region>-a/b`, `ganga`, `sea`) | 6 regions x 2 + ganga 1 = 13 | 60 x 47 (54-unit top 59.4 x 45.5 + 1.2 slab side) | 4 | 243 x 189 | 45,900 | 597 k |
| Fog tile (one per region incl. ganga, sea) | 7 | 60 x 47 | 4 | 243 x 189 | 45,900 | 321 k |
| Mist overlay | 2 | 72 x 56 | 4 | 288 x 224 | 64,500 | 129 k |
| Numeral glyph (8 x 14 units flat on the sill, sheared) | 10 digits x 2 inks = 20 | 10 x 12 | 5 | 50 x 60 | 3,000 | 60 k |
| Shared FX: shadow, shimmer, puff, tongue x2, bulge, bird frames x6 | 12 | ≤ 24 x 16 | 5 | ≤ 120 x 80 | ≤ 9,600 | 80 k |
| Prop, small (≤ 10 x 10 x 22 units) | 30 | 20 x 26 | 5 | 100 x 130 | 13,000 | 390 k |
| Prop, landmark (≤ 40 x 40 x 22) | 10 | 35 x 45 | 5 | 175 x 225 | 39,400 | 394 k |
| Frame: rim module 56 x 22 with plinth face and foot | 4 bars + 4 corners | 45 x 42 | 4 | 180 x 168 | 30,200 | 242 k |
| Frame: torana, parasol, maker's plate, 5 chapter plates | 8 | ≤ 40 x 60 | 4 | ≤ 160 x 240 | ≤ 38,400 | 95 k |
| Snake coil (R 2.2 / 2.6–3.0 / 3.4 / 4.0) | 2 / 9 / 1 / 1 | 22x31 / 25x36 / 27x38 / 30x44 | 5 | 112x156 / 124x180 / 132x192 / 152x220 | 17.5 k / 22.3 k / 25.3 k / 33.4 k | 294 k (Hard) |
| Snake head and neck (closed, open) | 13 x 2 | 14 x 20 (Ravana 19 x 27) | 5 | 72 x 104 (96 x 136) | 7,500 (13,000) | 206 k (Hard) |
| Bridge segment (per row band, 6.4) | 27 Easy / 23 Medium / 18 Hard | middle segment up to 114 x 68 (vishwamitra) | 4 | up to 456 x 272 | up to 124 k | 652 k / 507 k / 452 k |
| Figurine `s` (80 units, fit box 34 x 28 x 83) | 4 heroes x 5 emotions x 2 (plain, lit) = 40 | 27 x 64 | 5 | 136 x 320 | 43,500 | 1,741 k |
| Die faces (HUD, DPR 2 only) | 6 | 96 x 96 | 2 | 192 x 192 | 36,900 | 221 k |

Bridge pixels (factor 4; the middle band holds ~79 % of a 3-band span): vishwamitra 143 k, shiva-bow 55 k, wedding
90 k, guha 55 k, shabari 12 k, hanuman-meeting 55 k, sugriva 90 k, hanuman-leap 57 k, rama-setu 95 k.

### 3.3 Sheets and the total

| Sheet | Content | Used px | Allocation (POT) | MB | With mips | Loaded in |
|---|---|---|---|---|---|---|
| `blocks` | 13 base + 7 fog tiles | 918 k | 1024 x 1024 | 4.0 | 5.3 | BoardScene |
| `shared` | mist 2, numerals 20, FX 12 | 269 k | 1024 x 512 | 2.0 | 2.7 | BoardScene |
| `props` | 40 prop frames | 784 k | 1024 x 1024 | 4.0 | 5.3 | BoardScene |
| `frame` | 16 frames | 337 k | 1024 x 512 | 2.0 | 2.7 | BoardScene |
| `snakes-hard` (worst level) | 13 coils + 26 heads | 500 k | 1024 x 1024 | 4.0 | 5.3 | per level |
| `bridges-easy` (worst level) | 27 segments | 652 k | 1024 x 1024 | 4.0 | 5.3 | per level |
| `figurines-s` | 40 frames | 1,741 k | 2048 x 1024 | 8.0 | 10.7 | BoardScene (seat plates use it at scale 0.55; `m` no longer loads there) |
| `die` | 6 faces | 221 k | 1024 x 256 | 1.0 | 1.0 (no mip) | BoardScene |
| Phaser Text canvases (HUD, bubbles) | ≈ 14 | — | — | ≈ 2.0 | 2.0 | BoardScene |
| Dais, misc | | | | 0.5 | 0.5 | |
| **Total** | | | | **31.5** | **40.8 MB** | ≤ 48 MB, 7 MB headroom |

Gone from T40's budget: `board-<level>` 1568 x 1440 (9.0 MB) and figurine `m` in BoardScene (3 MB). If the total
measured on a device exceeds 44 MB, cut first the lit `s` variants (−5.3 MB; the current player's token is then
marked by a 1 px black ring under its pedestal plus the lit seat plate), then `props` to factor 4 (−1.9 MB).
Runtime check: in dev BoardScene logs the sum over `renderer.gl` textures of w x h x 4 x 1.33 and the smoke test
fails above 48 MB.

### 3.4 Fog variant (build time only, no per-object runtime blur)

| Step | Spec |
|---|---|
| Source | the finished `<region>-a` tile SVG |
| Filter at export | `feColorMatrix` saturate 0.3 → mix 60 % toward #CFCCC4 → `feGaussianBlur` stdDeviation 1.5 world units (1.14 logical px, 4.6 device px) → clipped to the tile rhombus + 0.5 unit |
| Then | rasterised like any frame; the region's hue stays faintly visible so the row bands still read at Fit |
| Overlay | `mist-1/2` (1.2): soft cloud, alpha 0.55, colour #F2F2EF, tileable so neighbouring fog merges |
| Reveal | 420 ms (Fast 120): fog alpha 1 → 0 over the lit tile already underneath; mist scale 1 → 1.3, alpha → 0 `Quad.easeOut`; props pop `1.0 → 1.06 → 1.0` staggered 40 ms (Fast 0); numeral crossfades `dark` → region ink; fog and mist sprites destroyed at the end |
| Never | no `postFX` blur, no runtime filters, no per-block RenderTexture |

### 3.5 Numerals stay readable

Numerals are fine (factor 5), live in band 3000 above every board object and carry a 1 px halo baked into the
glyph. Over fog they always use the `dark` ink. Height at follow zoom: 14 units → 18 logical px → 36 px on an iPad,
12 CSS px on an 844-wide phone (was 5). The seat readout (T40 §6) stays the exact source. On bridge top blocks the
numeral is engraved on the abutment's vertical front face (6.2), which reads larger than the flat sill.

---

## 4. Camera contract (T42.A, in progress; integrate to this)

### 4.1 Two cameras, two layers

| | Board camera | HUD camera (`cameras.main`) |
|---|---|---|
| Viewport (device px) | `(0, 0, 784·DPR, 720·DPR)` | full canvas `1280·DPR x 720·DPR` |
| Zoom | `DPR x userZoom` (user zoom multiplies T40's HiDPI zoom; `applyHiDpi` stays for the HUD) | `DPR` |
| Renders | `board` Layer only (`hudCam.ignore(boardLayer)`) | `hud` Layer only (`boardCam.ignore(hudLayer)`) |
| Scroll space | logical board-stage px (T40 `toScreen` output); at zoom 1 everything is where T40 put it | fixed |
| Bounds | plinth bbox (12, 42)–(772, 678) grown by `panMargin` 80 → `setBounds(−68, −38, 920, 796)` | — |
| Shake | `fx.shake` moves to the board camera (bite, bridge thud) | never shakes |
| Ignores | HUD, bubbles, modals, Rotate overlay, die ring pulse, win confetti | blocks, props, fog, numerals, tokens, shadows, snakes, bridges, board FX |

Input: a drag that starts at `pointer.downX < 784` logical pans the board; wheel events over the board viewport
zoom; the HUD column never pans or zooms. HUD hit areas keep working because Phaser hit-tests an object against the
camera that renders it.

### 4.2 API (`src/game/iso/boardCamera.ts`)

```ts
export class BoardCamera {
  readonly cam: Phaser.Cameras.Scene2D.Camera;   // scene.cameras.add(...), viewport in device px
  readonly layer: Phaser.GameObjects.Layer;       // every board object is added here
  get zoom(): number;                              // user zoom 1.0..2.5; cam.zoom === DPR * zoom
  setZoom(z: number, opts?: { duration?: number; around?: Screen }): void; // clamps; keeps `around` fixed on screen
  centerOn(p: Screen, duration: number): Promise<void>;
  follow(target: Phaser.GameObjects.GameObject | null, lerp: number): void; // Phaser startFollow with lerp
  resumeFollow(target: GameObject, duration: number): Promise<void>; // zoom → follow, centre → target, clears userInteracted
  fit(duration: number): Promise<void>;            // zoom → min, centre (392, 360), clears userInteracted; follow off until TurnStarted
  readonly userInteracted: boolean;                // set by drag, wheel, pinch; pauses follow until resumeFollow or fit
  toLogical(pointer: Phaser.Input.Pointer): Screen; // board logical coords under the pointer
  shake(duration: number, intensity: number): void;
  viewRect(): Phaser.Geom.Rectangle;               // logical rect in view, for culling ambient tweens
}
```

### 4.3 Behaviour and timings

| Event | Normal | Fast |
|---|---|---|
| `TurnStarted` | `resumeFollow(currentToken, 420)`: zoom → 2.0 and scroll → token feet in one `Sine.easeInOut` tween; the die enables when it ends | 0 ms (snap) |
| Token hops or walks a bridge | `follow(token, 0.12)` (per-frame lerp, ≈ 130 ms time constant) | lerp 1.0 (locked) |
| Snake: token lands on the head block | camera holds on the token until it is swallowed | same |
| Snake: after the swallow | `centerOn(tailSpot, 420)`, then `follow(token)` as it reappears | 0 |
| Reached 144 | `setZoom(1.4, 600)` centred on 144 | 0 |
| Fit button, key `0` | `fit(350)` | 350 (a user action) |
| `+` / `−` buttons, keys `+` `−` | x1.25 / ÷1.25 around the view centre, 200 ms `Quad.easeOut` | same |
| Wheel | x1.1 per notch (deltaY < 0 zooms in) around the pointer, 120 ms, coalesced per frame | same |
| Pinch (`input.addPointer(1)`) | zoom by the distance ratio around the midpoint, immediate | same |
| Drag (> 8 px) | scroll immediately, no momentum | same |
| Any manual gesture | sets `userInteracted`; follow pauses until the next `TurnStarted` or `fit()` | same |
| Rotate overlay, scene pause | camera tweens paused, state frozen | same |

Zoom chips in the HUD column (T40 §6.1 grid): `FIT` (1088, 612, 56, 44), `⊕` (1152, 612, 48, 44), `⊖` (1204, 612,
48, 44), secondary-chip style, disabled look at the range ends. Zoom around a point `p`:
`scroll' = p − (p − scroll) · z / z'` in logical coords, then clamp to bounds.

Fast rule: every camera tween is 0 ms and follow lerp is 1; at 40 ms hops a pan is unreadable, so the camera sits on
the mover. Phones: `Scale.FIT` still scales the whole canvas; the board viewport is `784·DPR x 720·DPR` of it, so no
layout changes; at follow zoom a block is 78 CSS px wide on an 844 x 390 phone.

---

## 5. Snakes: a standing coil in one block

### 5.1 Construction (figurine-style, `scripts/art/iso/snakes/`)

Built like the figurines (T40 §4.1 helpers: `createFigure`, `turned`, `tube`, audit, crop) in a local frame whose
origin is the coil's ground centre. Two sprites per snake so the head can move without redrawing the body.

| # | Part | Spec | Sprite |
|---|---|---|---|
| C1 | Halo | ellipse under the coil, r = outer radius, halo colour at .32 | coil |
| C2 | Ground spiral | the lowest turn spirals inward from r_h to r_h − 5 on the ground (z = R), so the coil's centre is filled by the snake itself: no hollow, no post inside (5.6) | coil |
| C3 | Stacked turns | helix `tubePieces` route, 2.5 turns from the end of C2 rising 2R per turn (each turn rests on the one below), radius r_h → r_h − 2 at the top, body radius R constant, `rings` = the snake's pattern (5.5), `maxLength` 6, `breaks` at every half turn so front chunks sort over back chunks | coil |
| C4 | Tail tip | the route's start (before C2) comes out at the front-right, tapers to 0.45 R over 10 units and ends in its elliptical cap on the tile | coil |
| C5 | Neck collar | `ringBand` r 1.15 R / 1.0 R, 1.2 tall, where the neck leaves the top turn at local (−6, −6) | coil (the head sprite's pivot sits on it) |
| N1 | Neck | tube r R → 0.85 R, S-route from the collar: (−6, −6, 5R) → (−9, −10, 5R + 7) → (−6, −9, 5R + 12) → head base (−2, −6, 5R + 14) (Ravana +16), filleted, same `rings` | head |
| N2 | Head | T40's lathe profile `[[0,1],[3,1.3,1],[7,1.4,1],[11,1.05,1],[14,0]]` in units of R along the route tangent, pointing down-forward at FIELD_C; two eye dots .45 at s 6, ±40°; closed mouth seam `arcOf` at s 10 | head `closed` |
| N3 | Open jaw | the lower third of N2 (s 4..14, below the mouth seam) hinged down 25° at s 4; mouth interior = a dark disc (body 70 % toward ink) inside; **no fangs, no teeth** | head `open` |
| N4 | Motif | per snake (5.5): small turned parts on the head or beside the coil | head or coil |
| T1 | Tongue | shared `shared:tongue-short`, `tongue-long` (forked, 2.4 units), tinted body 40 % toward blood, anchored at the manifest's mouth point | runtime |
| T2 | Bulge | shared `shared:bulge`, an ellipse 1.6 R x 1.2 R tinted to the body, slides down the neck path at the swallow | runtime |

Sizes by body radius R (T40 §3.3 values kept):

| R | Snakes | r_h | Coil outer radius | Stack height 5R | Head top (z over TOP_Z) | Footprint (world) |
|---|---|---|---|---|---|---|
| 2.2 | manthara, brahmastra | 8.0 | 10.2 | 11 | 29 | 20 x 20 |
| 2.6–3.0 | tataka, kaikeyi, viradha, shurpanakha, golden-deer, abduction, kabandha, indrajit-arrows, prahasta | 8.5 | 11.5 | 13–15 | 33–34 | 23 x 23 |
| 3.4 | kumbhakarna | 9.0 | 12.4 | 17 | 36 | 25 x 25 |
| 4.0 | ravana | 10.0 | 14.0 | 20 | 42 | 28 x 28 |

Every head stays under a token's chin (figurine shoulder z 44): the hero towers over the villain.

### 5.2 Placement and sprites

| Item | Value |
|---|---|
| Coil centre | `(cx, cy − 14)` of the head square: the back strip and the far half of the standing field; the coil never crosses the tile's inset edge (outer ≤ 14 < 27 − 13) |
| Why the back | the token lands at FIELD_C `(cx, cy − 9)` in front of the coil, so the strike comes forward and down toward the viewer; nothing else ever rests on a head square (`Bitten` always moves the lander), so the fan table is unaffected; the raised head sits at the coil's back-left so the token never hides it |
| Depth | coil `1000 + key(cx, cy − 14)`; head `+ 0.5`; tongue `+ 0.6`; bulge `+ 0.55`; the bitten token `+ 0.4` once the strike starts (in front of the coil, behind the head) |
| Manifest `snakes-<level>.meta.json` | per id: `coil: { frame, anchor }` (anchor = ground centre in frame px), `head: { closed, open, pivot, mouth, neck: [[x,y] x 3] }` (pivot = collar point relative to the coil anchor, mouth and neck points relative to the pivot, all in frame px at factor 5), `body: hex`, `R` |
| Scale at runtime | `setScale(1/5)`, origin from the anchor; the board camera does the rest |

### 5.3 Idle when revealed

| Motion | Spec |
|---|---|
| Sway | head sprite angle ±3° about the pivot, 2.2 s `Sine.easeInOut` yoyo, phase by seed |
| Breath | coil scaleX 1.00 → 1.015, 3 s yoyo (anchor at the ground centre) |
| Tongue | every 3–6 s (random): `short` 70 ms → `long` 90 ms → `short` 70 ms → hidden |
| Blink | none (slit eyes) |
| Culling | same as ambient props (1.6); reduced motion: still |

### 5.4 Choreography: land → reveal → strike → swallow → reappear

| Step | Normal | Fast | Detail |
|---|---|---|---|
| 0 Land | 60 ms | 30 | token squash on the head square; `markSeen` already done by the hop |
| 1 Rise (first reveal only) | 380 ms | 120 | coil scaleY 0 → 1 from the ground anchor, `Back.easeOut` (overshoot 1.08); head follows 120 ms later, alpha 0 → 1 rising 10 px; sound `audio.hiss()` |
| 2 Hold | 260 ms | 0 | head angle tweens to face the token (160 ms); one tongue flick; bystander reactions start here (T05) |
| 3 Strike | 180 ms | 90 | head rotates −18° about the pivot and translates 10 units toward FIELD_C on screen, `Quad.easeIn`; frame `closed` → `open` at 60 ms; sound: existing `audio.snake()` shortened to the 180 ms drop |
| 4 Swallow | 320 ms | 150 | token sprite: position → mouth point, scale 1 → 0.1, alpha 1 → 0 over the last 80 ms, `Quad.easeIn`; frame `open` → `closed` at 200 ms; bulge slides mouth → neck[1] → neck[2] → collar over 360 ms (overlapping) and fades; board camera shake 120 ms, intensity 0.004; sound `audio.gulp()`; the token's shadow fades with it |
| 5 Return | 220 ms | 0 | head back to the idle pose, `Sine.easeOut`; idle sway resumes |
| 6 Pan | 420 ms | 0 | `centerOn(tail spot)` starts at the end of step 4 |
| 7 Reappear | 260 ms | 120 | at FIELD_C(tail) + fan slot: `dustPuff` (6 dots) then token scale 0.1 → 1 `Back.easeOut`, shadow alpha 0 → .32; sound `audio.pop()`; `markSeen(tail)` |
| 8 Re-fan | 80 ms | 40 | tokens sharing the tail square |
| Total | ≈ 2.1 s (1.7 s when already revealed) | ≈ 0.5 s | T40's 700 ms glide is gone; the bystander window (T05) spans steps 2–5 |

No body, trail, dots or line is ever drawn between head and tail squares. The token is in the snake from step 4 to
step 7; its seat readout shows the tail square from step 7.

### 5.5 Story identity per snake (full colour; T03 motifs; T30 fixes kept)

Tones per body from `tones(hex)` (section 2); belly = body 40 % toward blood #8E3B3B as the tube's `tb-shade`;
pattern rings = body 35 % toward ink. Head creases = lines tone.

| id | Head → tail | R | Body | Pattern (`rings`) | Head motif | Prop beside the coil |
|---|---|---|---|---|---|---|
| tataka | 17 → 6 | 2.8 | #457334 swamp green | bands pitch 6 | hair tangle: 5 tubes r .4, ≤ 1.2 R long, drooping back and sideways (never up or flared) | broken stump, 4 tall |
| manthara | 37 → 19 | 2.2 | #1C1F4D | diamonds `cross`, twist 1, gold rings | shawl collar `ringBand` 1.3 R / 1.1 R on the neck below the head, 3 fold ribs; it sits on the neck, never behind the head | whisper scroll (tiny parchment roll) |
| kaikeyi | 46 → 28 | 2.8 | #7B3B6E | spots (dots .5 alternating) | two gold bangles: collars at s −4 and −8 on the neck (neck gapped) | palace window: slab 8 x 1 x 10 with a drawn curtain, standing in the right side strip |
| viradha | 58 → 40 | 3.0 | #A4703E ochre-brown | bands pitch 6, bristle dots | none | club lathe lying on the tile, 12 long |
| shurpanakha | 64 → 47 | 2.8 | #8E3B3B | bands pitch 6 | gold nose ring r .7 at the snout | 3 saffron nail marks (short slabs .4 tall) on the tile |
| golden-deer | 70 → 56 | 2.8 | #E9C12F | spots (parchment) | deer mask: two antler tubes r .35, 3 points, from the head top, ≤ 1.4 R; a blood band shows at the mask edge (the disguise) | none |
| abduction | 76 → 55 | 3.0 | #783431 red-brown (T30: not blue) | spots | nothing on or behind the head | wooden cart wheel LYING FLAT on the tile at the coil's front-right: ochre rim r 3.5, hub, 8 thick spokes (T30 major); 3 Jatayu feather slabs 3 x 1 x .4 on the tile |
| kabandha | 82 → 68 | 3.0 | #457334 | bands pitch 6 | headless: N2 replaced by a stout cap disc r 1.4 R with two eyes on its front face; two arm tubes r .6 out to the sides ending in hand spheres r .9 | none |
| indrajit-arrows | 114 → 96 | 2.6 | #3A3F9E | diamonds `cross` (a braid, the serpent-noose) | one head; two-loop bow-knot: two `ringBand` tori r 1.2 / .8 side by side at the neck (T30 fix) | 3 arrows (tubes r .3 with fletching slabs) stuck in the tile |
| prahasta | 120 → 110 | 3.0 | #C98B4B | bands pitch 5 (armour scallops, gold edge) | helmet crest: a thin fin slab 1 x 6 x 1.2 along the head's axis (a fin, never a disc) | shield disc r 3 leaning on the coil |
| kumbhakarna | 124 → 106 | 3.4 | #A6723E | bands pitch 8 | closed eyes: two short arcs instead of dots; a parchment "Z" is NOT drawn (text rule); instead a slow nod −4° in idle | drum lathe r 2.4 h 3 with 2 bands beside the coil |
| brahmastra | 130 → 119 | 2.2 | #F39C2B | diamonds twist 2 (lightning chevrons, gold) | arrowhead head profile `[[0,1],[2,1.6],[9,0]]` | none |
| ravana | 138 → 78 | 4.0 | #1C1F4D with gold diamond scales | diamonds `cross` + bands pitch 10 | ONE head wearing a rakshasa crown: 3 angular tiers (`ringBand` 1.1 R / .95 R / .8 R, 1.0 each, octagonal steps, horn-like finials on the top tier), red eye dots | broken ten-headed banner: pole 18 tall with a torn pennant showing ten tiny crown marks in a row; a mace lying on the tile |

Only `ravana` fires `snakeBig` (unchanged). Snakes per level: `boardFor(level).snakes` (6 / 9 / 13).

### 5.6 RESPECT: villain snakes must never read as Shesha, Vasuki, Ananta or any Naga deity

| # | Rule | How the build enforces it |
|---|---|---|
| 1 | No hood, no hood canopy | the head is a lathe (rotationally symmetric) with no flare; nothing is scaled sideways behind the head; no fan of anything behind or above the head |
| 2 | One head per snake | Ravana's identity is the crown, the banner and the gold scales, not ten heads; Indrajit's noose is one braided body |
| 3 | No halo, disc or ring behind the head | T30 major: abduction's wheel lies flat on the tile beside the coil; the T42 check (section 9, T42.11) fails any part whose screen footprint is a closed curve behind the head |
| 4 | No central post inside the coil | the ground spiral fills the centre (C2): a coil around a vertical shape would read as Vasuki around Mandara or a lingam |
| 5 | No devotional marks | no tilak, urdhva-pundra, garland, lotus seat, conch or discus on any snake or prop |
| 6 | Heroes above villains | every head top (≤ 42) is below the figurine's shoulders (44); the strike dips the head, it never rises over the hero |
| 7 | No fangs at the viewer | N3's open mouth is a dark interior only; no teeth, no venom, no blood |
| 8 | Comedy stays with Hanuman and Lakshmana | the bitten hero's emotion is T05's (Rama and Sita `scared` = concern); the snake shows no mockery pose |
| 9 | Native-speaker pass | the snake sheet (all 13 coils, heads closed and open) is in the T42.11 review |

---

## 6. Bridges: arched stone from the foot block to the top block

### 6.1 The 22 jumps by level (which are bridges)

| Level | Bridges (9 ids) | Snakes |
|---|---|---|
| Easy | vishwamitra 4→25, shiva-bow 20→43, wedding 26→52, guha 49→74, shabari 85→108, hanuman-meeting 88→113, sugriva 92→118, hanuman-leap 95→122, rama-setu 101→127 | manthara, kaikeyi, shurpanakha, golden-deer, abduction, indrajit-arrows |
| Medium | all but guha and sugriva (7) | Easy's + tataka, kabandha, kumbhakarna (9) |
| Hard | vishwamitra, wedding, shabari, hanuman-meeting, hanuman-leap, rama-setu (6) | all 13 |

### 6.2 Endpoints on real squares

| End | World position | Why |
|---|---|---|
| Foot abutment | back strip of the foot square: plan 14 wide (x ±7 around cx) x 12 deep (y cy−27..cy−15), 3 tall, bevel .6; deck leaves over the square's far edge | nobody ever rests on a foot square (`Laddered` moves the lander), and the standing field is left free for the landing token |
| Top abutment | sill of the top square: 14 wide x 16 deep (y cy+12..cy+28), 3 tall; the square's **numeral is engraved on its vertical +y face** (digit 8 x 14 units stands upright there, `dark` or `bone` ink per region) | the deck arrives from the viewer's side (+y) and never passes over the top square's standing field; resting tokens on top squares are untouched; the numeral reads better upright |
| Deck route | straight from F = `(cx_f, cy_f − 21)` to T = `(cx_t, cy_t + 20)`; `rama-setu` and `shiva-bow` bow 12 units toward −y at mid-span (3-point fillet) | rama-setu must clear Indrajit's coil on 114 (6.5); shiva-bow is a bow |
| Deck height | `z(s) = TOP_Z + 3 + h · sin(π s / L)`, `h = min(22, round(7 + 0.08 L))` | parapet top ≤ 2.4 + 3 + 22 + 2.5 = 29.9 < HEADROOM; a token on the apex (105) is 10 px over the Fit box, inside `pad` 12 |
| Arches | `n = max(1, round(L / 45))` openings of equal length between piers; each opening = a semicircular ring (`extrude` of a half-annulus in the vertical plane of the route, thickness 3) under the deck; pier = slab 8 x 8 base plate on the tile tops (it may straddle a 2-unit groove) + shaft 6 x 6 up to the deck, cap 7 x 7 x 1 | the arches are the "arched stone bridge" |
| Deck | prism 14 wide along the route, 2.5 thick, top at `z(s)`, chunked every 8 units so each chunk takes its own band (6.4); flagstone seams across it every 8 units as `inner` lines | |
| Parapets | two rails 1.5 wide x 2.5 tall along both deck edges with posts 2 x 2 x 4 every 16 units; story variant below | |
| Walkway | 11 wide between parapets ≥ pedestal 14? No: the pedestal (r 7) overhangs the walkway by 1.5 each side, so the parapets are 1.0 wide and the walkway 12; a 2-unit overhang over a low rail reads as standing on the bridge | tokens never float |

Per-bridge geometry (Δcol, Δrow from T03 cells, checked against `gridOf`):

| id | Foot (c, r) → Top (c, r) | Δx, Δy (world) | L | h | Openings | Bands crossed | Crossed squares (deck ± 7 over a tile) |
|---|---|---|---|---|---|---|---|
| vishwamitra | c4 r1 → c1 r3 | −168, −71 | 182 | 22 | 4 | r1, r2, r3 | 21, 22, 23, 24 |
| shiva-bow | c5 r2 → c6 r4 | +56, −71 | 90 | 14 | 2 | r2, r3, r4 | 29, 30 |
| wedding | c2 r3 → c4 r5 | +112, −71 | 133 | 18 | 3 | r3, r4, r5 | 45, 46, 47 |
| guha | c1 r5 → c2 r7 | +56, −71 | 90 | 14 | 2 | r5, r6, r7 | 71, 72 (Ganga) |
| shabari | c12 r8 → c12 r9 | 0, −15 | 15 | 8 | 1 | r8, r9 | none (it spans the groove) |
| hanuman-meeting | c9 r8 → c8 r10 | −56, −71 | 90 | 14 | 2 | r8, r9, r10 | 104, 105 |
| sugriva | c5 r8 → c3 r10 | −112, −71 | 133 | 18 | 3 | r8, r9, r10 | 99, 100, 101 |
| hanuman-leap | c2 r8 → c2 r11 | 0, −127 | 127 | 17 | 3 | r8, r9, r10, r11 | 98, 119 (sea) |
| rama-setu | c5 r9 → c7 r11 | +112, −71 | 133 (+ bow) | 18 | 3 | r9, r10, r11 | 115, 116 (and the near corner of 114 before the bow; the build recomputes) |

The build computes `crossed` from the deck's ±7 ribbon against tile plans and writes it to the manifest; the
test asserts the table above (rama-setu after the bow).

### 6.3 Story identity per bridge (T03 ladder story → stone bridge variant)

Stone tones from `tones(hex)`; every bridge is stone (owner), the story lives in material tint, parapet and
ornament. Each part is a real turned or extruded piece that sits on another part.

| id | T03 | Stone | Parapet | Ornament at the foot | Ornament at the top |
|---|---|---|---|---|---|
| vishwamitra | wood rails bound with cord | rough grey granite #8E8A80 | timber rails (slab 1.0 x 2.5, grain lines) lashed with cord collars at each post | kamandalu (lathe pot) on the abutment | a bowstring (`hi` line) tied across the last two posts |
| shiva-bow | the broken bow | pale gold sandstone #D9BE82 | two bow halves: tubes r 1.0 bowed 6 outward, gold tone, string segments every 16 | none | burst star: 6 spokes from a dot on the abutment top |
| wedding | rose silk, marigold garlands | rose marble `#D15587` 70 % toward paper = #E8B9CB | posts with saffron marigold swags (tubes r .5 with dots .5 pitch 2) between them | garland loop on the abutment | two crown discs r 1.6 on the end posts |
| guha | boat, oars, rope | river-stone #8FA3A8 | oar rails (tube r .8 with paddle slabs 6 x 3 x .8 at the foot end); rope ties across the deck every 16 | none (the piers are boat prows: lens-shaped hull plans 22 x 9 instead of 8 x 8 plates) | none |
| shabari | berry branches | mossy stone #7F8A5F | vine tubes r .6 with blood berry dots .5 and leaf prisms | basket lathe cup r 2.4 | none |
| hanuman-meeting | fur-trimmed rope, mace, tail | ochre stone #C98B4B | rope rails (`rings` twist) with fur collars (`rings` pitch 2.2) at the posts | tiny mace lying on the abutment | tail curl: tube r .7 spiral 1.5 turns ending in a tuft sphere |
| sugriva | rock pillars, clasped hands, crown | Kishkindha ochre #CF975B | pillar posts (4 x 4 x 6 blocks) with clasped-hands medallions (rings r .8 on the rail) | none | crown disc r 2 with two ear cylinders |
| hanuman-leap | wave columns, clouds, flying Hanuman | sea-stone #658DA2 | wave rails: tubes r .8 with a sine wave ±1.6 along the route; piers carved as wave crests | none | tuft finials: 4 tubes r .6 fanning ±35° from the last post |
| rama-setu | floating stones with Rama marks, squirrel | sea-stone #8AA0A6 | low stone blocks instead of rails; **the deck is stepping slabs 16 x 11 with 2-unit gaps**, each with a `hi` ring r .8 (the inscribed name) | dot pair (squirrel footprints) on the first slab | none |

### 6.4 OCCLUSION rule (exact)

A deck up to 25 units high projects up to 12 px (zoom 1) over the row behind it and would hide feet, numerals and
blocks. The rule, proven by geometry:

| # | Rule | Proof / value |
|---|---|---|
| 1 | **Per-row segments.** The built bridge is cut into one sprite per row band it occupies: every chunk (deck chunk, arch ring, pier, parapet piece) belongs to the band of its centre's world y (`floor((672 − y) / 56)`); a deck chunk straddling a band edge is split there | a 3-band bridge is 3 sprites, hanuman-leap 4 |
| 2 | **Own depth key per segment.** `depth = 1000 + depthKey([x_m, y_m, TOP_Z])` where `(x_m, y_m)` is the route point at the band's middle `y = 672 − 56 (n + 0.5)` (end segments: the abutment centre) | within a band the segment spans ≤ 60 key units; tokens on tiles the deck does not cross are ≥ 11 units (≥ 7 px) clear of its ribbon on screen, so their order against the segment never shows; tokens in the band behind have smaller keys and are correctly hidden up to the ankles (≤ 12 px); tokens in the band in front have larger keys and draw over it |
| 3 | **Fade-when-behind.** While any token rests on a square in the segment's `crossed` list, that segment's alpha tweens to 0.35 over 150 ms; back to 1.0 over 150 ms when the square empties | a token under a deck physically intersects it; the fade keeps the token readable (e.g. 119 under hanuman-leap, 46 under wedding) |
| 4 | **Crossing token on top.** While a token walks a bridge, its depth is `segment.depth + 0.5` of the segment whose band it is in (re-evaluated each frame), not its own floor key | otherwise a token in the far half of a band would sort behind its own deck |
| 5 | **Numerals above everything** (band 3000, 3.5) | the deck can never hide a square number |
| 6 | **Fit-view check** | the hidden-by-default rule means at most the revealed bridges stand; the test renders Easy with all 9 revealed and tokens on 24, 46, 119 and asserts rules 2–4 by depth comparison |

### 6.5 Known pairs the audit must prove (per level build, `--audit`)

| Pair | Risk | Resolution |
|---|---|---|
| wedding deck over kaikeyi's coil (46) | deck z at the crossing ≈ 23.4 vs coil top 2.4 + 5 x 2.8 = 16.4 | clearance 7 ✓, asserted |
| rama-setu over indrajit-arrows' coil (114) | straight route passes 6 units into the coil's plan at z 15 | 12-unit bow toward −y moves the ribbon off the coil's plan (x ≥ 352); asserted clearance ≥ 1.5 R |
| sugriva deck over rama-setu's foot abutment (101) | ribbon at t < 0.25 is at y 213..231, abutment at y 169..181 | no overlap ✓ |
| bridge vs bridge | none overlap on screen on any level (x ranges disjoint: vishwamitra 28–196 rows 1–3, shiva-bow 252–308, wedding 84–196 rows 3–5, guha 28–84, sugriva 140–252, rama-setu 252–364, hanuman-meeting 420–476, hanuman-leap x 84) | asserted |
| snake coil vs props on its block | the coil owns the back strip and far half; props on head squares go to the side strips only, height ≤ 12 | build rule |

### 6.6 Reveal → rise → cross → top revealed

| Step | Normal | Fast | Detail |
|---|---|---|---|
| 0 Land on the foot | 60 ms | 30 | squash; `markSeen(foot)` already set; `Laddered` arrives → `markRevealed(id)` |
| 1 Rise (first reveal) | 360 ms + 70 ms stagger per segment, foot → top (≤ 570) | 120, no stagger | each segment from y + 14 px, alpha 0, scaleY 0.9 → settled, `Back.easeOut`; a 4-dot `dustPuff` at each pier base as it lands; sound `audio.stone()` (3 thuds at 0 / 120 / 240 ms); board camera shake 100 ms, 0.003. Already revealed: a 120 ms `1.0 → 1.03 → 1.0` thud instead |
| 2 Step on | 140 ms | 50 | hop from FIELD_C(foot) onto the foot abutment (14 units back), `hopPoint` with z to TOP_Z + 3 |
| 3 Cross | `ceil(L / 28)` hops x 140 ms (vishwamitra 7 = 980 ms, shabari 1) | x 50 | hops along the route; `z = deck z(s) + 8 · 4u(1−u)`; token depth per rule 6.4.4; `audio.step()` per hop; camera follows (lerp 0.12) |
| 4 Step off | 140 ms | 50 | hop from the top abutment down to FIELD_C(top) + fan slot (shifted field, 1.3) |
| 5 Top revealed | 420 ms | 120 | `markSeen(top)` (crossfade if hidden), `goldBurst`, re-fan 80 ms; sound: the existing `audio.ladder()` arpeggio, shortened to 300 ms |
| Total | 1.2–2.1 s | 0.3–0.5 s | `Laddered` reactions (T05) play from step 1 |

Squares under the deck stay fogged (a bridge is not a hop; appendix 2). The manifest carries `deck: [[s, z]]`
sampled every 4 units so the runtime interpolates `z(s)` without the formula.

---

## 7. Reveal choreography (fog of war)

### 7.1 States

| Thing | States | Stored |
|---|---|---|
| Square | `hidden` (fog tile + mist, numeral `dark`, no props, no ambient) → `seen` (region tile, props, ambient) | `RevealState.seen: number[]` (sorted, 1..144) |
| Jump (snake or bridge) | `hidden` (no sprite) → `revealed` (sprite exists; snake idles, bridge stands) | `RevealState.revealed: string[]` (jump ids) |
| Frame | always visible | — |
| Start | all 144 hidden; recommended exceptions 1 and 144 (appendix 1) | `EMPTY_REVEAL` |

### 7.2 Triggers

| Event (BoardScene) | Reveal call | Visual | Sound |
|---|---|---|---|
| each `stepTo(player, n)` lands (a hop, 120 / 40 ms) | `markSeen(n)` | crossfade 3.4 (420 / 120 ms) running while the token keeps hopping | none (hops already play `step()`) |
| the roll's last `stepTo` (the landing square) | `markSeen(n)` | same crossfade | `audio.reveal()` (airy chord 300 ms) only if the square was hidden |
| `Bitten` (jump) | `markRevealed(jump.id)` | snake 5.4 | hiss, snake, gulp, pop |
| `Laddered` (jump) | `markRevealed(jump.id)` | bridge 6.6 | stone, step, ladder |
| snake tail arrival / bridge top arrival | `markSeen(square)` | crossfade | part of the sequence |
| token enters from the seat (square 0 → 1..6) | `stepTo` per square as today | squares 1..n crossfade in turn | |
| void slide (triple six → 0) | none | the token leaves; nothing unseen | |
| resume from save | `reveal` from `loadGame()` | all seen squares and revealed jumps are created in their final state, no animation | none |
| debug key `R` (dev only) | `revealAll()` | instant | none |

Hop vs land: hopping onto a square reveals its terrain; only landing (the last square of a roll) can reveal a
snake or bridge, and that happens through the core's `Bitten` / `Laddered` event, so the reveal state can never
disagree with the rules. Squares a token flies over on a bridge, or skips inside a snake, stay hidden.

### 7.3 Reveal module contract (T42.B, in progress; integrate to this)

```ts
// src/game/reveal.ts (pure, tested)
export interface RevealState { readonly seen: readonly number[]; readonly revealed: readonly string[] }
export const EMPTY_REVEAL: RevealState;
export function markSeen(state: RevealState, squares: readonly number[]): RevealState;   // returns the same object when nothing changed
export function markRevealed(state: RevealState, jumpId: string): RevealState;
export function isSeen(state: RevealState, square: number): boolean;
export function isRevealed(state: RevealState, jumpId: string): boolean;
export function revealAll(level: Level): RevealState;
export function isRevealState(value: unknown): value is RevealState;                      // for the save validator
// src/game/save.ts: SAVE_VERSION 2; SaveFile { version, state: GameState, reveal: RevealState }
// saveGame(state, reveal): boolean; loadGame(): { state, reveal } | null; a version-1 file loads as null (new game), as today for any mismatch
```

Save on the same cadence as `GameState` (after each move). `squares` passed to `markSeen` are 1..144; 0 is
ignored. Ids come from `STORY_JUMPS`.

### 7.4 Sound cues (`src/game/audio.ts`, synthesized, mute and Fast respected)

| Cue | Synthesis | Used |
|---|---|---|
| `reveal()` new | two sines a fifth apart (440 / 660 Hz) 300 ms with a low-pass sweep 2 kHz → 400 Hz, gain .25 | landing on a hidden square |
| `hiss()` new | band-passed noise 1.8 kHz, Q 2, 420 ms, 6 Hz tremolo, gain .2 | snake rise |
| `snake()` existing | descending tone, shortened to 180 ms | strike |
| `gulp()` new | sine 300 → 110 Hz over 220 ms + a 20 ms click, gain .3 | swallow |
| `pop()` new | sine 600 Hz 80 ms with a fast decay | token reappears |
| `stone()` new | 3 x (sine 110 Hz 60 ms + noise 30 ms) at 0 / 120 / 240 ms | bridge rise |
| `step()` existing | unchanged | hops, bridge hops |
| `ladder()` existing | arpeggio shortened to 300 ms | top reached |
| Fast | every new cue's duration halves, as the existing cues do | |

---

## 8. Obsolete from T40 (deleted in T42.10)

| T40 item | Replaced by |
|---|---|
| §1.3 F2–F7 (tiles, alternation, engraved numerals, inlays, threshold as parts of one SVG) | block sprites (1.2), numeral glyphs, water tiles, threshold prop |
| §2.6 depth table (board texture at 0, tokens always above the board) | depth bands 1.4 |
| §3 whole section: tube snakes, humps, crossings, hard cap, low-relief ladders, §3.1 tinted inks, §3.2, §3.3 | sections 5 and 6, full colour |
| §5 rows "Ladder glide", "Snake glide", "trail = mid dots", "puff at the tail" | 5.4 and 6.6 |
| §7.3, §7.4 ink tables | `tones(hex)` per body / stone (sections 2, 5.5, 6.3) |
| §8 "Board" row (3 SVGs, 1568 x 1440), GPU budget 20 MB | atlases 3.3, budget 48 MB |
| §9 item 7 wording | 5.6 |
| Appendix 2 (engraved numerals, 5 px on phones) and 4 (Ravana humps) | 3.5; moot |
| `src/game/iso/jumps.ts`: `snakeBezier`, `bezierPoint`, `snakeRadiusAt`, `Hump`, `HARD_CAP`, `HUMP_MARGIN`, `SNAKE_RADIUS`, `LADDER_RELIEF`, `jumpPaths`, `jumpPath`, `glidePoint`, `STEP`, `JumpPath` (keep `fieldCentre`, `Vec2`, `Vec3`) | `snakes-<level>.meta.json`, `bridges-<level>.meta.json` |
| `scripts/art/iso/jumps.mjs`, `snakes.mjs`, `ladders.mjs`; `board.mjs` `surfaceParts` tiles/numerals/inlays; `build.mjs` `board()` and `boards.json` | `blocks.mjs`, `props.mjs`, `frame.mjs`, `snakes/`, `bridges/`, `atlas.mjs` |
| `public/assets/iso/board-*.svg`, `boards.json`; `assets.ts` `BOARD_STAGE`, `boardKey`, `boardUrl`, `BOARD_BACKGROUND_KEY` | atlas keys in `assets.ts` |
| BoardScene `slideTo` path branch (`this.paths`, `glidePoint`), `sparkleTrail` for ladders, `biteEffects` at the head | `SnakeActor`, `BridgeActor` |
| `fx.shake` on `cameras.main` | `BoardCamera.shake` |
| figurine `m` loaded in BoardScene; `s` raster at k x 2 | `figurines-s` sheet at factor 5 (`m` stays for Setup, Gallery, Win) |
| `tests/boardIso.test.ts` jump-twin tests | atlas manifest tests (crossed lists, anchors, depth keys) |

---

## 9. Task split (dependency order, one commit each)

Acceptance for every task: `npm run verify` green plus the stated check. Build scripts in `scripts/art/iso/`,
output in `public/assets/iso/`. Sonnet for anything drawn or animated; Haiku only for mechanical work. "Worktree"
= can run in parallel in its own worktree with the tasks in the same group.

| # | Task | Model | Depends | Deliverable | Acceptance | Parallel |
|---|---|---|---|---|---|---|
| T42.A | Board camera (in progress) | Sonnet | — | `src/game/iso/boardCamera.ts` per 4.2–4.3; `camera.json` `zoom`, `raster`, `panMargin`; `hud`/`board` Layers; zoom chips; `fx.shake` moved | unit tests: zoom-around-point maths, clamp to bounds, Fast → 0 ms; smoke: wheel/drag/pinch/Fit on the slice; HUD untouched by zoom | with B |
| T42.B | Reveal state (in progress) | Haiku | — | `src/game/reveal.ts` per 7.3; `save.ts` v2 | tests: markSeen idempotent and same-object on no change; v1 save loads as null; round trip | with A |
| T42.1 | Atlas pipeline | Sonnet | — | `scripts/art/iso/atlas.mjs` (shelf packer → POT PNG + Phaser JSON hash + `*.meta.json`), `raster.mjs` generalised (factor per frame, transparent, clip), `assets.ts` atlas keys, Phaser `mipmapFilter` on | 3 dummy frames pack and load; frame anchors round-trip within 0.5 device px; sheet sizes POT | group 1 alone |
| T42.2 | Region tiles, fog, numerals, mist | Sonnet | T42.1 | `blocks.mjs` → `blocks.png/json/meta`, `shared` (mist, numerals, shadow, shimmer, puff, tongue, bulge, birds); `tones()` in `common.mjs` | 20 block frames fit 1024², fog frames built by filter (no runtime blur); numeral glyph 60 ± 2 px tall; 4x close-ups of each region tile read as material | group 2, worktree |
| T42.3 | Props | Sonnet | T42.1 | `props.mjs` → ≥ 40 kinds per section 2 and 1.5, each ≥ 4 solid parts, anchor + zone + height + anim in the meta | sheet fits 1024²; every prop's base at TOP_Z; heights within zone limits; line check 0 | group 2, worktree |
| T42.4 | Frame modules | Sonnet | T42.1 | `frame.mjs` from `board.mjs`: 4 bar modules (56 pitch, 1-unit overlap, edge lines owned by the far/left module), 4 corners, torana, parasol, plates; teak/brass tokens | 52 placed modules show no seam at 4x at factor 4; ticks continue across joints; audit 0 | group 2, worktree |
| T42.5 | Snakes | Sonnet | T42.1 | `snakes/` builder → `snakes-<level>.png/json/meta` per 5.1–5.2, 5.5 | audit 0 per snake; head tops within 5.1 table ± 1; 5.6 items 1–7 pass on the sheet; mouth/neck/pivot points within 0.5 px | group 2, worktree |
| T42.6 | Bridges | Sonnet | T42.1 | `bridges/` builder → `bridges-<level>.png/json/meta` per 6.2–6.5 with per-band segments, `crossed`, `deck` samples | audit 0; 6.5 pairs asserted; `crossed` equals 6.2; Easy sheet ≤ 1024² | group 2, worktree |
| T42.7 | Living board runtime | Sonnet | T42.2, .3, .4, A, B | `src/game/board/LivingBoard.ts`: 144 blocks + frame + props + fog + numerals, depth bands, seed rule, ambient tweens with culling, reveal crossfade, seat plates from `figurines-s`; `BoardScene` integration; old board texture removed | 4-player Hard game plays; `revealAll` shows every prop; ≥ 50 fps with ambient on a 4x CPU-throttled 390 px profile; dev memory log ≤ 48 MB | — |
| T42.8 | Snake runtime | Sonnet | T42.5, T42.7 | `SnakeActor` (rise, idle, strike, swallow, reappear per 5.4), audio `hiss/gulp/pop`, `snake()` shortened | scripted bite on Hard 138 and Easy 37: timings ± 20 ms; token hidden from step 4 to 7; no sprite between head and tail; Fast ≈ 0.5 s | group 3, worktree |
| T42.9 | Bridge runtime | Sonnet | T42.6, T42.7 | `BridgeActor` (rise, segment depths, fade-when-behind, hop-walk, shifted field on top squares, abutment numeral), audio `stone()` | 6.4 rules 2–4 asserted in a test with tokens on 24, 46, 119; vishwamitra crossing 980 ms ± 20; segments fade with a token on 119 | group 3, worktree |
| T42.10 | Integration, Fast, save, cleanup | Sonnet | T42.8, T42.9 | Fast rules everywhere; resume restores reveal; zoom chips wired; reduced motion; delete section 8 items; i18n `ladder` → `bridge` strings (appendix 10); tests updated; T40 amended with pointers to T42 | `npm run verify` green; resume mid-game shows the same fog; no reference to `board-<level>` or `jumps` remains | — |
| T42.11 | Review gate | Sonnet | T42.10 | `docs/review/T42-review.md`: 5.6 checklist on the snake sheet, 4x close-ups (blocks of each region, a bridge joint, a coil, a frame joint), phone profile captures, memory measurement on an iPad and a 390 px phone, native-speaker pass | every row recorded; memory ≤ 48 MB measured | — |

Groups: group 2 (T42.2–T42.6) are five parallel worktrees after T42.1; group 3 (T42.8, T42.9) two worktrees after
T42.7. T42.A and T42.B are already running and are adjusted at T42.7 to the contracts in 4.2 and 7.3.

---

## 10. Owner decisions (with recommendations)

| # | Question | Recommendation |
|---|---|---|
| 1 | Squares 1 and 144 start revealed (gate and throne are known) or fogged like the rest | revealed |
| 2 | Squares under a bridge deck during a crossing: stay fogged, or revealed by the crossing | stay fogged (a bridge is not a hop; the fog under the arch looks right) |
| 3 | Max zoom 2.5 (this budget) or 3.0 (+44 % on fine sheets ≈ +9 MB, over 48 MB) | 2.5 |
| 4 | Page colour behind the card: T40 #F2F2EF or warm linen #EFE6D3 under the teak board | linen; HUD plates then #FBF7EE (one token edit in T40.9) |
| 5 | Lit `s` token textures (8 MB sheet) or a black pedestal ring on the current token (saves 5.3 MB) | textures; fall back to the ring if the device measurement exceeds 44 MB |
| 6 | Second use of a revealed bridge: no animation, or the 120 ms thud | thud |
| 7 | Idle tongue flicks on revealed snakes | yes (all snakes are villains or setbacks) |
| 8 | Birds in the air band (≤ 5 live) | yes |
| 9 | Shabari's bridge is a 15-unit footbridge because 85 and 108 are adjacent squares | accept; the story is in the berry parapet and basket |
| 10 | Speech and UI strings that say "ladder" (`ui.*`, hero lines, Hindi सीढ़ी) → "bridge" / पुल | yes, in T42.10, after a Hindi native check |
| 11 | Reduced motion: also skip the snake strike (show rise → token vanishes → reappears) | yes, keep the three static beats |
