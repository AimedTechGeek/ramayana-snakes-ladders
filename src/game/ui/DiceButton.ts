import Phaser from 'phaser';
import { COLORS } from '../palette';
import { tweenAsync } from '../tween';

const ART = 96;
const TUMBLE_MS = 600;
const FLICKERS = 10;
const GRID = 21;

/** Pip centres per face on a 3x3 grid, in units of GRID from the die centre. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [
    [-1, -1],
    [1, 1],
  ],
  3: [
    [-1, -1],
    [0, 0],
    [1, 1],
  ],
  4: [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ],
  5: [
    [-1, -1],
    [1, -1],
    [0, 0],
    [-1, 1],
    [1, 1],
  ],
  6: [
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [1, 1],
  ],
};

/** The 128x128 dice button of the HUD: a parchment die drawn with Graphics, no image assets. */
export class DiceButton extends Phaser.GameObjects.Container {
  private readonly art: Phaser.GameObjects.Graphics;
  private enabled = false;
  private pulse?: Phaser.Tweens.Tween;

  /** `x`,`y` is the centre of the 128x128 hit area. */
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.art = scene.add.graphics();
    this.add(this.art);
    this.setSize(128, 128);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (this.enabled) this.emit('press');
    });
    this.drawFace(1);
    this.setEnabled(false);
    scene.add.existing(this);
  }

  setEnabled(on: boolean): this {
    this.enabled = on;
    this.pulse?.stop();
    this.pulse = undefined;
    this.setScale(1);
    this.setAlpha(on ? 1 : 0.55);
    if (on) {
      this.pulse = this.scene.tweens.add({
        targets: this,
        scale: 1.05,
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return this;
  }

  /** Tumble for about 600ms, flickering random faces, then settle on `value`. */
  async roll(value: number): Promise<void> {
    const progress = { t: 0 };
    let step = -1;
    await tweenAsync(this.scene, {
      targets: progress,
      t: 1,
      duration: TUMBLE_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        this.art.setRotation(progress.t * Math.PI * 4);
        const now = Math.floor(progress.t * FLICKERS);
        if (now !== step) {
          step = now;
          this.drawFace(Phaser.Math.Between(1, 6));
        }
      },
    });
    this.art.setRotation(0);
    this.drawFace(value);
  }

  private drawFace(value: number): void {
    const half = ART / 2;
    const g = this.art.clear();
    g.fillStyle(COLORS.parchment, 1);
    g.fillRoundedRect(-half, -half, ART, ART, 15);
    g.lineStyle(6, COLORS.ink, 1);
    g.strokeRoundedRect(-half, -half, ART, ART, 15);
    g.lineStyle(3, COLORS.gold, 1);
    g.strokeRoundedRect(-half + 9, -half + 9, ART - 18, ART - 18, 9);
    g.fillStyle(value === 6 ? COLORS.saffron : COLORS.indigo, 1);
    for (const [col, row] of PIPS[value] ?? []) g.fillCircle(col * GRID, row * GRID, 7.5);
  }
}
