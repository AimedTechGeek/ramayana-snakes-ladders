# T44 — The diorama: a real 3D board, clay heroes, trendy glass UI

Full visual rebuild. Replaces the Phaser presentation (T40 camera/raster, T42 §1–4 sprites and atlases, T43 §2/§5
pre-rendered facings and sheets) with a three.js scene and a DOM/CSS UI. **Kept, untouched:** `src/core` (rules,
boards, dice, events), `sim/`, `src/game/reveal.ts` + `save.ts` (v2), `src/game/iso/locomotion.ts` (pure gait rules),
`src/i18n`, `src/characters/reactions.json` + `reactionMapper.ts` + `reactions.ts`, `src/game/setupModel.ts`.
**Kept as content:** T03 regions, landmarks and the story of every snake and bridge; T42 §2 region lists, §5.5 snake
identities, §5.6 RESPECT rules, §6.3 bridge identities, §7 reveal rules; T43 §3–4 clip tables and movement rules;
T05 timing; T02 RESPECT RULES and T40 §9 bind.

Owner direction this answers (binding): the Chimakes look (soft pastel clay-toy diorama on a periwinkle gradient,
display serif + clean sans, thin dividers with sparkles, outlined pills, glass toggles) for the board and every
screen; Weatherglass detailing for the slab (terrain, soil cross-section, brass and wood); a 3D, mouse-operated board
with **no automatic camera follow**; all four heroes as rigged walking characters with their full iconography (Rama
and Lakshmana carry bow in hand and quiver on the back; Hanuman his gada; Sita lotus and garland; Rama keeps natural
skin); real 3D coiled snakes and arched stone bridges; a trendy UI on every screen.

Units in this document: **1 u = one block pitch**. T42/T43 world values convert at ×1/56 (`CELL` 56 → 1 u). Time in
ms; "Fast" = the Fast toggle. Screen sizes: desktop 1280x720 CSS px, phone landscape 844x390 CSS px.

---

## 1. Art direction

**The look in one line:** *a pastel clay-toy Ramayana road, cut from the earth like a museum terrain model and set on
an oak-and-brass plinth under soft studio light* — Chimakes' softness and typography, Weatherglass' slab and craft.

### 1.1 Palette

| Token | Hex | Use |
|---|---|---|
| `bg-top` / `bg-mid` / `bg-bottom` | #9AA3D9 / #8C96C8 / #7E88BC | page gradient `linear-gradient(165deg, top 0%, mid 55%, bottom 100%)`, every screen |
| `bg-pool` | rgba(214,220,255,.35) → transparent | `radial-gradient(ellipse 60% 40% at 55% 62%)` light pool under the board |
| `oak-top` / `oak-side` | #C9A77E / #B08A5E | plinth, dice tray |
| `brass` | #C9A24A (metalness .9, roughness .35) | rail, corner posts, tray rim, maker's plate |
| `strata-grass` / `-topsoil` / `-loam` / `-stone` / `-bedrock` | #86B468 / #6E4F36 / #9A7250 / #8E8A80 / #5B5652 | soil cross-section bands (2.2) |
| `mist` | #F4F4F8 at .62 | fog blobs |
| `fog-grey` | #CFCCC4 | hidden-block tint target (T42 3.4 kept) |
| `saffron` / `gold` / `blood` / `parchment` | #F39C2B / #E9C12F / #8E3B3B / #F3E3B8 | accents, as T02 |
| `ink` | #2B2F5C | text on white pills, number chips, seat badges (indigo-ink replaces T02 #2A1A0F in the UI; models keep T02 ink for pupils/lines) |
| `text` / `text-2` / `text-3` | #FFFFFF / rgba(255,255,255,.74) / rgba(255,255,255,.56) | text on the gradient and glass |
| `glass` / `glass-strong` | rgba(255,255,255,.16) / rgba(255,255,255,.26) | panels (8.3) |
| `scrim` | rgba(28,31,77,.42) + blur 6 px | behind dialogs |

Region materials (T42 §2 hues lifted ~15 % toward white so they sit on the periwinkle like Chimakes' pastels; the
hue stays so the row bands still read as the story):

| Region | Rows / squares | T42 top | Diorama top (a / b) | Detail colours | Block top height (2.3) |
|---|---|---|---|---|---|
| `mithila` | 1–3 (1–36) | #9CC46B | #A8CF86 / #B3D492 | path #F3E3B8, tufts #8FBE6E, Sarayu edge #78BBD2 | 0.22 |
| `ayodhya` | 4 (37–48) | #E3C98D | #EAD3A3 / #E2C892 | gold inlay #E9C12F, flagstone seams #C9B07A | 0.26 |
| `dandaka` | 5–7 (49–84) | #4F7F3C | r5 #6B9A58 / r6 #5F8D4D / r7 #547F43 (deepening), b = roots #7A5A3A | moss #7FAE6A, hidden eyes #E9C12F | 0.22 ± 0.02 |
| `ganga` | 49, 50, 71–74 | #4E9BB8 | water #78BBD2 (surface), bed #5A8FA6 | foam #F4F4F8, reeds #7FAE6A | 0.16 (water surface 0.17) |
| `kishkindha` | 8–9 (85–108) | #CF975B | #D9AB78 / #D0A06C | crevice #9C6A3E, boulders #B8906A | 0.30 ± 0.04, stepped |
| `sea` | 10 (109–120) | #3F8FB5 | surface #6AAECB, deep #4F93B3 | crests #F4F4F8, rock stacks #8E8A80 | 0.14 (water 0.15) |
| `lanka` | 11–12 (121–144) | #2A2E6B | #4D528F / #454A86 | filigree #E9C12F, banners #8E3B3B, lamps #F39C2B | r11 0.32, r12 0.38 (terraces rising to the throne) |

### 1.2 Material language

