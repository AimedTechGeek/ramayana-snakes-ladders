# T05 — Emotion and Timing

Scope: how an event becomes faces, tweens and bubbles on every seated hero, and the exact
numbers the engine uses. Data file: `reactions.json`. Lines: `speech.en.json`.

## 1. Reaction pipeline

When the rules engine emits an event `{ event, actorSeat }`:

| Step | Rule |
|---|---|
| 1. Resolve roles | The actor's hero gets role `self`; every other seated hero gets role `other`. Retired (ranked) players still react as `other`. |
| 2. Look up | `reactions[hero][role][event]` -> `{ emotion, intensity, tween, durationMs }`. |
| 3. Choose speakers | The `self` hero always speaks. Exactly one bystander is chosen uniformly at random from the `other` heroes (none if there are no bystanders). Nobody else shows a bubble. |
| 4. Stagger | `self` starts at t=0. Each bystander starts at t = random integer in `timing.bystanderStaggerMs` (80..150 ms), drawn independently, so bystanders never move in lockstep. |
| 5. Play | Swap the face layer to `emotion`, run `tween` scaled by `intensity`, keep the face for `max(durationMs, timing.faceHoldMs)` then return to `idle` (100 ms cross-fade). |
| 6. Bubble | For speakers: pick a line from `speech.en.json["<hero>.<role>.<event>"]` (not the same line as last time for that key), show it for `timing.bubbleMs`, pop-in 120 ms, fade-out 150 ms. |
| 7. Interrupt | A new event for the same hero cancels the running tween and face hold, snaps to `idle`, then starts the new reaction. Bubbles are replaced immediately. |

Events that can coincide on one move (for example `roll6` then `ladder`) are queued per
hero and played back to back; the move animation does not wait for reactions, except for
`win` and `lose`, which must finish before the Win screen opens.

Where it plays: the hero figure on each seat card (T04 section 4.2). The board token does
not change expression; it only hops.

## 2. Timing constants (`reactions.json` -> `timing`)

| Key | Value | Meaning |
|---|---|---|
| `stepMs` | 120 | One token hop between adjacent squares, normal speed |
| `fastStepMs` | 40 | Hop duration when the Fast toggle is on |
| `botDelayMs` | 1000 | Pause before a bot rolls, so humans can follow the turn |
| `bystanderStaggerMs` | [80, 150] | Random start delay range for bystander reactions |
| `bubbleMs` | 1800 | Speech bubble visible time |
| `faceHoldMs` | 1200 | Default minimum time an expression stays before returning to idle |

Fast mode: `stepMs -> fastStepMs`, every `durationMs` halved, `faceHoldMs` halved,
`bubbleMs` 1200, `botDelayMs` 400. Stagger range unchanged.

## 3. Reaction entry schema

```json
"<hero>": {
  "self":  { "<event>": { "emotion": "...", "intensity": 0.0-1.0, "tween": "...", "durationMs": 0 } },
  "other": { "<event>": { ... } }
}
```

| Field | Values |
|---|---|
| `emotion` | `idle, happy, excited, scared, sad` — face layer to show (T02 section 4) |
| `intensity` | 0..1, scales the tween amplitude (see section 4) and bubble pop scale (1.0 + 0.1 * intensity) |
| `tween` | `none, bounce, leap, somersault, cower, shake, slump, nod, clap, stomp, fidget, bless, salute, sigh` |
| `durationMs` | Total tween time, integer milliseconds |

All 4 heroes x 2 roles x 12 events = 96 entries are present.

## 4. Tween catalogue

Amplitudes below are for intensity 1.0 on the 80x112 seat-card figure; multiply distances,
angles and scale deltas by `intensity`. Minimum visible amplitude is clamped at 25% so a
0.2 reaction still reads. Ease is `Sine.easeInOut` unless stated. The shadow ellipse stays
on the ground and shrinks to 70% during airborne frames.

| Tween | Motion | Notes |
|---|---|---|
| `none` | No body motion; only the face changes | Used for composed waiting |
| `bounce` | 2 hops of 10 px up, `Quad.easeOut` up / `Bounce.easeOut` down | Cheerful |
| `leap` | One hop 22 px up with 6% squash on take-off and landing, slight forward lean 6 deg | Heroic |
| `somersault` | `leap` plus a full 360 deg rotation around the figure's centre during the airborne phase | Hanuman only in practice |
| `cower` | Scale to 88% height, shift 6 px down, knees-bent pose via 6 deg lean back, hands (prop layer) raised; hold, then recover | Comic fear |
| `shake` | Horizontal jitter +-5 px at 18 Hz for the duration | Anger / shock |
| `slump` | Scale to 92% height, 8 deg forward lean, 8 px drop, slow recover | Comic deflation; forbidden for Rama and Sita |
| `nod` | Head layer rotates +6 deg then back, twice; body still | Calm acknowledgement |
| `clap` | Arm/prop layer scales 90%-105% four times in the duration; a 3-dot `gold` sparkle puff | Celebration |
| `stomp` | 4 px drop with 8% squash, then 2 px recoil; one `parchment` dust puff at the feet | Indignation / vigour |
| `fidget` | Alternating 3 px left/right weight shift every 150 ms with 2 deg lean | Impatience |
| `bless` | Right-hand (prop) layer rises 10 px with a 4 deg body lean forward, holds 60% of the duration, lowers; a soft `gold` glow ring expands from the chest | Benediction |
| `salute` | Head layer dips 8 deg once, prop hand to chest, hold, recover | Sporting respect |
| `sigh` | Body scales 103% then 97% height (breath), head dips 4 deg, slow `Sine.easeInOut` | Quiet disappointment or relief |

