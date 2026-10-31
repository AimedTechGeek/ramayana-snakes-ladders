import Phaser from 'phaser';
import type { Hero } from '../core/types';
import {
  atlasFrameMeta,
  atlasOrigin,
  HANUMAN_SHEET,
  SHARED_SHEET,
  type AtlasFrameMeta,
} from '../game/assets';
import { COLORS } from '../game/palette';
import { frameIndexOf, leapFrameOf } from '../game/iso/locomotion';
import { shadowDepthOf, SHADOW_DEPTH, type TokenPose } from '../game/iso/tokenPose';
import type { BoardToken } from './BoardToken';
import { faceHoldMs, scaled, type Emotion, type Reaction, type TweenName } from './reactions';

const RING_COLOR = 0x6a6a6a; // the anatomy `mid` ink

/** The seat figure's shadow (the board token uses `shared:shadow`). */
const SEAT_SHADOW: [number, number] = [40, 16];
/** Seat card: SW frames at (1.711 / 0.7621) / 4 = 0.561 of their pixel size, 88 px for 80 units (T43 section 5). */
const SEAT_SCALE = 1.711 / 0.7621 / 4;
/** Idle clip: 3 fps ping-pong tail left, centre, right, centre (T43 section 3.1). */
const IDLE_ORDER = [0, 1, 2, 1] as const;
const IDLE_STEP_MS = 1000 / 3;
const BREATH = { scaleY: 1.015, duration: 2400 };
const WALK_FRAMES = 8;
const RUN_FRAMES = 6;
/** Shadow shrinks by this much per unit of lift and, in a flight frame, by this much more (T43 section 6.2). */
const LIFT_SHRINK = 0.3;
const AIR_SHRINK = 0.15;
/** The lit ring sorts just over the shadow (T43 section 6.2). */
const RING_OVER_SHADOW = 0.1;

/**
 * Hanuman's articulated figure (T43): the seat figure and the board token are one class drawing frames of the
 * `hanuman-s` atlas. At rest it shows SW (idle clip or an emotion pose); BoardScene gives a `pose.motion` while he
 * walks, runs or leaps and the frame follows facing, clip and phase. As a seat figure it plays the T05 tweens.
 */
