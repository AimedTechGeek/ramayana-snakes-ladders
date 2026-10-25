import Phaser from 'phaser';
import { BoardScene } from './game/scenes/BoardScene';
import { BootScene } from './game/scenes/BootScene';
import { GalleryScene } from './game/scenes/GalleryScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { RotateScene } from './game/scenes/RotateScene';
import { SetupScene } from './game/scenes/SetupScene';
import { WinScene } from './game/scenes/WinScene';
import { CSS } from './game/palette';
import { initLocale } from './i18n/i18n';

const FONT_FACES = ['40px "Yatra One"', '40px "Noto Sans"'];
const FONT_WAIT_MS = 2000;

/** Waits for the webfonts so Phaser text is drawn in them; offline or slow fonts never block the game. */
async function waitForFonts(): Promise<void> {
  const loads = FONT_FACES.map((face) => document.fonts.load(face).catch(() => []));
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, FONT_WAIT_MS));
  await Promise.race([Promise.all(loads), timeout]);
}

async function startGame(): Promise<void> {
  await waitForFonts();
  initLocale();

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
    // #gallery opens the hero expression sheet instead of the title screen.
    // RotateScene is listed last and starts active (see its constructor), so it stays above the others.
    scene:
      location.hash === '#gallery'
        ? [GalleryScene]
        : [PreloadScene, BootScene, SetupScene, BoardScene, WinScene, RotateScene],
  });

  // Exposed for end-to-end tests and the smoke script.
  window.__game = game;
}

void startGame();
