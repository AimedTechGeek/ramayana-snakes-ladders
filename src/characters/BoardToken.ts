import Phaser from 'phaser';
import type { Hero } from '../core/types';
import { tokenKey } from '../game/assets';
import { COLORS } from '../game/palette';
import { shadowDepthOf, SHADOW_DEPTH, type TokenPose } from '../game/iso/tokenPose';
import type { Emotion } from './reactions';

/** What BoardScene moves around the isometric board: a figurine, or the old medallion until T40.10. */
export interface BoardToken {
  /** Puts the token at a pose: feet, shadow, depth. */
  place(pose: TokenPose): void;
  /** Landing squash after a hop: scaleX 1.06, scaleY 0.92, then back (T40 spec 5). */
  squash(ms: number): void;
  setEmotion(emotion: Emotion): void;
  setLit(on: boolean): void;
}

const MEDALLION_SIZE = 28; // about the figurine token (39 px for 80 units), so a medallion does not hide a figurine on a shared square

/** The 2D medallion of Rama, Sita and Lakshmana, standing on the iso board by its bottom centre. */
export class MedallionToken implements BoardToken {
  private readonly image: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly baseScale: { x: number; y: number };

  constructor(
    private readonly scene: Phaser.Scene,
    hero: Hero,
  ) {
    this.shadow = scene.add.ellipse(0, 0, 18, 9, COLORS.ink, 0.3).setDepth(SHADOW_DEPTH);
    this.image = scene.add
      .image(0, 0, tokenKey(hero))
      .setDisplaySize(MEDALLION_SIZE, MEDALLION_SIZE)
      .setOrigin(0.5, 1);
    this.baseScale = { x: this.image.scaleX, y: this.image.scaleY };
  }

  place(pose: TokenPose): void {
    this.image
      .setPosition(pose.feet.x, pose.feet.y)
      .setDepth(pose.depth)
      .setScale(this.baseScale.x * (pose.scale ?? 1), this.baseScale.y * (pose.scale ?? 1));
    this.shadow
      .setPosition(pose.ground.x, pose.ground.y)
      .setDepth(shadowDepthOf(pose))
      .setScale((1 - 0.3 * pose.lift) * (pose.scale ?? 1));
  }

  squash(ms: number): void {
    const { scaleX, scaleY } = this.image;
    this.scene.tweens.add({
      targets: this.image,
      scaleX: scaleX * 1.06,
      scaleY: scaleY * 0.92,
      duration: ms / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  setEmotion(): void {
    // The medallion has no emotion textures.
  }

  setLit(): void {
    // The medallion has no lit variant.
  }
}
