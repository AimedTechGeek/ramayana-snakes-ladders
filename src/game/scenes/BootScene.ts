import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Ramayana Snakes & Ladders', {
        fontFamily: 'serif',
        fontSize: '48px',
        color: '#f2b632',
      })
      .setOrigin(0.5);

    this.game.registry.set('ready', true);
  }
}
