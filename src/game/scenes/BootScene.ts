import Phaser from 'phaser';
import { t } from '../../i18n/i18n';
import { CSS, TITLE_FONT } from '../palette';

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

    this.game.registry.set('ready', true);
  }
}
