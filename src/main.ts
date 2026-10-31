import Phaser from 'phaser';
import { BoardScene } from './game/scenes/BoardScene';
import { BootScene } from './game/scenes/BootScene';
import { GalleryScene } from './game/scenes/GalleryScene';
import { PreloadScene } from './game/scenes/PreloadScene';
import { RotateScene } from './game/scenes/RotateScene';
import { SetupScene } from './game/scenes/SetupScene';
import { WinScene } from './game/scenes/WinScene';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './game/hidpi';
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

/** Phaser renders Text at resolution 1 unless told otherwise; default every Text to DPR so it stays sharp under camera zoom. */
function installHiDpiText(): void {
  const factory = Phaser.GameObjects.GameObjectFactory.prototype;
  const original = factory.text;
  factory.text = function (
    this: Phaser.GameObjects.GameObjectFactory,
    x: number,
    y: number,
    text: string | string[],
    style?: Phaser.Types.GameObjects.Text.TextStyle,
  ): Phaser.GameObjects.Text {
    return original.call(this, x, y, text, { resolution: DPR, ...style });
  };
}

async function startGame(): Promise<void> {
  await waitForFonts();
  initLocale();
  installHiDpiText();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: LOGICAL_WIDTH * DPR,
    height: LOGICAL_HEIGHT * DPR,
    backgroundColor: CSS.deepIndigo,
    dom: { createContainer: true },
    // Atlas sheets are power-of-two; mipmaps stop fine textures sparkling when drawn small at Fit zoom (T42 spec 3.1).
    render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
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
