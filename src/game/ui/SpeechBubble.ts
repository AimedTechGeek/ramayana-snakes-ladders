import Phaser from 'phaser';
import { TIMING } from '../../characters/reactions';
import { BODY_FONT, COLORS, CSS } from '../palette';

const WIDTH = 432;
const HEIGHT = 42;
const PAD = 12;
const FONT_SIZE = 18;
const MIN_FONT_SIZE = 10;
const POP_MS = 120;
const FADE_MS = 150;

/**
 * A parchment speech bubble (T04 section 4.2). Positioned by its top-left corner; the tail points
 * up-left towards the speaker's head. Showing a new line replaces the current one immediately.
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x + WIDTH / 2, y + HEIGHT / 2);
    const art = scene.add.graphics();
    art.fillStyle(COLORS.parchment, 1);
    art.fillRoundedRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 10);
    const left = -WIDTH / 2;
    const top = -HEIGHT / 2;
    // Tail: tip up-left of the box (clear of the card text), base on the top edge.
    art.fillTriangle(left + 16, top + 1, left + 36, top + 1, left - 4, top - 10);
    art.lineStyle(2, COLORS.ink, 1);
    art.strokeRoundedRect(-WIDTH / 2, -HEIGHT / 2, WIDTH, HEIGHT, 10);
    art.lineBetween(left - 4, top - 10, left + 16, top);
    art.lineBetween(left - 4, top - 10, left + 36, top);
    this.label = scene.add
      .text(0, 0, '', { fontFamily: BODY_FONT, fontSize: `${FONT_SIZE}px`, color: CSS.ink })
      .setOrigin(0.5);
    this.add([art, this.label]);
    this.setVisible(false).setAlpha(0);
    scene.add.existing(this);
  }

  /** Pops in with the given text, stays for the bubble time (shorter in fast mode), then fades out. */
  say(text: string, intensity: number, fast: boolean): void {
    this.clear();
    this.label.setText(text).setFontSize(FONT_SIZE);
    for (let size = FONT_SIZE; this.label.width > WIDTH - 2 * PAD && size > MIN_FONT_SIZE; size--) {
      this.label.setFontSize(size);
    }
    this.setVisible(true).setAlpha(1).setScale(0.6);
    this.scene.tweens.add({
      targets: this,
      scale: 1 + 0.1 * intensity,
      duration: POP_MS,
      ease: 'Back.easeOut',
      onComplete: () => this.setScale(1),
    });
    const visibleMs = fast ? 1200 : TIMING.bubbleMs;
    this.hideTimer = this.scene.time.delayedCall(visibleMs, () => {
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: FADE_MS,
        onComplete: () => this.setVisible(false),
      });
    });
  }

  /** Cancels whatever is showing. */
  clear(): void {
    this.scene.tweens.killTweensOf(this);
    this.hideTimer?.remove();
    this.hideTimer = null;
    this.setVisible(false).setAlpha(0).setScale(1);
  }
}
