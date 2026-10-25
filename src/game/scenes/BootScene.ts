import Phaser from 'phaser';
import { CSS, COLORS, TITLE_FONT } from '../palette';
import { loadGame } from '../save';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 200, 'Ramayana Snakes & Ladders', {
        fontFamily: TITLE_FONT,
        fontSize: '64px',
        color: CSS.gold,
        stroke: CSS.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const saved = loadGame();
    if (saved) {
      this.createButton(480, 380, 320, 80, 'Resume', COLORS.saffron, () =>
        this.scene.start('Board', { state: saved }),
      );
      this.createButton(480, 476, 320, 64, 'New Game', COLORS.parchment, () => this.scene.start('Setup'));
    } else {
      const play = this.add
        .text(this.scale.width / 2, 440, 'Play', {
          fontFamily: TITLE_FONT,
          fontSize: '40px',
          color: CSS.ink,
          backgroundColor: CSS.saffron,
          padding: { x: 48, y: 12 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      play.on('pointerup', () => this.scene.start('Setup'));
    }

    this.game.registry.set('ready', true);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    fill: number,
    onPress: () => void,
  ): void {
    const box = this.add
      .rectangle(x, y, width, height, fill)
      .setOrigin(0)
      .setStrokeStyle(3, COLORS.ink)
      .setInteractive({ useHandCursor: true });
    box.on('pointerup', onPress);
    this.add
      .text(x + width / 2, y + height / 2, label, {
        fontFamily: TITLE_FONT,
        fontSize: '32px',
        color: CSS.ink,
      })
      .setOrigin(0.5);
  }
}
