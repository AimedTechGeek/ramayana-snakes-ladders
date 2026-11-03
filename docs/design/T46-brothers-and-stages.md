on the dais in front of the empty throne |









Owner requests (2026-11-04) on branch **`feat/diorama-v2`** (nothing merges to `main`). Builds on T44/T45 (`docs/design/T44-diorama-3d.md`, `docs/design/T45-living-diorama-2.md`, `docs/ARCHITECTURE.md`).

## T46.1 Snakes full size (done, 51e5acc)

`SNAKE_SCALE` back to 1 (`src/app/board3d/figureScale.ts`). Snakes are the theme pieces and must stand out. **R9 ("heroes above villains") is retired on the board** by owner decision; every other snake respect rule stays (no hood, one head, no halo, nothing deity-like, not gory). Heroes stay at `HERO_SCALE` 0.55.

## Six heroes

| Hero | Default seat | Seat colour | Carries | Notes |
|---|---|---|---|---|
| Rama | Seat 1, Human | blue (existing) | bow, quiver | existing GLB |
| Lakshmana | Seat 2, Bot | green (existing) | shorter bow, quiver | existing GLB |
| **Bharata** (new) | Seat 3, Bot | violet `#6E4BB5` | **Rama's padukas (sandals), held reverently in both hands at chest height** | the regent who ruled in Rama's name |
| **Shatrughna** (new) | Seat 4, Bot | teal `#1F9E95` | bow and quiver, in his own colours | youngest brother, Bharata's companion |
| Hanuman | choosable | orange (existing) | gada | existing GLB |
| Sita | choosable | pink (existing) | lotus, garland | existing GLB |

Setup offers all six; a hero can be chosen by only one seat. The default game is the four brothers.

### Respect (in addition to the T44 4.4 checklist R1–R8, R10–R11; R9 retired on the board)

- **Padukas:** always held with both hands, at chest height or above, soles facing away from the viewer's face, **never on the ground, never stood on, never swung, never in a comic gesture, never dropped**, in every clip including leap, scared and cheer. Bharata's clips are calm and devoted (Rama-like restraint: R1–R3), restrained face set.
- **Shatrughna:** prince proportions like Lakshmana, full-amplitude but dignified clips, comic face set allowed like Lakshmana.
- Both natural skin, crown or headband per spec 4.3 style, 9 clips (idle, walk, run, leap, happy, excited, scared, sad, cheer), planted feet, GLB ≤ 380 KB before pruning, ≤ 4,500 tris, shared rig.

## Named stages

Each region of the board is a stage of the Ramayana (verify region boundaries in `src/game/board/blockRules.ts` `regionOf` and the story map in `docs/design/T03-board-art.md`; Kanda names below are the intended mapping — correct them to the story order the board actually uses):

| Stage | Kanda | One-line story (en; Hindi alongside, marked for native check) |
|---|---|---|
| Start, square 1 | — | "Ayodhya gate — the journey begins" |
| Mithila | Bala Kanda | Vishwamitra's lessons, Shiva's bow, the wedding |
| Ayodhya | Ayodhya Kanda | Kaikeyi's boons, the exile, Bharata rules with the padukas |
| Dandaka forest and the Ganga | Aranya Kanda | Guha's boat, the forest years, Sita taken |
| Kishkindha | Kishkindha Kanda | Hanuman meets Rama, Sugriva's alliance |
| The sea | Sundara Kanda | Hanuman's leap, Rama Setu |
| Lanka | Yuddha Kanda | the battle |
| Throne, square 144 | Coronation | Rama returns to Ayodhya's throne |

- **Plaques:** a carved name plaque for each stage on the board's edge beside its first row (in the diorama finish), readable at Fit on desktop and phone, in the current language.
- **Chapter card:** when a hero first enters a new stage, a short glass card (stage name, Kanda, one line) slides in for ~2.5 s without blocking play (Fast: 1 s; reduced motion: fade). Once per stage per game; not for bots on Fast if it would spam (show once per stage regardless of who entered).
- **Start block:** square 1 named "Ayodhya gate — the journey begins" on its plaque and in the first card when the game starts.
- Budgets unchanged (plaques must be cheap: one instanced mesh or DOM labels; check the smoke budget line).

### As built (T46.5)

The Kanda per stage above matches the board's story order (`regionOf` and T03), so no stage moved. Two one-liners were corrected to their Kanda (Valmiki's division): Guha's boat and the Ganga crossing belong to Ayodhya Kanda, and Rama Setu to Yuddha Kanda, so Dandaka reads "The forest years, Panchavati, Sita taken" and the sea "Hanuman's leap to Lanka, Sita found". (The board itself still shows the Ganga inside the forest rows and the Setu bridge in the sea row; that is the art's story map, not the card text.) Stage table in `src/game/stages.ts` (strings `ui.stage.<id>.name|kanda|line`; tests in `tests/stages.test.ts`):

