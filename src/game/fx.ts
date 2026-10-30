import Phaser from 'phaser';
import { COLORS, CSS, TITLE_FONT } from './palette';

// Small flat-style particle effects (T28). Textures are drawn in code, once, with palette colours only.
const GOLD_DOT = 'fx-gold-dot';
const PARCHMENT_SQUARE = 'fx-parchment-square';
const PETAL = 'fx-petal';
const FX_DEPTH = 900; // above the token shadows (500), below the tokens (1000+): T40 spec 2.6

/** Particle lifespans are halved in fast mode. */
function life(ms: number, fast: boolean): number {
  return fast ? ms / 2 : ms;
}

/** Draws the three tiny particle textures if they do not exist yet. Safe to call on every scene start. */
export function ensureFxTextures(scene: Phaser.Scene): void {
  const textures = scene.textures;
  if (textures.exists(GOLD_DOT)) return;
  const g = scene.make.graphics({}, false);
  g.fillStyle(COLORS.gold, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture(GOLD_DOT, 6, 6);
  g.clear();
  g.fillStyle(COLORS.parchment, 1);
  g.fillRect(0, 0, 4, 4);
  g.generateTexture(PARCHMENT_SQUARE, 4, 4);
  g.clear();
  g.fillStyle(COLORS.saffron, 1);
  g.fillEllipse(5, 3, 10, 6);
  g.generateTexture(PETAL, 10, 6);
  g.destroy();
}

/** Removes a one-shot emitter once its particles are gone. */
function destroyAfter(
  scene: Phaser.Scene,
  emitter: Phaser.GameObjects.Particles.ParticleEmitter,
  ms: number,
): void {
  scene.time.delayedCall(ms + 50, () => emitter.destroy());
}

/** Gold sparkle trail: returns a function that drops one sparkle at a point, and a function that ends the trail. */
export function sparkleTrail(
  scene: Phaser.Scene,
  fast: boolean,
): { emit: (x: number, y: number) => void; stop: () => void } {
  const lifespan = life(380, fast);
  const emitter = scene.add
    .particles(0, 0, GOLD_DOT, {
      lifespan,
      speed: { min: 8, max: 30 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    })
    .setDepth(FX_DEPTH);
  return {
    emit: (x, y) => emitter.emitParticleAt(x, y, 1),
    stop: () => destroyAfter(scene, emitter, lifespan),
  };
}

/** 12-particle gold and saffron burst. */
export function goldBurst(scene: Phaser.Scene, x: number, y: number, fast: boolean): void {
  const lifespan = life(600, fast);
  const emitter = scene.add
    .particles(x, y, GOLD_DOT, {
      lifespan,
      speed: { min: 60, max: 150 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [COLORS.gold, COLORS.saffron],
      emitting: false,
    })
    .setDepth(FX_DEPTH);
  emitter.explode(12);
  destroyAfter(scene, emitter, lifespan);
}

/** Parchment dust puff; `count` squares drift outwards and fade. */
export function dustPuff(scene: Phaser.Scene, x: number, y: number, fast: boolean, count = 10): void {
  const lifespan = life(450, fast);
  const emitter = scene.add
    .particles(x, y, PARCHMENT_SQUARE, {
      lifespan,
      speed: { min: 20, max: 70 },
      scale: { start: 1.6, end: 0.4 },
      alpha: { start: 0.9, end: 0 },
      rotate: { min: 0, max: 90 },
      emitting: false,
    })
    .setDepth(FX_DEPTH);
  emitter.explode(count);
  destroyAfter(scene, emitter, lifespan);
}

/** Dust puff plus a small "!" that rises and fades (T04 section 4.1). */
export function bouncePuff(scene: Phaser.Scene, x: number, y: number, fast: boolean): void {
  dustPuff(scene, x, y, fast, 8);
  const mark = scene.add
    .text(x, y - 10, '!', { fontFamily: TITLE_FONT, fontSize: '28px', color: CSS.parchment })
    .setOrigin(0.5)
    .setStroke(CSS.ink, 5)
    .setDepth(FX_DEPTH);
  scene.tweens.add({
    targets: mark,
    y: y - 34,
    alpha: 0,
    duration: life(700, fast),
    ease: 'Sine.easeOut',
    onComplete: () => mark.destroy(),
  });
}

/** A saffron ring that grows and fades around a point (six rolled). */
export function ringPulse(scene: Phaser.Scene, x: number, y: number, radius: number, fast: boolean): void {
  const ring = scene.add.circle(x, y, radius).setStrokeStyle(4, COLORS.saffron).setDepth(9);
  scene.tweens.add({
    targets: ring,
    scale: 1.5,
    alpha: 0,
    duration: life(500, fast),
    ease: 'Sine.easeOut',
    onComplete: () => ring.destroy(),
  });
}

/** Brief, small camera shake; skipped in fast mode. */
export function shake(scene: Phaser.Scene, fast: boolean): void {
  if (!fast) scene.cameras.main.shake(120, 0.003);
}

/** Gold dots and saffron petals drifting down over the full screen, looping until the scene stops. */
export function confettiRain(scene: Phaser.Scene, width: number): void {
  const zone = new Phaser.Geom.Rectangle(0, -12, width, 1);
  const common = {
    emitZone: {
      type: 'random',
      source: zone,
    } as Phaser.Types.GameObjects.Particles.ParticleEmitterRandomZoneConfig,
    lifespan: 5200,
    speedY: { min: 40, max: 90 },
    speedX: { min: -20, max: 20 },
    alpha: { start: 1, end: 0.6 },
  };
  const dots = scene.add.particles(0, 0, GOLD_DOT, {
    ...common,
    frequency: 140,
    scale: { min: 0.8, max: 1.4 },
  });
  const petals = scene.add.particles(0, 0, PETAL, {
    ...common,
    frequency: 220,
    rotate: { min: 0, max: 360 },
    scale: { min: 0.8, max: 1.3 },
  });
  // Pre-fill so the screen is not empty for the first seconds.
  dots.fastForward(4000);
  petals.fastForward(4000);
}

/** A single burst of saffron lotus petals around a point. */
export function petalBurst(scene: Phaser.Scene, x: number, y: number): void {
  const emitter = scene.add
    .particles(x, y, PETAL, {
      lifespan: 1400,
      speed: { min: 80, max: 220 },
      gravityY: 120,
      rotate: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0.4 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    })
    .setDepth(20);
  emitter.explode(24);
  destroyAfter(scene, emitter, 1400);
}
