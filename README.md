# Ramayana Snakes & Ladders

Snakes & Ladders, retold through the Ramayana. Every ladder and every snake is a moment from the epic, so the board tells the story from Ayodhya's gate, through the forest and across to Lanka, and back to Ayodhya's throne at square 144. Four heroes play it, each with their own voice and feelings, in English or Hindi. It is built with Phaser 3 and TypeScript.

![The board mid-game](docs/images/03-board.png)

## Play

**https://aimedtechgeek.github.io/ramayana-snakes-ladders/**

The link goes live once GitHub Pages is enabled for the repository (see [Deploying](#deploying)). Until then, run the game locally with `npm run dev`.

New to the game? Read the illustrated [player guide](docs/USER_GUIDE.md).

## Features

- Two to four seats, each Human, Bot or Empty, with a choice of hero for each seat.
- Three board levels (Easy, Medium, Hard). Each level uses the same story map with a different mix of ladders and snakes.
- A story-ordered board of 9 ladders and 13 snakes, each named after a Ramayana event.
- Heroes that react to every move with faces, gestures and speech, in English and Hindi.
- Autosave: close the window and resume where you stopped.
- Sound made in the browser with the Web Audio API, with mute, and a Fast mode.
- Mouse, touch and keyboard controls, and a layout for laptops, tablets and phones in landscape.
- No accounts, and no game data leaves the device.

## Development

Requires Node.js 22 (see `.nvmrc`).

| Command               | What it does                                                                     |
| --------------------- | -------------------------------------------------------------------------------- |
| `npm install`         | Install dependencies.                                                            |
| `npm run dev`         | Start the Vite development server.                                               |
| `npm test`            | Run the unit tests (Vitest).                                                     |
| `npm run sim`         | Simulate many games with the real rules engine and check the balance thresholds. |
| `npm run verify`      | Run the full check: lint, tests, simulation, build and smoke test.               |
| `npm run smoke`       | Serve the last build, play it in Microsoft Edge and fail on any error.           |
| `npm run devices`     | Check the canvas fit, errors and frame rate at five device sizes.                |
| `npm run screenshots` | Regenerate the images in `docs/images/` (run `npm run build` first).             |
| `npm run art`         | Regenerate the vector art in `public/assets/`.                                   |
| `npm run art:check`   | Validate the vector art.                                                         |

## Project structure

| Path              | Contents                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `src/core/`       | Rules engine, boards, dice and events. Plain TypeScript with no Phaser, so it is unit tested.  |
| `src/game/`       | Phaser scenes (Boot, Setup, Board, Win, Rotate, Gallery), layout, audio, effects and autosave. |
| `src/characters/` | The hero figures, faces, reactions and how events map to reactions.                            |
| `src/i18n/`       | English and Hindi strings.                                                                     |
| `sim/`            | Monte Carlo simulator that drives the real rules engine.                                       |
| `scripts/`        | Smoke, device and screenshot checks, and the art generator in `scripts/art/`.                  |
| `public/assets/`  | Art: board and figurine atlases, tokens and the favicon.                                       |
| `tests/`          | Unit tests.                                                                                    |
| `docs/design/`    | Design documents: heroes, style guide, board art, UX and emotion timing.                       |
| `docs/review/`    | Review and playtest notes.                                                                     |
| `docs/images/`    | Screenshots used by this README and the player guide.                                          |

## How it was built

The game was built in milestones:

| Milestone   | What it delivered                                                                   |
| ----------- | ----------------------------------------------------------------------------------- |
| M0 Design   | Hero personalities, style guide, board art, UX and emotion timing (`docs/design/`). |
| M1 Core     | The rules engine, story-ordered boards, the simulator and continuous integration.   |
| M2 Playable | Setup, board, dice, bots, autosave, and the win and rotate overlays.                |
| M3 Alive    | Character reactions, speech bubbles, derived events, and English and Hindi.         |
| M4 Art      | The vector board, tokens, snake heads, themed ladders and credits.                  |
| M5 Polish   | Sound effects and drone, visual effects, device checks, and a respect-rules review. |

The project was built with Claude models (Anthropic): design by Fable, complex logic by Opus, and simpler tasks by Sonnet and Haiku. The repository owner reviewed the work.

## Credits and licence

- The game is released under the MIT licence. See [LICENSE](LICENSE).
- [CREDITS.md](CREDITS.md) lists the artwork, fonts (Yatra One, Noto Sans and Noto Sans Devanagari, under the SIL Open Font License), software and the note on the Ramayana story.

## Deploying

The game is deployed to GitHub Pages by `.github/workflows/deploy.yml`.

1. In the GitHub repo, go to Settings → Pages and set Source to "GitHub Actions", then add the repository variable `DEPLOY_PAGES` = `true` (Settings → Secrets and variables → Actions → Variables). Until then CI runs every check but skips the deploy job.
2. Every push to `main` runs lint, test, sim and build, then deploys to https://aimedtechgeek.github.io/ramayana-snakes-ladders/ . Pull requests run the same checks but do not deploy.
3. The build uses `base: './'` (see `vite.config.ts`), so it works under the repo sub-path.
