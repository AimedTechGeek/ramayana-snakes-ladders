# T04 — UX and Layout

Scope: screen flow and the exact pixel layout of every screen on the logical 1280x720
canvas. Phaser `Scale.FIT` + `autoCenter`, letterbox colour `deepIndigo`. All coordinates
are logical canvas pixels, origin top-left. Visual treatment of each element follows
`T02-style-guide.md` section 7 (palm-leaf manuscript UI).

## 1. Screen flow

```
Boot ──(no save)──> Setup ──Start──> Board ──144 reached──> Win
 │                                   ▲  │                   │
 └──(save exists)─> Resume prompt ───┘  │                   ├─ Play Again ─> Board (same seats, fresh state)
        │  New Game ──> Setup           │                   ├─ Play On ────> Board (winner retired, others continue)
        └────────────────────────────── ┘                   └─ Menu ───────> Boot
Any screen ── portrait orientation ──> Rotate overlay (pauses) ── landscape ──> back
Board ── Menu chip / Esc ──> Pause modal (Resume, Speed, Mute, New Game)
```

| Transition | Rule |
|---|---|
| Boot -> Resume prompt | Shown only if `localStorage["rsl.save.v1"]` parses and its `version` matches. |
| Resume prompt -> Board | Restores seats, positions, whose turn, consecutive-six counter, settings. |
| Resume prompt -> New Game | Goes to Setup. The old save is kept until Start is pressed, so backing out loses nothing. |
| Setup -> Board | Requires >= 2 non-empty seats; otherwise Start is disabled. |
| Board autosave | After every completed turn and on every settings change. Cleared when a game ends with no "Play On". |
| Board -> Win | The moment a token lands exactly on 144 (after its reaction plays). |
| Win -> Play On | Winner's seat is marked "retired" with a rank badge; play continues; each later arrival at 144 gets the next rank; when one unranked player remains the Win screen shows the final standings. |
| Rotate overlay | Shown whenever `window.innerHeight > window.innerWidth`. Pauses tweens, bot timers and input. Auto-dismisses. |

Keyboard (desktop): `Space`/`Enter` roll, `F` fast toggle, `M` mute, `Esc` pause menu.
Touch targets: every interactive element is >= 48x48 px; listed sizes below are the hit
areas, not just the drawn shapes.

## 2. Boot screen

Background `deepIndigo` with a 15%-alpha board silhouette centred.

| Element | Rect (x, y, w, h) | Notes |
|---|---|---|
| Title `ui.title` | (0, 160, 1280, 80) centred | Yatra One 64px `gold`, `ink` 4px outline |
| Lotus divider | (540, 256, 200, 24) | `saffron` cutout |
| Play `ui.play` (no save) | (480, 400, 320, 80) | Primary button |
| Resume `ui.resume` (save exists) | (480, 380, 320, 80) | Primary button, replaces Play |
| New Game `ui.newGame` (save exists) | (480, 476, 320, 64) | Secondary button |
| Mute chip | (1120, 640, 128, 56) | Persisted setting |

The "Resume prompt" is this same screen with the two-button variant; no separate modal.

## 3. Setup screen

Background `deepIndigo`. Title strip, four seat columns, bottom bar.

| Element | Rect | Notes |
|---|---|---|
| Menu chip `ui.menu` | (24, 24, 120, 56) | Back to Boot |
| Title `ui.title` | (160, 24, 960, 64) centred | Yatra One 40px `gold` |
| Seat column k (k = 0..3) | (24 + 312k, 104, 296, 456) | Parchment manuscript panel |
| Bot icon (decorative) | (24, 604, 32, 32) | Marks the difficulty control as a bot setting (no string in v1, see section 8) |
| Difficulty segmented control | (72, 592, 360, 56) | Segments `ui.easy` / `ui.medium` / `ui.hard`, 120 wide each. Applies to all bots. |
| Start `ui.start` | (960, 584, 296, 72) | Primary; disabled (55% alpha) while < 2 non-empty seats |

Seat column internals, relative to the column origin (cx, 104):

