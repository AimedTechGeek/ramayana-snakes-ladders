// The standing snake (T42.8): one coiled snake per snake square, hidden until a token lands there. Spec: docs/design/
// T42-living-board.md sections 5.2 to 5.4. The snake appears, eats the token and the token reappears at the tail square;
// nothing is ever drawn between the head and the tail. Everything is created in the board camera layer.

import Phaser from 'phaser';
import { addAtlasSprite, atlasFrameMeta, atlasMeta } from '../assets';
import { boardFor } from '../../core/boards';
import type { Level } from '../../core/types';
import type { Audio } from '../audio';
import { dustPuff } from '../fx';
import { fieldCentre, type Vec2 } from '../iso/jumps';
import { toScreen } from '../iso/boardIso';
import { TOP_Z } from '../iso/world';
import { worldPose, type TokenPose } from '../iso/tokenPose';
import type { BoardCameraRig } from '../ui/BoardCameraRig';
import { floorKey, snakeHeadDepth, standingDepth } from './boardBands';
import { SHARED_SHEET, type LivingBoard } from './LivingBoard';
import {
  blendColor,
  COIL_BEHIND_FIELD_UNITS,
  headPoint,
  headSide,
  headTurn,
  snakeEntry,
  snakeTimeline,
  toLogical,
  type Pt,
  type SnakeSheetEntry,
} from './snakePlan';

const BLOOD = 0x8e3b3b;
const SWAY_DEG = 3;
const SWAY_PERIOD_MS = 4400;
const BREATH_SCALE = 0.015;
const BREATH_PERIOD_MS = 6000;
const TONGUE_MIN_MS = 3000;
const TONGUE_MAX_MS = 6000;
/** Tongue flick: short 70 ms, long 90 ms, short 70 ms. */
const TONGUE_FLICK = [
  { frame: 'tongue-short', ms: 70 },
  { frame: 'tongue-long', ms: 90 },
  { frame: 'tongue-short', ms: 70 },
] as const;
const TONGUE_DOWN_DEG = 25;
const RISE_OVERSHOOT = 1.3;
const RISE_HEAD_LIFT_PX = 10;
const HEAD_FOLLOWS = 0.3;
const TURN_MS = 160;
const STRIKE_PITCH_DEG = 18;
const STRIKE_REACH_PX = 10;
const BULGE_START = 0.4;
const BULGE_MS = 360;
const BULGE_FADE = 0.25;
/** The shared bulge frame is drawn for R = 3; it is shrunk a little so it reads as a lump inside the neck. */
const BULGE_SCALE = 0.8;
const TOKEN_CHEST_PX = 20;
const TOKEN_SMALLEST = 0.1;
const TOKEN_STRIKE_DEPTH = 0.4;
const SHAKE = { ms: 120, intensity: 0.004 };
const CULL_MARGIN = 60;
const CULL_EVERY_MS = 250;

export interface BiteHooks {
  /** World (x, y) the token stands at on the head square. */
  tokenSpot: Vec2;
  /** Draws the token (and its shadow) at a pose with an overall alpha. */
  drawToken(pose: TokenPose, alpha: number): void;
  /** The swallow is over: send the camera to the tail square. */
  panToTail(): void;
  /** The token is about to reappear: move it to the tail square, lift that fog, and return its resting pose there. */
  landAtTail(): TokenPose;
}

export interface BiteTrace {
  name: string;
  /** performance.now() when the step began (the frame that crossed its start). */
  at: number;
  /** The timeline time (ms) of that frame: how far past the step's planned start it was noticed. */
  t: number;
}

/** Placement of the head: mirrored side (1 right, -1 left, between while turning around), turn, offset and lift. */
interface HeadPose {
  side: number;
  angle: number;
  shift: Pt;
  lift: number;
}