| Rule | Value |
|---|---|
| Base material | `MeshStandardMaterial`, roughness 0.88–0.95, metalness 0, **vertex colours** (no albedo textures except 1.4's list); flat where a facet should read, smooth on bodies |
| Bevels | every edge bevelled in Blender: 0.03 u on blocks/plinth, 0.012 u on props, 0.008 u on character parts (the "clay" roundness); no sharp 90° edge anywhere |
| Noise | vertex-colour value jitter ±3 % (Blender noise texture baked to colour attribute) so flat clay never looks like plastic |
| Ambient occlusion | baked in Blender to a second colour attribute (`AO`), multiplied in the shader (`onBeforeCompile`); **no runtime SSAO** |
| Metals | brass/gold: metalness 0.9, roughness 0.35, lit by the environment map only |
| Cloth | roughness 1.0, a 2 % sheen tint toward white on garments (`sheen` 0.2) |
| Water | one custom `ShaderMaterial` (2.5), the only shader besides fog/number-chip patches |
| Glass (UI) | DOM only (8.3); no 3D glass in-game (2.7) |
| Lines | none — the T40/T42 0.6 px outline language is gone; form comes from bevel + AO + light (Chimakes) |

### 1.3 Lighting rig and render settings

| Element | Setting |
|---|---|
| Environment | three `RoomEnvironment` through `PMREMGenerator`, `scene.environment` only (background stays the CSS gradient), `envMapIntensity` 0.55 on all materials |
| Key | `DirectionalLight` #FFF1E0, intensity 2.4, position (8, 14, 6) → target (0, 0, 0); casts shadows; ortho shadow camera ±8.5 x ±8.5, near 1, far 40 |
| Fill | `HemisphereLight` sky #D8DDF5, ground #8C96C8, intensity 0.7 |
| Rim | `DirectionalLight` #E6EBFF, intensity 0.5, position (−9, 7, −7), no shadow |
| Shadows | `PCFSoftShadowMap`, map 2048 desktop / 1024 phone, `bias` −0.0004, `normalBias` 0.03, `radius` 4; casters: heroes, snakes, bridges, landmarks, trees, die; receivers: everything on the slab |
| Contact shadow | drei `ContactShadows` under the plinth: opacity 0.5, scale 18, blur 2.5, far 1.5, resolution 512, `frames={1}` (static pool like Chimakes) |
| Tone mapping | `ACESFilmicToneMapping`, exposure 1.0, `outputColorSpace` sRGB |
| Antialias | MSAA (`gl.antialias: true`), no FXAA pass |
| Post-processing | **none**: no SSAO (AO is baked), no DOF, no bloom pass. Lamp/fire glow = additive billboard sprites (2.6). Phone-safe by construction |
| Background | CSS gradient on `body` + `bg-pool`; canvas `alpha: true`; 48 dust motes (`Points`, 0.012 u, opacity .35, drift 0.05 u/s) over the board, off under reduced motion |
| DPR | `min(devicePixelRatio, 2)` desktop/tablet, `min(dpr, 1.5)` for CSS width ≤ 900; drei `PerformanceMonitor` lowers to 1.25 after 2 s below 42 fps and restores after 5 s above 55 |

---

## 2. The board as a diorama object

### 2.1 Stack of parts (bottom → top)

| Part | Size (u) | Material | Notes |
|---|---|---|---|
| Plinth | 13.6 x 13.6 x 0.45, edge bevel 0.05 | `oak-top` / `oak-side` | a 1.4 x 2.0 ledge extends the front-right edge for the dice tray (7.2); maker's plate (brass, 0.9 x 0.25) centred on the front face, no text (text rule) |
| Brass corner posts | Ø 0.06, height 0.5, ball finial r 0.05 | `brass` | at the 4 plinth corners — the Weatherglass case nod without panes (2.7) |
| Brass rail | tube r 0.025 along the slab's top edge | `brass` | hairline of light around the field |
| Slab (soil section) | 12.6 x 12.6 x 0.90 | strata (2.2) | sits on the plinth; its top is the field plate at z 0 |
| Field plate | 12.6 x 12.6, z 0 | #B8A98A warm stone | the groove bottom seen between blocks; 0.30 u rim strip around the 12 x 12 grid |
| Blocks | 144 x (0.92 x 0.92 top, height per region 1.1), gap 0.08, bevel 0.03 | region material | centres at `x = c − 6.5`, `z = 6.5 − r` (c, r 1-based; row 1 nearest the viewer), tops at the region height |
| Props, landmarks, water, mist, chips | — | — | 2.4–2.6, 3 |

### 2.2 Soil cross-section per side (Weatherglass slab)

Bands from the top, total 0.90 u, modelled as one bevelled mesh with vertex colours and a 0.015 u displacement noise
so the strata read as cut earth, not painted stripes:

| Band | Height (u) | Colour | Per-side variation |
|---|---|---|---|
| Grass lip | 0.06 | `strata-grass` | south (Mithila) side thicker 0.08 with tuft geometry; north (Lanka) side 0.03 and scorched #6F6A66 for the 4 u nearest the throne corner |
| Topsoil | 0.16 | `strata-topsoil` | west/east sides show root tufts (6 per side, 0.05 u) |
| Loam | 0.24 | `strata-loam` | south #A67C52 (rich), north #7D6A58 |
| Stone | 0.30 | `strata-stone` + 40 pebbles/side #6F6A66 | north: volcanic #6D6973 band with 3 ember dots #F39C2B (flicker) |
| Bedrock | 0.14 | `strata-bedrock` | uniform |
| Water lens | — | `ganga` / `sea` water at 0.45 opacity | where Ganga tiles (49, 50 on the west; 74 on the east... per layout) and the sea row (109 west, 120 east) touch an edge, the section shows a translucent water body 0.12 u deep with a sand floor #D9C9A0 — the aquarium cut of Weatherglass' lake |

### 2.3 Block grid, heights and standing field

| Item | Value |
|---|---|
| Block top | 0.92 x 0.92; groove 0.08 (field plate visible); bevel 0.03; top-face vertex noise ±0.01 u height |
| Heights | per region (1.1): mithila 0.22, ayodhya 0.26, dandaka 0.22 ± 0.02 (seed), ganga 0.16, kishkindha 0.30 ± 0.04 in 0.02 steps (rocky), sea 0.14, lanka r11 0.32 / r12 0.38. Water surfaces 0.01 above their block |
| Zones (T42 1.3 ÷ 56) | sill (front strip) z +0.18..+0.50 of the block centre; standing field core x ±0.29, z −0.39..+0.07; side strips x ±0.30..±0.48; back strip z −0.50..−0.39 |
| Fan slots (T42 `FAN_WORLD` ÷ 56) | 1 token: centre of the core; 2: (−0.16, 0), (+0.16, 0); 3: (−0.16, −0.11), (+0.16, −0.11), (0, +0.11); 4: (±0.16, ±0.11); yaw of each token toward the camera's default azimuth |
| Variety | T42 1.3 seed rule unchanged (`seed = (square * 2654435761) >>> 0`): pattern a/b, prop count 1–2, kinds, side, jitter |
| Landmark squares | fixed props (2.5) replace the random second prop |

### 2.4 Props: ≥ 6 kinds per region, low-poly, instanced

One `InstancedMesh` per kind (all kinds share one vertex-colour material → one draw call per kind). Tri budget per
kind in brackets. Height ≤ 0.39 u (22/56) except landmarks.

| Region | Kinds (tris) | Ambient |
|---|---|---|
| mithila | mango-tree (180), rice-stripes (24), sage-hut (140), lamp (60), plough (80), peacock (160), cow (190), path-stone (12), marigold-bush (90) | sway (trees, bush), smoke (hut), flicker (lamp), butterflies ×6 |
| ayodhya | rampart (120), dome (160), chariot (220), lamp (60), banner-saffron (40), dark-tree (160), fountain (150, shimmer) | flicker, sway, shimmer |
| dandaka | sal-tree (200), vine-post (90), hidden-eyes (8, emissive), panchavati-hut (140), rock (60), fern (70), reed (30), mushroom-cluster (50) | sway, flicker (eyes), Jatayu bird |
| ganga | reed (30), lotus-pad (24), boat-post (40), fish-ripple ring (8) | water shader, shimmer |
| kishkindha | boulder (70), cave-mouth (120), waterfall (60 + scrolling strip), banana-plant (110), berry-bush (90), basket (80), monkey-frieze-stone (100), hill (160) | shimmer (waterfall), sway |
| sea | wave-crest (20, shimmer), rock-stack (90), buoy-stone (40), foam-ring (8), shell (40), gull (bird) | water shader, birds |
| lanka | lanka-wall (120), tower-banner (150), arrow-stack (60), fire (sprite + 30), broken-banner (90), gold-lamp (70), terrace-step (24), crow (bird), dais (144) | flicker, smoke, birds |

Props of hidden blocks are present but scaled to 0 (instance matrix), so reveal needs no re-upload beyond the matrix.

### 2.5 Landmarks (T03 §2, T42 1.5), modelled individually (≤ 1,200 tris each)

| Square | Landmark | Build notes | Respect |
|---|---|---|---|
| 1 | **Ayodhya gate** (torana): two posts 0.6 tall, lintel, mango garland, two lamps, a parchment road strip from the rim to the block | the gate stands on the rim strip south of block 1; the block's standing field is free | a gate, not a shrine (T40 §9 #8) |
| 24 / 36 / 30 | sage hut with smoke / Janaka's palace silhouette (0.5 tall) / plough | side strips | — |
| 48, 47 / 45 / 42 / 37–40 | ramparts / dome / chariot / dark trees | row 4 runs right→left (T03) | — |
| 66 / 77 | Panchavati hut / Jatayu circling (air, one bird on a 14 s loop over rows 6–8 at height 1.2) | — | — |
| 85 / 90 / 96 / 97 | Shabari's basket + berry bush / cave mouth / waterfall into the Shabari bridge's side / Rishyamukha hill | waterfall: 0.08 x 0.4 strip, UV scroll 0.6 u/s, foam sprites at the foot | — |
| 109–120 | sea row: Rama Setu stones are the bridge (6) | — | — |
| 121, 132 / 125, 129 / 123, 131 / 134, 136 / 137 | Lanka walls / towers with blood banners / arrow stacks / fires / broken ten-crown banner (ten crown marks on torn cloth, not heads) | fires = 4-frame additive sprite 0.18 u + 3 ember particles | no ten heads anywhere (T42 5.6 #2) |
| 144 | **Coronation**: dais ring (0.08 tall, gold trim) covering the block, an empty throne (0.42 tall, gold with saffron cushion) at the back strip, the **chhatra** (parasol, r 0.35, pole 0.95) planted on the rim corner behind 144 so its canopy centre sits over the throne back, 0.42 u behind the standing field centre | a token on 144 stands in front of the throne and is **not under the canopy** (no nimbus reading, T40 §9 #3); no lamps or offerings on the dais | the winner is lit by the saffron ground ring (4.7), never by the parasol |

### 2.6 Ambient life (cheap, culled, reduced-motion aware)

| Kind | Implementation | Count / cost |
|---|---|---|
| Sway | vertex shader patch on the prop material: `pos.xz += sin(time*w + phase) * amp * (pos.y / height)`; `amp` 0.015 u, `w` 2.4–3.5 rad/s by instance id | 0 draw calls extra |
| Flicker | emissive intensity 0.75–1.0 random 80–140 ms steps on the shared "flame" material + additive glow sprite (0.14 u, #F39C2B at .35) | lamps ≤ 24, fires 2 |
| Smoke | 3 emitters (24, 66, Lanka fires) x 4 sprites, rise 0.3 u over 1.6 s, alpha .4 → 0 | 1 `Points` draw |
| Water | shader: 2-octave sine normal wobble (amp 0.004 u, 0.8 and 1.3 Hz), Fresnel tint toward #F4F4F8, foam mask from vertex alpha at block edges; shared by Ganga, sea, fountain, water lenses | 2 draw calls |
| Birds | ≤ 5: Jatayu (row 7), gull (row 10), crows (row 12), parrots (row 2); 2-bone flap at 6 Hz in a 16-frame clip; fly a row-band loop in 14 s | 1 instanced mesh |
| Butterflies | 6 over Mithila: 2 quads each, wing flap in the vertex shader (8 Hz), figure-8 drift r 0.3 u | 1 instanced mesh |
| Dust motes | 48 `Points` over the board (1.3) | 1 draw |
| Rules | ambient runs only for revealed blocks inside the camera frustum + 1 block; list rebuilt on camera settle and every 250 ms; `prefers-reduced-motion`: sway/flicker/smoke/birds/butterflies/motes off, water static normals |

### 2.7 Glass case decision

**No panes.** A full case would add a translucent, screen-filling surface (overdraw and haze on phones) and complicate
tap raycasts. The case idea survives as the four brass corner posts, the rail and the plinth (2.1). The title screen
may show a static glass lid (one plane, Fresnel-only material) because nothing is tapped there — owner decision 13.1.

### 2.8 Square numbers: pinned label chips

| Item | Value |
|---|---|
| What | one `InstancedMesh` of 144 quads with a **camera-facing (billboard) vertex shader**: each chip is a tiny parchment label with the number, like a sign pinned at the block's front-left corner |
| Atlas | 1024 x 1024 WebP, 12 x 12 cells (85 px), rounded parchment chip #F3E3B8 with a 1 px shadow and the number in Poppins 600, `ink` #2B2F5C; one atlas for both fogged and revealed states (a label is a label) |
| Size | 0.26 x 0.17 u at scale 1; `scale = clamp(distance / 10, 1.0, 2.5)` keeps digits ≥ 12 px tall at 1280x720 from Fit down to Focus, and ≥ 10 px on the phone at distance ≤ 12 u; anchor 0.10 u above the corner, 0.05 u inside the block |
| Readability at any orbit | billboards are always upright and facing the camera, so azimuth is unclamped (9); `renderOrder` after mist, `depthTest` on, `depthWrite` off |
| On bridge top squares | the chip moves to the front-right corner (the abutment owns the sill) |
| Exact source | the seat card's square badge (8.5) is still the authoritative readout; tapping or hovering a block shows a DOM label `ui.square` for 1.5 s (8.5 "block label") |

---

## 3. Fog of war in 3D

Rules unchanged (T42 §7, `reveal.ts`): terrain revealed when passed or landed on, snakes/bridges only on landing
through `Bitten`/`Laddered`, permanent, saved in v2, squares 1 and 144 start revealed.

| Thing | Hidden | Revealed | Transition (normal / Fast) |
|---|---|---|---|
| Block | shader attribute `aFog` = 1: vertex colour mixed 70 % toward `fog-grey` and desaturated (luma mix 0.7); AO kept | `aFog` 0 | 420 / 120 ms ease-out on the attribute (per instance) |
| Mist | 3 low-poly blobs (icosphere subdiv 1, 80 tris, r 0.22–0.30 by seed) per block hovering 0.15 u over the top, `mist` material (transparent .62, `depthWrite` false), drift ±0.02 u over 6 s | gone | blobs scale 1 → 1.35 and opacity .62 → 0 over 420 / 120 ms `Quad.easeOut` via attribute `aReveal`; then scale 0 |
| Props | instance scale 0 | scale 1 | pop 0 → 1.06 → 1.0 over 260 ms, stagger 40 ms (Fast: no stagger) |
| Water | static, grey-tinted | shader on | normal wobble fades in over 420 ms |
| Ambient | off | on (culled) | starts after the pop |
| Number chip | visible | visible | none (3.4) |
| Snake / bridge | not in the scene (GLB not even requested until needed; preloaded in idle time after the board is ready) | rise clip (5.4 / 6.4) | — |
| Sound | — | `audio.reveal()` on landing on a hidden square only (T42 7.4) | — |

Counts: 432 mist instances in one draw; 14 block instanced meshes carry `aFog` in an `InstancedBufferAttribute`
(144 floats each, updated in place). Resume from save: every state applied at frame 0, no animation.

---

## 4. Characters

### 4.1 Shared rig (`tools/blender/rig.py`), ≤ 32 bones, ≤ 4 weights per vertex

| Group | Bones | Notes |
|---|---|---|
| Core (6) | `root`, `hips`, `spine`, `chest`, `neck`, `head` | `root` on the ground = the anchor; `hips` at 0.44 u (24.5/56) |
| Arms (8) | `shoulder.L/R`, `upperArm.L/R`, `foreArm.L/R`, `hand.L/R` | |
| Legs (8) | `thigh.L/R`, `shin.L/R`, `foot.L/R`, `toe.L/R` | `foot` sole at 0 |
| Sockets (3) | `prop.R`, `prop.L`, `back` | bow / gada / lotus; quiver on `back` |
| Cloth (2) | `cloth.01`, `cloth.02` | dhoti/sari front panel swing (secondary motion baked in clips) |
| Hero extras | Hanuman `tail.01–04` (+4 = 31); Sita `braid.01–02` (+2 = 29); Rama/Lakshmana `quiver.strap` (+1 = 28) | all ≤ 32 |

### 4.2 Proportions (T43 1.1 ÷ 56; stylised-dignified, "cute-heroic", not chibi)

| Measure | u | Note |
|---|---|---|
| Height, sole → crown finial | 1.43 | 1.55 blocks wide; T43 figure/cell ratio kept so the hero towers over a block and every snake head |
| Head sphere r / heads tall | 0.129 / 4.7 | |
| Shoulders | ±0.104 at 0.875; shoulder top 0.92 | above every snake head top (≤ 0.75) |
| Hips / knees / ankles | 0.44 / 0.24 / 0.064 | |
| Footprint at rest | 0.18 x 0.09 (two soles) | fits a fan slot |
| Tri budget | ≤ 4,500 incl. props and face; Hanuman ≤ 5,000 (tail, gada) | one skinned mesh + one face quad = 2 draw calls per hero |
| Face | a 6-frame expression atlas (idle, blink, happy, excited, scared, sad; 1024 x 192 WebP per hero) on a curved face patch, UV offset per frame; eyes/brows/mouth per T02 §4 geometry redrawn as soft painted features | no geometry morphs; blink every 3–5 s at idle |

### 4.3 Per-hero design (all details present in every clip and from every angle)

| Hero | Skin / fur | Hair & head | Garments | Hand props | Back | Jewellery & marks | Colour identity |
|---|---|---|---|---|---|---|---|
| **Rama** | natural warm wheat #E8B58C (owner decision; no blue skin) | dark top-knot (jata) under a **kirita-mukuta** crown: gold band + 3 tiers + saffron jewel, 0.16 tall | yellow-gold dhoti (pitambara) #E9C12F with saffron border, pleated front panel on `cloth.*`; **blue uttariya** #3F6FC2 over the left shoulder, knotted at the right hip | **Kodanda bow** in the left hand (`prop.L`): 1.10 u tall, gold limbs, ink grip wrap, string; held upright at rest, angled 20° forward when walking | **quiver** on `back`: leather #7A5A3A tube 0.42 long, gold rim, 5 arrows with parchment fletching and gold tips, strap over the right shoulder | gold armlets, necklace with one pendant, earrings, anklets; saffron tilak (vertical) | blue garment + gold dhoti + crown + bow; seat colour `ramaAccent` #3F6FC2 |
| **Sita** | fair #F2C29B | long braid over the left shoulder (`braid.01–02`), gold ties, jasmine dots (parchment); thin gold tiara | rose sari #D15587 with gold border, pallu over the left shoulder swinging on `cloth.*`; saffron blouse | **lotus** in the right hand (#D15587 petals, leaf stem), raised to the chest when happy | none | **marigold garland** (saffron beads, 0.6 u loop) over the shoulders, nose ring, bangles x4, anklets | rose + saffron + garland; seat colour `sitaAccent` #D15587 |
| **Lakshmana** | golden fair #F0B57C | dark top-knot, **saffron headband**, no crown | emerald dhoti #2E9E6B with gold border; saffron sash across the chest | **shorter bow** in the right hand (`prop.R`): 0.90 u, gold limbs | **quiver** on `back` as Rama's (strap over the left shoulder), 5 arrows | one armlet, plain anklets | emerald + saffron headband; seat colour `lakshmanaAccent` #2E9E6B |
| **Hanuman** | fur #F0A96B, muzzle and ruff parchment #F3E3B8 | round face, wide muzzle, big ears (discs r 0.054), gold crown (band + tiers + finial) | saffron loincloth with gold hem; sash and belt #E4572E | **gada** in the right hand: dark-wood shaft #5A3A1E 0.39 long, gold knurled head, gold collars; shouldered at rest | none | gold armlets, anklets; **sindoor** lozenge on the forehead #E4572E; sacred thread | **tail** (`tail.01–04`), r 0.023, tuft #E4572E, S-curl to 1.12 u at rest; seat colour `hanumanAccent` #E4572E |

### 4.4 Respect checklist (T40 §9 + T43 §7 items 13–21, plus 3D)

| # | Check | Pass condition |
|---|---|---|
| R1 | Rama and Sita posture | upright in every frame of every clip: lean ≤ 8°, no knee bend beyond 60° in the air, never kneel, crouch, cover the face, cross arms or slump; head above hips always |
| R2 | Rama and Sita faces | `scared` = idle brows (concern); no sweat, tears or sparkles; `excited` is a raised-hand blessing with a small bound, not a jump-and-tuck |
| R3 | Rama and Sita gait | `run` = "swift stride" (shoulder swing ≤ 25°, elbows ≤ 60°, lean ≤ 8°); `leap` = "bound" (no tuck, no spin, arms low); T05 tween bans (somersault, slump, cower, stomp, fidget, shake) map to allowed clips (4.6) |
| R4 | Lakshmana and Hanuman comedy | full T43 amplitudes; cower = hands over eyes; no somersault on the board (win cheer may spin only on the Win screen, 8.12) |
| R5 | Weapons | bow and gada never pointed at a snake, a token or the camera; the bow stays upright or forward-low; arrows never leave the quiver |
| R6 | No halo reading | the lit marker is a ground ring (4.7); no disc, ring, parasol or glow behind any head; the chhatra at 144 is never over a token (2.5) |
| R7 | Iconography present | every clip, every angle: Rama bow + quiver + crown + blue garment + tilak; Sita lotus + garland + braid + tiara; Lakshmana bow + quiver + headband; Hanuman gada + tail + sindoor + ears + crown |
| R8 | Camera | polar clamp 78° means no view from below any figure; min distance 6 u |
| R9 | Heroes above villains | shoulder top 0.92 > every snake head top ≤ 0.75; the strike dips, never rises over a hero |
| R10 | Colour restraint | only the materials above; the seat colour appears on cloth, never as skin |
| R11 | Native-speaker pass | the four turntables (idle, walk, 5 emotions) and the Hard board join the T44.16 review |

### 4.5 Clip list (24 fps in Blender, exported as glTF animations; one GLB per hero)

| Clip | Frames | Seconds | Loop | Drive | Notes |
|---|---|---|---|---|---|
| `idle` | 48 | 2.00 | yes | time | breath, weight shift ≤ 0.01 u, tail/braid/garland sway; blink via the face atlas |
| `walk` | 24 | 1.00 | yes | **distance**: phase = (d mod 0.571) / 0.571 | one cycle = 2 steps = 0.571 u (T43 32/56); contacts at frames 0 and 12 |
| `run` | 16 | 0.667 | yes | distance: cycle 1.0 u (T43 56/56) | contacts at frames 0 and 8; Rama/Sita "stride" variant (R3) |
| `leap` | 22 | 0.917 | no | time: anticipation 4 f / takeoff 2 f / air 10 f (stretched to the flight time) / land 6 f | T43 beats 160 / 80 / flight / 120 (Fast 60 / 40 / flight / 60) |
| `happy` | 36 | 1.50 | hold last pose | time | Rama blesses, Sita raises the lotus, Lakshmana raises the bow, Hanuman shoulders the gada high |
| `excited` | 36 | 1.50 | hold | time | Rama/Sita: raised-hand blessing + small bound; Lakshmana: bow-raise and stomp; Hanuman: hop + gada twirl |
| `scared` | 30 | 1.25 | hold | time | Rama/Sita: step back, hand to chest (concern); Lakshmana: shake; Hanuman: hands over eyes, tail round the shins (T43) |
| `sad` | 36 | 1.50 | hold | time | Rama/Sita: slow sigh, head dip 6°; Lakshmana: stomp + arms crossed; Hanuman: droop, tail on the ground |
| `cheer` | 60 | 2.50 | yes | time | Win-screen loop per T05 `win`: Rama bless, Sita clap, Lakshmana leap, Hanuman somersault (Win screen only) |
| swallowed | — | — | — | — | `scared` pose, then the whole figure scales to 0.1 toward the mouth point (T42 5.4 step 4) |
| reappear | — | — | — | — | `idle` frame 0, scale 0.1 → 1 `Back.easeOut` 260 ms + dust |
| Crossfades | `AnimationMixer.crossFadeTo` 150 ms between any two clips; walk ↔ run never (one gait per move) | | | | |

Total per hero ≈ 340 keyframed frames at 28–31 bones → ≈ 180 KB of animation before compression; the GLB budget
(10) is 380 KB meshopt.

### 4.6 Movement on the board (reuses `locomotion.ts` unchanged; the view multiplies its units by 1/56)

| Rule | Value |
|---|---|
| Path | `pathOf(fieldCentres(Moved.path), finalSlot)` — the polyline through every square centre incl. bounce-back squares, fan slot blended over the last 20 units (0.357 u) |
| Gait | `gaitFor(n, fast)`: n ≤ 2 **walk** 1.43 u/s; n ≥ 3 **run** 5.0 u/s; Fast: run 10 u/s; durations by `durationOf` (1 sq 820 ms, 2 sq 1,520, 3 sq 700, 6 sq 1,300; Fast 100 ms/sq) |
| Phase | `phaseAt(distanceAt(u))` drives `mixer.setTime(phase * clipDuration)` — the clip never free-runs during a move, so feet do not slide (net drift 0 per cycle, T43) |
| Facing | `facingOf(dir, prev)` still picks the axis; the 3D yaw turns smoothly toward the path tangent: slerp with a 120 ms time constant, so a row-end bend is a 90° turn across the square centre; rest yaw = toward the default camera azimuth (+22°, the "SW" of T43) |
| Arrival | last 16 units ease out (`distanceAt`), 60 ms squash (scale y .94, xz 1.03), crossfade to idle or the pending emotion |
| Reveal | `onPass(square)` callback when `d` passes each centre → the view starts that block's reveal (3) |
| Entry from the seat | the token appears on square `n` of the first move via a 360 ms arc from the rim strip in front of row 1 (replaces the HUD → board arc), idle pose, 100 ms squash |
| Triple six | `slideBack`: idle pose, lean −6°, straight glide 500 ms (Fast 250) to the restored square, dust on landing; no steps, no celebration |
| Bridges / snakes | 6.5 / 5.4 |
| Re-fan | 80 ms slide (Fast 40) |
| Reduced motion | glide at 5 u/s in idle, no yaw animation (snap), bridges: appear at the top, snakes: three static beats (T42 decision 11) |
| T05 tween → clip | `bounce, clap, nod, bless, salute → happy`; `leap, somersault, stomp(positive) → excited`; `cower, shake → scared`; `slump, sigh, fidget, stomp(negative) → sad`; `none → idle`; intensity → clip weight `0.5 + 0.5·i` blended over idle; Rama/Sita always resolve to their restrained variants (R3) |

### 4.7 Current-player highlight

| Element | Spec |
|---|---|
| Ground ring | saffron ring decal r 0.26 u, width 0.03, under the active token's feet, pulsing alpha 0.4–1.0 at 1.2 s (static .8 under reduced motion); follows the token during its move |
| Seat card | active card gets the `saffron` 2 px ring and the lit glow (8.5) |
| Emote | on a reaction, a 0.22 u billboard glyph (inline-SVG-rendered sprite: heart, sparkle, drop, exclamation) pops 0.35 u above the head for 1.2 s so the board shows who is reacting; the speech bubble stays on the seat card (8.5) |

---

## 5. Snakes

### 5.1 The 13 snakes by level (`boardFor(level).snakes`)

| Level | Snakes |
|---|---|
| Easy (6) | manthara 37→19, kaikeyi 46→28, shurpanakha 64→47, golden-deer 70→56, abduction 76→55, indrajit-arrows 114→96 |
| Medium (9) | Easy + tataka 17→6, kabandha 82→68, kumbhakarna 124→106 |
| Hard (13) | Medium + viradha 58→40, prahasta 120→110, brahmastra 130→119, ravana 138→78 |

### 5.2 Coiled build (`tools/blender/snakes.py`, parametric per id)

| Part | Spec |
|---|---|
| Body curve | helix: ground spiral from r_h inward to r_h − 0.09 u (fills the centre: no post, T42 5.6 #4), then 2.5 stacked turns rising 2R per turn, radius r_h → r_h − 0.036 at the top; bevel = body radius R; tail tapers to 0.45 R over 0.18 u and ends at the coil's front-right |
| Neck + head | S-curve from the top turn's collar up 0.25–0.29 u to the head; head = lathe profile (T42 N2) scaled by R, two eye dots, closed mouth seam; **jaw** = lower third, hinged (bone `jaw`) |
| Rig | `coil` (root), `neck.01–05`, `head`, `jaw`, `tongue` = 9 bones; the coil is unskinned (static), the neck chain is skinned |
| Pattern | bands / spots / diamonds painted as vertex colours by a geometry-nodes pass; belly = body 40 % toward blood on the underside normal |
| Bulge | an ellipsoid 1.6 R x 1.2 R, body colour, parented to the snake; animated along `neck.05 → neck.01` positions during swallow (visible as a lump under the skin), then scale → 0 |
| Tongue | forked, 2.4 R long, body 40 % toward blood; scale 0 → 1 → 0 (70 / 90 / 70 ms) every 3–6 s at idle |
| Sizes (T42 5.1 ÷ 56) | R 0.039 (manthara, brahmastra) · 0.046–0.054 (nine) · 0.061 (kumbhakarna) · 0.071 (ravana); coil outer r 0.18 / 0.205 / 0.22 / 0.25; head top 0.52 / 0.59–0.61 / 0.64 / 0.75 over the block top |
| Placement | coil centre at (cx, cz − 0.25) of the head block (back strip + far half of the field); the token lands at the field centre in front; the raised head sits back-left |
| Tris | ≤ 2,200 (ravana ≤ 3,200); 1 draw call each; shadows cast |

### 5.3 Story identity per snake (T42 5.5 kept; props now real meshes beside the coil)

| id | Body | Pattern | Head motif | Prop beside the coil |
|---|---|---|---|---|
| tataka | #457334 | bands pitch 6R | drooping hair tangle (5 strands, never up or flared) | broken stump |
| manthara | #1C1F4D, gold rings | diamonds | shawl collar on the neck (3 fold ribs) | tiny whisper scroll |
| kaikeyi | #7B3B6E | spots | two gold bangles on the neck | palace window slab with a drawn curtain |
| viradha | #A4703E | bands + bristle dots | none | club lying on the block |
| shurpanakha | #8E3B3B | bands | gold nose ring | 3 saffron nail-mark slabs |
| golden-deer | #E9C12F | parchment spots | deer mask with two 3-point antlers; blood band at the mask edge | none |
| abduction | #783431 | spots | nothing on or behind the head | wooden cart wheel **lying flat** at the coil's front-right; 3 Jatayu feathers |
| kabandha | #457334 | bands | headless: stout cap with two eyes on its front; two arm tubes ending in hands | none |
| indrajit-arrows | #3A3F9E | braided diamonds | two-loop bow-knot at the neck | 3 arrows stuck in the block |
| prahasta | #C98B4B, gold scallop edges | bands pitch 5R | helmet crest fin along the head's axis (a fin, never a disc) | shield leaning on the coil |
| kumbhakarna | #A6723E | bands pitch 8R | closed eyes (arcs); slow −4° nod in idle | drum with two bands |
| brahmastra | #F39C2B, gold chevrons | twisted diamonds | arrowhead head profile | none |
| ravana | #1C1F4D with gold diamond scales | diamonds + bands pitch 10R | **one head** with a 3-tier angular rakshasa crown (octagonal steps, horn finials), red eyes | broken ten-crown banner (pole 0.32, torn pennant with ten tiny crown marks in a row) + a mace on the block |

### 5.4 Clips (24 fps) and choreography (T42 5.4 timings kept)

| Clip | Frames / ms (Fast) | What |
|---|---|---|
| `hidden` | pose | scale 0 at the ground anchor; the GLB is loaded lazily on first `Bitten` for that id (preloaded in idle time) |
| `rise` | 9 f / 380 (120) | coil scale y 0 → 1 `Back.easeOut` (overshoot 1.08); head follows 120 ms later, rising 0.18 u with opacity; `audio.hiss()` |
| `idle` | 72 f / 3,000 loop | head sway ±3° about the collar, coil breath scale x 1.00–1.015; tongue flicks at runtime; kumbhakarna nods |
| `strike` | 4 f / 180 (90) | head rotates −18° and translates 0.18 u toward the field centre, `Quad.easeIn`; `jaw` 0 → 25° at 60 ms; `audio.snake()` 180 ms |
| `swallow` | 8 f / 320 (150) | token: position → mouth point, scale 1 → 0.1, opacity → 0 over the last 80 ms; jaw closes at 200 ms; bulge travels neck.05 → neck.01 over 360 ms and fades; camera **does not move** (owner); `audio.gulp()` |
| `settle` | 5 f / 220 (0) | back to idle pose `Sine.easeOut` |
| reappear | 260 (120) | at the tail square's field centre + fan slot: dust (6 motes), token scale 0.1 → 1 `Back.easeOut`; `audio.pop()`; tail block revealed |
| Hold before strike | 260 (0) | head turns to face the token (160 ms), one tongue flick; bystander reactions start (T05) |
| Total | ≈ 2.1 s first time, 1.7 s revealed; Fast ≈ 0.5 s | no body, trail or line between head and tail, ever |

### 5.5 RESPECT (T42 5.6 binds, restated for 3D)

| # | Rule | Enforcement in the build/review |
|---|---|---|
| 1 | No hood, no canopy, nothing flared or fanned behind or above a head | head is a lathe; the build asserts no vertex behind the head plane wider than 1.3 R |
| 2 | One head per snake | ravana = crown + banner + gold scales; indrajit = one braided body |
| 3 | No disc, ring or halo behind a head | abduction's wheel lies flat beside the coil; the review renders each snake from the default camera and checks the silhouette behind the head |
| 4 | No post inside the coil | ground spiral fills the centre |
| 5 | No devotional marks | no tilak, garland, lotus seat, conch, discus on any snake or prop |
| 6 | Heroes above villains | head tops ≤ 0.75 < shoulder 0.92; the strike dips |
| 7 | No fangs at the viewer | the open mouth is a dark interior; no teeth, venom, blood |
| 8 | Comedy stays with Hanuman and Lakshmana | the bitten hero's emotion is T05's; the snake shows no mockery pose |
| 9 | Native-speaker pass | 13 turntables (closed and open mouth) in the T44.16 review |

---

## 6. Bridges

### 6.1 By level (T42 6.1): Easy 9, Medium 7 (no guha, sugriva), Hard 6 (vishwamitra, wedding, shabari, hanuman-meeting, hanuman-leap, rama-setu).

### 6.2 Construction (`tools/blender/bridges.py`, parametric from the 9 (foot, top) pairs)

| Item | Value (T42 6.2 ÷ 56) |
|---|---|
| Foot abutment | on the foot block's back strip: 0.25 wide x 0.21 deep x 0.054 tall, bevel 0.01 |
| Top abutment | on the top block's sill: 0.25 x 0.29 x 0.054; the chip moves to the other corner (2.8) |
| Deck route | straight from F = (cx_f, cz_f − 0.375) to T = (cx_t, cz_t + 0.357); `rama-setu` and `shiva-bow` bow 0.21 u toward −z at mid-span |
| Deck height | `y(s) = blockTop + 0.054 + h·sin(π s / L)`, `h = min(0.39, 0.125 + 0.08 L)` (u) |
| Arches | `n = max(1, round(L / 0.80))` semicircular openings between piers; pier = 0.14 x 0.14 base plate + 0.11 shaft + cap |
| Deck | 0.25 wide, 0.045 thick, flagstone seams every 0.14 u (vertex-colour lines); parapets 0.018 wide x 0.045 tall with posts every 0.29 |
| Per bridge (L u, h u, openings) | vishwamitra 3.25 / 0.39 / 4 · shiva-bow 1.61 / 0.25 / 2 · wedding 2.38 / 0.32 / 3 · guha 1.61 / 0.25 / 2 · shabari 0.27 / 0.14 / 1 · hanuman-meeting 1.61 / 0.25 / 2 · sugriva 2.38 / 0.32 / 3 · hanuman-leap 2.27 / 0.30 / 3 · rama-setu 2.38 (+ bow) / 0.32 / 3 |
| Tris | ≤ 3,000 each; one GLB per bridge; 1 draw call (2 for rama-setu's slabs + water foam) |
| Audit | T42 6.5 pairs re-asserted in the build (wedding deck over kaikeyi's coil clearance ≥ 0.125 u; rama-setu bow clears indrajit's coil on 114; no bridge overlaps another) |

### 6.3 Story identity (T42 6.3 kept)

| id | Stone | Parapet | Foot ornament | Top ornament |
|---|---|---|---|---|
| vishwamitra | granite #8E8A80 | timber rails lashed with cord collars | kamandalu pot | bowstring tied across the last two posts |
| shiva-bow | sandstone #D9BE82 | two bow halves (gold) with string segments | — | burst star on the abutment |
| wedding | rose marble #E8B9CB | posts with saffron marigold swags | garland loop | two crown discs on the end posts |
| guha | river-stone #8FA3A8 | oar rails, rope ties | boat-prow piers | — |
| shabari | mossy stone #7F8A5F | vine rails with blood berries and leaves | basket | — |
| hanuman-meeting | ochre #C98B4B | rope rails with fur collars | tiny mace | tail-curl finial with tuft |
| sugriva | ochre #CF975B | pillar posts with clasped-hands medallions | — | crown disc with two ear cylinders |
| hanuman-leap | sea-stone #658DA2 | wave rails (sine ±0.03 u); wave-crest piers | — | tuft finials fanning ±35° |
| rama-setu | sea-stone #8AA0A6 | low stone blocks; **deck = stepping slabs 0.29 x 0.20 with 0.036 gaps**, each with a ring mark | squirrel footprint pair | — |

### 6.4 Rise animation (first reveal; T42 6.6)

| Step | Normal | Fast |
|---|---|---|
| Segments rise | each pier+arch+deck chunk (one per opening, foot → top) from y − 0.25, scale y 0.9 → 1, `Back.easeOut` 360 ms, stagger 70 ms (≤ 570 total); dust puff at each pier base; `audio.stone()` 3 thuds; **no camera shake** (the camera is the player's) | 120, no stagger |
| Already revealed | 120 ms scale 1.0 → 1.03 → 1.0 thud | same |
| Fade-when-behind | while a token rests on a square under the deck (T42 `crossed`), the bridge material opacity → 0.35 over 150 ms (`transparent` toggled on only then) | same |

### 6.5 Crossing (T43 §4 kept)

| Phase | Normal | Fast |
|---|---|---|
| Step on | `leap` 0.25 u from the field centre onto the foot abutment: 160 + 80 + 180 + 120 ms, apex +0.14 u | 60 + 40 + 80 + 60 |
| Cross | **run** along the deck curve `s` 0 → L at 5.0 u/s, `y = deck(s)`, yaw = route tangent; `distanceAt` ramps | 10 u/s |
| Step off | `leap` 0.25 u down to the top block's field centre + fan slot, land → idle | halved |
| Short bridges (L < 0.5 u: shabari) | one leap foot → top abutment | — |
| `hanuman-leap` 95 → 122 | **Hanuman only**: one leap foot abutment → top abutment, anticipation 200, flight 700 on a parabola with apex = deck apex + 0.25 u, land 120; the other heroes run the deck | 80 / 250 / 60 |
| Top revealed | top block reveal + gold burst (12 sparks) + re-fan 80 ms; `audio.ladder()` 300 ms | 120 |
| Totals | vishwamitra 1.73 s, guha 1.40, shabari 0.54 | 0.81 / 0.64 / 0.24 |

---

## 7. Dice

| Item | Spec |
|---|---|
| Die | cube 0.42 u, edge bevel 0.06 (rounded clay-wood), pale boxwood #E3CDA4 with grain vertex noise; pips inlaid `brass` #C9A24A r 0.045; the six face's pips saffron #F39C2B (T02 "a 6 reads as special"); 420 tris, casts a shadow |
| Tray | 1.6 x 1.2 x 0.12 u teak (`oak`) with a brass rim and a pastel-indigo felt #4A4F8C floor, on the plinth's front-right ledge (2.1), inside the default framing (9.2) |
| Roll | 3 baked tumble clips (24 f = 1.0 s each; Fast plays at 2.5x = 0.4 s): the die drops from 0.5 u, bounces twice (contacts at frames 6, 12, 18 → `audio.dice()` ticks), slides 0.3 u and stops; the clip is chosen by `(value + turn) mod 3`; the final orientation is corrected over the last 6 frames by a quaternion blend so the rolled `value` faces up (verified by a unit test on the face-normal table) |
| Idle | enabled for a human: a 1.2 s gentle bob (y ±0.01) and the saffron ring under the tray pulses; bots: no bob, the HUD hint says who is rolling |
| Tap | raycast on a 1.8 x 1.4 u box over the tray (tap = pointer down→up ≤ 300 ms and ≤ 8 CSS px, 9.1); also the **Roll** pill (8.5), `Space`/`Enter` |
| Result | the HUD pill shows the value as a pip glyph for the turn; a 6 adds a gold ring pulse on the tray |
| Reduced motion | the die snaps to the result with a 120 ms fade |

---

## 8. UI system (DOM/CSS, React)

### 8.1 Type pair (OFL, self-hosted woff2, Latin + Devanagari in the same files — no per-language fallback)

| Role | Font | Weights | Files (subset Latin + Devanagari) | Use |
|---|---|---|---|---|
| Display serif | **Rozha One** (ITF, OFL) | 400 | ≈ 95 KB | the title word on Boot/Win (Chimakes' "Chisato" moment) |
| Headline serif | **Eczar** (Rosetta, OFL) | 500, 600 | ≈ 70 KB each | section headings, turn banner, dialog titles, hero names |
| Body / UI sans | **Poppins** (ITF, OFL) | 400, 500, 600 | ≈ 55 KB each | everything else, number-chip atlas, bubbles |
| Fallbacks | `Georgia, "Noto Serif Devanagari", serif` / `system-ui, "Noto Sans Devanagari", sans-serif` | | | `font-display: swap`; Rozha One + Poppins 500 preloaded |
| Ornament | ✦ (U+2726) is **inline SVG** (4-point star, 10 px), never a font glyph | | | dividers, list bullets |

Type scale (desktop 1280x720 → phone 844x390), line-height 1.2 display / 1.45 body, letter-spacing −0.01em on display:

| Style | Desktop | Phone |
|---|---|---|
| `display` (Rozha One) | 64 | 40 |
| `h1` (Eczar 600) | 36 | 24 |
| `h2` (Eczar 500) | 24 | 18 |
| `body` (Poppins 400) | 16 | 14 |
| `label` (Poppins 500) | 13, +0.04em, uppercase optional | 12 |
| `caption` (Poppins 400) | 12 | 11 (minimum anywhere) |

Spacing scale 4 / 8 / 12 / 16 / 24 / 32 / 48; radii: pill 999, card 16, dialog 20, bubble 14; hit areas ≥ 44 x 44
(touch) with ≥ 8 px gaps.

### 8.2 Layout principle

Title screen = Chimakes hero: text and pills sit **directly on the gradient**, no panel; the 3D board is the hero
object in the centre-right. In-game = light pastel glass panels floating over the 3D scene, icons in rows, hairline
dividers with a ✦ at the end.

### 8.3 Glass styles

| Style | CSS |
|---|---|
| `glass` | `background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.42); backdrop-filter: blur(14px) saturate(1.4); border-radius: 16px; box-shadow: 0 10px 30px rgba(38,44,102,.18), inset 0 1px 0 rgba(255,255,255,.5)` |
| `glass-strong` | as `glass` with `background: rgba(255,255,255,.26)`; dialogs, active seat card |
| `pill-outline` | height 44 (phone 40), padding 0 20, `border: 1px solid rgba(255,255,255,.75)`, text `text` 15/500; hover `rgba(255,255,255,.14)`, active `.22`, 120 ms; trailing arrow icon slides 3 px on hover |
| `pill-primary` | `background: #FFFFFF; color: #2B2F5C`, hover #F4F5FF, shadow 0 6px 18px rgba(38,44,102,.22); Play, Start, Roll, Resume |
| `pill-icon` | 44 x 44 round glass, 20 px icon; the HUD toolbar |
| `toggle` | track 56 x 30 `glass`, knob 24 white with the state icon inside (sun/moon style like Chimakes); on = knob right + saffron track tint .35 |
| `divider` | 1 px `rgba(255,255,255,.45)` line, 160–240 px, ✦ at the right end |
| `scrim` | `rgba(28,31,77,.42)` + `backdrop-filter: blur(6px)` |
| Focus ring | 2 px `saffron`, offset 2 px (keyboard only) |

### 8.4 Icons (inline SVG, 20 px, stroke 1.6, round caps; one sprite sheet `icons.svg` with `<symbol>`s)

dice, roll (die with motion lines), speaker, speaker-off, fast (double chevron), normal (single chevron), menu
(three lines), close, fit (four corners), focus (crosshair with a dot), globe (language), person, robot, seat-empty
(dashed circle), arrow-right, arrow-left, chevron-left/right, rotate-phone, trophy, sparkle (✦), heart, drop, bolt,
exclamation, play, pause, gallery (grid).

### 8.5 Components

| Component | Spec |
|---|---|
| Seat card | `glass` 240 x 72 (phone 200 x 48): hero portrait disc 48 (phone 36; 2D render of the hero's `idle` head from Blender, 5-emotion PNG set 96 px swapped on reactions), name (Eczar 500 18), square badge (pill 44 x 22, `ink` on parchment; gate icon before the first move, laurel + rank after), controller tag (person/robot + difficulty, caption). Active: `glass-strong`, 2 px saffron ring, 0 0 24px rgba(243,156,43,.35) glow, portrait bounces per T05 tween (CSS transform, amplitudes ÷ 2) |
| Turn banner | centred pill `glass` with a 10 px hero-colour dot + `ui.yourTurn` (Eczar 500 20 / 16); hint line below in `text-2` 13 |
| Roll pill | `pill-primary` 160 x 48 with the roll icon or the last value as pips; disabled = 55 % opacity; pulses scale 1.0–1.03 at 1 s when enabled |
| Toolbar | right column of `pill-icon`s: Fit, Focus, Fast toggle, Mute toggle, Language, Menu — each with a `label` caption under it on desktop, icon-only on phone |
| Speech bubble | white glass (`rgba(255,255,255,.92)`, `ink` text Poppins 500 14 / 13), radius 14, tail toward the speaker's portrait, max 2 lines, 40 % width cap; pop-in 120 ms scale .9→1, out 150 ms; `bubbleMs` 1800 (Fast 1200) as T05 |
| Block label | `glass` chip `ui.square` near the pointer for 1.5 s on block tap/hover (2.8) |
| Toast | bottom-centre `glass` 320 x 44, 3 s: `ui.tripleSix`, save failures, "reduced motion on" |
| Dialog | `glass-strong` 420 wide (phone 360), radius 20, padding 24, title `h2`, divider, rows of toggles/segments, pill buttons right-aligned; enter scale .96→1 + fade 200 ms, exit 120 ms |
| Segmented control | pill group `glass`, selected segment white with `ink` text; `ui.human/bot/empty`, `ui.easy/medium/hard`, EN/हिंदी |
| Emote (3D) | 4.7 |

Motion defaults: enter 180 ms `cubic-bezier(.2,.8,.2,1)`, exit 120 ms ease-in; hover 120 ms; `prefers-reduced-motion`
→ all 0 ms except fades ≤ 120 ms.

### 8.6 Screens

Flow (T04 §1 kept): Loading → Boot (Play / Resume + New Game) → Setup → Board → Win (Play Again / Play On / Menu);
Pause dialog from Menu or `Esc`; Rotate overlay in portrait; `#gallery` opens the Gallery.

**Loading** — gradient, `display` title centred, a 240 px divider whose ✦ travels left→right with progress (asset
bytes), caption `text-2` with the loading stage. Phone: title 40, divider 160.

**Boot / title** (the 3D board sits centre-right, slowly turning 2°/s, polar 52°; still under reduced motion):

```
1280x720                                                    844x390
+--------------------------------------------------------+   +--------------------------------------------+
| ✦ Ramayana ✦                             [EN|हिं] [((o)]|   | ✦ Ramayana ✦                   [EN|हिं] [o]|
|                                                        |   |                                            |
|   Snakes & Ladders            (3D board, azimuth 22°)  |   |  Ramayana           (3D board)   ✦ 2–4     |
|   र ा म ा य ण   <- display 64        ....  ...   ....   |   |  <- display 40                   ✦ EN/हिं  |
|   ─────────────✦                      .  board  .      |   |  ────✦                           ✦ 3 levels|
|   A living board from Ayodhya           ...  ...  ..   |   |  [ Play -> ]  [ New Game ]                 |
|   to Lanka. Walk, leap, beware.                        |   |                                            |
|   [ Play -> ]   [ New Game ]      ✦ 2–4 players        |   +--------------------------------------------+
|                                   ✦ English · हिंदी    |
|                                   ✦ Easy · Medium · Hard|
+--------------------------------------------------------+
```
Rects (desktop): title block x 128–520, y 180–560; `display` at y 236; divider y 318; body y 350 (2 lines);
pills y 430 (Play 160 x 48, New Game outline 150 x 48, gap 16); feature rows at x 1096, y 300/360/420 (icon disc 36 +
label/caption). Resume variant: Play → `ui.resume`, second pill `ui.newGame`. Mute toggle top-right (56 x 30);
language segment beside it.

**Setup** (board in the background, dimmed by a 20 % scrim, no interaction):

```
1280x720                                                    844x390
+--------------------------------------------------------+   +--------------------------------------------+
| [<- Menu]        Choose your heroes        [EN|हिं] [o] |   | [<]  Heroes                 [EN|हिं] [o]    |
|                                                        |   | +--------+ +--------+ +--------+ +--------+|
| +----------+ +----------+ +----------+ +----------+    |   | |Seat 1  | |Seat 2  | |Seat 3  | |Seat 4  ||
| | Seat 1   | | Seat 2   | | Seat 3   | | Seat 4   |    |   | |[H|B|E] | |[H|B|E] | |[H|B|E] | |[H|B|E] ||
| |[Hum|Bot|E]|[Hum|Bot|E]|[Hum|Bot|E]|[Hum|Bot|E]|    |   | | <(o)>  | | <(o)>  | | <(o)>  | | <(o)>  ||
| |   <  o >  |   <  o >  |   <  o >  |   <  o >  |    |   | | Rama   | | Hanuman| | —      | | —      ||
| |  (portrait)| (portrait)| (portrait)| (portrait)|    |   | | [name] | | [name] | |        | |        ||
| |  Rama     |  Hanuman  |  Lakshmana|  Sita     |    |   | +--------+ +--------+ +--------+ +--------+|
| |  [name   ]|  [name   ]|  [name   ]|  [name   ]|    |   | (robot) [Easy|Medium|Hard]   [ Start Game ->]|
| +----------+ +----------+ +----------+ +----------+    |   +--------------------------------------------+
| (robot) [ Easy | Medium | Hard ]           [ Start Game -> ]
+--------------------------------------------------------+
```
Desktop: cards 272 x 420 at x 64 + 296k, y 120; portrait disc 160 (3D turntable of the hero's `idle` in a tiny
R3F view **only on desktop**; phone uses the 2D portrait); phone cards 196 x 232 at x 16 + 206k, y 72. Empty seats
dim to 60 % and grey the portrait (T04). Hero uniqueness swap with a 200 ms cross-slide (T04). `ui.start` disabled
below 2 seats.

**Board / HUD**:

```
1280x720                                                    844x390
+--------------------------------------------------------+   +--------------------------------------------+
| ✦ Ramayana      [ (o) Hanuman's turn · roll! ]   [fit] |   |[R 47][H 23]  [ Hanuman's turn ]   [fit][foc]|
| +----------+                                     [foc] |   |[L  —][S  9]                       [>>] [spk]|
| |(o) Rama  47|                                    [>>] |   |                                   [menu]    |
| +----------+        (3D board, mouse-operated)   [spk] |   |          (3D board)                        |
| |(o) Hanu  23|                                   [EN]  |   |                                            |
| +----------+                                     [menu]|   |                                            |
| |(o) Laks   —|                                         |   |                                            |
| +----------+   (bubble: "Six! Watch me hop!")          |   |   (bubble)                     [ Roll ]    |
| |(o) Sita   9|                               [ Roll ]  |   +--------------------------------------------+
+--------------------------------------------------------+
```
Desktop: seat cards at x 24, y 88 + 84j (240 x 72); turn banner centred at y 24 (max 520 wide); toolbar x 1212,
y 88 + 56i; Roll pill bottom-right (1096, 648, 160 x 48); bubbles anchor to the speaking card's right edge. Phone:
seat cards shrink to 2 x 2 chips (96 x 40) top-left; toolbar icons 40 px top-right in two rows; Roll pill (700, 330,
128 x 44); the 3D tray stays visible at Fit. The 3D viewport is the whole window; UI never blocks the board centre.

**Pause dialog** (`ui.menu` / `Esc`): scrim + dialog 420 x 360 centred: title `ui.menu`, divider, rows `ui.speed`
[Normal | Fast], `ui.mute` toggle, language segment, camera row [Fit] [Focus]; buttons `ui.resume` (primary),
`ui.newGame` (outline). Phone: 360 x 300, rows 40 tall.

**Resume prompt** = Boot with the two-pill variant (T04).

**Win** (board stays, dimmed 30 %; the winner on 144 plays `cheer`):

```
+--------------------------------------------------------+
|                 ✦  {name} reaches Ayodhya's throne!  ✦  |  <- h1 Eczar 600 36, centred, y 96
|                        ───────✦                        |
|   (o) 1st Rama     (o) 2nd Hanuman   (o) Lakshmana   (o) Sita   <- row of seat cards with rank badges, y 180
|                                                        |
|        [ Play Again -> ]   [ Play On ]   [ Menu ]      |  <- y 640, primary / outline / outline
+--------------------------------------------------------+
```
Gold confetti: 120 `Points` in 3D over rows 11–12 for 3 s (T03). Phone: h1 24 at y 40, cards 160 x 44 at y 110,
pills at y 330. `ui.playOn` hidden when fewer than 2 unranked players remain.

**Gallery** (`#gallery`): gradient, title, a 4 x 6 grid of 3D turntables (one shared R3F canvas, 24 views of the
heroes' idle + 5 emotions at 160 px), language toggle; used for the respect review.

**Rotate prompt** (portrait): full-screen gradient, rotate-phone icon 120 px animating 90° every 2 s, `ui.rotate`
in `h2`; pauses the controller clock.

### 8.7 New i18n keys (English given; Hindi in T44.15 after a native check)

`ui.loading` "Loading…", `ui.focus` "Focus player", `ui.language` "Language", `ui.chooseHeroes` "Choose your
heroes", `ui.difficulty` "Difficulty", `ui.players` "2–4 players", `ui.normal` "Normal", `ui.tagline` "A living board
from Ayodhya to Lanka.", `ui.reducedMotion` "Reduced motion is on", `ui.gallery` "Gallery", `ui.rolls` "{name} rolls…".
Existing `ui.*` keys (34) are reused unchanged; the T42 decision 10 "ladder → bridge" wording change is carried out in
T44.15.

---

## 9. Camera

### 9.1 Controls (drei `CameraControls` = camera-controls; **no follow, ever**)

| Input | Action | Limits |
|---|---|---|
| Left drag / one finger | orbit | polar 17°–78° from zenith (`minPolarAngle` 0.30 rad, `maxPolarAngle` 1.36 rad: never below the slab's soil band); azimuth free |
| Wheel / pinch | dolly toward the cursor (`dollyToCursor` true) | distance 6–28 u (phone 6–30); `dollySpeed` 0.8 |
| Right drag / two-finger drag | pan (truck) | target bounded to Box3 (−5, −0.5, −5)…(5, 2.5, 5), `boundaryFriction` 0.1; `truckSpeed` 1.6 |
| Damping | `smoothTime` 0.28 s, `draggingSmoothTime` 0.10 s | |
| Tap vs drag | pointer down→up within 300 ms and 8 CSS px = tap → raycast (die/tray, blocks for the label); otherwise the gesture belongs to the camera | |
| Keyboard | `0` Fit, `F` Focus, arrows orbit 5°, `+`/`−` dolly x1.2 | |
| Rotate overlay / pause | controls disabled, state frozen | |

### 9.2 Framing

| Pose | Values (desktop fov 35° vertical; phone fov 38°) |
|---|---|
| Default = Fit | target (0, 0.35, 0.4); polar 52° (elevation 38°), azimuth +22° (a Chimakes three-quarter); distance from `fitToBox(plinthBox, true, { paddingTop: 0.6, paddingBottom: 0.2, paddingLeft: 0.4, paddingRight: 0.4 })` ≈ 19 u at 1280x720, ≈ 17 u at 844x390 (vertical-fit bound in both); the dice tray and the gate are in frame |
| Fit button | `fitToBox` from the current azimuth, polar reset to 52°, 600 ms (Fast 300); also resets pan |
| Focus player | `setLookAt` → target = current token's feet + (0, 0.5, 0), distance 7 u, polar 55°, azimuth unchanged, 600 ms; **only when pressed**; disabled before the first move |
| Game start / resume | Fit, instantly |
| Reaching 144 / Win | no camera move; the Win screen dims the board |
| Title screen | Fit pose + auto-rotate 2°/s (azimuth only), stops on first interaction and under reduced motion |
| Reduced motion | all camera transitions 0 ms (snap); damping off (`smoothTime` 0) |

Scale at Fit on desktop: 1 u ≈ 60 px (a block ≈ 55 px, a hero ≈ 86 px tall); at Focus: 1 u ≈ 163 px.

---

## 10. Performance budgets

Targets: phone landscape 844x390 CSS on a mid-range 2022 phone (Snapdragon 7-class / A14) **≥ 45 fps** sustained
during a 6-square run with 3 revealed snakes and 2 bridges in view; desktop ≥ 60 fps. Headless device script
threshold stays 24 fps (headless rAF caps near 30); the real-device number is read from `__app.metrics()` over USB
debugging and recorded in the review.

| Budget | Phone | Desktop |
|---|---|---|
| Draw calls, main pass | ≤ 150 (expected ≈ 130: plinth/slab/rail 4, blocks 14, water 2, mist 1, chips 1, props ≤ 50, landmarks 16, snakes ≤ 13, bridges ≤ 9, heroes 8, FX 9, die + tray 2, contact shadow 1) | ≤ 180 |
| Draw calls, shadow pass | ≤ 50 (heroes 8, revealed snakes/bridges ≤ 22, trees 6, landmarks 16, die 1) | ≤ 60 |
| Triangles on screen | ≤ 350 k (expected ≈ 290 k: blocks 9 k, props ≈ 135 k, landmarks 40 k, snakes 29 k, bridges 27 k, heroes 18 k, mist 35 k) | ≤ 500 k |
| Skinned meshes | ≤ 4 heroes + ≤ 13 snakes + 1 bird set; bones ≤ 32 per rig; 4 weights | same |
| Textures | ≤ 8 MB GPU: number atlas 1024², 4 face atlases 1024 x 192, water noise 256², fire/smoke sprites 256², portraits 2048² (DOM, not GPU) | same |
| Shadow map | 1024² | 2048² |
| DPR cap | 1.5 (→ 1.25 under load) | 2 |
| Frame time budget | 22 ms total: CPU ≤ 6 ms (mixers, reveal attribute updates, culling), GPU ≤ 14 ms | — |

Download (brotli, first load; everything else lazy):

| Asset | Budget | Notes |
|---|---|---|
| JS: three (tree-shaken) + R3F + drei (CameraControls, ContactShadows, useGLTF, useAnimations, PerformanceMonitor) + React + app | ≤ 380 KB | meshopt decoder ≈ 30 KB included; **no Draco** (300 KB wasm) |
| Fonts (6 files, Latin + Devanagari) | ≤ 420 KB | 8.1 |
| Board GLB (plinth, slab, rail, posts, field plate, 14 block variants, tray, die) | ≤ 300 KB | vertex colours, no textures |
| Props pack GLB (≈ 50 kinds) | ≤ 450 KB | one GLB, instanced at runtime |
| Landmarks GLB | ≤ 400 KB | lazy after the board is ready |
| Hero GLB x 4 (mesh + rig + 9 clips) | ≤ 380 KB each (1.5 MB; only seated heroes load) | face atlas ≤ 60 KB each extra |
| Snake GLB x 13 | ≤ 70 KB each (ravana ≤ 110) | lazy on first reveal, preloaded in idle time |
| Bridge GLB x 9 | ≤ 60 KB each | lazy, as snakes |
| Textures (atlas, sprites, noise) | ≤ 250 KB WebP | |
| Portraits (4 heroes x 6 PNG 96 px) + icons.svg | ≤ 120 KB | |
| **First interactive** (JS + fonts + board + props + 2 heroes + atlas) | **≤ 2.6 MB** | measured by the smoke script from the performance entries |
| **Total, 4 heroes, Hard, everything revealed** | **≤ 6.0 MB** | |

Rules: every prop kind is one `InstancedMesh`; per-instance attributes only `aFog` (float) and `aReveal` (float);
instanced meshes have `frustumCulled = false` (bounding sphere = board); GLBs pass through `gltfpack -cc -kn -km -tc`
(meshopt, keep node names and materials); vertex-colour quantisation 8-bit; no texture larger than 1024²; `useGLTF.preload`
for lazy sets after `requestIdleCallback`; the dev overlay prints `renderer.info` and fails the smoke test above budget.

---

## 11. Architecture contract

### 11.1 Modules

| Layer | Path | Depends on | Tested with |
|---|---|---|---|
| Core (kept) | `src/core/*` | — | existing tests, `sim/` |
| Turn logic (**extracted from `BoardScene.play/animate/react/afterEvents`**) | `src/game/turn/TurnController.ts` | core, `reveal.ts`, `save.ts`, `reactionMapper.ts`, `reactions.ts`, `i18n`, `BoardView`, `GameStore`; **no three, no React, no DOM** | Vitest with `FakeBoardView` |
| Store (UI state) | `src/game/turn/store.ts` (zustand, vanilla store + React hook) | — | Vitest |
| 3D view | `src/view3d/` (`DioramaView.tsx` implements `BoardView`, `Board.tsx`, `Hero.tsx`, `Snake.tsx`, `Bridge.tsx`, `Die.tsx`, `Fog.tsx`, `Camera.tsx`, `useAssets.ts`) | three, R3F, drei, `locomotion.ts` (×1/56) | Playwright smoke/devices/screenshots |
| UI | `src/ui/` (screens, components, `icons.svg`, `tokens.css`) | React, store, i18n | Playwright + screenshots |
| App | `src/main.tsx`: fonts → locale → store → `<App/>`; installs `window.__app` | | |
| Art tools | `tools/blender/*.py` (common, rig, heroes, snakes, bridges, board, props), `tools/build-assets.mjs` (runs Blender headless then `gltfpack`), `tools/portraits.py` | Blender 5.2 at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` | `tests/assets3d.test.ts` on the GLB manifests (bone counts, clip names, tri/byte budgets) |

### 11.2 `BoardView` (what the controller drives; every method resolves when its animation is done)

```ts
export interface BoardView {
  load(level: Level, players: readonly PlayerState[]): Promise<void>;        // assets for the seated heroes + board
  restore(state: GameState, reveal: RevealState): void;                       // final state, no animation (resume)
  startTurn(player: number): void;                                            // lit ring, yaw to rest, HUD via store
  rollDie(value: number, fast: boolean): Promise<void>;
  walk(player: number, path: readonly number[], opts: { fast: boolean; revealing: ReadonlySet<number> }): Promise<void>;
  cross(player: number, jump: Jump, opts: { fast: boolean; firstTime: boolean; revealTop: boolean }): Promise<void>;
  bite(player: number, jump: Jump, opts: { fast: boolean; firstTime: boolean; revealTail: boolean }): Promise<void>;
  slideBack(player: number, to: number, fast: boolean): Promise<void>;        // TripleSixVoid
  react(seat: number, reaction: Reaction, fast: boolean): Promise<void>;      // clip + emote; bubbles are store/DOM
  win(player: number, rank: number, fast: boolean): Promise<void>;            // cheer loop + confetti
  gameOver(ranking: readonly number[]): void;
  setReducedMotion(on: boolean): void;
  camera: { fit(animate: boolean): void; focusPlayer(player: number): void };
  dispose(): void;
}
```

Controller → store (DOM reads): `screen`, `players`, `current`, `busy`, `banner`, `hint`, `dieValue`, `dieEnabled`,
`bubbles[seat] = { line, intensity, until }`, `fast`, `muted`, `locale`, `reducedMotion`, `toast`, `canContinue`.
The controller keeps BoardScene's behaviour: `play(events)` applies `applyEvent(reveal, event)` first, publishes to
the store, starts `react()` (T05 staggers via `reactionMapper`) without blocking movement, awaits the view, waits for
reactions only on `Won`/`GameOver`; `afterEvents()` saves (`saveGame(state, reveal)`), schedules bots
(`botDelayMs` 1000 / Fast 400), enables the die for humans, clears the save on game over.

### 11.3 Test hooks — `window.__app` (replaces `window.__game`; minimal and stable)

```ts
export interface AppTestApi {
  readonly version: 1;
  readonly ready: boolean;                                   // fonts settled + first frame drawn (was registry 'ready')
  readonly screen: 'loading' | 'boot' | 'setup' | 'board' | 'win' | 'gallery' | 'rotate';
  readonly boardReady: boolean;                              // assets loaded + controller begun (was 'board-ready')
  readonly busy: boolean;                                    // was board.isBusy
  fast: boolean;                                             // was board.fastMode (get/set)
  startGame(config: GameConfig, opts?: { seed?: number }): Promise<void>;   // Setup → Board without clicks
  requestRoll(): Promise<void>;                              // human turn; resolves after the turn's animations
  continuePlay(): Promise<void>;
  state(): GameState;                                        // was board.snapshot()
  reveal(): RevealState;
  revealAll(): void;                                         // dev only
  setLocale(locale: 'en' | 'hi'): void;
  camera: { fit(): void; focus(): void; set(pose: { azimuth: number; polar: number; distance: number }): void; get(): { azimuth: number; polar: number; distance: number } };
  metrics(): { fps: number; drawCalls: number; triangles: number; textureMb: number; bytesLoaded: number };
}
```

Script ports: `smoke.mjs` waits for `__app.ready`, clicks `[data-testid="play"]` and `[data-testid="start"]`, then
drives `__app.requestRoll()`; `devices.mjs` uses `__app.startGame` + `__app.metrics().fps` and asserts
`screen === 'rotate'` in portrait; `screenshots.mjs` uses `camera.set` for deterministic poses. `data-testid`s:
`play`, `resume`, `new-game`, `start`, `roll`, `fit`, `focus`, `fast`, `mute`, `menu`, `seat-{n}`, `lang`.

---

## 12. Task split (dependency order; one commit each; `npm run verify` green plus the stated checks)

Model rule: **Opus** for foundation/integration/pipeline, **Sonnet** for art builders and screens, **Haiku** only for
mechanical moves. "Worktree" = runs in parallel with the others in its group.

| # | Task | Model | Depends | Deliverable | Acceptance |
|---|---|---|---|---|---|
| T44.1 | **Foundation** (in progress, A) | Opus | — | Vite + React + R3F + drei; `TurnController` extracted from `BoardScene` with `BoardView` + store (11.2); `window.__app` (11.3); placeholder `BoardView` (boxes + cylinders); `smoke/devices/screenshots` ported; Phaser left in place but unused by the new entry | a 4-bot Hard game plays to Win through the placeholder in Fast ≤ 60 s; controller tests with `FakeBoardView`: event order, bot delay, save after every turn, `Won` awaits reactions, v2 resume; `npm run smoke` green on `__app` |
| T44.2 | **Blender spike** (in progress, B) | Opus | — | `tools/blender/common.py` (clay material, bevel, AO + noise bake to colour attributes, glTF export) + `rig.py` (4.1) + `hanuman_spike.py` → `public/models/hanuman.glb` with `idle` + `walk`; `tools/build-assets.mjs` (headless Blender → gltfpack meshopt); `useAssets.ts` loader with meshopt | GLB ≤ 400 KB; ≤ 32 bones; idle and walk play via `useAnimations`; `tests/assets3d.test.ts` reads the manifest |
| T44.3 | Board diorama | Sonnet | 1, 2 | `board.py` (plinth, strata, rail, posts, field plate, 14 block variants, tray, die mesh), `Board.tsx`, `Fog.tsx` (blocks `aFog`, mist, chips + atlas), water shader, lighting rig (1.3), `Camera.tsx` (9) | 144 blocks at the region heights; fog reveal 420 ms; chips readable (2.8 sizes); camera clamps asserted in a unit test; ≤ 25 draw calls for the bare board | worktree |
| T44.4 | Props, landmarks, ambient | Sonnet | 1, 2 | `props.py` (≥ 50 kinds, 2.4), `landmarks.py` (2.5), instancing + seed placement, ambient (2.6) with culling and reduced motion | every kind within its tri budget; seed rule test identical to T42's; ambient off under reduced motion; props pack ≤ 450 KB | worktree |
| T44.5 | Hanuman complete | Sonnet | 2 | `heroes/hanuman.py` on the shared rig: all 4.3 details, 9 clips (4.5), face atlas, portraits; `Hero.tsx` clip player driven by `locomotion.ts` (4.6), lit ring, emote | turntable renders; R4–R10 ticked; walk/run phase-locked (foot drift ≤ 0.01 u per cycle in a test on sampled bone positions); GLB ≤ 380 KB | worktree |
| T44.6 | UI system and screens | Sonnet | 1 | `tokens.css`, fonts (8.1), `icons.svg`, components (8.5), screens (8.6) on the store, rotate overlay, loading | screenshots at 1280x720 and 844x390 for every screen; hit areas ≥ 44; both locales; keyboard flow; `data-testid`s present | worktree |
| T44.7 | Dice | Sonnet | 3 | `Die.tsx`, 3 tumble clips, orientation correction, tap raycast, Roll pill wiring | unit test: every value lands face-up for all 3 clips; tap-vs-drag test; Fast 0.4 s | worktree |
| T44.8 | **Integration 1 → LOOK CHECKPOINT** | Opus | 3, 4, 5, 6, 7 | `DioramaView.tsx` implements `BoardView` end to end with Hanuman on the board (others as placeholder figures), bridges/snakes still placeholders; owner review pack `docs/review/T44-look.md`: 8 captures (Fit desktop, Fit phone, Focus on a Hanuman walk, Kishkindha close-up, fog mid-reveal, title screen, Setup, HUD with a bubble) | **owner sign-off on the look** before any of 9–13 starts; ≥ 45 fps on the phone profile with the board, props and Hanuman |
| T44.9 | Rama | Sonnet | 8 | `heroes/rama.py`: crown, blue uttariya, bow, quiver, 9 clips with R1–R3 restraint | R-checklist; GLB ≤ 380 KB | worktree |
| T44.10 | Sita | Sonnet | 8 | `heroes/sita.py`: braid bones, sari, lotus, garland, 9 clips | R-checklist | worktree |
| T44.11 | Lakshmana | Sonnet | 8 | `heroes/lakshmana.py`: headband, shorter bow, quiver, full-amplitude clips | R-checklist | worktree |
| T44.12 | Snakes | Sonnet | 8 | `snakes.py` (5.2–5.3) → 13 GLBs; `Snake.tsx` (5.4) with lazy load | 5.5 items 1–7 asserted on the turntables; bite timings ± 20 ms; token hidden between swallow and reappear; no geometry between head and tail | worktree |
| T44.13 | Bridges | Sonnet | 8 | `bridges.py` (6.2–6.3) → 9 GLBs; `Bridge.tsx` (6.4–6.5) | T42 6.5 pairs asserted; vishwamitra crossing 1,730 ms ± 30; fade-when-behind with a token on 119 | worktree |
| T44.14 | **Integration 2, performance, cleanup** | Opus | 9–13 | all heroes/snakes/bridges wired; lazy loading + idle preload; `PerformanceMonitor` DPR policy; budgets (10) enforced in smoke; **Phaser, `src/game/iso/*` (except `locomotion.ts`), `src/game/board/*`, `scripts/art/iso/*`, `public/assets/iso/*` deleted**; `global.d.ts` → `__app` | `npm run verify` green; `devices` ≥ 24 fps headless on all 5 profiles; real phone ≥ 45 fps recorded; total download ≤ 6.0 MB; no `phaser` in `package.json` |
| T44.15 | Strings and Hindi | Haiku | 14 | new `ui.*` keys (8.7) in `en.json`/`hi.json`, ladder → bridge wording (T42 decision 10), `tests/i18n.test.ts` key parity | parity test green; Hindi reviewed by a native speaker (noted in the commit) |
| T44.16 | Review gate | Sonnet | 15 | `docs/review/T44-review.md`: R1–R11 and 5.5 tables with turntable captures, phone and desktop captures of every screen in both locales, measured fps/draw calls/bytes, native-speaker pass | every row recorded; owner sign-off |

Groups: **group A** (T44.1 and T44.2, running now); **group B** (T44.3–T44.7, five worktrees after A); **T44.8 →
LOOK CHECKPOINT**; **group C** (T44.9–T44.13, five worktrees after sign-off); then T44.14 → 15 → 16.

---

## 13. Owner decisions (short, with recommendations)

| # | Question | Recommendation |
|---|---|---|
| 1 | Glass case: none (brass posts + rail only), or a static glass lid on the title screen only | **none in-game**; a title-only lid is optional polish after T44.8 |
| 2 | Orbit azimuth: free 360° (number chips are billboards, always upright) or clamped ±70° around the front | **free** |
| 3 | Lanka: pastel indigo (#4D528F, lamps glowing) or a true night (#2A2E6B) that breaks the pastel palette | **pastel indigo** |
| 4 | Rama and Sita run and leap (restrained "stride" and "bound" variants) as the owner asked, superseding T43 decision 1 (walk only) | **run and leap with the R3 restraints** |
| 5 | Speech bubbles on the seat cards (stable, readable) plus a small emote glyph above the token, vs bubbles anchored to the 3D head | **seat card + emote** |
| 6 | Title screen slow auto-rotate (2°/s, stops on interaction, off under reduced motion) — the in-game camera never moves by itself | **yes, title only** |
| 7 | Die on a 3D tray (tap) plus the Roll pill, vs a DOM-only die | **tray + pill** |
| 8 | Fonts: Rozha One (display) + Eczar (headline) + Poppins (UI), all OFL with Devanagari | **accept** |
| 9 | Setup portraits as live 3D turntables on desktop (one extra canvas) vs 2D renders everywhere | **3D on desktop, 2D on phone** |
| 10 | Phone DPR cap 1.5 with a drop to 1.25 under load, vs 2 | **1.5** |
| 11 | Seat colours stay the T02 accents on cloth (Rama's is the blue garment, not skin) | **accept** |
| 12 | Hanuman's win somersault: Win screen only (T43 #14 keeps it off the board) | **Win screen only** |
| 13 | Delete Phaser and the iso/atlas pipeline in T44.14, or keep a legacy route for a release | **delete** (the 2D look is superseded; git history keeps it) |
| 14 | Hindi `तुम`/`आप` register (open since T30) | decide in T44.15 with the native speaker; recommend `आप` for Rama and Sita, `तुम` for Lakshmana and Hanuman |
