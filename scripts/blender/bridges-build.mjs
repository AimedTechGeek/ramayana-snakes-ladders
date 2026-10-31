// Builds the nine bridge GLBs: writes the deck samples from src/app/board3d/bridgeGeometry.ts to a scratch JSON,
// runs scripts/blender/bridges.py headless, and leaves the manifest (tris, bytes, deck check) next to the board code.
//   npm run blender:bridges
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ABUTMENT_H,
  ABUTMENT_WIDTH,
  DECK_WIDTH,
  FOOT_ABUTMENT_DEPTH,
  PARAPET_WIDTH,
  TOP_ABUTMENT_DEPTH,
  bridges,
} from '../../src/app/board3d/bridgeGeometry.ts';

const OUT_DIR = 'public/models/bridges';
const MANIFEST = 'src/app/board3d/bridgesManifest.json';
const scratch = join(tmpdir(), 'rsl-bridges-input.json');

const input = {
  consts: {
    deckWidth: DECK_WIDTH,
    parapetWidth: PARAPET_WIDTH,
    abutmentWidth: ABUTMENT_WIDTH,
    abutmentHeight: ABUTMENT_H,
    footAbutmentDepth: FOOT_ABUTMENT_DEPTH,
    topAbutmentDepth: TOP_ABUTMENT_DEPTH,
  },
  bridges: [...bridges().values()].map((b) => ({
    id: b.id,
    from: b.from,
    to: b.to,
    openings: b.openings,
    deck: b.deck.map((p) => [p.x, p.y, p.z, p.ground]),
  })),
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(scratch, JSON.stringify(input));

const result = spawnSync(
  process.execPath,
  ['scripts/blender/run.mjs', 'scripts/blender/bridges.py', scratch, OUT_DIR, MANIFEST],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