## 5. Respect rules in the data

| Hero | Never uses | Reasoning |
|---|---|---|
| Rama | `somersault, slump, cower, stomp, fidget, shake` | Composed and dignified at every moment |
| Sita | `somersault, slump, cower, stomp, fidget, shake` | Calm; her sorrow is a sigh, never a collapse |
| Both | `scared` face | They show concern via `sad` at low intensity or `idle` |
| Lakshmana, Hanuman | — | Full catalogue allowed; they carry the comedy |

`reactions.json` is checked against this table by `scripts/check-reactions` (to be added
with the implementation); until then the author verified it by script before commit.

## 6. Reaction map (summary)

Format: `emotion / tween / intensity`.

| Event | Rama self | Sita self | Lakshmana self | Hanuman self |
|---|---|---|---|---|
| roll6 | happy / nod / .5 | happy / nod / .5 | excited / stomp / .7 | excited / bounce / .8 |
| ladder | happy / bless / .6 | happy / bounce / .6 | happy / bounce / .6 | excited / leap / .7 |
| ladderBig | excited / leap / .7 | excited / clap / .8 | excited / leap / .9 | excited / somersault / 1 |
| snake | sad / sigh / .4 | sad / sigh / .4 | scared / shake / .6 | scared / cower / .6 |
| snakeBig | sad / sigh / .6 | sad / sigh / .6 | sad / stomp / .8 | scared / somersault / .9 |
| overtake | happy / salute / .5 | happy / nod / .5 | excited / salute / .7 | excited / leap / .8 |
| overtaken | idle / nod / .3 | happy / nod / .3 | sad / stomp / .5 | sad / fidget / .4 |
| nearMiss | happy / nod / .4 | happy / sigh / .4 | happy / stomp / .5 | happy / bounce / .6 |
| waiting | idle / none / .3 | idle / none / .3 | idle / fidget / .5 | excited / fidget / .7 |
| tripleSix | sad / sigh / .3 | sad / sigh / .3 | sad / stomp / .7 | sad / slump / .5 |
| win | excited / bless / .9 | excited / clap / .9 | excited / leap / 1 | excited / somersault / 1 |
| lose | happy / clap / .6 | happy / clap / .6 | sad / fidget / .5 | happy / clap / .6 |

| Event | Rama other | Sita other | Lakshmana other | Hanuman other |
|---|---|---|---|---|
| roll6 | happy / nod / .3 | happy / nod / .3 | idle / fidget / .3 | excited / bounce / .6 |
| ladder | happy / nod / .4 | happy / clap / .4 | happy / nod / .4 | excited / clap / .6 |
| ladderBig | excited / clap / .6 | excited / clap / .6 | excited / stomp / .6 | excited / leap / .9 |
| snake | sad / sigh / .3 | sad / sigh / .3 | happy / clap / .5 | scared / cower / .5 |
| snakeBig | sad / bless / .4 | sad / bless / .4 | scared / shake / .5 | scared / shake / .7 |
| overtake | happy / salute / .4 | happy / nod / .4 | sad / stomp / .4 | excited / bounce / .6 |
| overtaken | idle / nod / .3 | idle / nod / .3 | idle / fidget / .4 | happy / clap / .5 |
| nearMiss | happy / nod / .3 | happy / sigh / .3 | scared / shake / .4 | happy / bounce / .5 |
| waiting | idle / none / .2 | idle / none / .2 | idle / fidget / .6 | excited / fidget / .6 |
| tripleSix | idle / sigh / .3 | sad / sigh / .2 | happy / clap / .6 | happy / clap / .6 |
| win | happy / clap / .8 | happy / clap / .8 | happy / salute / .5 | excited / somersault / .9 |
| lose | happy / bless / .5 | happy / bless / .5 | happy / salute / .4 | happy / bounce / .6 |

Design intent: `self` reactions are stronger than `other` by 0.1-0.3 so the actor reads as
the focus; Hanuman is the loudest in every column; Rama and Sita stay within 0.2-0.9 and
never use an airborne-comic tween.

## 7. Worked timeline (normal speed, Hanuman lands on a snake, 4 players)

| t (ms) | What |
|---|---|
| 0 | Token glide along the snake body ends; event `snake` for Hanuman |
| 0 | Hanuman: face `scared`, `cower` 700 ms, bubble "Oops! Slipped on a snake!" |
| 0 | Random bystander chosen: Lakshmana |
| 80-150 | Rama: `sad`, `sigh` 600 ms (no bubble); Sita: `sad`, `sigh` 600 ms (no bubble); Lakshmana: `happy`, `clap` 600 ms, bubble "Ha! Watch your step!" |
| 700 | Hanuman tween done; face held until 1200 |
| 1200 | Hanuman's face hold ends, back to idle |
| 1280-1350 | Bystanders' holds end (start offset + 1200), back to idle |
| 1800 | Bubbles fade (1950 fully gone) |
| 1950 | Next turn may begin (bot: + `botDelayMs`) |
