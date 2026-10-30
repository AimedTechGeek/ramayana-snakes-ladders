import Phaser from 'phaser';
import type { Hero } from '../core/types';
import { figurineFrame, figurineKey, type FigurineSize } from '../game/assets';
import { COLORS } from '../game/palette';
import { SHADOW_DEPTH, type TokenPose } from '../game/iso/tokenPose';
import type { BoardToken } from './BoardToken';
import { faceHoldMs, scaled, type Emotion, type Reaction, type TweenName } from './reactions';

const RING_COLOR = 0x6a6a6a; // the anatomy `mid` ink

const SHADOW_SIZE: Record<FigurineSize, [number, number]> = { s: [18, 9], m: [40, 16], l: [120, 44] };

/**
 * An iso figurine (T40 spec 4 and 5): one pre-rendered sprite per emotion, plain and lit, standing by its feet point
 * (the container origin). As a seat figure it plays the T05 tween catalogue through `feel`; as a board token it only
 * hops (BoardScene calls `place`) and follows the seat figure's emotion.
 */
export class Figurine extends Phaser.GameObjects.Container implements BoardToken {
  private readonly figure: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private current: Emotion = 'idle';
  private isLit = false;
  /** Called after every emotion change, so a board token can mirror its seat figure. */
  onEmotion: ((emotion: Emotion) => void) | undefined;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly hero: Hero,
    private readonly size: FigurineSize,
    shadowDepth = SHADOW_DEPTH,
  ) {
    super(scene, x, y);
    const [shadowWidth, shadowHeight] = SHADOW_SIZE[size];
    this.shadow = scene.add.ellipse(x, y, shadowWidth, shadowHeight, COLORS.ink, 0.3).setDepth(shadowDepth);
    this.sprite = scene.add.image(0, 0, figurineKey(hero, 'idle', false, size));
    this.figure = scene.add.container(0, 0, [this.sprite]);
    this.add(this.figure);
    this.applyTexture();
    scene.add.existing(this);
  }

  get emotion(): Emotion {
    return this.current;
  }

  get lit(): boolean {
    return this.isLit;
  }

  setEmotion(emotion: Emotion): void {
    this.current = emotion;
    this.applyTexture();
    this.onEmotion?.(emotion);
  }

  setLit(on: boolean): void {
    this.isLit = on;
    this.applyTexture();
  }

  /** Texture swap: the key and the feet-point origin come from the figurine manifest. */
  private applyTexture(): void {
    const frame = figurineFrame(this.hero, this.current, this.isLit, this.size);
    this.sprite
      .setTexture(figurineKey(this.hero, this.current, this.isLit, this.size))
      .setOrigin(frame.anchorX / frame.w, frame.anchorY / frame.h)
      .setScale(1 / frame.scale);
  }

  place(pose: TokenPose): void {
    this.setPosition(pose.feet.x, pose.feet.y).setDepth(pose.depth);
    this.shadow.setPosition(pose.ground.x, pose.ground.y).setScale(1 - 0.3 * pose.lift);
  }

  squash(ms: number): void {
    this.scene.tweens.add({
      targets: this.figure,
      scaleX: 1.06,
      scaleY: 0.92,
      duration: ms / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Play a reaction; a new one interrupts the running one and snaps back to idle first (T05 step 7). */
  feel(reaction: Reaction, fast = false): Promise<void> {
    this.interrupt();
    const r = scaled(reaction, fast);
    this.setEmotion(r.emotion);
    this.holdTimer = this.scene.time.delayedCall(faceHoldMs(reaction, fast), () => this.setEmotion('idle'));
    return this.playTween(r.tween, Math.max(0.25, r.intensity), r.durationMs);
  }

  interrupt(): void {
    this.scene.tweens.killTweensOf([this.figure, this.shadow]);
    this.holdTimer?.remove();
    this.holdTimer = null;
    this.figure.setPosition(0, 0).setScale(1).setAngle(0);
    this.shadow.setScale(1);
    this.setEmotion('idle');
  }

  /** The T05 catalogue on the one sprite (T40 spec 4.6): the pose variant carries the head and hands. */
  private playTween(name: TweenName, k: number, ms: number): Promise<void> {
    const f = this.figure;
    const run = (targets: object, props: Record<string, unknown>) =>
      new Promise<void>((resolve) =>
        this.scene.tweens.add({ targets, ease: 'Sine.easeInOut', ...props, onComplete: () => resolve() }),
      );
    const air = (height: number, duration: number, extra: Record<string, unknown> = {}) =>
      Promise.all([
        run(f, { y: -height * k, duration: duration / 2, yoyo: true, ease: 'Quad.easeOut', ...extra }),
        run(this.shadow, { scaleX: 0.7, scaleY: 0.7, duration: duration / 2, yoyo: true }),
      ]).then(() => undefined);

    switch (name) {
      case 'none':
        return Promise.resolve();
      case 'bounce':
        return air(10, ms / 2).then(() => air(10, ms / 2));
      case 'leap':
        return Promise.all([air(22, ms), run(f, { angle: 6 * k, duration: ms / 2, yoyo: true })]).then(
          () => undefined,
        );
      case 'somersault':
        return Promise.all([air(22, ms), run(f, { angle: 360, duration: ms, ease: 'Linear' })]).then(() => {
          f.setAngle(0);
        });
      case 'cower': // the scared variant has the hands over the eyes; the tween keeps the squash and the lean
        return run(f, { scaleY: 0.88, y: 6 * k, angle: -6, duration: ms * 0.3, yoyo: true, hold: ms * 0.4 });
      case 'shake':
        return run(f, {
          x: 5 * k,
          duration: 28,
          yoyo: true,
          repeat: Math.max(1, Math.round(ms / 56) - 1),
          ease: 'Linear',
        }).then(() => {
          f.x = 0;
        });
      case 'slump':
        return run(f, {
          scaleY: 1 - 0.08 * k,
          angle: 8 * k,
          y: 8 * k,
          duration: ms * 0.4,
          yoyo: true,
          hold: ms * 0.2,
        });
      case 'nod': // the whole figure rotates about its feet
        return run(f, { angle: 3 * k, duration: ms / 4, yoyo: true, repeat: 1 });
      case 'clap': // a scale pulse 1.00 to 1.04, four times
        return run(f, { scaleX: 1.04, scaleY: 1.04, duration: ms / 8, yoyo: true, repeat: 3 });
      case 'stomp':
        return run(f, { y: 4 * k, scaleY: 1 - 0.08 * k, duration: ms / 3, yoyo: true, ease: 'Quad.easeIn' });
      case 'fidget':
        return run(f, {
          x: 3 * k,
          angle: 2 * k,
          duration: 150,
          yoyo: true,
          repeat: Math.max(1, Math.round(ms / 300) - 1),
        }).then(() => {
          f.setPosition(0, 0).setAngle(0);
        });
      case 'bless':
        return Promise.all([
          run(f, { angle: 4 * k, duration: ms * 0.2, yoyo: true, hold: ms * 0.6 }),
          this.glow(ms),
        ]).then(() => undefined);
      case 'salute':
        return run(f, { angle: 4 * k, duration: ms * 0.25, yoyo: true, hold: ms * 0.5 });
      case 'sigh':
        return run(f, { scaleY: 1.03, duration: ms * 0.3, yoyo: true }).then(() =>
          run(f, { scaleY: 0.97, duration: ms * 0.2, yoyo: true }),
        );
    }
  }

  /** The blessing ring: a 1 px circle expanding from the chest, alpha 1 to 0. */
  private glow(ms: number): Promise<void> {
    const frame = figurineFrame(this.hero, this.current, this.isLit, this.size);
    const chest = -(frame.anchorY / frame.scale) * 0.55;
    const ring = this.scene.add.circle(0, chest, 10).setStrokeStyle(1, RING_COLOR, 1);
    this.add(ring);
    return new Promise((resolve) =>
      this.scene.tweens.add({
        targets: ring,
        scale: 3,
        alpha: 0,
        duration: ms,
        onComplete: () => {
          ring.destroy();
          resolve();
        },
      }),
    );
  }
}
