import Phaser from 'phaser';
import type { Hero } from '../core/types';
import { COLORS } from '../game/palette';
import { drawFace } from './faces';
import { faceHoldMs, scaled, type Emotion, type Reaction, type TweenName } from './reactions';

const FIGURE_HEIGHT = 112;
const CENTRE_Y = -FIGURE_HEIGHT / 2;
const HEAD_Y = -88;
const HEAD_RADIUS = 20;

interface Look {
  skin: number;
  costume: number;
  trim: number;
}

const LOOKS: Record<Hero, Look> = {
  rama: { skin: 0x3f6fc2, costume: COLORS.gold, trim: COLORS.saffron },
  sita: { skin: 0xf2c29b, costume: 0xd15587, trim: COLORS.gold },
  lakshmana: { skin: 0xf0b57c, costume: 0x2e9e6b, trim: COLORS.gold },
  hanuman: { skin: 0xf0a96b, costume: COLORS.saffron, trim: COLORS.gold },
};

/**
 * A seat-card hero: a layered vector figure whose face swaps between five emotions and whose body
 * plays the tween catalogue of T05. The origin is the point between the feet.
 */
export class Character extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  private readonly head: Phaser.GameObjects.Container;
  private readonly hand: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Graphics;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private holdTimer: Phaser.Time.TimerEvent | null = null;
  private current: Emotion = 'idle';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly hero: Hero,
  ) {
    super(scene, x, y);
    const look = LOOKS[hero];
    this.shadow = scene.add.ellipse(0, 0, 44, 8, COLORS.ink, 0.25);

    // The figure container pivots at the body's centre so leans and spins look natural.
    this.figure = scene.add.container(0, CENTRE_Y);
    const body = scene.add.graphics();
    drawBody(body, hero, look);
    this.hand = scene.add.container(0, 0, [drawProp(scene.add.graphics(), hero)]);
    const headArt = scene.add.graphics();
    drawHead(headArt, hero, look);
    this.face = scene.add.graphics();
    this.head = scene.add.container(0, HEAD_Y - CENTRE_Y, [headArt, this.face]);
    const behind = hero === 'hanuman' ? [drawTail(scene.add.graphics())] : [];
    this.figure.add([...behind, body, this.hand, this.head]);

    this.add([this.shadow, this.figure]);
    this.setEmotion('idle');
    scene.add.existing(this);
  }

  get emotion(): Emotion {
    return this.current;
  }

  setEmotion(emotion: Emotion): void {
    this.current = emotion;
    drawFace(this.face, this.hero, emotion, HEAD_RADIUS);
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
    this.scene.tweens.killTweensOf([this.figure, this.head, this.hand, this.shadow]);
    this.holdTimer?.remove();
    this.holdTimer = null;
    this.figure.setPosition(0, CENTRE_Y).setScale(1).setAngle(0);
    this.head.setAngle(0);
    this.hand.setPosition(0, 0).setScale(1);
    this.shadow.setScale(1);
    this.setEmotion('idle');
  }

  private playTween(name: TweenName, k: number, ms: number): Promise<void> {
    const f = this.figure;
    const run = (targets: object, props: Record<string, unknown>) =>
      new Promise<void>((resolve) =>
        this.scene.tweens.add({ targets, ease: 'Sine.easeInOut', ...props, onComplete: () => resolve() }),
      );
    const air = (height: number, duration: number, extra: Record<string, unknown> = {}) =>
      Promise.all([
        run(f, {
          y: CENTRE_Y - height * k,
          duration: duration / 2,
          yoyo: true,
          ease: 'Quad.easeOut',
          ...extra,
        }),
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
      case 'cower':
        return Promise.all([
          run(f, {
            scaleY: 1 - 0.12 * k,
            y: CENTRE_Y + 6 * k,
            angle: -6 * k,
            duration: ms * 0.3,
            yoyo: true,
            hold: ms * 0.4,
          }),
          run(this.hand, { y: -14 * k, duration: ms * 0.3, yoyo: true, hold: ms * 0.4 }),
        ]).then(() => undefined);
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
          y: CENTRE_Y + 8 * k,
          duration: ms * 0.4,
          yoyo: true,
          hold: ms * 0.2,
        });
      case 'nod':
        return run(this.head, { angle: 6 * k, duration: ms / 4, yoyo: true, repeat: 1 });
      case 'clap':
        return run(this.hand, { scaleX: 1 + 0.05 * k, scaleY: 0.9, duration: ms / 8, yoyo: true, repeat: 3 });
      case 'stomp':
        return run(f, {
          y: CENTRE_Y + 4 * k,
          scaleY: 1 - 0.08 * k,
          duration: ms / 3,
          yoyo: true,
          ease: 'Quad.easeIn',
        });
      case 'fidget':
        return run(f, {
          x: 3 * k,
          angle: 2 * k,
          duration: 150,
          yoyo: true,
          repeat: Math.max(1, Math.round(ms / 300) - 1),
        }).then(() => {
          f.setPosition(0, CENTRE_Y).setAngle(0);
        });
      case 'bless':
        return Promise.all([
          run(this.hand, { y: -10 * k, duration: ms * 0.2, yoyo: true, hold: ms * 0.6 }),
          run(f, { angle: 4 * k, duration: ms * 0.2, yoyo: true, hold: ms * 0.6 }),
          this.glow(ms),
        ]).then(() => undefined);
      case 'salute':
        return Promise.all([
          run(this.head, { angle: 8 * k, duration: ms * 0.25, yoyo: true, hold: ms * 0.5 }),
          run(this.hand, { x: 6 * k, y: -6 * k, duration: ms * 0.25, yoyo: true, hold: ms * 0.5 }),
        ]).then(() => undefined);
      case 'sigh':
        return Promise.all([
          run(f, { scaleY: 1.03, duration: ms * 0.3, yoyo: true }).then(() =>
            run(f, { scaleY: 0.97, duration: ms * 0.2, yoyo: true }),
          ),
          run(this.head, { angle: 4 * k, duration: ms / 2, yoyo: true }),
        ]).then(() => undefined);
    }
  }

  /** The soft gold ring of a blessing, expanding from the chest. */
  private glow(ms: number): Promise<void> {
    const ring = this.scene.add.circle(0, -60, 10).setStrokeStyle(3, COLORS.gold, 0.9);
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

// Body coordinates are relative to the figure centre (CENTRE_Y above the feet).
const dy = (y: number) => y - CENTRE_Y;

function drawBody(g: Phaser.GameObjects.Graphics, hero: Hero, look: Look): void {
  g.lineStyle(2, COLORS.ink, 1);
  // Legs.
  g.fillStyle(look.skin, 1);
  g.fillRect(-12, dy(-24), 8, 22).strokeRect(-12, dy(-24), 8, 22);
  g.fillRect(4, dy(-24), 8, 22).strokeRect(4, dy(-24), 8, 22);
  g.fillStyle(COLORS.gold, 1);
  g.fillRect(-12, dy(-6), 8, 3).fillRect(4, dy(-6), 8, 3);
  // Torso.
  g.fillStyle(hero === 'sita' ? COLORS.saffron : look.skin, 1);
  g.fillRoundedRect(-16, dy(-68), 32, 26, 6).strokeRoundedRect(-16, dy(-68), 32, 26, 6);
  // Dhoti / sari / loincloth.
  g.fillStyle(look.costume, 1);
  const hem = hero === 'sita' ? -4 : hero === 'hanuman' ? -30 : -18;
  g.fillPoints(
    [
      new Phaser.Math.Vector2(-17, dy(-44)),
      new Phaser.Math.Vector2(17, dy(-44)),
      new Phaser.Math.Vector2(20, dy(hem)),
      new Phaser.Math.Vector2(-20, dy(hem)),
    ],
    true,
  );
  g.strokePoints(
    [
      new Phaser.Math.Vector2(-17, dy(-44)),
      new Phaser.Math.Vector2(17, dy(-44)),
      new Phaser.Math.Vector2(20, dy(hem)),
      new Phaser.Math.Vector2(-20, dy(hem)),
    ],
    true,
  );
  g.lineStyle(3, look.trim, 1);
  g.lineBetween(-19, dy(hem + 2), 19, dy(hem + 2));
  if (hero === 'rama') {
    g.lineStyle(4, COLORS.indigo, 1);
    g.lineBetween(-14, dy(-66), 12, dy(-46));
  }
  if (hero === 'lakshmana') {
    g.lineStyle(4, COLORS.saffron, 1);
    g.lineBetween(14, dy(-66), -12, dy(-46));
  }
  // Arms.
  g.lineStyle(6, look.skin, 1);
  g.lineBetween(-16, dy(-64), -22, dy(-44));
  g.lineBetween(16, dy(-64), 22, dy(-44));
  g.fillStyle(COLORS.gold, 1);
  g.fillCircle(-19, dy(-56), 2.5).fillCircle(19, dy(-56), 2.5);
}

function drawProp(g: Phaser.GameObjects.Graphics, hero: Hero): Phaser.GameObjects.Graphics {
  g.lineStyle(3, COLORS.ink, 1);
  if (hero === 'rama' || hero === 'lakshmana') {
    const side = hero === 'rama' ? -1 : 1;
    const h = hero === 'rama' ? 44 : 36;
    g.lineStyle(4, COLORS.gold, 1);
    g.beginPath();
    g.arc(
      26 * side,
      dy(-50),
      h / 2,
      side < 0 ? Math.PI * 0.6 : -Math.PI * 0.4,
      side < 0 ? Math.PI * 1.4 : Math.PI * 0.4,
    );
    g.strokePath();
    g.lineStyle(1.5, COLORS.ink, 1);
    g.lineBetween(
      26 * side + (side < 0 ? -1 : 1) * (h / 2) * Math.cos(Math.PI * 0.6),
      dy(-50) - (h / 2) * Math.sin(Math.PI * 0.6),
      26 * side + (side < 0 ? -1 : 1) * (h / 2) * Math.cos(Math.PI * 0.6),
      dy(-50) + (h / 2) * Math.sin(Math.PI * 0.6),
    );
  }
  if (hero === 'sita') {
    g.fillStyle(COLORS.leaf, 1).fillRect(23, dy(-50), 2, 10);
    g.fillStyle(0xd15587, 1).fillCircle(24, dy(-52), 5);
    g.fillStyle(COLORS.parchment, 1).fillCircle(24, dy(-53), 2);
  }
  if (hero === 'hanuman') {
    g.lineStyle(4, COLORS.ink, 1).lineBetween(22, dy(-44), 30, dy(-78));
    g.fillStyle(COLORS.gold, 1).fillCircle(31, dy(-82), 8);
    g.lineStyle(2, COLORS.ink, 1).strokeCircle(31, dy(-82), 8);
  }
  return g;
}

function drawHead(g: Phaser.GameObjects.Graphics, hero: Hero, look: Look): void {
  g.lineStyle(2.5, COLORS.ink, 1);
  if (hero === 'hanuman') {
    g.fillStyle(0xe4572e, 1);
    g.fillCircle(-22, -2, 7).strokeCircle(-22, -2, 7);
    g.fillCircle(22, -2, 7).strokeCircle(22, -2, 7);
  }
  if (hero === 'sita') {
    g.fillStyle(COLORS.ink, 1);
    g.fillRoundedRect(-24, -8, 7, 34, 3);
    g.fillStyle(COLORS.parchment, 1)
      .fillCircle(-20, 4, 1.5)
      .fillCircle(-20, 12, 1.5)
      .fillCircle(-20, 20, 1.5);
  }
  g.fillStyle(look.skin, 1);
  g.fillCircle(0, 0, HEAD_RADIUS).strokeCircle(0, 0, HEAD_RADIUS);
  if (hero === 'hanuman') {
    g.fillStyle(COLORS.parchment, 1).fillEllipse(0, 9, 26, 14);
    g.fillStyle(COLORS.saffron, 1).fillRect(-1.5, -18, 3, 7);
    return;
  }
  // Hair cap, then the hero's head detail.
  g.fillStyle(COLORS.ink, 1);
  const cap: Phaser.Math.Vector2[] = [];
  for (let deg = 200; deg <= 340; deg += 10) {
    const a = Phaser.Math.DegToRad(deg);
    cap.push(new Phaser.Math.Vector2(Math.cos(a) * HEAD_RADIUS, Math.sin(a) * HEAD_RADIUS));
  }
  g.fillPoints(cap, true);
  if (hero === 'rama') {
    g.fillCircle(0, -22, 7);
    g.fillStyle(COLORS.gold, 1).fillRect(-14, -17, 28, 4);
    g.fillStyle(COLORS.saffron, 1).fillCircle(0, -15, 2.5);
  }
  if (hero === 'sita') {
    g.fillStyle(COLORS.gold, 1).fillRect(-10, -19, 20, 3);
  }
  if (hero === 'lakshmana') {
    g.fillCircle(0, -22, 6);
    g.fillStyle(COLORS.saffron, 1).fillRect(-17, -14, 34, 4);
  }
}

function drawTail(g: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics {
  const curve = new Phaser.Curves.CubicBezier(
    new Phaser.Math.Vector2(-10, dy(-30)),
    new Phaser.Math.Vector2(-40, dy(-20)),
    new Phaser.Math.Vector2(-44, dy(-90)),
    new Phaser.Math.Vector2(-26, dy(-100)),
  );
  g.lineStyle(5, 0xe4572e, 1);
  curve.draw(g, 24);
  g.fillStyle(0xe4572e, 1).fillCircle(-26, dy(-100), 4);
  return g;
}