export class Figurine extends Phaser.GameObjects.Container implements BoardToken {
  readonly walks = true;
  private readonly figure: Phaser.GameObjects.Container;
  private readonly breath: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Ellipse | Phaser.GameObjects.Image;
  /** Shadow scale at pose scale 1 (the shared frame is drawn at 1 / factor, the seat ellipse at 1). */
  private readonly shadowBase: number;
  private readonly ring: Phaser.GameObjects.Image | null;
  private readonly ringBase: number;
  private readonly breathTween: Phaser.Tweens.Tween;
  private readonly spriteScale: number;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private current: Emotion = 'idle';
  private pinned: Emotion | null = null;
  private isLit = false;
  private idleStep = 0;
  private moving = false;
  private frameName = '';
  private frameMeta: AtlasFrameMeta;
  /** Called after every emotion change, so a board token can mirror its seat figure. */
  onEmotion: ((emotion: Emotion) => void) | undefined;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly hero: Hero,
    size: 's' | 'm',
    shadowDepth = SHADOW_DEPTH,
  ) {
    super(scene, x, y);
    if (size === 's') {
      const shadowMeta = atlasFrameMeta(scene, SHARED_SHEET, 'shadow');
      const shadowOrigin = atlasOrigin(shadowMeta);
      this.shadowBase = 1 / shadowMeta.factor;
      this.shadow = scene.add
        .image(x, y, SHARED_SHEET, 'shadow')
        .setOrigin(shadowOrigin.x, shadowOrigin.y)
        .setScale(this.shadowBase)
        .setDepth(shadowDepth);
      const ringMeta = atlasFrameMeta(scene, SHARED_SHEET, 'lit-ring');
      const ringOrigin = atlasOrigin(ringMeta);
      this.ringBase = 1 / ringMeta.factor;
      this.ring = scene.add
        .image(x, y, SHARED_SHEET, 'lit-ring')
        .setOrigin(ringOrigin.x, ringOrigin.y)
        .setScale(this.ringBase)
        .setDepth(shadowDepth)
        .setVisible(false);
    } else {
      this.shadowBase = 1;
      this.ringBase = 1;
      this.shadow = scene.add
        .ellipse(x, y, SEAT_SHADOW[0], SEAT_SHADOW[1], COLORS.ink, 0.3)
        .setDepth(shadowDepth);
      this.ring = null;
    }
    this.spriteScale = size === 's' ? 1 / 4 : SEAT_SCALE;
    this.frameName = 'idle.SW.1';
    this.frameMeta = atlasFrameMeta(scene, HANUMAN_SHEET, this.frameName);
    this.sprite = scene.add.image(0, 0, HANUMAN_SHEET, this.frameName);
    this.breath = scene.add.container(0, 0, [this.sprite]);
    this.figure = scene.add.container(0, 0, [this.breath]);
    this.add(this.figure);
    this.applyFrame(this.frameName);
    this.breathTween = scene.tweens.add({
      targets: this.breath,
      scaleY: BREATH.scaleY,
      duration: BREATH.duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const idleTimer = scene.time.addEvent({
      delay: IDLE_STEP_MS,
      loop: true,
      callback: () => {
        this.idleStep = (this.idleStep + 1) % IDLE_ORDER.length;
        if (!this.moving && this.current === 'idle') this.applyFrame(this.restFrameName());
      },
    });
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      idleTimer.remove();
      this.breathTween.remove();
    });
    scene.add.existing(this);
  }

  get emotion(): Emotion {
    return this.current;
  }

  get lit(): boolean {
    return this.isLit;
  }

  /** Stores the emotion; it shows at rest, and a moving token applies it on arrival (T43 section 6.2). */
  setEmotion(emotion: Emotion): void {
    if (this.pinned) return;
    this.current = emotion;
    if (!this.moving) this.applyFrame(this.restFrameName());
    this.onEmotion?.(emotion);
  }

  /** Holds an emotion against every change until `unpin()`: the scared pose while a snake has him. */
  pin(emotion: Emotion): void {
    this.pinned = null;
    this.setEmotion(emotion);
    this.pinned = emotion;
  }

  unpin(): void {
    this.pinned = null;
  }

  /** The current player's token stands in a `lit-ring` on the tile (T43 section 6.2); the seat figure has none. */
  setLit(on: boolean): void {
    this.isLit = on;
    this.ring?.setVisible(on);
  }

  /** Container angle in degrees, about the feet (the triple-six slide pulls him back, -6). */
  tilt(degrees: number): void {
    this.figure.setAngle(degrees);
  }

  private restFrameName(): string {
    if (this.current === 'idle') return `idle.SW.${IDLE_ORDER[this.idleStep]}`;
    return `SW.${this.current}`;
  }

  private motionFrameName(pose: TokenPose): string | null {
    const motion = pose.motion;
    if (!motion || motion.facing === 'SW') return null;
    if (motion.clip !== 'walk' && motion.clip !== 'run' && motion.clip !== 'leap') return null;
    const index =
      motion.clip === 'leap'
        ? leapFrameOf(motion.phase)
        : frameIndexOf(motion.phase, motion.clip === 'walk' ? WALK_FRAMES : RUN_FRAMES);
    return `${motion.clip}.${motion.facing}.${index}`;
  }

  /** Frame swap: the atlas frame and the root-ground-point origin come from the sidecar. */
  private applyFrame(name: string): void {
    if (name === this.frameName && this.sprite.frame.name === name) return;
    this.frameName = name;
    this.frameMeta = atlasFrameMeta(this.scene, HANUMAN_SHEET, name);
    const origin = atlasOrigin(this.frameMeta);
    this.sprite.setFrame(name).setOrigin(origin.x, origin.y).setScale(this.spriteScale);
  }

  /** The name of the frame on show, for tests. */
  get shownFrame(): string {
    return this.frameName;
  }

  place(pose: TokenPose): void {
    const scale = pose.scale ?? 1;
    const name = this.motionFrameName(pose);
    if (name) {
      if (!this.moving) {
        this.moving = true;
        this.breathTween.pause();
        this.breath.setScale(1);
      }
      this.applyFrame(name);
    } else {
      if (this.moving) {
        this.moving = false;
        this.breathTween.resume();
      }
      this.applyFrame(this.restFrameName());
    }
    this.setPosition(pose.feet.x, pose.feet.y).setDepth(pose.depth).setScale(scale);
    const air = this.frameMeta.air === 1 ? AIR_SHRINK : 0;
    const shadowDepth = shadowDepthOf(pose);
    this.shadow
      .setPosition(pose.ground.x, pose.ground.y)
      .setDepth(shadowDepth)
      .setScale((1 - LIFT_SHRINK * pose.lift - air) * scale * this.shadowBase);
    this.ring
      ?.setPosition(pose.ground.x, pose.ground.y)
      .setDepth(shadowDepth + RING_OVER_SHADOW)
      .setScale(scale * this.ringBase);
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
    const chest = -this.frameMeta.anchorY * this.spriteScale * 0.55;
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