interface Standing {
  entry: SnakeSheetEntry;
  coil: Phaser.GameObjects.Image;
  head: Phaser.GameObjects.Image;
  tongue: Phaser.GameObjects.Image;
  bulge: Phaser.GameObjects.Image;
  pivot: Pt;
  coilKey: number;
  factor: number;
  /** False until the rise has played (or the snake was restored from a save). */
  shown: boolean;
  /** True while a bite drives the sprites. */
  biting: boolean;
  pose: HeadPose;
  phaseMs: number;
  nextTongueAt: number;
  tongueStartedAt: number;
  inView: boolean;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;
const hexOf = (css: string): number => parseInt(css.replace('#', ''), 16);

export function snakeSheetKey(level: Level): string {
  return `snakes-${level}`;
}

export class SnakeActor {
  private readonly standing = new Map<number, Standing>();
  private readonly sheet: string;
  private readonly reduced: boolean;
  private nextCull = 0;
  /** Step times of the last bite, for tests (performance.now()). */
  readonly trace: BiteTrace[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: BoardCameraRig,
    living: LivingBoard,
    private readonly level: Level,
    private readonly audio: Audio,
    private readonly isFast: () => boolean,
  ) {
    this.sheet = snakeSheetKey(level);
    this.reduced =
      typeof window !== 'undefined' && !!window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    living.onJumpRevealed((jumpId, type, animate) => {
      if (type === 'snake') this.stand(jumpId, !animate);
    });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this),
    );
  }

  /** Whether the snake of a jump is standing on the board (hidden or not). */
  has(jumpId: number): boolean {
    return this.standing.has(jumpId);
  }

  // ---------------------------------------------------------------- standing

  /** Builds the coil and head of a snake square; `instant` shows it in idle at once (resume), else it waits hidden for the bite. */
  private stand(jumpId: number, instant: boolean): void {
    if (this.standing.has(jumpId)) return;
    const jump = boardFor(this.level).snakes.find((snake) => snake.from === jumpId);
    if (!jump) throw new Error(`No snake on square ${jumpId}`);
    const entry = snakeEntry(
      atlasMeta(this.scene, this.sheet) as unknown as Parameters<typeof snakeEntry>[0],
      jump.id,
    );
    const factor = atlasFrameMeta(this.scene, this.sheet, entry.coil.frame).factor;
    const [fx, fy] = fieldCentre(jumpId);
    const world: Vec2 = [fx, fy - COIL_BEHIND_FIELD_UNITS];
    const ground = toScreen([world[0], world[1], TOP_Z]);
    const coilKey = floorKey(world[0], world[1]);
    const delta = toLogical(entry.head.pivot, factor);
    const pivot = { x: ground.x + delta.x, y: ground.y + delta.y };
    const sprite = (sheet: string, frame: string, at: Pt, depth: number) =>
      addAtlasSprite(this.scene, sheet, frame, at.x, at.y).setDepth(depth).setVisible(false);
    const headDepth = snakeHeadDepth(coilKey);
    const made = this.rig.within('board', () => ({
      coil: sprite(this.sheet, entry.coil.frame, ground, standingDepth(coilKey)),
      head: sprite(this.sheet, entry.head.closed, pivot, headDepth),
      tongue: sprite(SHARED_SHEET, 'tongue-short', pivot, headDepth + 0.1),
      bulge: sprite(SHARED_SHEET, 'bulge', pivot, headDepth + 0.05),
    }));
    const body = hexOf(entry.body);
    made.tongue.setTint(blendColor(body, BLOOD, 0.4));
    made.bulge.setTint(body);
    const snake: Standing = {
      entry,
      ...made,
      pivot,
      coilKey,
      factor,
      shown: false,
      biting: false,
      pose: { side: 1, angle: 0, shift: { x: 0, y: 0 }, lift: 0 },
      phaseMs: (jumpId * 977) % SWAY_PERIOD_MS,
      nextTongueAt: this.scene.time.now + Phaser.Math.Between(TONGUE_MIN_MS, TONGUE_MAX_MS),
      tongueStartedAt: -1,
      inView: true,
    };
    this.standing.set(jumpId, snake);
    if (instant) this.showIdle(snake);
  }

  private showIdle(snake: Standing): void {
    snake.shown = true;
    snake.biting = false;
    snake.pose = { side: 1, angle: 0, shift: { x: 0, y: 0 }, lift: 0 };
    snake.coil
      .setVisible(true)
      .setAlpha(1)
      .setScale(1 / snake.factor);
    snake.head.setVisible(true).setAlpha(1).setFrame(snake.entry.head.closed);
    snake.tongueStartedAt = -1;
    snake.tongue.setVisible(false);
    snake.bulge.setVisible(false);
    this.applyHead(snake);
  }

  private applyHead(snake: Standing): void {
    const { pose, pivot, factor } = snake;
    snake.head
      .setPosition(pivot.x + pose.shift.x, pivot.y + pose.shift.y + pose.lift)
      .setAngle(pose.angle)
      .setScale(pose.side / factor, 1 / factor);
  }

  /** A head-relative point (device px relative to the pivot) on screen, for the head as posed. */
  private headSpot(snake: Standing, local: readonly [number, number], pose: HeadPose = snake.pose): Pt {
    return headPoint(snake.pivot, toLogical(local, snake.factor), pose.side, pose.angle, {
      x: pose.shift.x,
      y: pose.shift.y + pose.lift,
    });
  }

  /** The tongue at a flick step (null hides it), rooted at the mouth and following the head. */
  private drawTongue(snake: Standing, frame: string | null): void {
    if (!frame) {
      snake.tongue.setVisible(false);
      return;
    }
    const meta = atlasFrameMeta(this.scene, SHARED_SHEET, frame);
    const mouth = this.headSpot(snake, snake.entry.head.mouth);
    const { side, angle } = snake.pose;
    snake.tongue
      .setVisible(true)
      .setFrame(frame)
      .setOrigin(meta.anchorX / meta.w, meta.anchorY / meta.h)
      .setPosition(mouth.x, mouth.y)
      .setAngle(angle + TONGUE_DOWN_DEG * Math.sign(side || 1))
      .setScale(side / meta.factor, 1 / meta.factor);
  }

  // ---------------------------------------------------------------- idle (spec 5.3)

  private update(time: number): void {
    if (this.reduced || this.standing.size === 0) return;
    if (time >= this.nextCull) {
      this.nextCull = time + CULL_EVERY_MS;
      const view = this.rig.board.worldView;
      for (const snake of this.standing.values()) {
        snake.inView =
          snake.pivot.x >= view.x - CULL_MARGIN &&
          snake.pivot.x <= view.right + CULL_MARGIN &&
          snake.pivot.y >= view.y - CULL_MARGIN &&
          snake.pivot.y <= view.bottom + CULL_MARGIN;
      }
    }
    for (const snake of this.standing.values()) {
      if (!snake.shown || snake.biting || !snake.inView) continue;
      const t = time + snake.phaseMs;
      snake.pose.angle = -SWAY_DEG * Math.cos((2 * Math.PI * t) / SWAY_PERIOD_MS);
      this.applyHead(snake);
      const breath = 1 + (BREATH_SCALE / 2) * (1 - Math.cos((2 * Math.PI * t) / BREATH_PERIOD_MS));
      snake.coil.setScale(breath / snake.factor, 1 / snake.factor);
      this.idleTongue(snake, time);
    }
  }

  private idleTongue(snake: Standing, time: number): void {
    if (snake.tongueStartedAt < 0) {
      if (time < snake.nextTongueAt) return;
      snake.tongueStartedAt = time;
    }
    const frame = flickFrame(time - snake.tongueStartedAt);
    this.drawTongue(snake, frame);
    if (frame === null) {
      snake.tongueStartedAt = -1;
      snake.nextTongueAt = time + Phaser.Math.Between(TONGUE_MIN_MS, TONGUE_MAX_MS);
    }
  }

  // ---------------------------------------------------------------- the bite (spec 5.4)

  /**
   * Plays one bite: rise (first reveal only), hold, strike, swallow, camera pan, reappearance. One clock drives every
   * step, so the step times of `snakeTimeline` hold to a frame however long a frame takes.
   */
  bite(jumpId: number, hooks: BiteHooks): Promise<void> {
    const snake = this.standing.get(jumpId);
    if (!snake) return Promise.reject(new Error(`No snake on square ${jumpId}`));
    const fast = this.isFast();
    const first = !snake.shown;
    const line = snakeTimeline(fast, first);
    const S = line.steps;
    const dur = (name: keyof typeof S) => S[name].end - S[name].start;
    const progress = (t: number, name: keyof typeof S) => {
      const d = dur(name);
      return d === 0 ? (t >= S[name].start ? 1 : 0) : clamp01((t - S[name].start) / d);
    };

    // Placement, decided once: which way the head faces and how it turns toward the token's body.
    const rest = worldPose(hooks.tokenSpot[0], hooks.tokenSpot[1]);
    const chest = { x: rest.feet.x, y: rest.feet.y - TOKEN_CHEST_PX };
    const mouthLocal = toLogical(snake.entry.head.mouth, snake.factor);
    const side = headSide(snake.pivot, chest);
    const turn = headTurn(snake.pivot, mouthLocal, side, chest);
    const reach = Math.hypot(chest.x - snake.pivot.x, chest.y - snake.pivot.y) || 1;
    const dir = {
      x: ((chest.x - snake.pivot.x) / reach) * STRIKE_REACH_PX,
      y: ((chest.y - snake.pivot.y) / reach) * STRIKE_REACH_PX,
    };
    const struck: HeadPose = { side, angle: turn + STRIKE_PITCH_DEG * side, shift: dir, lift: 0 };
    const mouthStruck = this.headSpot(snake, snake.entry.head.mouth, struck);
    const startAngle = snake.pose.angle;
    const tokenDepth = standingDepth(snake.coilKey) + TOKEN_STRIKE_DEPTH;
    let tail: TokenPose | null = null;

    snake.biting = true;
    snake.tongueStartedAt = -1;
    snake.pose = { side, angle: startAngle, shift: { x: 0, y: 0 }, lift: first ? RISE_HEAD_LIFT_PX : 0 };
    if (first) {
      snake.coil.setScale(1 / snake.factor, 0);
    }

    const done = new Set<string>();
    let clock = 0;
    let running = false;
    const once = (name: string, when: boolean, action: () => void): void => {
      if (!when || !running || done.has(name)) return;
      done.add(name);
      this.trace.push({ name, at: performance.now(), t: clock });
      action();
    };
    this.trace.length = 0;

    const frame = (t: number): void => {
      clock = t;
      const pose = snake.pose;
      // 1 rise: the coil grows from its ground anchor, the head follows 120 ms later, rising 10 px out of nothing.
      if (first) {
        once('rise', t >= S.rise.start, () => {
          snake.coil.setVisible(true);
          this.audio.hiss(fast);
        });
        const grow = progress(t, 'rise');
        snake.coil.setScale(
          1 / snake.factor,
          Phaser.Math.Easing.Back.Out(grow, RISE_OVERSHOOT) / snake.factor,
        );
        const headU = clamp01((grow - HEAD_FOLLOWS) / (1 - HEAD_FOLLOWS));
        snake.head.setVisible(headU > 0).setAlpha(headU);
        pose.lift = RISE_HEAD_LIFT_PX * (1 - Phaser.Math.Easing.Quadratic.Out(headU));
      }
      // 2 hold: the head turns to face the token and flicks its tongue.
      once('hold', t >= S.hold.start, () => undefined);
      const turning = dur('hold') === 0 ? progress(t, 'hold') : clamp01((t - S.hold.start) / TURN_MS);
      pose.angle = lerp(startAngle, turn, Phaser.Math.Easing.Sine.InOut(turning));
      if (dur('hold') > 0 && t >= S.hold.start && t < S.hold.end)
        this.drawTongue(snake, flickFrame(t - S.hold.start));
      else if (t >= S.hold.end) snake.tongue.setVisible(false);
      // 3 strike: the head dips toward the token and opens its mouth a third of the way in.
      if (t >= S.strike.start) {
        once('strike', true, () => {
          this.audio.snake(fast);
          hooks.drawToken({ ...rest, depth: tokenDepth }, 1);
        });
        const e = Phaser.Math.Easing.Quadratic.In(progress(t, 'strike'));
        pose.angle = lerp(turn, struck.angle, e);
        pose.shift = { x: dir.x * e, y: dir.y * e };
        if (t - S.strike.start >= dur('strike') / 3) snake.head.setFrame(snake.entry.head.open);
      }
      // 4 swallow: the token shrinks into the mouth and a bulge runs down the neck.
      if (t >= S.swallow.start && t < S.swallow.end) {
        once('swallow', true, () => {
          this.audio.gulp(fast);
          if (!fast) this.rig.board.shake(SHAKE.ms, SHAKE.intensity);
        });
        const u = Phaser.Math.Easing.Quadratic.In(progress(t, 'swallow'));
        const fade = dur('swallow') / 4;
        const alpha = 1 - clamp01((t - (S.swallow.end - fade)) / fade);
        const feet = { x: lerp(rest.feet.x, mouthStruck.x, u), y: lerp(rest.feet.y, mouthStruck.y + 4, u) };
        const ground = {
          x: lerp(rest.ground.x, mouthStruck.x, u),
          y: lerp(rest.ground.y, mouthStruck.y + 4, u),
        };
        hooks.drawToken(
          { feet, ground, depth: tokenDepth, lift: 0, scale: lerp(1, TOKEN_SMALLEST, u) },
          alpha,
        );
        if (progress(t, 'swallow') >= 200 / 320) snake.head.setFrame(snake.entry.head.closed);
      }
      this.drawBulge(
        snake,
        t,
        S.swallow.start + BULGE_START * dur('swallow'),
        (BULGE_MS * dur('swallow')) / 320,
      );
      // 5 restore: the head returns to its idle pose (it turns round again if it had faced left).
      if (t >= S.restore.start) {
        once('swallowed', true, () => hooks.drawToken({ ...rest, depth: tokenDepth }, 0));
        const e = Phaser.Math.Easing.Sine.Out(progress(t, 'restore'));
        pose.angle = lerp(struck.angle, 0, e);
        pose.shift = { x: dir.x * (1 - e), y: dir.y * (1 - e) };
        pose.side = lerp(side, 1, e);
      }
      // 6 pan: the camera goes to the tail square.
      once('pan', t >= S.pan.start, () => hooks.panToTail());
      // 7 reappear: dust, then the token grows back at the tail square.
      once('reappear', t >= S.reappear.start, () => {
        tail = hooks.landAtTail();
        this.audio.pop(fast);
        this.rig.within('board', () => dustPuff(this.scene, tail!.feet.x, tail!.feet.y, fast, 6));
      });
      if (tail && t >= S.reappear.start) {
        const u = progress(t, 'reappear');
        const grown = lerp(TOKEN_SMALLEST, 1, Phaser.Math.Easing.Back.Out(u));
        hooks.drawToken({ ...tail, scale: grown }, clamp01(u * 3));
      }
      this.applyHead(snake);
    };

    return new Promise<void>((resolve) => {
      frame(0);
      this.scene.tweens.addCounter({
        from: 0,
        to: line.total,
        duration: line.total,
        onUpdate: (tween) => {
          running = true;
          frame(tween.getValue() ?? 0);
        },
        onComplete: () => {
          frame(line.total);
          if (tail) hooks.drawToken(tail, 1);
          this.showIdle(snake);
          resolve();
        },
      });
    });
  }

  /** The bulge running mouth, neck points, collar (spec 5.4 step 4); it follows the head and fades at the end. */
  private drawBulge(snake: Standing, t: number, start: number, length: number): void {
    const u = length === 0 ? 0 : (t - start) / length;
    if (u <= 0 || u >= 1) {
      snake.bulge.setVisible(false);
      return;
    }
    const { mouth, neck } = snake.entry.head;
    const path = [mouth, ...neck, [0, 0] as [number, number]];
    const along = u * (path.length - 1);
    const i = Math.min(path.length - 2, Math.floor(along));
    const a = this.headSpot(snake, path[i]!);
    const b = this.headSpot(snake, path[i + 1]!);
    const k = along - i;
    const scale =
      (BULGE_SCALE * snake.entry.R) / 3 / atlasFrameMeta(this.scene, SHARED_SHEET, 'bulge').factor;
    snake.bulge
      .setVisible(true)
      .setPosition(lerp(a.x, b.x, k), lerp(a.y, b.y, k))
      .setScale(scale)
      .setAlpha(1 - clamp01((u - (1 - BULGE_FADE)) / BULGE_FADE));
  }
}

/** The tongue frame `elapsed` ms into a flick; null once the flick is over. */
function flickFrame(elapsed: number): string | null {
  let at = 0;
  for (const step of TONGUE_FLICK) {
    at += step.ms;
    if (elapsed < at) return step.frame;
  }
  return null;
}
