import Phaser from 'phaser';
import { applyHiDpi, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../hidpi';
import { ASSETS } from '../assets';
import { COLORS } from '../palette';

const BAR = { width: 480, height: 20 };

/** First scene: rasterises the vector art, shows a progress bar, then hands over to Boot. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    applyHiDpi(this);
    const x = (LOGICAL_WIDTH - BAR.width) / 2;
    const y = LOGICAL_HEIGHT / 2;
    this.add.rectangle(x - 4, y - 4, BAR.width + 8, BAR.height + 8, COLORS.parchment, 0.3).setOrigin(0);
    const fill = this.add.rectangle(x, y, 0, BAR.height, COLORS.parchment).setOrigin(0);
    this.load.on('progress', (value: number) => {
      fill.width = BAR.width * value;
    });
    for (const asset of ASSETS) {
      this.load.svg(asset.key, asset.url, { width: asset.size, height: asset.size });
    }
  }

  create(): void {
    this.scene.start('Boot');
  }
}