| Element | Rect (relative) | Notes |
|---|---|---|
| Seat label `ui.seat` with `{n}` = k+1 | (16, 12, 264, 24) | 18px `indigo` |
| Controller segmented control | (16, 40, 264, 56) | `ui.human` / `ui.bot` / `ui.empty`, 88 wide each |
| Hero picker left arrow | (16, 160, 56, 56) | Cycles hero |
| Hero portrait | (72, 112, 152, 152) | Hero body SVG scaled to fit, `idle` face; tapping the portrait also cycles forward |
| Hero picker right arrow | (208, 160, 56, 56) | |
| Hero name caption | (16, 276, 264, 28) centred | 22px Yatra One, hero accent colour |
| Name label `ui.name` | (16, 316, 264, 20) | 14px |
| Name field | (16, 336, 264, 48) | Text input (DOM element overlaid by Phaser), max 12 chars, default = hero name. On Bot: default "<hero>" too; still editable. |

Column states: `Empty` dims the whole column to 60% alpha and hides arrows + name field;
the portrait stays (greyscale) so the slot is recognisable. Defaults: seat 1 Human/Rama,
seat 2 Bot/Hanuman, seats 3-4 Empty/Lakshmana, Empty/Sita.

Hero uniqueness: each hero can be held by one seat. Cycling onto a hero another seat holds
swaps the two seats' heroes (both portraits animate the swap with a 200ms cross-slide).

## 4. Board screen (the main HUD)

Background `deepIndigo`. The board is a 672x672 square at (24, 24); the right panel
occupies x 720..1256.

### 4.1 Board

| Item | Value |
|---|---|
| Board rect | (24, 24, 672, 672), 12x12 cells of 56px |
| Border | 4px `gold` outside, 2px `ink` outside that (drawn in the 24px margin) |
| Cell of square n | row `r = floor((n-1)/12)` (0 = bottom), `i = (n-1) % 12`, col `c = r even ? i : 11-i`; pixel origin `(24 + 56c, 24 + 56(11-r))` |
| Token position | Cell centre plus stacking offset (T02 section 5). Token sprite 40px. |
| Movement | One hop per square, `stepMs` per hop (T05). Ladders/snakes: a single eased glide along the rail/body path over `max(400, 25 * |jump|)` ms. |
| Bounce back | Hops to 144 then hops back the remainder; a small `parchment` "!" puff at 144. |

### 4.2 Seat cards

Occupied seats are stacked from the top in seat order; empty seats are not drawn.

| Card index j (0..3) | Rect |
|---|---|
| j | (720, 24 + 128j, 536, 120) |

Card internals, relative to the card origin:

| Element | Rect (relative) | Notes |
|---|---|---|
| Active bar | (0, 0, 8, 120) | `saffron`, only on the active seat; card outline also becomes `saffron` 4px |
| Hero figure | (8, 4, 80, 112) | Body SVG (200x300) at 0.37 scale, anchored bottom-centre at (48, 116). This is where face swaps and tweens play. |
| Name | (100, 12, 300, 28) | 24px Yatra One `ink`, ellipsis past 300px |
| Position badge | (100, 46, 72, 24) | Square-shaped `indigo` chip with the current square number in `parchment` 16px; shows a gate icon before the first move and a laurel + rank after retiring (no text needed) |
| Controller pill | (412, 10, 116, 24) | `ui.human`, or `ui.bot` + " · " + difficulty, 14px |
| Speech bubble | (96, 70, 432, 42) | Appears only for the speaking heroes (T05). Tail points up-left to the figure's head. 18px `ink` text, single line. |

### 4.3 Dice block and HUD chips (below the cards)

