# T43 — Walking Hanuman: a character, not a statue

Amendment to `T40-anatomy.md` section 4 (figurines) and `T42-living-board.md` (where silent, T42 holds; T02 RESPECT
RULES and T40 section 9 bind). Owner feedback this answers (binding): *"Hanuman character (anatomy) must also walk or run
with legs, not as a statue."* Earlier direction kept: the anatomy craft (lathe/sphere/tube parts, four-tone shading,
0.6-unit lines, every part on another part, audit to zero) is the BASE; go beyond it for colour and life.

Units: world units as T40 (`CELL` 56, `TOP_Z` 2.4, `k` 0.7621 logical px per unit at zoom 1; z 0.490 px/unit;
depth 0.584 px/unit). Follow zoom 2.0, max 2.5, DPR cap 2 (T42 section 4). Hanuman only: Rama, Sita and Lakshmana stay
medallions on the board for now (section 9, decision 1).

What is wrong today (contact sheet `scratchpad/hanuman/shots/sheet.png`, in-game `t4210/level-hard-mid.png`): a white
turned-wood figurine on a lathe pedestal with a seat-colour band, legs as two fixed dowels, one pose per emotion, the
token hopping 56 units in 120 ms with a landing squash. Everything else on the board is in full colour.

---

## 1. Character, not statue

### 1.1 Decisions

