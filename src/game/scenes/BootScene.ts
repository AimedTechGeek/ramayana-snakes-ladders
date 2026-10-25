import Phaser from 'phaser';
import { getLocale, setLocale, t } from '../../i18n/i18n';
import { CSS, COLORS, TITLE_FONT } from '../palette';
import { loadGame } from '../save';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, 200, t('ui.title'), {
        fontFamily: TITLE_FONT,
        fontSize: '64px',
        color: CSS.gold,
        stroke: CSS.ink,
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    const saved = loadGame();
    if (saved) {
      this.createButton(480, 380, 320, 80, t('ui.resume'), COLORS.saffron, () =>
        this.scene.start('Board', { state: saved }),
      );
      this.createButton(480, 476, 320, 64, t('ui.newGame'), COLORS.parchment, () =>
        this.scene.start('Setup'),
      );
    } else {
      const play = this.add
        .text(this.scale.width / 2, 440, t('ui.play'), {
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

    // The chip names the language it switches to, in that language.
    const other = getLocale() === 'en' ? 'hi' : 'en';
    this.createButton(1112, 640, 144, 56, other === 'hi' ? 'हिंदी' : 'English', COLORS.parchment, () => {
      setLocale(other);
      this.scene.restart();
    });

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
