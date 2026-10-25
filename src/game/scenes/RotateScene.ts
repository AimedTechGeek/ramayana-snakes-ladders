import Phaser from 'phaser';
import { BODY_FONT, COLORS } from '../palette';

const ROTATE_KEY = 'Rotate';

function drawPhoneIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(8, COLORS.parchment, 1);
  g.strokeRoundedRect(600, 216, 80, 128, 12);
  g.lineStyle(8, COLORS.saffron, 1);
  g.beginPath();
  g.arc(640, 280, 72, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340));
  g.strokePath();
}

/**
 * Full-canvas "rotate your device" overlay. While the window is portrait it pauses every other
 * active scene and takes input; in landscape it hides, resumes what it paused and ignores input.
 */
export class RotateScene extends Phaser.Scene {
  private layer!: Phaser.GameObjects.Container;
  private scrim!: Phaser.GameObjects.Rectangle;
  private pausedKeys: string[] = [];
  private readonly onOrientationChange = (): void => this.refresh();

  constructor() {
    super({ key: ROTATE_KEY, active: true });
  }

  create(): void {
    this.scrim = this.add.rectangle(0, 0, 1280, 720, COLORS.deepIndigo).setOrigin(0);
    const icon = this.add.graphics();
    drawPhoneIcon(icon);
    const text = this.add
      .text(640, 420, 'Please rotate your device', {
        fontFamily: BODY_FONT,
        fontSize: '28px',
        color: '#F3E3B8',
      })
      .setOrigin(0.5);
    this.layer = this.add.container(0, 0, [this.scrim, icon, text]).setVisible(false);
    this.input.enabled = false;

    this.scale.on('resize', this.refresh, this);
    window.addEventListener('orientationchange', this.onOrientationChange);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.refresh, this);
      window.removeEventListener('orientationchange', this.onOrientationChange);
    });
    this.refresh();
  }

  private refresh(): void {
    if (window.innerHeight > window.innerWidth) this.show();
    else this.hide();
  }

  private show(): void {
    if (this.layer.visible) return;
    this.layer.setVisible(true);
    this.input.enabled = true;
    this.scrim.setInteractive();
    this.scene.bringToTop();
    this.pausedKeys = this.game.scene
      .getScenes(true)
      .map((scene) => scene.sys.settings.key)
      .filter((key) => key !== ROTATE_KEY);
    for (const key of this.pausedKeys) this.scene.pause(key);
  }

  private hide(): void {
    if (!this.layer.visible) return;
    this.layer.setVisible(false);
    this.scrim.disableInteractive();
    this.input.enabled = false;
    for (const key of this.pausedKeys) {
      if (this.scene.isPaused(key)) this.scene.resume(key);
    }
    this.pausedKeys = [];
  }
}