| # | Decision | Value |
|---|---|---|
| 1 | Pedestal | gone (S1–S6 of T40 4.1 deleted). Hanuman stands on his own two feet on the tile; his footprint is the two soles (10 x 5 units at rest). The halo under the pedestal becomes the token shadow (`shared:shadow`, T40 section 5) |
| 2 | Height | `FIG_H` 80 kept: sole to crown finial. Head r 7.2 (14.4 of 80 = 4.7 heads to the crown band: T02 "cute-heroic"). Hip height 24.5 (31 %), shoulders ±5.8 at z 49 |
| 3 | Vs a block | 39.2 px tall at zoom 1 vs a tile top 45.5 px tall (59.4 wide); 78 vs 91 px at follow zoom; 98 vs 114 at 2.5. Shoulders at z 51.4 world stay above every snake head top (≤ 42 over TOP_Z, T42 5.6 item 6) |
| 4 | Vs other tokens | medallions stay 28 px (zoom 1); Hanuman's shoulder line is at 25 px, so a medallion never hides his face on a shared square; fan slots (`FAN_WORLD`) unchanged |
| 5 | Construction | articulated kit character: every joint is a seated ball (`meta: { seated, cut }`, the T40 build's `JOINTS` allow-list extended with hip, knee, ankle, toe); limbs are dowels between balls; cloth and torso are lathes; tail and sash are tubes; crown and mace are lathes with rings. Still rendered by `createFigure` at the board camera |
| 6 | Colour | full colour via T42's `tones(hex)` (top = hex, shade-3 +12 % white, shade-1 −12 % ink, shade-0 −26 % ink, lines = hex 55 % toward ink). The seat colour #E4572E survives as the **sash and the belt**; the T40 seat band is gone |
| 7 | Lit | no lit textures (section 5). The current player's token gets `shared:lit-ring` under the feet (section 6); the seat plate keeps its 1.5 px `lit` outline |
| 8 | Iconography (T02, T40 9.4) | mace (gada), tail, sindoor, ears, muzzle, crown (kiritamukuta), armlets, anklets: all present in every frame and facing |

### 1.2 Palette (materials → `tones(hex)`)

| Material | Hex | Parts |
|---|---|---|
| fur / skin | #F0A96B | head, muzzle base, torso, arms, legs, feet, tail, ruff (ruff and muzzle front lightened: #F3E3B8 parchment) |
| saffron | #F39C2B | loincloth |
| gold | #E9C12F | hem band, armlets, anklets, belt knot, crown (band, tiers, rings, finial), mace head, grip collars, mace finial |
| seat colour | #E4572E | sash, belt, tail tuft, sindoor lozenge |
| dark wood | #5A3A1E | mace shaft and butt |
| ink | #2A1A0F | pupils, eye and brow lines, mouth line (as `hi` lines today, now ink) |
| lines | material hex 55 % toward ink | every outline and seam (T42 section 2 rule) |

### 1.3 Rest skeleton (local frame: `t` forward = facing direction, `l` to the character's right, `u` up; origin = the
root's ground point = midpoint between the ankles at rest). Positions `(l, t, u)`.

| Joint / part | Position (rest) | Primitive | Notes |
|---|---|---|---|
| Root (pelvis centre) | (0, 0, 25) | — | the anchor is its ground projection (0, 0, 0) |
| Hip L/R | (∓3.0, 0, 24.5) | ball r 2.2 (seated in the loincloth) | hip pitch rotates thigh + everything below |
| Thigh | hip → knee | dowel r 2.0, length 11 | |
| Knee L/R | (∓3.0, 0, 13.5) | ball r 2.1 | replaces T40 knee beads |
| Shin | knee → ankle | dowel r 1.7, length 9.9 | |
| Ankle L/R | (∓3.0, 0, 3.6) | ball r 1.9 | anklet ring r 2.3/2.0, z 3.9..4.7, gold |
| Foot | (∓3.0, −1.4..3.4, 1.8) | dowel r 1.8 along `t`, toe ball r 1.8 seated at the front | sole at z 0 |
| Loincloth | z 22..31 | lathe `[[22,5.4],[23,5.8,1],[27,5.0,1],[31,4.0]]` smooth | hem band ring r 5.6/5.2 z 22..23.2 gold |
| Belt | z 31..32.4 | ring r 4.2/3.9, seat colour; knot ball r 1.1 at the front | |
| Torso | z 32.4..51 | lathe `[[32.4,3.9],[36,4.6,1],[44,4.8,1],[49,3.9,1],[51,3.1]]` smooth | |
| Sash | (−4.2, 1.6, 50) → (3.8, 2.4, 32.5) on the torso surface + 0.5, 5 points, filleted | tube r 0.9, seat colour, gold `inner` edge line | replaces the T40 thread (one tube, not two) |
| Ruff | z 51..53 | ring r 3.0/1.9, parchment | |
| Neck | z 53..55 | dowel r 2.0 seated in the head | |
| Shoulder L/R | (∓5.8, 0, 49) | ball r 2.1 | shoulder pitch rotates the arm |
| Upper arm | shoulder → elbow, length 9 | dowel r 1.6 gapped under the armlet collar r 2.0 t 0.8 (gold) | |
| Elbow | — | ball r 1.9 | |
| Forearm | elbow → hand, length 8.5 | dowel r 1.6 | |
| Hand | — | ball r 1.9; open hand = 4 finger balls r .55 (excited, left) | |
| Head | (0, 0, 61.5) | sphere r 7.2 | face pitch +24° as today (`FACE_PITCH`) |
| Muzzle, nose | face basis (0, 5.7, −4.3) | ball r 2.7 seated; dot .6 | mouth drawn on the muzzle (T02 shapes, +6 wide) |
| Ears | (±8.7, 0.9, 62.5), axis 35° toward the viewer | disc r 3.0 t 1.2 + inner disc r 1.8 parchment | |
| Eyes, brows, sindoor | T02 section 4 via `faceWorld` | lines + dots; sindoor lozenge 1.2 x 3 filled seat colour | extras (sparkles, sweat, tear) as T40 |
| Crown | band ring r 3.9 h .9 at head +6.0; tiers bulged 3.6→3.0 h 3.2, 2.8→2.0 h 2.6, 1.8→0 h 2.7 with rings r 3.2 / 2.3 h .6 between; finial ball r .55 | lathes, gold | top ≈ 79.2 ≤ 80 |
| Tail root | (0, −4.8, 26) on the loincloth back | ball r 1.7 | |
| Tail | root → J1 (−3, −8.6, 27.5) → J2 (−8.2, −8.4, 33) → J3 (−10.2, −7, 43) → J4 (−9.6, −7.2, 54) → tip (−7, −7, 62.5) | tube r 1.3, `rings` pitch 2.4 fade, filleted 4; tuft ball r 2.2 seat colour | a 4-joint chain: base pitch + 3 bends per frame (section 3) |
| Mace | shaft tube r 0.6 length 22 through the right hand; grip collars r .9 t .6 x2; head lathe `maceR` length 8.9 belly 3.4 with 12 knurl ribs s 2..7; finial ball r .8; butt ball r .7 | gold head and collars, dark-wood shaft | shouldered at rest: shaft pitch +20° back over the right shoulder, head at about (7.5, −3, 66) |

Part types ≈ 69 (legs 16, body 8, head 21, arms 14, tail 3, mace 7); the build prints the count (≥ 60 required).

---

## 2. Facing

The camera is fixed (azimuth 55°, elevation 50°). The only directions a token ever walks are the four world axes.

| Facing | World direction | On screen | Angle off the camera axis | Used for |
|---|---|---|---|---|
| `SE` | +x | down-right, 28.2° below horizontal | 55° (front 3/4, face visible) | odd rows (1, 3, 5 ...), bounce-back on row 12, bridges wedding and rama-setu |
| `SW` | +y | down-left, 47.6° below horizontal | 35° (near-frontal) | **rest facing**: idle, the 4 emotion poses, seat card, reappear, entry, slide |
| `NW` | −x | up-left, 28.2° above horizontal | 125° (back 3/4) | even rows (2, 4, 6 ...), bridges vishwamitra and sugriva |
| `NE` | −y | up-right, 47.6° above horizontal | 145° (back) | up a row at row ends, bridges shiva-bow, guha, shabari, hanuman-meeting, hanuman-leap |

| Rule | Value |
|---|---|
| Rendered facings | 4, all rendered. **No mirrors**: azimuth 55° makes +x and +y different projections, and a flipped iso sprite breaks the camera-locked light (T42 1.3) |
| Frames per facing | `SW`: idle 3 + happy, excited, scared, sad = 7. `SE`, `NW`, `NE`: walk 8 + run 6 + leap 4 = 18 each. Total **61** |
| Facing from a move vector `d` | `argmax` over {+x, +y, −x, −y} of `dot(unit(d), axis)`; a tie keeps the previous facing. Bridges use the route direction: Δ(+112, −71) → `SE`, (+56, −71) → `NE`, (−168, −71) → `NW` |
| Turning | a facing change is a frame swap on the same cycle phase (the legs keep their position in the cycle). It happens exactly at a square centre where the path bends (row end, the turn-around at 144), never mid-tile |
| Arrival | on the landing squash (60 ms) the token swaps to `SW` idle (or the current emotion pose). Every rest is `SW` |
| Why `SW` for rest | the most frontal view (35°): face, sash, sindoor and the shouldered mace all read; the seat card uses the same frames, so the seat figure and the token are one object (T40 section 5) |

---

## 3. Animation clips (pre-rendered poses, build time, like the emotions)

Angle conventions (degrees): hip + = thigh forward; knee + = flexion; ankle + = toes up; shoulder + = arm forward
(180 = straight up); elbow + = flexion; lean + = torso pitched forward; tail = (base pitch, total curl); mace = shaft
pitch from vertical, + = head back over the shoulder. Bob = root z − 25. **The builder solves the root**: the planted
foot's sole touches z 0 at the table's offset along `t` (relative to the root); bob is the result and is checked ± 0.5,
not set. Faces: `idle` eyes/brows/mouth in every locomotion frame (the token's face only changes at rest).

### 3.1 Clip table

| Clip | Frames | Timing | Facings | Loop | Cycle length |
|---|---|---|---|---|---|
| `idle` | 3 (tail left, centre, right) | 3 fps ping-pong L C R C (1.33 s) + container breath `scaleY` 1.00→1.015, 2.4 s `Sine.easeInOut` yoyo | SW | yes | — |
| `walk` | 8 (contact, down, pass, up x 2 legs) | **distance-driven**: 20 fps at 80 units/s | SE NW NE | yes | 32 units (16 per step, 4 per frame) |
| `run` | 6 (contact, down, air x 2 legs) | distance-driven: 30 fps at 280 units/s, 60 fps at 560 (Fast) | SE NW NE | yes | 56 units = one square (9.33 per frame) |
| `leap` | 4 (anticipation, takeoff, air, land) | time-driven: 160 / 80 / flight / 120 ms (Fast 60 / 40 / flight / 60) | SE NW NE (+ `SW` land for reappear/entry: use `SW idle` with a 100 ms squash instead, no extra frame) | no | — |
| `happy` `excited` `scared` `sad` | 1 each | rest poses, T40 4.6 remapped (3.3) | SW | — | — |
| swallowed / vanish | none | the `scared` SW pose is what the snake eats (T42 5.4 step 4 scales and fades the whole container) | — | — | — |
| reappear | none | `SW idle` frame 1, scale 0.1 → 1 `Back.easeOut` 260 ms + dust (T42 5.4 step 7) | — | — | — |

### 3.2 Key frames (joint angles). Planted offset = the planted foot's ground point along `t` relative to the root.

Walk (frames 4–7 mirror 0–3 with L and R swapped):

| # | Name | hip L | knee L | ankle L | hip R | knee R | ankle R | shoulder L / R | elbow L / R | lean | tail (pitch, curl) | mace | bob (expected) | planted |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | contact | +25 | 5 | +8 | −20 | 8 | −12 | −20 / +20 | 15 / 30 | 4 | (+15, 150) yaw −8 | +20 | 0 | L at +8 |
| 1 | down | +18 | 16 | 0 | −12 | 10 | −22 | −12 / +12 | 18 / 28 | 4 | (+12, 150) yaw −4 | +22 | −1.5 | L at +4 |
| 2 | pass | +4 | 10 | 0 | +6 | 48 | −10 | 0 / 0 | 20 / 20 | 3 | (+15, 150) yaw 0 | +20 | 0 | L at 0 |
| 3 | up | −10 | 4 | −18 | +22 | 22 | +2 | +12 / −12 | 28 / 15 | 4 | (+18, 150) yaw +4 | +18 | +1.5 | L at −4 |

Run (frames 3–5 mirror 0–2):

| # | Name | hip L | knee L | ankle L | hip R | knee R | ankle R | shoulder L / R | elbow L / R | lean | tail | mace | bob | planted |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | contact | +40 | 18 | +5 | −30 | 70 | −10 | −35 / +35 | 85 / 85 | 12 | (−5, 60) streaming back | +35 | −0.5 | L at +9.33 |
| 1 | down | +12 | 35 | −5 | +15 | 95 | −20 | −10 / +10 | 90 / 90 | 12 | (−8, 55) | +35 | −2.5 | L at 0 |
| 2 | air | −35 | 25 | −25 | +45 | 60 | 0 | +30 / −30 | 90 / 90 | 14 | (0, 50) | +35 | +3 | none (`air: 1`) |

Leap:

| # | Name | hips | knees | ankles | shoulders L / R | elbows | lean | tail | mace | bob | planted |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | anticipation | +55 | 70 | +15 | −40 / −40 | 20 / 20 | 18 | (−30, 20) down-back | +80 (held low behind) | −7 | both, 0 (feet ±3 apart) |
| 1 | takeoff | −10 | 5 | −30 (toes) | +60 / +60 | 30 / 30 | 10 | (0, 40) | −20 (raised forward) | +4 | both, 0 |
| 2 | air | +70 | 95 (tucked) | 0 | +40 / +150 (mace high) | 40 / 20 | 15 | (+30, 20) straight back-up | −10 | +6 | none (`air: 1`) |
| 3 | land | +40 | 45 | +10 | +20 / +60 | 60 / 40 | 15 | (+25, 110) | 0 (upright) | −4 | both, 0 |

Emotion rest poses (SW; from T40 4.6 with the pedestal gone):

| Pose | Head | Arms | Mace | Tail | Legs | Face extras |
|---|---|---|---|---|---|---|
| idle (frame 1 of the clip) | level | R shouldering the mace (shoulder +25, elbow 95); L down (shoulder 0, elbow 10) | +20 shouldered | (+20, 160) S-curl up to z 62 | hips 0, knees 0: weight even | — |
| happy | side-tilt 6° | R raised (shoulder +40, elbow 70); L to the chest (shoulder +30, elbow 95) | +10, head up | (+20, 160), tip at z 70 | rest | smile |
| excited | level | both up: shoulders +160, elbows 10; L hand open | vertical, shaft shortened to 16 so the finial ≤ z 82 | (+60, 0) straight up, tuft r 2.6 | knees 8 (a spring, feet planted) | open mouth, sparkles |
| scared | level | hands over the eyes: shoulders +120, elbows 110 (hands at face (±2.9, 8.9, +1)) | planted: butt on the tile at (7.5, −2, 0), shaft vertical | wrapped 1.75 turns round the shins, ellipse 7.4 x 5.2, z 11.2 → 6 | hips 25, knees 30, lean −6 (bob −4) | sweat, open oval mouth |
| sad | nod −8° | R low (shoulder +10, elbow 20); L down | planted head-down beside him: head on the tile at (9, 3, 0), shaft up to the hand | drooping: tip at (6, −3, 1.3), tuft on the tile | knees 5 | tear |

---

## 4. Movement rules

| Rule | Normal | Fast | Notes |
|---|---|---|---|
| Path | polyline through `FIELD_C` of every square in `Moved.path`; the fan slot is blended in over the last 20 units | same | the path already contains the bounce-back squares (core `game.ts`), so the token turns around at 144 |
| Gait by squares `n` (path length) | `n ≤ 2` walk at **80 u/s**, `n ≥ 3` run at **280 u/s** | run always, **560 u/s** | one gait per move, chosen at the start |
| Speed profile | ease-in over the first 12 units, ease-out over the last 16 units (quadratic), constant between | no ramps | `d(t)` is monotone; the frame index comes from `d`, so ramps never cause sliding |
| Frame index | `i = floor(((d + d0) mod C) / C · N)`, `d0` so frame 0 (contact) starts the move | same | `C` 32 walk / 56 run, `N` 8 / 6 |
| Cadence | walk 2.5 steps/s (20 fps), run 5 steps/s (30 fps) | run 10 steps/s (60 fps) | cadence = speed / step length by construction |
| No sliding | the planted foot's offsets fall by exactly `C/N` per frame (4 walk, 9.33 run): net drift per cycle 0; frame-hold skating ≤ `C/N` per held frame (walk 4 units = 6 px at zoom 2 for 50 ms) | none (a frame per display frame) | section 9, decision 3 for the foot-locked alternative |
| Durations | walk 1 sq 820 ms, 2 sq 1,520; run 3 sq 700, 6 sq 1,300 (`L/v` + 120 / 100 ms ramps) | 100 ms per square (6 sq = 600 ms) | was 120 / 40 ms per square (T05) |
| Row end | the path bends 90° at the square centre: facing swap, phase continues, no pause | same | |
| Arrival | last 16 units ease out; on `d = L`: swap to `SW`, squash 60 ms (T40 section 5), `relayout` | squash 30 | |
| Reveal | `revealTerrain(square)` when `d` passes each square centre | same | T42 7.2 unchanged |
| Sound | `audio.step()` on entering frames 0 and `N/2` (contacts); leap land `step()` | same | |
| Bridge: step on | leap 14 units from `FIELD_C(foot)` onto the foot abutment (z +3): 160 + 80 + flight 180 + 120 ms, apex +8 | 60 + 40 + 80 + 60 | T42 6.6 step 2 |
| Bridge: cross | **run** along the deck, `s` 0 → L at 280 u/s, z = `deck z(s)` from the manifest, facing by the route direction, depth per T42 6.4 rule 4 | 560 u/s | vishwamitra 182 units = 650 ms (was 980) |
| Bridge: step off | leap 14 units down to `FIELD_C(top)` + fan slot, same timings as step on; land → `SW` | halved | |
| Bridge totals | vishwamitra 1.73 s (540 + 650 + 540), guha 1.40, shabari (L 15 < 28: one leap foot → top abutment, no run) 0.54 | 0.81 / 0.64 / 0.24 | `Laddered` reactions play from the rise (T42 6.6) |
| `hanuman-leap` 95 → 122 | **one leap** foot abutment → top abutment: anticipation 200 ms, flight 700 ms on a parabola with apex z = deck apex 22.4 + 14, `air` frame, land 120; the deck stays, squares under it stay fogged | 80 / 250 / 60 | his own story; the only bridge he does not run |
| Snake | arrives, turns `SW`; at `Bitten` BoardScene sets the token to `scared` at once (T42 5.4 step 2 hold shows it); swallow and reappear per 3.1 | T42 Fast column | no body between head and tail, ever |
| Entry from the seat | the existing HUD → board arc (360 ms, `ENTRY_ARC_PX` 30) drawn with the `SW` idle frame and a 100 ms landing squash | 180 | Hanuman arrives as a figure, no leap frames needed |
| Triple-six slide | `SW` idle frame, container angle −6° while sliding (pulled back), 500 ms straight line, dust on landing | 250 | a penalty: no steps, no celebration |
| Re-fan (`relayout`) | 80 ms slide in the idle frame (≤ 18 units, a shuffle) | 40 | as today |
| Bounce | the turn-around at 144 is a facing swap NW → SE on the pass frame; `bouncePuff` fires when `d` passes 144 the first time | same | `Bounced` audio unchanged |
| Reduced motion | no clips: the token glides at 280 u/s in the `SW` idle frame (no bob, no turning); bridges: appears at the top (T42.10); snake: three static beats (T42 decision 11) | — | emotion crossfades kept |
| Camera | `follow(token, 0.12)` per frame on the smooth path point; `TurnStarted` as T42 4.3 | lerp 1.0 | unchanged |

---

## 5. Sprite sizes and texture memory

Only two uses exist: the board token (crisp at follow zoom 2.0, upscaled 1.25x at 2.5) and the seat card. Both draw
from one sheet. `m` and `l` PNGs (Setup, Gallery, Win) are rebuilt from the new body with the same file names and are
not loaded in BoardScene (T42 3.3).

| Item | Value |
|---|---|
| Factor | **4** (= follow zoom 2.0 x DPR 2, T42's `coarse`), not 5: at factor 5 the sheet is 2048 x 2048 (16 MB, 21.3 with mips) and the total hits 46.5 MB; at factor 4 the token is 1:1 at follow zoom and upscaled 1.25x at max zoom, the same as the blocks under its feet. Lines 0.6 units = 1.8 device px |
| Frame box (logical px at zoom 1) | locomotion and leap frames 26 x 56 (lateral ±13 units incl. the mace head, travel ±12 units incl. stride and lean, u −1..82); `SW` rest 22 x 56, excited 25 x 56 |
| Frame px at factor 4 | ≤ 104 x 224 (leap air ≤ 104 x 232); per-frame crop, anchor written per frame |
| Frames | 61 (section 2) |
| Sheet `hanuman-s` | shelf packing (`atlas.mjs`): 2048 wide holds 19 frames of 104 px per shelf; 61 frames = 4 shelves x 232 = 928 ≤ 1024 → **2048 x 1024**, 8.0 MB, **10.67 MB with mips**; used ≈ 1.4 M of 2.1 M px |
| Lit ring | `shared:lit-ring`, one frame 120 x 70 px at factor 5 (the shared sheet has 255 k px free) |
| Seat card | `SW` frames from `hanuman-s` at scale (1.711 / 0.7621) / 4 = **0.561** → 88 px for 80 units as T40 6.1; emotion and T05 tweens on the container as today |
| Anchor rule | anchor = `iso((0, 0, 0))` of the frame's own local origin = the root's ground point. The root bob and the stride live inside the frame; every frame of every clip shares that origin, so swapping frames never moves the body. Runtime: `setOrigin(anchorX / w, anchorY / h)`, `setScale(1/4)` |
| Ground contact | per frame the planted sole's lowest point is at z 0 within 0.3 px (frame px); `air` frames carry `air: 1` and `lift` 0.15 for the shadow |
| Meta per frame | `{ w, h, factor: 4, anchorX, anchorY, clip, facing, index, planted: { foot: 'L' \| 'R' \| 'both' \| null, offset }, air }` |

Budget (measured on this branch: `blocks` 5.33, `bridges-hard` 5.33, `snakes-hard` 5.33, `frame` 2.67, `props` 2.67,
`shared` 2.67 = 24.0 MB mipped; figurine `s`+`m` PNGs 1.8; text canvases, FX, old 2D hero art ≈ 1.5; total ≈ 27 MB):

| Sheet | Now (MB, mipped) | After (MB, mipped) |
|---|---|---|
| T42 atlases, Hard (worst level) | 24.0 | 24.0 |
| Hanuman `s` + `m` PNGs (30 textures) | 1.8 | 0 (deleted from BoardScene) |
| `hanuman-s` 2048 x 1024 | — | 10.67 |
| Text canvases, FX, 2D art for the other three heroes | ≈ 1.5 | ≈ 1.5 |
| **Total** | **≈ 27** | **≈ 36.2** (Easy ≈ 33.5); headroom ≥ 11.8 MB of 48 |

---

## 6. Runtime contract

### 6.1 Types (`src/game/iso/tokenPose.ts` extended, `src/game/iso/locomotion.ts` new and pure)

```ts
export type Facing = 'SE' | 'SW' | 'NW' | 'NE';                 // world +x, +y, −x, −y
export type ClipName = 'idle' | 'walk' | 'run' | 'leap' | 'happy' | 'excited' | 'scared' | 'sad';
export interface Motion { facing: Facing; clip: ClipName; phase: number }   // phase 0..1 of the cycle (leap: of the beat sequence)
export interface TokenPose { feet; ground; depth; lift; scale?; motion?: Motion }   // no motion = rest (SW, current emotion)

// locomotion.ts
export function facingOf(dir: Vec2, previous: Facing): Facing;
export function gaitFor(squares: number, fast: boolean): { clip: 'walk' | 'run'; speed: number; cycle: number; frames: number };
export function pathOf(from: Vec2, squares: number[], finalSpot: Vec2): Polyline;   // FIELD_C centres, fan slot blended over the last 20 units
export function distanceAt(u: number, length: number, fast: boolean): number;       // ramps 12 / 16 units, monotone
export function sampleAt(path: Polyline, d: number): { point: Vec2; dir: Vec2; squareIndex: number };
export function phaseAt(d: number, cycle: number, d0: number): number;
export function durationOf(length: number, gait, fast: boolean): number;
```

### 6.2 `Figurine` (seat figure and board token, one class) must

| Duty | Behaviour |
|---|---|
| Clip player | `place(pose)`: with `pose.motion` → frame `${clip}.${facing}.${floor(phase·N) mod N}` from `hanuman-s` (leap: beat thresholds .25 / .40 / .80 → frames 0..3); without → the rest frame `SW.<emotion>` (idle = clip frame 1) and the idle timer runs (3 fps ping-pong + breath tween) |
| Facing | from `pose.motion.facing`; rest is always `SW` |
| Frame timing | none of its own for walk/run: BoardScene drives `phase` from distance; the idle timer is the only clock inside the token |
| Emotion | `setEmotion` stores it and applies it at rest; during a clip it is deferred to the arrival swap (`onEmotion` mirror from the seat figure kept) |
| Lit | `setLit(on)` shows/hides the `lit-ring` sprite at `pose.ground`, depth floor key + 0.7 (over the shadow at + 0.6) |
| Shadow | `shared:shadow` at `pose.ground`, scale `1 − 0.3·lift − 0.15·frame.air` |
| Depth | `pose.depth` as today (`1000 + key(ground)`); bridges per T42 6.4 rule 4 |
| Seat mode | SW frames at scale 0.561, `feel()` tweens unchanged (T40 4.6 table) |
| Alpha | `setAlpha` on the whole container for the snake's `drawToken(pose, alpha)` |

### 6.3 BoardScene

| Method | Change |
|---|---|
| `Moved` handler | `if (token.walks)` → `moveAlong(player, path)`: one `travel()` of `durationOf(L)` with `poseAt(u)` = `worldPose(sampleAt(path, distanceAt(u)))` + `motion { facing, clip, phase }`; `onUpdate` fires `revealTerrain`, `step()` on contact frames, the 144 puff; then arrival swap, squash, `relayout`. Medallions keep the per-square `stepTo` loop |
| `stepTo` (entry from the seat) | unchanged arc; the `SW` idle frame; squash 100 ms on landing |
| `crossBridge` | three phases: leap on (time-driven), run (`travel` over `L / speed` with `s` from `distanceAt`, z from the manifest `deck`, facing from the route, phase from `s`), leap off; `hanuman-leap` and any `L < 28`: single leap; depth via `crossingDepth(segments, y)` as today |
| `snakeBite` | before `snakes.bite`: `token.setEmotion('scared')` + `place(restPose)`; hooks unchanged; `landAtTail` returns the rest pose and the token plays the reappear scale |
| `slideTo` | idle frame, container angle −6° during the tween, reset at the end |
| `relayout` | unchanged (idle frame slide) |
| Fast / reduced motion | `gaitFor(n, fast)`; `reducedMotion` → `motion` omitted, glide at 280 u/s |
| `reactions.json` `timing` | add `walkUnitsPerS: 80`, `runUnitsPerS: 280`, `fastRunUnitsPerS: 560`, `walkMaxSquares: 2`; `stepMs` / `fastStepMs` stay for medallions |

---

## 7. Respect checklist additions (extends T40 section 9; run on the contact sheet and in a full game)

| # | Check | Pass condition |
|---|---|---|
| 13 | Always bipedal | no frame has a hand or knee on the ground; no quadruped or knuckle pose; torso lean ≤ 18° in every frame; the head is above the hips in every frame |
| 14 | No comic fall | `leap.land` knees ≤ 45°, bob ≥ −4, arms forward for balance only; the snake swallow uses the `scared` pose, never a tumble; no somersault on the board (T05 keeps it on the seat card) |
| 15 | Dignified run | chest up, mace shouldered (never dragged, never pointed at a snake or another token), tail streaming, no flailing arms (shoulders within ±35°, elbows ≤ 90°) |
| 16 | Dignified idle | weight even, tail sway ≤ 10° of base yaw, head still, no scratching, yawning, tail-grabbing or fidget on the board |
| 17 | Back views | NW and NE frames keep the crown, ears, sash and tail readable; the loincloth hem (z 22) is never lifted by the tail (root at z 26) |
| 18 | Iconography in motion | mace, tail tuft, sindoor (front facings), crown and sash visible in every frame of every facing |
| 19 | Heroes above villains | shoulder z 51.4 > every snake head top (≤ 42); the token lands at `FIELD_C` in front of the coil and never steps on it |
| 20 | Colour restraint | only the materials of 1.2; no new hue; the seat colour is the sash, belt, tuft and sindoor only |
| 21 | Native-speaker pass | the walk, run and leap contact sheets join the T42.11 review |

---

## 8. Task split (dependency order, one commit each; `npm run verify` green plus the stated checks)

| # | Task | Model | Depends | Deliverable | Acceptance |
|---|---|---|---|---|---|
| T43.1 | Art build: rig, clips, atlas | Sonnet | — | `scripts/art/iso/figurines/rig.mjs` (skeleton of 1.3, joint angles → part placement, root solve from the planted foot, facing frames `frameFor(facing)`), `clips.mjs` (the tables of 3.2 as data), `hanuman.mjs` rewritten on the rig with the materials of 1.2, `index.mjs` → `buildAtlas('hanuman-s', 61 frames, { factor: 4, maxSize: 2048 })` with the meta of section 5; `shared:lit-ring`; `m`/`l` PNGs rebuilt from the `SW` rest poses (same names); contact sheet script → `scratchpad/hanuman/shots/clips.png` (4 facings x clips + SW emotions at 4x) | sheet is 2048 x 1024 with 61 frames; part count ≥ 60 printed; `--audit` 0 on SW idle 1, the 4 emotions, and walk 0 / 2, run 0 / 2, leap 0 / 2 of each facing (the T40 `JOINTS` list + hip/knee/ankle/toe); line check 0; `tests/figurineClips.test.ts` on the meta: consecutive planted offsets differ by `C/N` ± 0.05, planted soles at z 0 ± 0.3 px, anchors round-trip ± 0.5 px, no frame touches its crop edge; section 7 items 13–20 ticked on the contact sheet |
| T43.2 | Runtime: locomotion + clip player + BoardScene | Sonnet | T43.1 | `src/game/iso/locomotion.ts` (6.1, pure, tested), `tokenPose.ts` `Motion`, `Figurine.ts` clip player / lit ring / seat scale 0.561, `assets.ts` atlas key + removal of the `s`/`m` PNG loads in BoardScene, `BoardScene` per 6.3, `reactions.json` timing keys, `bridgeRules.ts` run-the-deck sampling | `tests/locomotion.test.ts`: facing choice incl. ties and all 9 bridge routes; `distanceAt` monotone with ramps; durations 1 sq 820 ms, 6 sq 1,300, Fast 6 sq 600 (± 1 ms); phase continuous across a row-end bend; net foot drift over one cycle at zoom 2 ≤ 1 px (planted offsets x 1.524 px/unit); smoke: a 4-bot Hard game with Hanuman seated plays to the end, the token turns around at 144 on a bounce, vishwamitra crossing 1,730 ms ± 30, bite timings unchanged (T42.8 test), reduced motion and Fast runs pass; dev memory log ≤ 48 MB (expected ≈ 36) |
| T43.3 | Review gate | Sonnet | T43.2 | `docs/review/T43-review.md`: section 7 table, 4x close-ups of contact / pass / air frames in each facing, a 2-second screen recording frame strip of a 6-square run at follow zoom, memory measurement | every row recorded; owner sign-off on the gait |

---

## 9. Owner decisions (short, with recommendations)

| # | Question | Recommendation |
|---|---|---|
| 1 | Should Rama, Sita and Lakshmana follow the walking-character model later? | **Yes.** Rama and Sita walk only (no run, no leap: T05 forbids airborne-comic tweens for them), Lakshmana walks, runs and leaps. Budget: four factor-4 sheets are 24 + 4 x 10.7 = 67 MB (over). Four heroes fit as **one shared factor-3 sheet** 2048 x 2048 (78 x 168 px frames, 26 per shelf x 12 shelves = 312 ≥ 244 frames): 21.3 MB → total ≈ 47 MB, at the cap, with the token upscaled 1.33x at follow zoom. Decide then whether to accept factor 3 for all four (Hanuman's builder takes the factor as one constant) or raise the budget on tablets; Hanuman ships at factor 4 now either way |
| 2 | Move pace: walk ≤ 2 squares at 80 u/s, run otherwise at 280 u/s (a 6-roll takes 1.3 s instead of 0.72 s); Fast at 100 ms per square (was 40) | accept; the walk is the point of this amendment. If Fast feels slow, 70 ms per square (800 u/s) keeps every run frame on screen for at least one display frame |
| 3 | Root-locked frames (smooth body, planted foot skates ≤ 4 units for 50 ms within a held walk frame, zero net drift) or foot-locked frames (the foot never skates; the body advances in 20 fps steps of 4 units / 30 fps steps of 9.3) | root-locked; the camera follows a smooth point and the Fast run has one frame per display frame anyway |
| 4 | All bridges run across the deck; only `hanuman-leap` 95 → 122 (and footbridges shorter than 28 units) are a single leap | accept; the stone bridges stay in use and a leap over every arch would hide the arch under the flying token |
| 5 | Lit marker: a black ground ring under the current player's token (no lit textures, saves 10.7 MB) | ring |
| 6 | Rest facing `SW` (near-frontal, 35° off camera) after every move, which means a visible turn on arrival, vs staying in the walking facing (back views at rest half the time) | `SW` |
| 7 | The seat colour as sash + belt (one hue on cloth), vs a tinted outline as T40 appendix 8 proposed for Rama | sash + belt |
