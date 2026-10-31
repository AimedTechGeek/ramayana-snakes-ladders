// The living board (T42.7): 144 blocks, frame, props, fog of war and ambient life as depth-sorted atlas sprites.
// Spec: docs/design/T42-living-board.md sections 1, 2, 3.5, 4 and 7. Everything it creates goes to the board camera
// layer (`rig.within('board', ...)`). Snakes and bridges (T42.8 / T42.9) are actors placed into the same depth bands
// (boardBands.ts) that hook `onJumpRevealed`.

import Phaser from 'phaser';
import { addAtlasSprite, atlasFrameMeta, atlasMeta, type AtlasFrameMeta } from '../assets';
import type { Board } from '../../core/types';
import { gridOf } from '../layout';
import { toScreen, type Screen } from '../iso/boardIso';
import { BOARD_VIEWPORT } from '../boardCamera';
import { CELL, SIZE, TOP_Z } from '../iso/world';
import type { BoardCameraRig } from '../ui/BoardCameraRig';
import type { RevealState } from '../reveal';
import {
  AMBIENT_LIMIT,
  CULL_MARGIN,
  NUMERAL_DEPTH,
  airDepth,
  floorDepth,
  floorKey,
  frameDepth,
  selectAmbient,
  standingDepth,
  type AmbientSource,
  type Rect,
} from './boardBands';
import {
  FINAL_SQUARE,
  REGION_INK,
  fogFrameOf,
  frameNameOf,
  layoutProps,
  regionOf,
  seedOf,
  tileTintOf,
  type NumeralInk,
  type PlacedProp,
  type PropKind,
  type RegionName,
} from './blockRules';

export const BLOCKS_SHEET = 'blocks';
export const SHARED_SHEET = 'shared';
export const PROPS_SHEET = 'props';
export const FRAME_SHEET = 'frame';

/** Fog lifts over this long (spec 3.4); Fast mode 120 ms. */
export const REVEAL_MS = 420;
export const FAST_REVEAL_MS = 120;
const PROP_STAGGER_MS = 40;
const MIST_ALPHA = 0.55;
const MIST_GROW = 1.3;
const CULL_EVERY_MS = 250;
const BIRD_FLIGHT_MS = 14000;
const BIRD_FLAP_HZ = 6;
const SMOKE_EVERY_MS = 2000;
const SMOKE_RISE_PX = 8;
const SMOKE_MS = 1600;

type JumpType = 'ladder' | 'snake';
export type JumpRevealListener = (jumpId: number, jumpType: JumpType, animate: boolean) => void;

interface FramePlacementMeta {
  id: string;
  frame: string;
  world: [number, number, number];
  depthAt: [number, number];
  depthBias: number;
}

interface NumeralMeta extends AtlasFrameMeta {
  sill: Screen;
  advance: Screen;
}

/** One thing that animates while on screen; `start`/`stop` pause and resume its tween or timer. */
interface AmbientItem extends AmbientSource {
  live: boolean;
  start(): void;
  stop(): void;
  dispose(): void;
}

interface Block {
  square: number;
  region: RegionName;
  revealed: boolean;
  /** Tile floor point on screen. */
  at: Screen;
  key: number;
  tile: Phaser.GameObjects.Image;
  fog: Phaser.GameObjects.Image | null;
  mist: Phaser.GameObjects.Image | null;
  numerals: Phaser.GameObjects.Image[];
  props: Phaser.GameObjects.Image[];
  shimmer: Phaser.GameObjects.Image | null;
  ambient: AmbientItem[];
}

interface BirdSpec {
  frames: [string, string];
  row: number;
  scale: number;
}

