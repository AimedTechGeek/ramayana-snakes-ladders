# T45 — Living diorama 2: terraces, scale, walkways, bridge hops, cinematic bite

Owner requests (2026-11-03), building on T44 (`docs/design/T44-diorama-3d.md`, architecture in `docs/ARCHITECTURE.md`).
Integration branch: **`feat/diorama-v2`** (from `feat/diorama-3d` at 64398aa). **Nothing merges to `main`.**

## Why

| Owner observation | Answer |
|---|---|
| Heroes are huge compared to the blocks' walls and doors | Heroes 1.43 u on 0.92 u blocks with ~0.3–0.45 u walls: shrink to about half (default 0.55) |
| Heroes walk through bridges and block props | Straight centre-to-centre path ignores scenery: clear walkways, doors on the lanes, hop over risen bridges |
| The board is flat | Block tops only 0.15–0.38 u: every row rises, a climb from the gate (1) to the throne (144) |
| The snake bite is simple | A slow, staged, cancellable bite scene: block focus, snake grows, swallows, shrinks back |

## T45.1 Terraces (every row rises)

- Each board row (12 squares) is a terrace **0.12–0.15 u** above the previous one (tune so Fit still frames the board with the throne and tray on desktop 1280×720 and phone 844×390). Region detail heights can still vary a little within a row, but every row's lowest block must be above the previous row's highest.
- The sea row (row 10, today sunk to 0.15) stays a water channel set **into** its terrace: the terrace rises, the water sits inside it.
- Row changes happen at the row ends (boustrophedon, alternating left/right): give those block pairs a small **stair or ramp**; water rows get a little **waterfall** down the riser. The soil cross-section on the sides becomes a staircase.
- Source of truth: `blockHeight()` / `blockTopY()` in `src/app/board3d/boardLayout.ts`; board model `scripts/blender/board.py` (`npm run blender:board`). Bridges (`scripts/blender/bridges.py`, deck curve in `src/app/board3d/bridgeGeometry.ts`, `npm run blender:bridges`) already take foot and top heights from `blockTopY` — rebuild them so decks become ramps up the terraces; keep every T44 bridge test (clearances incl. kaikeyi on 46 and indrajit on 114, vishwamitra crossing time) green, updating numbers only where the geometry legitimately changed.
- Camera Fit/Focus bounds (`cameraConfig.ts`), shadow camera bounds (`Lighting.tsx`), tray/ledge stay sensible.

## T45.2 Scale and walkways

- **Scale:** one constant `HERO_SCALE` (default **0.55**) and `SNAKE_SCALE` (default 0.55) applied at runtime (root of the rigged token in `Pieces.tsx` multiplied with the existing `token.scale`; snake root in `Snake.tsx`). GLBs are not rebuilt.
  - Stride: `Hero.tsx` gait cycle = GLB stride × `HERO_SCALE` so feet stay planted (more, shorter steps; move speeds unchanged).
  - Scale the lit ring, blob shadow, speech-bubble head anchor, `HERO_HEIGHT` in `cameraConfig.ts`, snake mouth points / strike reach / swallow target used by `snakeChoreo.ts` and `DioramaView.bite()`.
  - `MIN_DISTANCE` (cameraConfig.ts, now 6) down to about 3; Focus frames the scaled hero.
  - Produce a comparison sheet at 0.45 / 0.55 / 0.65 (Fit, close-up beside the Ayodhya rampart or Lanka wall, a hut block) so the owner can change the default later.
- **Walkways:** the walking line between neighbouring squares (`pathOf` in `src/game/iso/locomotion.ts`: field centre to field centre, then the fan slot) is a reserved lane about one scaled hero wide (≥ 0.22 u). Props, dressing and landmarks are kept out of it (`src/app/board3d/propLayout.ts`); a layout test fails if any instance footprint intersects a lane on any level.
  - **Doors:** where a lane crosses a wall-type prop (`rampart` 47/48, `lanka-wall` 121/132, the gate on 1, palace walls), the wall is placed or built so its doorway sits on the lane (`scripts/blender/props.py`, `landmarks.py`, `npm run blender:props`). Heroes visibly walk through the doors.
  - A collision test samples every hero walking path on all three levels (every square-to-square step) against prop/landmark footprints and fails on any hit.

## T45.3 Bridge hops

- When a walk's path crosses the footprint of a **risen** bridge that the hero is not using, that part of the walk becomes a hop over the deck and parapets (clearance ≥ 0.06 u above the highest deck/parapet point under the path), landing back on the lane. Hidden bridges are ignored (never give a reveal away).
- Reuse the leap clip and `stepLeapBeats` / leap machinery already used for bridge step-on (`src/app/board3d/crossing.ts`, `DioramaView.walk()`, `src/game/iso/locomotion.ts`); the crossing geometry comes from `bridgeGeometry.ts` at runtime, so it follows the T45.1 terraces after merge.
- Per hero: Hanuman a proper leap; Rama, Lakshmana, Sita a low calm bound (arms low, soft landing — existing R3 limits). Fast halves the hop; reduced motion: a short glide over, no leap.
- Tests: every walk on all three levels clears every risen bridge; the hop lands on the lane; the move ends exactly on its square; timing per hop ≤ 0.5 s normal.

## T45.4 Cinematic snake bite (UI agent)

Replaces today's quick rise → hold → strike → swallow → settle with a slow staged scene (~3.5 s at normal speed):

| Beat | Time | What happens |
|---|---|---|
| Focus | 0.0–0.7 s | Camera glides (eased) to the head block; the rest of the board dims slightly |
| Rise and grow | 0.7–1.4 s | Snake uncoils and swells to ~1.6× (on top of `SNAKE_SCALE`); eyes narrow, tongue flicks; hero plays `scared` |
| Strike | 1.4–1.7 s | Slow lunge, mouth wide |
| Swallow | 1.7–2.3 s | Hero shrinks into the mouth; a bulge slides down the body (the rig's `bulge` bone) |
| Shrink and settle | 2.3–2.9 s | Snake shrinks back to normal, small satisfied sway, soft puff; gentle, never gory |
| Reappear | 2.9–3.5 s | Camera glides to the tail square; hero pops up there with `sad`; camera eases back to the view the player had |

- **Camera rules:** slow and eased, never snaps; any user drag/zoom/wheel during the scene cancels the camera part immediately (control stays with the player, the animation finishes in place); only bites move the camera; restores the previous pose afterwards.
- **Fast:** today's short bite, no camera move. **Reduced motion:** no camera move, no growth; a fade. Menu toggle **"Bite close-ups"** (on by default, saved with settings; English + Hindi string; Hindi marked for native check).
- **Respect rule R9 relaxed for the bite only:** while biting, a grown snake head may rise above the hero; at every other moment R9 holds. Put a comment at the growth code and in the R9 test explaining the owner's exception (2026-11-03), and keep the rest of R5.5 (no hood, one head, no halo, nothing deity-like, not gory).
- Token hidden from swallow to tail reappear (existing rule); bite beat timings tested ±20 ms; cancel-on-drag tested; Fast and reduced-motion paths tested.

## Integration (T45.5, lead)

Merge order: T45.1 → T45.2 → T45.3 → T45.4 into `feat/diorama-v2`, full verify after each, push the feature branch only. Re-run clearance and collision tests on the merged tree (terraces change heights under walkways, hops and bite framing). Full games Easy/Hard, normal/Fast/reduced motion. Run the app locally for the owner.
