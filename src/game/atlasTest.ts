// Dev-only three-frame test sheet (T42.1): proves pack, load and anchor read-back in the running game. Preload calls
// loadAtlasTest only under import.meta.env.DEV, so production builds drop it; the files live in tests/fixtures, not public/.
import Phaser from 'phaser';
import { atlasSheet, loadAtlas } from './assets';

export const ATLAS_TEST_KEY = 'atlas-test';

export function loadAtlasTest(scene: Phaser.Scene): void {
  loadAtlas(scene, atlasSheet(ATLAS_TEST_KEY, '/tests/fixtures/atlas'));
}
