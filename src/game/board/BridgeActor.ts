// Bridge runtime (T42.9, spec 6.4 and 6.6): the stone bridges of the ladders. Hidden until a token lands on the foot
// block; a reveal makes the per-row segment sprites rise, foot to top; segments fade to 0.35 while a token rests on a
// square they cover. The token's walk is BoardScene's (it owns the tokens); this actor gives it the model to walk on.

import Phaser from 'phaser';
import { addAtlasSprite, atlasMeta, atlasSheet, type AtlasSheet } from '../assets';
import type { StoryJump } from '../../core/boards';
import type { Level } from '../../core/types';
import type { Audio } from '../audio';
import { dustPuff } from '../fx';
import { toScreen } from '../iso/boardIso';
import { TOP_Z } from '../iso/world';
import type { BoardCameraRig } from '../ui/BoardCameraRig';
import type { LivingBoard } from './LivingBoard';
import {
  BEHIND_ALPHA,
  FADE_MS,
  fadedSegments,
  segmentsOf,
  type BridgeFrameMeta,
  type BridgeMeta,
  type BridgeSegment,
} from './bridgeRules';

/** The sheet of a level's bridges (loaded by BoardScene.preload). */
export function bridgeSheet(level: Level): AtlasSheet {
  return atlasSheet(`bridges-${level}`);
}

const RISE_MS = 360;
const FAST_RISE_MS = 120;
const RISE_STAGGER_MS = 70;
const RISE_FROM_PX = 14;
const RISE_SQUASH = 0.9;
const THUD_MS = 120;
const FAST_THUD_MS = 60;
const THUD_SCALE = 1.03;
const DUST_DOTS = 4;

interface SheetMeta {
  frames: Record<string, BridgeFrameMeta>;
  bridges: Record<string, BridgeMeta>;
}

/** A segment sprite and what it is doing: hidden, rising, or settled at an alpha it fades between. */
interface SegmentSprite {
  segment: BridgeSegment;
  image: Phaser.GameObjects.Image;
  /** Screen anchor (logical px) and the settled scale. */
  at: { x: number; y: number };
  scale: number;
  settled: boolean;
  /** Alpha the settled sprite is at or fading to. */
  alpha: number;
}

/** What BoardScene walks on: the bridge's manifest entry and its segments with depths. */
export interface BridgeModel {
  id: string;
  meta: BridgeMeta;
  segments: BridgeSegment[];
}

interface Bridge extends BridgeModel {
  sprites: SegmentSprite[] | null;
}

export interface BridgeActorOptions {
  isFast: () => boolean;
  audio: Audio;
  /** Squares the tokens rest on right now (not the ones they are hopping to). */
  restingSquares: () => number[];
}

