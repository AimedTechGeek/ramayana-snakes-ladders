import Phaser from 'phaser';
import { BoardScene } from './game/scenes/BoardScene';
import { BootScene } from './game/scenes/BootScene';
import { CSS } from './game/palette';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: CSS.deepIndigo,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, BoardScene],
});

// Exposed for end-to-end tests and the smoke script.
window.__game = game;