| Element | Rect | Notes |
|---|---|---|
| Dice button | (720, 552, 128, 128) | Shows the current face (96px art). Enabled only for a human whose turn it is. Pulses scale 1.0-1.05 at 1s while enabled. Bot turns show the same button disabled while it rolls itself. |
| Turn banner `ui.yourTurn` | (864, 548, 392, 32) | 26px Yatra One `parchment`; 12px dot in the hero's accent colour before the name |
| Roll hint `ui.rollHint` | (864, 584, 392, 24) | 16px `parchment` at 70% alpha; hidden on bot turns and during animations |
| Fast chip `ui.fast` | (864, 624, 128, 56) | Toggle; active = `indigo` fill. Switches `stepMs` to `fastStepMs` and halves all reaction durations (T05). |
| Mute chip `ui.mute` | (1000, 624, 128, 56) | Toggle |
| Menu chip `ui.menu` | (1136, 624, 120, 56) | Opens the pause modal |

### 4.4 Pause modal

Scrim `deepIndigo` 70% over the whole canvas. Panel (400, 160, 480, 400), manuscript style.

| Element | Rect | Notes |
|---|---|---|
| Resume `ui.resume` | (440, 200, 400, 64) | Primary |
| Speed row: label `ui.speed` + Fast chip `ui.fast` | label (440, 288, 200, 56); chip (712, 288, 128, 56) | Same state as the HUD chip |
| Mute chip `ui.mute` | (712, 360, 128, 56) | label-less; the chip text is enough |
| New Game `ui.newGame` | (440, 448, 400, 64) | Secondary; goes to Setup (save kept until Start) |

### 4.5 Turn sequence (for timing reference)

1. Turn starts: active card highlights, banner updates. If position >= 132 fire `waiting`.
2. Human taps dice (or bot waits `botDelayMs`) -> dice rolls 600ms -> result shown.
3. Token hops; events fire on landing (`roll6`, `ladder`, `snake`, `overtake`, `nearMiss`,
   ...). Each event triggers the reaction broadcast described in T05.
4. Extra roll on 6 (same player); third consecutive 6 fires `tripleSix` and ends the turn
   without moving.
5. Autosave, next seat.

## 5. Win screen

Overlay on the Board scene (board stays visible and dimmed). Scrim `deepIndigo` 70%.
Panel (200, 80, 880, 560), manuscript style with `gold` confetti dots falling behind it.

| Element | Rect | Notes |
|---|---|---|
| Winner figure | (240, 140, 200, 300) | Full-size body, `excited` face, win tween looping every 2.5s |
| Title `ui.winner` | (470, 140, 560, 96) | 36px Yatra One `ink`, wraps to 2 lines |
| Other heroes row | (470, 300, 560, 140) | Each non-winner as an 80x120 figure with their `lose` face/tween, spaced 140px apart from x=470; a small rank badge above retired players |
| Play Again `ui.playAgain` | (470, 560, 240, 72) | Primary |
| Play On `ui.playOn` | (726, 560, 200, 72) | Secondary; hidden when fewer than 2 unranked players remain |
| Menu `ui.menu` | (942, 560, 120, 72) | Secondary; clears the save, returns to Boot |

## 6. Rotate overlay

Full-canvas `deepIndigo`. Rotate-phone icon 160x160 at (560, 200) (`parchment` cutout
with a `saffron` arrow), text `ui.rotate` at (0, 400, 1280, 40) centred, 28px `parchment`.
No buttons. Shown above every other scene.

## 7. Hit-area and accessibility summary

| Control | Hit size |
|---|---|
| Dice | 128 x 128 |
| HUD chips | 128 x 56 (Menu 120 x 56) |
| Setup arrows | 56 x 56 |
| Segmented control segments | 88 x 56 (controller), 120 x 56 (difficulty) |
| Buttons | >= 200 x 64 |
| Name field | 264 x 48 |
| Minimum gap between adjacent hit areas | 8 px |

Text never below 14px on the logical canvas. Toggle state is shown by fill colour AND an
icon change (speaker / crossed speaker, single / double chevron), never colour alone.

## 8. Gaps in the fixed string set (recommended for v1.1, not added in v1)

| Need | Workaround in v1 |
|---|---|
| "Difficulty" caption for the Setup selector | Bot icon beside the control |
| "Choose at least 2 seats" hint | Start button disabled state only |
| "Square {n}" / "Not started" / "Winner" position labels | Number badge, gate icon, laurel icon |
