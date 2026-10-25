import Phaser from 'phaser';
import type { GameConfig } from '../../core/types';
import { CSS, TITLE_FONT } from '../palette';

/** Until the Setup screen exists, Play starts a two-seat Easy game. */
const DEFAULT_GAME: GameConfig = {
  level: 'easy',
  playOn: false,
  players: [
    { hero: 'rama', controller: 'human', name: 'Rama' },
    { hero: 'hanuman', controller: 'bot', name: 'Hanuman' },
  ],
};

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
    play.on('pointerup', () => this.scene.start('Board', { config: DEFAULT_GAME }));

    this.game.registry.set('ready', true);
  }
}
