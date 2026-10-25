import Phaser from 'phaser';
import { BoardScene } from './game/scenes/BoardScene';
import { BootScene } from './game/scenes/BootScene';
import { RotateScene } from './game/scenes/RotateScene';
import { SetupScene } from './game/scenes/SetupScene';
import { WinScene } from './game/scenes/WinScene';
import { CSS } from './game/palette';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 720,
  backgroundColor: CSS.deepIndigo,
  dom: { createContainer: true },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // RotateScene is listed last and starts active (see its constructor), so it stays above the others.
  scene: [BootScene, SetupScene, BoardScene, WinScene, RotateScene],
});

// Exposed for end-to-end tests and the smoke script.
window.__game = game;