| Stage id | Squares | Regions (`regionOf`) | Rows | Signpost (T46.6; the T46.5 edge plaques are gone) |
|---|---|---|---|---|
| `start` Ayodhya gate | 1 | mithila | 1 | back edge of 1, behind the token field (the gate stands in front); reads "Ayodhya gate / The journey begins" |
| `mithila` | 2-36 | mithila | 1-3 | back edge of 2 |
| `ayodhya` | 37-48 | ayodhya | 4 | outer front corner of 37, its board reaching out over the right rim (the stair from 36 arrives at the front, Manthara coils at the back) |
| `dandaka` | 49-84 | dandaka, ganga (49, 50, 71-74) | 5-7 | outer front corner of 49, board over the left rim (Guha's bridge leaves from the back); the post stands in the Ganga |
| `kishkindha` | 85-108 | kishkindha | 8-9 | outer front corner of 85, board over the right rim (Shabari's bridge leaves from the back) |
| `sea` | 109-120 | sea | 10 | back edge of 109, the post in the water |
| `lanka` | 121-143 | lanka | 11-12 | back edge of 121, clear of the Lanka wall |
| `throne` | 144 | lanka | 12 | on the dais in front of the empty throne |

- Chapter card: bottom left, glass, 2.5 s (Fast 1 s), slide in and out (reduced motion: fade); the first card of a game waits until the board has drawn; a card earned at a snake's tail waits for the bite. Once per stage per game, kept in the save (`stages`). The throne's card belongs to the win, not to a bounce. A stage skipped on a bridge (e.g. Ayodhya on 26 -> 52) has no card until a hero stands in it.
- **Hindi for native check:** all `ui.stage.*` strings in `src/i18n/hi.json` (names, Kandas, the eight one-line stories).

### As built (T46.6 signposts)

Owner feedback (2026-11-04): the T46.5 edge plaques were huge next to the blocks. They are replaced by a small wooden **signpost on each stage's first block** (squares in the table above), at a prop's scale:

- Size: 0.40 u tall (post and cap), board 0.42 x 0.21 u, against a hero of about 0.79 u and a 0.92 u block. Foot stone, post, cap and a two-plank board with a brass nail in each corner; the name painted large on the upper plank, the Kanda (the start block: "The journey begins") on the lower. On a water block (49, 109) the post stands in the water; on 144 it stands on the dais.
- Placement: hand-placed spots in `src/app/board3d/signpostLayout.ts`, turned 0-22 degrees toward the default camera. `tests/signposts.test.ts` checks that each one is off every walking lane and fan slot (its square, both neighbours and the gate lane), clear of snake coils, bridge decks and the gate, palace and throne, on its block (a board may only reach out over the rim), and at Fit on desktop and phone hides no number chip and leaves the throne in view (a board may graze the edge of a chip, at most 15% of it); `tests/walkways.test.ts` walks every move of every level past them. Props give way: a dressing piece skips a slot that touches a signpost, and a seed-rule prop that touches one moves like a prop in a lane (`propLayout.SCENERY_LAYOUT`).
- Drawing: all eight are one merged mesh (one draw call, one shadow caster) with a 512 x 512 canvas atlas (2 x 4 cells of 256 x 128), redrawn on a language switch; a signpost on a fogged block is tarnished but legible.
- Legibility: the names read when zoomed in or at Focus; at Fit (desktop and phone) a signpost is a small detail and its name is not readable. The plaques' distance scaling was dropped on purpose (a signpost must keep its real size).

## Tasks

| Task | Agent | Scope |
|---|---|---|
| T46.2 Bharata | Sonnet (blender-asset-builder) | `scripts/blender/heroes/bharata.py` → `public/models/heroes/bharata.glb`, tests mirroring `tests/ramaGlb.test.ts` plus paduka respect asserts, `HeroId` + `RIGGED` entry |
| T46.3 Shatrughna | Sonnet (blender-asset-builder) | `scripts/blender/heroes/shatrughna.py` → GLB, tests mirroring `tests/lakshmanaGlb.test.ts`, `HeroId` + `RIGGED` entry |
| T46.4 Roster and voices | Opus | `Hero` type in `src/core/types.ts`, `src/game/heroes.ts`, `src/game/setupModel.ts` defaults (four brothers), seat colours, portraits/Gallery, peg fallback colours, personalities in `docs/design/T01-heroes.md` (§ per hero + cross-hero relationships), reactions and speech lines (en + hi, Hindi marked for native check), reactionMapper, sim, smoke/screenshot scripts that assume the old defaults |
| T46.5 Stages (UI) | Fable (Opus fallback) | plaques, chapter card, start-block name, i18n, settings if needed, tests, captures |
| T46.6 Integration | lead | merge 4 → 2 → 3 → 5, verify after each, full games, run the app |