/** Spec 1.6: parrots over row 2, Jatayu row 7 (crow frames, larger: no vulture frame in the atlas), gulls row 10, crows row 12. */
const BIRDS: readonly BirdSpec[] = [
  { frames: ['bird-parrot-1', 'bird-parrot-2'], row: 2, scale: 1 },
  { frames: ['bird-crow-1', 'bird-crow-2'], row: 7, scale: 1.5 },
  { frames: ['bird-gull-1', 'bird-gull-2'], row: 10, scale: 1 },
  { frames: ['bird-crow-1', 'bird-crow-2'], row: 12, scale: 1 },
];
const BIRD_HEIGHT_UNITS = 34;

export interface LivingBoardOptions {
  /** Fast mode halves the crossfade to 120 ms. */
  isFast: () => boolean;
}

export class LivingBoard {
  private readonly blocks: Block[] = [null as unknown as Block];
  private readonly propKinds: PropKind[];
  private readonly propLayout: PlacedProp[][];
  private readonly jumpTypes = new Map<number, JumpType>();
  private readonly revealedJumps = new Set<number>();
  /** Squares whose board numeral is hidden because a bridge stele engraves it (T42.9). */
  private readonly hiddenNumerals = new Set<number>();
  private readonly listeners: JumpRevealListener[] = [];
  private readonly items: AmbientItem[] = [];
  private nextId = 1;
  private readonly reduced: boolean;
  private lastViewKey = '';
  private viewStableFrames = 0;
  private cullDirty = true;
  private readonly framePlacements: FramePlacementMeta[];
  private readonly birds: {
    item: AmbientItem;
    sprite: Phaser.GameObjects.Image;
    place: () => void;
    rowFirst: number;
    advance: (ms: number) => number;
  }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly rig: BoardCameraRig,
    board: Board,
    reveal: RevealState,
    private readonly options: LivingBoardOptions,
  ) {
    this.reduced =
      typeof window !== 'undefined' && !!window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    for (const jump of board.ladders) this.jumpTypes.set(jump.from, 'ladder');
    for (const jump of board.snakes) this.jumpTypes.set(jump.from, 'snake');
    this.propKinds = Object.values(atlasMeta(scene, PROPS_SHEET).frames) as unknown as PropKind[];
    this.propLayout = layoutProps(this.propKinds);
    const frameMeta = atlasMeta(scene, FRAME_SHEET) as unknown as {
      placements: FramePlacementMeta[];
      fixtures: FramePlacementMeta[];
    };
    this.framePlacements = [...frameMeta.placements, ...frameMeta.fixtures];

    this.rig.within('board', () => {
      this.buildFrame();
      for (let square = 1; square <= FINAL_SQUARE; square++) {
        const seen = reveal.terrain.includes(square);
        this.blocks.push(this.buildBlock(square, seen));
      }
      this.buildBirds();
    });
    for (const jumpId of reveal.jumps) this.revealedJumps.add(jumpId);

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    const cull = scene.time.addEvent({
      delay: CULL_EVERY_MS,
      loop: true,
      callback: () => (this.cullDirty = true),
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      cull.remove();
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    });
  }

  // ---------------------------------------------------------------- public API

  isSquareRevealed(square: number): boolean {
    return this.blocks[square]?.revealed ?? false;
  }

  /** The depth key of a square's floor point, for actors that stand on it (`standingDepth(living.keyOf(sq))`). */
  keyOf(square: number): number {
    return this.blockOf(square).key;
  }

  /** Hides or shows a square's board numeral (a revealed bridge shows its top square's number on its stele instead). */
  setNumeralHidden(square: number, hidden: boolean): void {
    if (hidden) this.hiddenNumerals.add(square);
    else this.hiddenNumerals.delete(square);
    for (const glyph of this.blockOf(square).numerals) glyph.setVisible(!hidden);
  }

  /** The tile centre on screen (logical px), the floor point of the block. */
  floorPointOf(square: number): Screen {
    return this.blockOf(square).at;
  }

  /**
   * Lifts the fog of a square: the crossfade of spec 3.4 (420 ms, Fast 120), or at once with `animate: false`.
   * Returns false when it was already revealed.
   */
  revealSquare(square: number, animate = true): boolean {
    const block = this.blockOf(square);
    if (block.revealed) return false;
    block.revealed = true;
    this.rig.within('board', () => this.lift(block, animate));
    return true;
  }

  /** Marks a jump revealed and tells every actor listening (snake / bridge runtime). False when already revealed. */
  revealJump(jumpId: number, animate = true): boolean {
    if (this.revealedJumps.has(jumpId)) return false;
    this.revealedJumps.add(jumpId);
    this.notify(jumpId, animate);
    return true;
  }

  /**
   * A snake or bridge actor registers here. It is called at once, without animation, for every jump already revealed
   * (resume from a save), then with `animate: true` whenever a jump is revealed later.
   */
  onJumpRevealed(listener: JumpRevealListener): void {
    this.listeners.push(listener);
    for (const jumpId of this.revealedJumps) {
      const type = this.jumpTypes.get(jumpId);
      if (type) listener(jumpId, type, false);
    }
  }

  /** Every square and every jump at once (debug key `R`). */
  revealAll(): void {
    for (let square = 1; square <= FINAL_SQUARE; square++) this.revealSquare(square, false);
    for (const jumpId of this.jumpTypes.keys()) this.revealJump(jumpId, false);
  }

  get revealedSquareCount(): number {
    return this.blocks.filter((block) => block?.revealed).length;
  }

  /** Live ambient items and their tween cost, for tests and the performance log. */
  get ambientStats(): { items: number; live: number; liveCost: number } {
    const live = this.items.filter((item) => item.live);
    return {
      items: this.items.length,
      live: live.length,
      liveCost: live.reduce((sum, item) => sum + item.cost, 0),
    };
  }

  // ---------------------------------------------------------------- build

  private blockOf(square: number): Block {
    const block = this.blocks[square];
    if (!block) throw new Error(`No block ${square}`);
    return block;
  }

  private buildFrame(): void {
    for (const placement of this.framePlacements) {
      const at = toScreen(placement.world);
      addAtlasSprite(this.scene, FRAME_SHEET, placement.frame, at.x, at.y).setDepth(frameDepth(placement));
    }
  }

  private buildBlock(square: number, seen: boolean): Block {
    const { row, column } = gridOf(square);
    const cx = column * CELL + CELL / 2;
    const cy = SIZE - row * CELL - CELL / 2;
    const at = toScreen([cx, cy, TOP_Z]);
    const key = floorKey(cx, cy);
    const region = regionOf(square);
    const seed = seedOf(square);
    const tile = addAtlasSprite(this.scene, BLOCKS_SHEET, frameNameOf(square), at.x, at.y)
      .setDepth(floorDepth(key))
      .setTint(tileTintOf(square));
    const block: Block = {
      square,
      region,
      revealed: seen,
      at,
      key,
      tile,
      fog: null,
      mist: null,
      numerals: [],
      props: [],
      shimmer: null,
      ambient: [],
    };
    if (seen) {
      block.numerals = this.makeNumerals(block, REGION_INK[region]);
      this.furnish(block, false);
      return block;
    }
    block.fog = addAtlasSprite(this.scene, BLOCKS_SHEET, fogFrameOf(square), at.x, at.y).setDepth(
      floorDepth(key, 'fog'),
    );
    block.mist = addAtlasSprite(this.scene, SHARED_SHEET, `mist-${1 + ((seed >>> 4) & 1)}`, at.x, at.y)
      .setDepth(floorDepth(key, 'mist'))
      .setAlpha(MIST_ALPHA);
    block.numerals = this.makeNumerals(block, 'dark');
    this.addMistDrift(block, block.mist);
    return block;
  }

  /** One glyph sprite per digit, centred on the sill of the tile (spec 1.2 and the numeral meta). */
  private makeNumerals(block: Block, ink: NumeralInk): Phaser.GameObjects.Image[] {
    const digits = String(block.square).split('');
    const meta = atlasFrameMeta(this.scene, SHARED_SHEET, `num-${digits[0]}-${ink}`) as NumeralMeta;
    return digits.map((digit, i) => {
      const offset = i - (digits.length - 1) / 2;
      return addAtlasSprite(
        this.scene,
        SHARED_SHEET,
        `num-${digit}-${ink}`,
        block.at.x + meta.sill.x + offset * meta.advance.x,
        block.at.y + meta.sill.y + offset * meta.advance.y,
      )
        .setDepth(NUMERAL_DEPTH)
        .setVisible(!this.hiddenNumerals.has(block.square));
    });
  }

  /** Props, water shimmer and their ambient life: the terrain of a revealed block. */
  private furnish(block: Block, animate: boolean): void {
    const fast = this.options.isFast();
    block.props = this.propLayout[block.square]!.map((placed, index) =>
      this.makeProp(block, placed, index, animate, fast),
    );
    if (block.region === 'sea' || block.region === 'ganga') this.addShimmer(block, animate);
  }

  private makeProp(
    block: Block,
    placed: PlacedProp,
    index: number,
    animate: boolean,
    fast: boolean,
  ): Phaser.GameObjects.Image {
    const meta = atlasFrameMeta(this.scene, PROPS_SHEET, placed.kind) as AtlasFrameMeta &
      PropKind & { emit?: Screen };
    const { cx, cy } = this.centreOf(block);
    const x = cx + placed.x;
    const y = cy + placed.y;
    const at = toScreen([x, y, TOP_Z]);
    const sprite = addAtlasSprite(this.scene, PROPS_SHEET, placed.kind, at.x, at.y).setDepth(
      standingDepth(floorKey(x, y)),
    );
    const base = sprite.scaleX;
    const register = () => this.addPropAmbient(block, sprite, meta, at, seedOf(block.square) + index);
    if (!animate) {
      register();
      return sprite;
    }
    const duration = fast ? FAST_REVEAL_MS : REVEAL_MS;
    const stagger = fast ? 0 : index * PROP_STAGGER_MS;
    sprite.setAlpha(0);
    this.scene.tweens.add({ targets: sprite, alpha: 1, duration, delay: stagger, ease: 'Quad.easeOut' });
    this.scene.tweens.add({
      targets: sprite,
      scaleX: base * 1.06,
      scaleY: base * 1.06,
      duration: duration / 2,
      delay: stagger + duration / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        sprite.setScale(base);
        if (sprite.active) register();
      },
    });
    return sprite;
  }

  private centreOf(block: Block): { cx: number; cy: number } {
    const { row, column } = gridOf(block.square);
    return { cx: column * CELL + CELL / 2, cy: SIZE - row * CELL - CELL / 2 };
  }

  // ---------------------------------------------------------------- reveal (spec 3.4 and 7)

  private lift(block: Block, animate: boolean): void {
    const fast = this.options.isFast();
    const duration = !animate ? 0 : fast ? FAST_REVEAL_MS : REVEAL_MS;
    const { fog, mist } = block;
    block.ambient = block.ambient.filter((item) => {
      // the mist drift ends with the fog
      item.dispose();
      this.forget(item);
      return false;
    });
    block.fog = null;
    block.mist = null;
    if (fog) {
      if (duration === 0) fog.destroy();
      else
        this.scene.tweens.add({
          targets: fog,
          alpha: 0,
          duration,
          ease: 'Linear',
          onComplete: () => fog.destroy(),
        });
    }
    if (mist) {
      if (duration === 0) mist.destroy();
      else
        this.scene.tweens.add({
          targets: mist,
          alpha: 0,
          scaleX: mist.scaleX * MIST_GROW,
          scaleY: mist.scaleY * MIST_GROW,
          duration,
          ease: 'Quad.easeOut',
          onComplete: () => mist.destroy(),
        });
    }
    this.crossfadeNumerals(block, duration);
    this.furnish(block, animate);
  }

  /** Numerals turn from the fog `dark` ink to the region's ink (a no-op for dark regions). */
  private crossfadeNumerals(block: Block, duration: number): void {
    const ink = REGION_INK[block.region];
    if (ink === 'dark') return;
    const old = block.numerals;
    block.numerals = this.makeNumerals(block, ink);
    if (duration === 0) {
      old.forEach((glyph) => glyph.destroy());
      return;
    }
    block.numerals.forEach((glyph) => glyph.setAlpha(0));
    this.scene.tweens.add({ targets: block.numerals, alpha: 1, duration, ease: 'Linear' });
    this.scene.tweens.add({
      targets: old,
      alpha: 0,
      duration,
      ease: 'Linear',
      onComplete: () => old.forEach((glyph) => glyph.destroy()),
    });
  }

  private notify(jumpId: number, animate: boolean): void {
    const type = this.jumpTypes.get(jumpId);
    if (!type) return;
    for (const listener of this.listeners) listener(jumpId, type, animate);
  }

  // ---------------------------------------------------------------- ambient (spec 1.6)

  private register(item: Omit<AmbientItem, 'id' | 'live'>): AmbientItem {
    const full: AmbientItem = { ...item, id: this.nextId++, live: false };
    this.items.push(full);
    this.cullDirty = true;
    return full;
  }

  private forget(item: AmbientItem): void {
    const index = this.items.indexOf(item);
    if (index >= 0) this.items.splice(index, 1);
  }

  /** A tween that is built the first time it is needed, then paused and resumed by culling. */
  private tweenItem(
    block: Block,
    x: number,
    y: number,
    target: Phaser.GameObjects.GameObject | null,
    make: () => Phaser.Tweens.Tween,
  ): AmbientItem | null {
    if (this.reduced) return null;
    let tween: Phaser.Tweens.Tween | null = null;
    const item = this.register({
      x,
      y,
      cost: 1,
      start: () => {
        tween ??= make();
        tween.resume();
      },
      stop: () => tween?.pause(),
      dispose: () => {
        if (target) this.scene.tweens.killTweensOf(target);
        tween = null;
      },
    });
    block.ambient.push(item);
    return item;
  }

  private addMistDrift(block: Block, mist: Phaser.GameObjects.Image): void {
    const seed = seedOf(block.square);
    this.tweenItem(block, block.at.x, block.at.y, mist, () =>
      this.scene.tweens.add({
        targets: mist,
        x: { from: block.at.x - 2, to: block.at.x + 2 },
        duration: 6000,
        delay: seed % 3000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }),
    );
  }

  private addShimmer(block: Block, animate: boolean): void {
    const sprite = addAtlasSprite(this.scene, SHARED_SHEET, 'shimmer', block.at.x, block.at.y)
      .setDepth(floorDepth(block.key, 'shimmer'))
      .setAlpha(animate ? 0 : 0.3);
    block.shimmer = sprite;
    const seed = seedOf(block.square);
    const make = () => {
      sprite.setAlpha(0.3);
      return this.scene.tweens.add({
        targets: sprite,
        x: { from: block.at.x - 3, to: block.at.x + 3 },
        alpha: { from: 0.3, to: 0.6 },
        duration: 2400,
        delay: seed % 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    };
    if (animate) {
      this.scene.tweens.add({ targets: sprite, alpha: 0.3, duration: REVEAL_MS });
    }
    this.tweenItem(block, block.at.x, block.at.y, sprite, make);
  }

  private addPropAmbient(
    block: Block,
    sprite: Phaser.GameObjects.Image,
    meta: AtlasFrameMeta & PropKind & { emit?: Screen },
    at: Screen,
    seed: number,
  ): void {
    switch (meta.anim) {
      case 'sway': {
        const duration = 1800 + (seed % 9) * 100;
        this.tweenItem(block, at.x, at.y, sprite, () =>
          this.scene.tweens.add({
            targets: sprite,
            angle: { from: -2.5, to: 2.5 },
            duration,
            delay: (seed % 7) * 250,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
        return;
      }
      case 'flicker':
        this.tweenItem(block, at.x, at.y, sprite, () =>
          this.scene.tweens.add({
            targets: sprite,
            alpha: { from: 1, to: 0.75 },
            duration: 100,
            yoyo: true,
            repeat: -1,
            onYoyo: (tween: Phaser.Tweens.Tween) => (tween.timeScale = 100 / Phaser.Math.Between(80, 140)),
            onRepeat: (tween: Phaser.Tweens.Tween) => (tween.timeScale = 100 / Phaser.Math.Between(80, 140)),
          }),
        );
        return;
      case 'shimmer':
        this.tweenItem(block, at.x, at.y, sprite, () =>
          this.scene.tweens.add({
            targets: sprite,
            alpha: { from: 1, to: 0.82 },
            duration: 2400,
            delay: (seed % 5) * 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          }),
        );
        return;
      case 'smoke':
        this.addSmoke(block, sprite, meta, at);
        return;
      default:
        return;
    }
  }

  /** A puff rises 8 px and fades over 1.6 s, every 2 s from the prop's emit point. */
  private addSmoke(
    block: Block,
    sprite: Phaser.GameObjects.Image,
    meta: AtlasFrameMeta & { emit?: Screen },
    at: Screen,
  ): void {
    if (this.reduced || !meta.emit) return;
    const emit = meta.emit;
    let timer: Phaser.Time.TimerEvent | null = null;
    const puff = () =>
      this.rig.within('board', () => {
        const image = addAtlasSprite(this.scene, SHARED_SHEET, 'puff', at.x + emit.x, at.y + emit.y)
          .setDepth(sprite.depth + 0.1)
          .setAlpha(0.6);
        this.scene.tweens.add({
          targets: image,
          y: image.y - SMOKE_RISE_PX,
          alpha: 0,
          duration: SMOKE_MS,
          onComplete: () => image.destroy(),
        });
      });
    const item = this.register({
      x: at.x,
      y: at.y,
      cost: 1,
      start: () => {
        timer ??= this.scene.time.addEvent({ delay: SMOKE_EVERY_MS, loop: true, callback: puff });
        timer.paused = false;
      },
      stop: () => {
        if (timer) timer.paused = true;
      },
      dispose: () => timer?.remove(),
    });
    block.ambient.push(item);
  }

  // ---------------------------------------------------------------- birds (air band)

  private buildBirds(): void {
    if (this.reduced) return;
    for (const spec of BIRDS) {
      const { y } = squareCentre(spec.row);
      const leftToRight = spec.row % 2 === 1;
      const sprite = addAtlasSprite(this.scene, SHARED_SHEET, spec.frames[0], 0, 0)
        .setDepth(airDepth(floorKey(SIZE / 2, y)))
        .setVisible(false);
      sprite.setScale(sprite.scaleX * spec.scale);
      const flip = leftToRight ? 1 : -1;
      sprite.scaleX = Math.abs(sprite.scaleX) * flip;
      let elapsed = Math.random() * BIRD_FLIGHT_MS;
      const rowFirst = (spec.row - 1) * 12 + 1;
      const place = () => {
        const u = (elapsed % BIRD_FLIGHT_MS) / BIRD_FLIGHT_MS;
        const x = -20 + (SIZE + 40) * (leftToRight ? u : 1 - u);
        const bob = Math.sin(u * Math.PI * 10) * 1.5;
        const at = toScreen([x, y, TOP_Z + BIRD_HEIGHT_UNITS + bob]);
        sprite.setPosition(at.x, at.y);
        sprite.setFrame(spec.frames[Math.floor((elapsed / 1000) * BIRD_FLAP_HZ) % 2]!);
      };
      place();
      const centre = toScreen([SIZE / 2, y, TOP_Z + BIRD_HEIGHT_UNITS]);
      const item = this.register({
        x: centre.x,
        y: centre.y,
        cost: 1,
        start: () => undefined,
        stop: () => undefined,
        dispose: () => sprite.destroy(),
      });
      // Birds are advanced by update(); they show once any square of their row is revealed.
      const bird = { item, sprite, place, rowFirst, advance: (ms: number) => (elapsed += ms) };
      this.birds.push(bird);
    }
  }

  // ---------------------------------------------------------------- per-frame

  /** The board camera's view in logical px, from the rig. */
  private viewRect(): Rect {
    const { zoom, cx, cy } = this.rig.view;
    const width = BOARD_VIEWPORT.width / zoom;
    const height = BOARD_VIEWPORT.height / zoom;
    return { x: cx - width / 2, y: cy - height / 2, width, height };
  }

  private update(_time: number, delta: number): void {
    const view = this.rig.view;
    const key = `${view.zoom.toFixed(3)}|${view.cx.toFixed(1)}|${view.cy.toFixed(1)}`;
    if (key === this.lastViewKey) {
      this.viewStableFrames++;
      // the camera has settled on a new view: rebuild the cull list now, not at the next 250 ms tick
      if (this.viewStableFrames === 2) this.cullDirty = true;
    } else {
      this.lastViewKey = key;
      this.viewStableFrames = 0;
    }
    if (this.reduced) return;
    if (this.cullDirty) {
      this.cullDirty = false;
      this.applyCull();
    }
    for (const bird of this.birds) {
      if (!bird.item.live) continue;
      bird.advance(delta);
      bird.place();
    }
  }

  private applyCull(): void {
    const view = this.viewRect();
    const eligible = this.items.filter((item) => this.isEligible(item));
    const chosen = selectAmbient(eligible, view, CULL_MARGIN, AMBIENT_LIMIT);
    for (const item of this.items) {
      const want = chosen.has(item.id);
      if (want && !item.live) {
        item.live = true;
        item.start();
      } else if (!want && item.live) {
        item.live = false;
        item.stop();
      }
    }
    for (const bird of this.birds) {
      const shown = this.rowRevealed(bird.rowFirst);
      bird.sprite.setVisible(shown && bird.item.live);
    }
  }

  /** Birds fly only over a row with a revealed square; every other item is eligible as it exists. */
  private isEligible(item: AmbientItem): boolean {
    const bird = this.birds.find((b) => b.item === item);
    return bird ? this.rowRevealed(bird.rowFirst) : true;
  }

  private rowRevealed(first: number): boolean {
    for (let square = first; square < first + 12; square++) if (this.blocks[square]?.revealed) return true;
    return false;
  }
}

/** Centre (world x, y) of the first square of a row (1-based from the nearest row). */
function squareCentre(row: number): { x: number; y: number } {
  return { x: CELL / 2, y: SIZE - (row - 1) * CELL - CELL / 2 };
}

/** Dev estimate of GPU texture memory: w x h x 4 bytes, x 1.33 for the mipmaps of power-of-two sources. */
export function estimateTextureMb(textures: Phaser.Textures.TextureManager): {
  mb: number;
  largest: { key: string; mb: number }[];
} {
  const rows: { key: string; mb: number }[] = [];
  for (const key of textures.getTextureKeys()) {
    if (key.startsWith('__')) continue;
    const texture = textures.get(key);
    let bytes = 0;
    for (const source of texture.source) {
      const mips = source.isPowerOf2 ? 4 / 3 : 1;
      bytes += source.width * source.height * 4 * mips;
    }
    rows.push({ key, mb: bytes / (1024 * 1024) });
  }
  rows.sort((a, b) => b.mb - a.mb);
  return { mb: rows.reduce((sum, row) => sum + row.mb, 0), largest: rows.slice(0, 8) };
}
