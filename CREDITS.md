# Credits

## 1. Game

**Ramayana Snakes & Ladders** is released under the MIT licence.
Copyright (c) 2026 AimedTechGeek. See [LICENSE](LICENSE).

## 2. Artwork and 3D models

Every model under `public/models/` is original and was made for this project. The GLB files (board, props,
landmarks, die and tray, the four heroes with their rigs and animation clips, the 13 snakes and the 9 bridges) are
built from code by the Blender Python scripts in `scripts/blender/` (`npm run blender:*`), run headless in Blender 5.2,
and exported as glTF binaries with meshopt compression. No model was downloaded or bought, and none came from an AI
image or 3D generator.

Other art is drawn by the game's own code or written by hand:

- The heroes' faces are painted at runtime onto a canvas texture (`src/app/board3d/heroFace.ts`).
- The fog, mist, water, square-number chips and effects are generated in code (`src/app/board3d/`).
- The seat badges are coloured monograms drawn with CSS (`src/app/ui/Portrait.tsx`).
- The icons in `public/icons.svg` and the favicon `public/assets/icons/favicon.svg` are hand-authored SVG.

The art was created with AI assistance (Claude) and is released under the same MIT licence as the game.

Design rules for the art are in `docs/design/T44-diorama-3d.md`, with the earlier `docs/design/T02-style-guide.md`,
`docs/design/T03-board-art.md` and `docs/design/T42-living-board.md`. The hero personalities and reactions are in
`docs/design/T01-heroes.md` and `docs/design/T05-emotion-timing.md`.

## 3. Fonts

The fonts are served with the game from `public/fonts/` (WOFF2, declared in `src/app/tokens.css`); the page loads no
fonts from other sites. They are licensed under the [SIL Open Font License 1.1](https://openfontlicense.org), and each
licence text is next to the font files.

| Font      | Weights       | Use                         | Copyright                                     | Licence file                    |
|-----------|---------------|-----------------------------|-----------------------------------------------|---------------------------------|
| Rozha One | 400           | The title and display text  | Indian Type Foundry, 2014                     | `public/fonts/OFL-RozhaOne.txt` |
| Eczar     | 500, 600      | Headings, names and banners | The Eczar Project Authors, 2014               | `public/fonts/OFL-Eczar.txt`    |
| Poppins   | 400, 500, 600 | Body text and controls      | The Poppins Project Authors, 2020             | `public/fonts/OFL-Poppins.txt`  |

All three fonts include Devanagari, so the Hindi text uses the same fonts as the English.

## 4. Software

Versions are the installed versions from `node_modules/<package>/package.json`.
Licences are the `license` field of each package.

| Package | Version | Role | Licence |
|---|---|---|---|
| react, react-dom | 19.3.1 | User interface | MIT |
| three | 0.179.1 | 3D rendering (WebGL) | MIT |
| @react-three/fiber | 9.8.2 | React renderer for three.js | MIT |
| @react-three/drei | 10.7.9 | three.js helpers: model loading, camera controls | MIT |
| camera-controls | 3.1.2 | The board camera (used through drei) | MIT |
| three-stdlib | 2.36.1 | glTF loader and meshopt decoder (used through drei) | MIT |
| vite | 8.3.5 | Dev server and build | MIT |
| @vitejs/plugin-react | 6.1.2 | React support for Vite | MIT |
| typescript | 6.0.3 | Language and type checking | Apache-2.0 |
| vitest | 5.0.5 | Unit tests | MIT |
| eslint | 10.13.0 | Linting | MIT |
| @eslint/js | 10.0.1 | ESLint core rules | MIT |
| typescript-eslint | 8.72.0 | TypeScript lint rules | MIT |
| eslint-plugin-react-hooks | 7.1.1 | React hooks lint rules | MIT |
| globals | 17.13.0 | ESLint global definitions | MIT |
| prettier | 3.9.10 | Code formatting | MIT |
| playwright-core | 1.64.1 | Browser automation (smoke, devices, screenshots) | Apache-2.0 |
| tsx | 4.23.15 | Run TypeScript scripts | MIT |
| anatomy kit | vendored | Isometric solids kit (`src/game/iso/isoKit.ts`), still used by the board projection | MIT |

Tools that are not shipped with the game:

| Tool | Version | Role | Licence |
|---|---|---|---|
| Blender | 5.2 | Builds every 3D model from the scripts in `scripts/blender/` | GNU GPL (GPL-3.0-or-later, per its `license/license.md`); the models it produces are not covered by Blender's licence |
| Microsoft Edge | installed | Headless browser for the smoke, device and screenshot scripts | Proprietary |

## 5. Audio

All sounds are synthesized at runtime with the Web Audio API (`src/game/audio.ts`); no audio files are included.

## 6. Story

The story is based on the Ramayana, the ancient Sanskrit epic attributed to Valmiki. The
Ramayana is in the public domain. The game text, including all dialogue and UI strings,
is original.

## 7. Built with AI assistance

The design, code and 3D models were produced with Claude (Anthropic) models. The repository
owner reviewed the work.