export class BridgeActor {
  private readonly bridges = new Map<number, Bridge>();
  private lastResting = '';
  private readonly risen = new Map<number, Promise<void>>();
  private readonly sheetKey: string;
  private readonly reduced =
    typeof window !== 'undefined' && !!window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: BoardCameraRig,
    private readonly living: LivingBoard,
    ladders: readonly StoryJump[],
    level: Level,
    private readonly options: BridgeActorOptions,
  ) {
    this.sheetKey = bridgeSheet(level).key;
    const sheet = atlasMeta(scene, this.sheetKey) as unknown as SheetMeta;
    for (const ladder of ladders) {
      const meta = sheet.bridges[ladder.id];
      if (!meta) throw new Error(`No bridge ${ladder.id} in the ${level} sheet`);
      this.bridges.set(ladder.from, { id: ladder.id, meta, segments: segmentsOf(meta, sheet.frames), sprites: null });
    }
    living.onJumpRevealed((jumpId, type, animate) => {
      if (type === 'ladder') this.risen.set(jumpId, this.show(jumpId, animate));
    });
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.fade, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.fade, this),
    );
  }

  /** The bridge of the ladder whose foot is `jumpId`. */
  modelOf(jumpId: number): BridgeModel {
    return this.bridgeOf(jumpId);
  }

  /**
   * Reveals the bridge of a ladder foot as a token lands on it and resolves when it stands (the rise, spec 6.6 step 1),
   * or after the 120 ms thud when it was already revealed.
   */
  async reveal(jumpId: number): Promise<void> {
    if (this.living.revealJump(jumpId)) await this.risen.get(jumpId);
    else await this.thud(jumpId);
  }

  // ---------------------------------------------------------------- show

  private bridgeOf(jumpId: number): Bridge {
    const bridge = this.bridges.get(jumpId);
    if (!bridge) throw new Error(`No bridge for ladder ${jumpId}`);
    return bridge;
  }

  private build(bridge: Bridge): SegmentSprite[] {
    return (bridge.sprites ??= this.rig.within('board', () =>
      bridge.segments.map((segment) => {
        const at = toScreen([segment.world[0], segment.world[1], TOP_Z]);
        const image = addAtlasSprite(this.scene, this.sheetKey, segment.name, at.x, at.y)
          .setDepth(segment.depth)
          .setAlpha(0);
        return { segment, image, at, scale: image.scaleX, settled: false, alpha: 0 };
      }),
    ));
  }

  private async show(jumpId: number, animate: boolean): Promise<void> {
    const bridge = this.bridgeOf(jumpId);
    // The board numeral of the top square would double up the number engraved on the bridge's stele.
    this.living.setNumeralHidden(bridge.meta.to, true);
    const sprites = this.build(bridge);
    if (!animate || this.reduced) {
      for (const sprite of sprites) this.settle(sprite);
      return;
    }
    await this.rise(sprites);
  }

  private async rise(sprites: SegmentSprite[]): Promise<void> {
    const fast = this.options.isFast();
    const duration = fast ? FAST_RISE_MS : RISE_MS;
    const stagger = fast ? 0 : RISE_STAGGER_MS;
    this.options.audio.stone(fast);
    if (!fast) this.rig.board.shake(100, 0.003);
    const resting = fadedSegments(
      sprites.map((sprite) => sprite.segment),
      this.options.restingSquares(),
    );
    await Promise.all(
      sprites.map((sprite, i) => {
        const delay = i * stagger;
        const alpha = resting.has(sprite.segment.name) ? BEHIND_ALPHA : 1;
        sprite.image.setPosition(sprite.at.x, sprite.at.y + RISE_FROM_PX).setScale(sprite.scale, sprite.scale * RISE_SQUASH);
        this.scene.time.delayedCall(delay + duration * 0.7, () =>
          this.rig.within('board', () =>
            dustPuff(this.scene, sprite.at.x, sprite.at.y, fast, DUST_DOTS, sprite.segment.depth + 0.5),
          ),
        );
        return new Promise<void>((resolve) =>
          this.scene.tweens.add({
            targets: sprite.image,
            y: sprite.at.y,
            alpha,
            scaleY: sprite.scale,
            duration,
            delay,
            ease: 'Back.easeOut',
            onComplete: () => {
              sprite.alpha = alpha;
              sprite.settled = true;
              this.lastResting = '';
              resolve();
            },
          }),
        );
      }),
    );
  }

  /** Shown at once (resume), at the alpha its resting tokens ask for. */
  private settle(sprite: SegmentSprite): void {
    sprite.settled = true;
    sprite.alpha = 1;
    sprite.image.setAlpha(1);
    this.lastResting = '';
  }

  /** A bridge that is already revealed answers a landing on its foot with a 120 ms `1.0 -> 1.03 -> 1.0` thud. */
  private async thud(jumpId: number): Promise<void> {
    if (this.reduced) return;
    const sprites = this.bridgeOf(jumpId).sprites ?? [];
    const duration = this.options.isFast() ? FAST_THUD_MS : THUD_MS;
    await Promise.all(
      sprites.map(
        (sprite) =>
          new Promise<void>((resolve) =>
            this.scene.tweens.add({
              targets: sprite.image,
              scaleX: sprite.scale * THUD_SCALE,
              scaleY: sprite.scale * THUD_SCALE,
              duration: duration / 2,
              yoyo: true,
              ease: 'Quad.easeOut',
              onComplete: () => {
                sprite.image.setScale(sprite.scale);
                resolve();
              },
            }),
          ),
      ),
    );
  }

  // ---------------------------------------------------------------- fade when behind (rule 3)

  /** Each frame: segments over a square a token rests on fade to 0.35 over 150 ms, and back when it leaves. */
  private fade(): void {
    const resting = this.options.restingSquares();
    const key = resting.join(',');
    if (key === this.lastResting) return;
    this.lastResting = key;
    for (const bridge of this.bridges.values()) {
      if (!bridge.sprites) continue;
      const faded = fadedSegments(bridge.segments, resting);
      for (const sprite of bridge.sprites) {
        if (!sprite.settled) continue; // a rising segment takes its target alpha when it lands
        const target = faded.has(sprite.segment.name) ? BEHIND_ALPHA : 1;
        if (target === sprite.alpha) continue;
        sprite.alpha = target;
        this.scene.tweens.killTweensOf(sprite.image);
        if (this.reduced) sprite.image.setAlpha(target);
        else this.scene.tweens.add({ targets: sprite.image, alpha: target, duration: FADE_MS, ease: 'Linear' });
      }
    }
  }
}
