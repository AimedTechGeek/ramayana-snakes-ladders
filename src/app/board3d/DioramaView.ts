// The BoardView of the 3D diorama: a plain model the R3F components read every frame (token spots, fog, raised
// jumps, puffs) plus a small requestAnimationFrame tween runner that plays each animation and resolves when done.
// No React here; components subscribe for discrete changes and read token transforms in useFrame.

import type { Arrive, BoardSetup, BoardView, Cue, MotionOptions } from '../turn/ports';
import type { Emotion, Reaction } from '../../characters/reactions';
import { TIMING } from '../../characters/reactions';
import type { StoryJump } from '../../core/boards';
import type { Jump } from '../../core/types';
import { fieldCentre, type Vec2 } from '../../game/iso/boardIso';
import {
  durationOf,
  distanceAt,
  frameIndexOf,
  phaseAt,
  pathOf,
  sampleAt,
  type Gait,
} from '../../game/iso/locomotion';
import { restingSpot } from '../../game/iso/tokenPose';
import type { RevealChange } from '../../game/reveal';
import { bridgeCurve, bridgeLeads } from './jumpCurves';
import { DECK_SAMPLES, bridgeById } from './bridgeGeometry';
import { blockTopY, groundHeightAt, squareCentre } from './boardLayout';
import { bitePose } from './cameraConfig';
import {
  SNAKE_META,
  backOut,
  biteTimeline,
  growAt,
  grownMouthPoint,
  mouthPoint,
  snakeAnchor,
  SWALLOW_IN,
  type SnakeClip,
} from './snakeChoreo';
import { toThree, toWorld, waitingSpot } from './coords';
import { crossingPlan, hopHeight, leapProgress } from './crossing';
import type { Beats } from './heroClips';

export interface TokenState {
  /** Square the token is drawn on (0: waiting off the board). Trails the engine while animations run. */
  square: number;
  /** World (x, y) of the feet. */
  spot: Vec2;
  /** Height above the block tops, three units. */
  lift: number;
  scale: number;
  /** Heading in radians around the vertical axis (0 faces the viewer). */
  heading: number;
  /** A three-space position that wins over `spot` (on a bridge arch). */
  override: [number, number, number] | null;
  /** Sliding or arcing without steps (entry arc, triple-six slide, re-fan): the figure keeps its rest pose. */
  gliding: boolean;
  /** A leap in progress (onto or off a bridge deck, Hanuman's leap to Lanka): `ms` into its four beats. */
  leap: { ms: number; beats: Beats } | null;
  /** Swallowed by a snake: not drawn (from the end of the swallow to the reappearance at the tail). */
  hidden: boolean;
}

/** The beat of a snake's clip now playing: the snake samples `clip` at (now - start) / ms. */
export interface SnakeAct {
  clip: SnakeClip;
  start: number;
  ms: number;
}

/** A point in viewport CSS pixels (a token's head, for its speech bubble). */
export interface ScreenAnchor {
  x: number;
  y: number;
}

export interface Puff {
  at: Vec2;
  start: number;
  ms: number;
  /** Ring scale: 1 for a token's bounce, smaller for the dust at a bridge's feet. */
  size: number;
}

export interface SeatMood {
  emotion: Emotion;
  until: number;
  /** The reaction behind the mood: its tween picks the clip, its intensity the clip weight. */
  reaction: Reaction;
}

export interface Bubble {
  line: string;
  intensity: number;
  until: number;
}

/** Camera actions the HUD buttons call; the camera rig registers them once it is mounted. */
export interface CameraApi {
  fit(): void;
  focus(player: number): void;
  /** Test hooks (`window.__app.camera`): an exact pose, angles in radians, instantly. */
  set(pose: CameraPose): void;
  get(): CameraPose;
  /**
   * Bite close-ups (T45.4), the one move the game makes by itself: an eased glide to `pose` over `ms`. A later glide
   * retargets from wherever the camera is; any player input (drag, wheel, keys, Fit, Focus) drops it and calls
   * `DioramaView.cancelCamera`, so the player always keeps control.
   */
  glide(pose: CameraPose, ms: number): void;
}

export interface CameraPose {
  azimuth: number;
  polar: number;
  distance: number;
  /** Look-at point; the current one when absent. */
  target?: [number, number, number];
}

interface StepSound {
  step(): void;
}

const ENTER_MS = 360;
const SLIDE_MS = 500;
const RISE_MS = 450;
const REFAN_MS = 80;
const PUFF_MS = 600;
const ENTER_ARC = 0.6;
const BOB = 0.08;

export class DioramaView implements BoardView {
  setup: BoardSetup | null = null;
  tokens: TokenState[] = [];
  revealedTerrain = new Set<number>();
  /** Rise of each revealed jump (keyed by its head or foot square), 0..1. */
  jumpRise = new Map<number, number>();
  /** Foot squares of bridges that rose during this turn's reveal (their crossing skips the thud), and thud start times. */
  justRisen = new Set<number>();
  thuds = new Map<number, number>();
  /** Snake beat in progress per head square (rise, hold, strike, swallow, settle); absent: idle. */
  snakeAct = new Map<number, SnakeAct>();
  /** Snakes revealed but not yet risen: bite() plays their rise (first time only). */
  snakePending = new Set<number>();
  /** Head squares whose snake GLB has mounted (Snake.tsx). */
  snakeLoaded = new Set<number>();
  /**
   * Growth of a coil in a close-up bite, per head square (a multiplier on the snake root's base scale; absent: 1).
   * Owner exception to respect rule R9 (2026-11-03): while it bites, a grown head may rise above the hero. Set only
   * between the grow and settle beats of `bite()` and never in Fast or under reduced motion.
   */
  snakeGrow = new Map<number, number>();
  /** The "Bite close-ups" setting (T45.4): the staged bite with the camera. Fast keeps the short bite regardless. */
  biteCloseUps = true;
  /** A close-up bite is on: the board dims round the scene (GameScreen draws the vignette). */
  cinema = false;
  /** The player took the camera during a close-up: the bite finishes in place and does not restore the pose. */
  private cameraCancelled = false;
  current = -1;
  moods: (SeatMood | null)[] = [];
  bubbles: (Bubble | null)[] = [];
  puffs: Puff[] = [];
  ranking: readonly number[] | null = null;
  /** The Win dialog is up: the winner may play its cheer (Win screen only, R4). */
  winShown = false;
  camera: CameraApi | null = null;
  /** Speech-bubble anchors (each token's head in viewport px, null when off screen), refreshed by the canvas. */
  anchors: readonly (ScreenAnchor | null)[] = [];
  private anchorVersion = 0;
  private anchorListeners = new Set<() => void>();
  /** Fog lift duration of the reveal in progress, ms: 420, Fast 60, 0 under reduced motion. */
  revealMs = 420;
  private version = 0;
  private listeners = new Set<() => void>();
  private disposed = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly sound?: StepSound) {}

  // ---- store for React (discrete changes only; transforms are read per frame)

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getVersion = (): number => this.version;

  private changed(): void {
    this.version++;
    this.listeners.forEach((listener) => listener());
  }

  /** Anchors change often (10 Hz while a bubble shows), so only the bubbles subscribe to them. */
  readonly subscribeAnchors = (listener: () => void): (() => void) => {
    this.anchorListeners.add(listener);
    return () => this.anchorListeners.delete(listener);
  };

  readonly getAnchorVersion = (): number => this.anchorVersion;

  setAnchors(anchors: readonly (ScreenAnchor | null)[]): void {
    this.anchors = anchors;
    this.anchorVersion++;
    this.anchorListeners.forEach((listener) => listener());
  }

  /** Review and test hook: lifts the fog from every block on screen, and with `jumps` stands every snake and bridge (the engine's reveal state is untouched). */
  revealAll(jumps = false): void {
    for (let square = 1; square <= 144; square++) this.revealedTerrain.add(square);
    if (jumps && this.setup) {
      // the worst case for the budgets (spec 10): every snake coiled and every bridge standing
      for (const jump of [...this.setup.board.snakes, ...this.setup.board.ladders]) this.jumpRise.set(jump.from, 1);
    }
    this.changed();
  }

  setWinShown(shown: boolean): void {
    this.winShown = shown;
  }

  setBiteCloseUps(on: boolean): void {
    this.biteCloseUps = on;
  }

  /** The player moved the camera (drag, wheel, keys, Fit, Focus): the bite's camera part stops at once (T45.4). */
  cancelCamera(): void {
    this.cameraCancelled = true;
    if (this.cinema) {
      this.cinema = false;
      this.changed();
    }
  }

  /** The story ladder (id, names) behind an engine jump on the current board. */
  private ladderOf(jump: Jump): StoryJump | undefined {
    return this.setup?.board.ladders.find((ladder) => ladder.from === jump.from);
  }

  dispose(): void {
    this.disposed = true;
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }

  /** Three-space position of a token's feet. */
  tokenPosition(player: number): [number, number, number] | null {
    const token = this.tokens[player];
    if (!token) return null;
    return token.override ?? toThree(token.spot, token.lift);
  }

  // ---- BoardView

  init(setup: BoardSetup): void {
    this.setup = setup;
    this.current = setup.state.current;
    this.ranking = null;
    this.revealedTerrain = new Set(setup.reveal.terrain);
    const jumps = [...setup.board.ladders, ...setup.board.snakes];
    this.jumpRise = new Map(
      setup.reveal.jumps.filter((id) => jumps.some((jump) => jump.from === id)).map((id) => [id, 1]),
    );
    const players = setup.state.players;
    this.tokens = players.map((player) => ({
      square: player.position,
      spot: [0, 0],
      lift: 0,
      scale: 1,
      heading: 0,
      override: null,
      gliding: false,
      leap: null,
      hidden: false,
    }));
    this.tokens.forEach((token, i) => (token.spot = this.spotOf(i)));
    this.moods = players.map(() => null);
    this.bubbles = players.map(() => null);
    this.puffs = [];
    this.changed();
  }

  turnStarted(player: number): void {
    this.current = player;
    this.changed();
  }

  async enter(player: number, square: number, motion: MotionOptions, arrive: Arrive): Promise<void> {
    const token = this.token(player);
    const from = token.spot;
    token.square = square;
    const to = this.spotOf(player);
    this.sound?.step();
    token.gliding = true;
    await this.tween(this.ms(ENTER_MS, motion), (u) => {
      token.spot = lerp2(from, to, u);
      token.lift = ENTER_ARC * 4 * u * (1 - u);
      token.heading = headingOf(from, to, token.heading);
    });
    token.lift = 0;
    token.gliding = false;
    arrive(square);
    await this.refan(player, motion);
  }

  async walk(
    player: number,
    squares: readonly number[],
    gait: Gait,
    motion: MotionOptions,
    arrive: Arrive,
  ): Promise<void> {
    const last = squares[squares.length - 1];
    if (last === undefined) return;
    const token = this.token(player);
    token.square = last;
    const path = pathOf(token.spot, squares, this.spotOf(player));
    const glide = motion.reducedMotion;
    const duration = glide ? (path.length / gait.speed) * 1000 : durationOf(path.length, gait, motion.fast);
    let passed = 0;
    let lastFrame = -1;
    await this.tween(duration, (u) => {
      const walked = glide ? u * path.length : distanceAt(u, path.length, gait, motion.fast);
      const at = sampleAt(path, walked);
      token.spot = at.point;
      if (at.dir[0] !== 0 || at.dir[1] !== 0) token.heading = Math.atan2(at.dir[0], at.dir[1]);
      while (passed < squares.length - 1 && walked >= path.centreAt[passed]!) arrive(squares[passed++]!);
      if (glide) return;
      const phase = phaseAt(walked, gait.cycle);
      token.lift = Math.abs(Math.sin(phase * Math.PI * 2)) * BOB;
      const frame = frameIndexOf(phase, gait.frames);
      if (frame !== lastFrame && frame % (gait.frames / 2) === 0) this.sound?.step();
      lastFrame = frame;
    });
    token.lift = 0;
    arrive(last);
    await this.refan(player, motion);
  }

  async cross(player: number, jump: Jump, motion: MotionOptions, arrive: Arrive): Promise<void> {
    const token = this.token(player);
    const story = this.ladderOf(jump);
    if (!story) throw new Error(`No bridge from square ${jump.from}`);
    const curve = bridgeCurve(story);
    // a bridge that already stood thuds under the lander (T44 6.4); one that just rose has had its show
    if (!this.justRisen.delete(jump.from) && !motion.reducedMotion) this.thuds.set(jump.from, performance.now());
    token.square = jump.to;
    const end = this.spotOf(player);
    // Reduced motion: the token appears at the top (T44 4.6).
    if (!motion.reducedMotion) {
      const foot = curve.getPointAt(0);
      const top = curve.getPointAt(1);
      let apex = -Infinity;
      for (let i = 0; i <= 20; i++) apex = Math.max(apex, curve.getPointAt(i / 20).y);
      const leads = bridgeLeads(curve);
      const plan = crossingPlan({
        id: story.id,
        hero: this.setup?.state.players[player]?.hero ?? 'rama',
        length: leads.deck,
        leadIn: leads.leadIn,
        leadOut: leads.leadOut,
        apexRise: apex - (foot.y + top.y) / 2,
        fast: motion.fast,
      });
      const place = (x: number, y: number, z: number): void => {
        token.override = [x, y, z];
        token.spot = toWorld(x, z); // the spot follows, so the figure's stride counts the deck distance
      };
      for (const segment of plan) {
        if (segment.kind === 'run') {
          await this.tween(segment.ms, (u) => {
            const t = segment.t0 + (segment.t1 - segment.t0) * u;
            const point = curve.getPointAt(t);
            const ahead = curve.getPointAt(Math.min(1, t + 0.01));
            place(point.x, point.y, point.z);
            token.heading = Math.atan2(ahead.x - point.x, ahead.z - point.z) || token.heading;
          });
          continue;
        }
        const from = curve.getPointAt(segment.t0);
        const to = curve.getPointAt(segment.t1);
        token.heading = Math.atan2(to.x - from.x, to.z - from.z) || token.heading;
        await this.tween(segment.ms, (u) => {
          const ms = u * segment.ms;
          const p = leapProgress(ms, segment.beats);
          token.leap = { ms, beats: segment.beats };
          const point = from.clone().lerp(to, p);
          place(point.x, point.y + hopHeight(p, segment.hop), point.z);
        });
        token.leap = null;
      }
    }
    token.override = null;
    token.leap = null;
    token.spot = end;
    arrive(jump.to);
    await this.refan(player, motion);
  }

  /**
   * The bite (T44 5.4), or with "Bite close-ups" on and not Fast the staged scene of T45.4: the camera glides to the
   * head block and the board dims (`cinema`), the coil swells (`snakeGrow`) as the head turns to the hero, a slow
   * strike, the hero into the mouth and a bulge down the body, the coil shrinks back with a sway and a puff, the camera
   * glides to the tail where the hero reappears sad, and eases back to the player's pose. Any player camera input
   * cancels the camera part (`cancelCamera`); the rest of the scene finishes in place.
   */
  async bite(player: number, jump: Jump, motion: MotionOptions, arrive: Arrive, cue: Cue): Promise<void> {
    const token = this.token(player);
    const head = jump.from;
    const id = this.setup?.board.snakes.find((snake) => snake.from === head)?.id ?? '';
    const meta = SNAKE_META[id];
    const loaded = meta !== undefined && (await this.snakeReady(head));
    const firstTime = this.snakePending.has(head);
    const cinema = this.biteCloseUps && !motion.fast;
    const steps = biteTimeline({ fast: motion.fast, reducedMotion: motion.reducedMotion, firstTime, closeUps: cinema });
    const ms = (name: string): number => steps.find((step) => step.name === name)?.ms ?? 0;
    const play = async (clip: SnakeClip, beat: number, each?: (u: number) => void): Promise<void> => {
      if (loaded) this.snakeAct.set(head, { clip, start: performance.now(), ms: beat });
      await this.tween(beat, each ?? (() => undefined));
    };
    const still = (): void => undefined;
    // focus: the camera glides to the head block and the board dims (no camera under reduced motion: the dim fades)
    this.cameraCancelled = false;
    const home = cinema && !motion.reducedMotion ? (this.camera?.get() ?? null) : null;
    if (cinema) this.setCinema(true);
    if (home) this.glide(bitePose(blockPoint(head), home.azimuth), ms('focus') + ms('rise'));
    if (ms('focus') > 0) await this.tween(ms('focus'), still);
    // rise (the first reveal only): the snake appears from the ground
    if (firstTime) {
      this.snakePending.delete(head);
      cue('hiss');
      if (loaded) await play('rise', ms('rise'));
    }
    // hold: the head turns to the token; in a close-up the coil swells meanwhile (grow) and the hero is scared
    const spot = token.spot;
    const idleMouth = mouthPoint(head, id, 'idle');
    const snakeAt = toWorld(idleMouth[0], idleMouth[2]);
    token.heading = headingOf(spot, snakeAt, token.heading);
    if (ms('grow') > 0) {
      this.mood(player, 'scared', ms('grow') + ms('strike') + ms('swallow'));
      await play('hold', ms('grow'), (u) => this.snakeGrow.set(head, growAt(u, 'grow')));
    } else if (ms('hold') > 0) await play('hold', ms('hold'));
    cue('strike');
    await play('strike', ms('strike'));
    // swallow: the token flies to the mouth, shrinking, and is hidden there (the close-up's jaw closes over the rest)
    const feet = this.tokenPosition(player) ?? toThree(spot, 0);
    const mouth = grownMouthPoint(head, id, 'strike', this.snakeGrow.get(head) ?? 1);
    const into = cinema ? SWALLOW_IN : 1;
    token.gliding = true;
    cue('gulp');
    await play('swallow', ms('swallow'), (u) => {
      const v = Math.min(1, u / into);
      const e = v * v;
      const x = feet[0] + (mouth[0] - feet[0]) * e;
      const z = feet[2] + (mouth[2] - feet[2]) * e;
      token.spot = toWorld(x, z);
      token.lift = feet[1] + (mouth[1] - feet[1]) * e - groundHeightAt(x, z);
      token.scale = 1 - 0.9 * e;
      if (v >= 1) token.hidden = true;
    });
    token.hidden = true;
    token.gliding = false;
    token.lift = 0;
    // settle: the head goes back to idle (Fast: at once); a close-up shrinks the coil back with a sway and a soft puff
    if (ms('settle') > 0) {
      if (cinema) this.coilPuff(head, id, ms('settle'));
      await play('settle', ms('settle'), (u) => {
        if (cinema) this.snakeGrow.set(head, growAt(u, 'shrink'));
      });
    }
    this.snakeGrow.delete(head);
    this.snakeAct.delete(head);
    // to the tail: the camera glides to the tail square ahead of the hero
    token.square = jump.to;
    if (home) this.glide(bitePose(blockPoint(jump.to), home.azimuth), ms('toTail'));
    if (ms('toTail') > 0) await this.tween(ms('toTail'), still);
    // reappear at the tail square
    token.spot = this.spotOf(player);
    token.scale = 0.1;
    token.hidden = false;
    arrive(jump.to);
    this.puff(jump.to, motion);
    cue('pop');
    if (cinema) this.mood(player, 'sad', TIMING.faceHoldMs);
    await this.tween(ms('reappear'), (u) => (token.scale = 0.1 + 0.9 * backOut(u)));
    token.scale = 1;
    // restore: the camera eases back to the pose the player had while the board brightens again
    if (home) this.glide(home, ms('restore'));
    if (cinema) this.setCinema(false);
    if (ms('restore') > 0) await this.tween(ms('restore'), still);
    await this.refan(player, motion);
  }

  /** A bite's camera move, unless the player has taken the camera during this bite. */
  private glide(pose: CameraPose, ms: number): void {
    if (!this.cameraCancelled) this.camera?.glide(pose, ms);
  }

  private setCinema(on: boolean): void {
    if (this.cinema === on) return;
    this.cinema = on;
    this.changed();
  }

  /** A mood the view sets itself (the bitten hero: scared as the coil swells, sad as it reappears). */
  private mood(seat: number, emotion: 'scared' | 'sad', ms: number): void {
    // the tween only picks the clip (heroClips.clipForTween): shake -> scared, sigh -> sad
    const tween = emotion === 'scared' ? 'shake' : 'sigh';
    void this.react(seat, { emotion, intensity: 0.6, tween, durationMs: ms });
  }

  /** The soft puff of dust round a coil shrinking back to its size. */
  private coilPuff(head: number, id: string, ms: number): void {
    const [x, , z] = snakeAnchor(head, id);
    this.puffs.push({ at: toWorld(x, z), start: performance.now(), ms, size: 0.75 });
    this.changed();
  }

  /** Resolves true once the snake's GLB has mounted for this head square; false after 1.5 s (the bite then plays without it). */
  private async snakeReady(from: number): Promise<boolean> {
    for (let waited = 0; waited < 1500 && !this.disposed; waited += 30) {
      if (this.snakeLoaded.has(from)) return true;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return this.snakeLoaded.has(from);
  }

  bounce(_player: number, motion: MotionOptions): void {
    this.puff(144, motion);
  }

  async voidTriple(player: number, restoredTo: number, motion: MotionOptions): Promise<void> {
    const token = this.token(player);
    const from = token.spot;
    token.square = restoredTo;
    const to = this.spotOf(player);
    token.gliding = true;
    await this.tween(this.ms(SLIDE_MS, motion), (u) => (token.spot = lerp2(from, to, easeInOut(u))));
    token.gliding = false;
    await this.refan(player, motion);
  }

  async reveal(changes: readonly RevealChange[], motion: MotionOptions, cue: Cue): Promise<void> {
    this.revealMs = motion.reducedMotion ? 0 : motion.fast ? 60 : 420;
    const rising: number[] = [];
    for (const change of changes) {
      if (change.kind === 'terrain') this.revealedTerrain.add(change.square);
      else if (!this.jumpRise.has(change.jumpId)) {
        this.jumpRise.set(change.jumpId, 0);
        if (change.jumpType === 'snake') this.snakePending.add(change.jumpId); // bite() plays the rise
        else rising.push(change.jumpId);
      }
    }
    this.changed();
    if (rising.length === 0) return;
    cue('stone');
    await this.tween(this.ms(RISE_MS, motion), (u) =>
      rising.forEach((id) => this.jumpRise.set(id, easeInOut(u))),
    );
    rising.forEach((id) => {
      this.justRisen.add(id);
      this.pierDust(id, motion);
    });
    this.changed();
  }

  react(seat: number, reaction: Reaction): Promise<void> {
    this.moods[seat] = {
      emotion: reaction.emotion,
      until: performance.now() + reaction.durationMs,
      reaction,
    };
    this.changed();
    return this.after(reaction.durationMs, () => {
      const mood = this.moods[seat];
      if (mood && mood.until <= performance.now()) this.moods[seat] = null;
    });
  }

  speak(seat: number, line: string, intensity: number, fast: boolean): void {
    const ms = fast ? TIMING.bubbleMs / 2 : TIMING.bubbleMs;
    const bubble: Bubble = { line, intensity, until: performance.now() + ms };
    this.bubbles[seat] = bubble;
    this.changed();
    void this.after(ms, () => {
      if (this.bubbles[seat] === bubble) this.bubbles[seat] = null;
    });
  }

  win(ranking: readonly number[]): void {
    this.ranking = ranking;
    this.changed();
  }

  // ---- helpers

  private token(player: number): TokenState {
    const token = this.tokens[player];
    if (!token) throw new Error(`No token for player ${player}`);
    return token;
  }

  /** Resting spot of a token: its fan slot among the tokens on its square, or its waiting spot off the board. */
  private spotOf(player: number): Vec2 {
    const square = this.tokens[player]?.square ?? 0;
    if (square === 0) return waitingSpot(player);
    const sharing = this.tokens.flatMap((token, i) => (token.square === square ? [i] : []));
    return restingSpot(square, sharing.indexOf(player), sharing.length);
  }

  /** Re-fans every token sharing the square the given player just reached. */
  private async refan(player: number, motion: MotionOptions): Promise<void> {
    const square = this.tokens[player]?.square ?? 0;
    const sharing = this.tokens.flatMap((token, i) => (token.square === square ? [i] : []));
    if (square === 0 || sharing.length < 2) return;
    const moves = sharing.map((i) => ({
      token: this.token(i),
      from: this.token(i).spot,
      to: this.spotOf(i),
    }));
    moves.forEach(({ token }) => (token.gliding = true));
    await this.tween(this.ms(REFAN_MS, motion), (u) =>
      moves.forEach(({ token, from, to }) => (token.spot = lerp2(from, to, u))),
    );
    moves.forEach(({ token }) => (token.gliding = false));
  }

  private puff(square: number, motion: MotionOptions): void {
    this.puffs.push({ at: fieldCentre(square), start: performance.now(), ms: this.ms(PUFF_MS, motion), size: 1 });
    this.changed();
  }

  /** Dust where a risen bridge comes down on the blocks: its two abutments and every pier (bridges.py: k / openings). */
  private pierDust(jumpId: number, motion: MotionOptions): void {
    const story = this.setup?.board.ladders.find((ladder) => ladder.from === jumpId);
    const bridge = story ? bridgeById(story.id) : undefined;
    if (!bridge) return;
    const start = performance.now();
    const ms = this.ms(PUFF_MS, motion);
    for (let k = 0; k <= bridge.openings; k++) {
      const p = bridge.deck[Math.round((k * DECK_SAMPLES) / bridge.openings)]!;
      this.puffs.push({ at: toWorld(p.x, p.z), start, ms, size: 0.55 });
    }
  }

  /** Fast halves an animation; reduced motion skips it. */
  private ms(base: number, motion: MotionOptions): number {
    if (motion.reducedMotion) return 0;
    return motion.fast ? base / 2 : base;
  }

  private after(ms: number, then: () => void): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        then();
        this.changed();
        resolve();
      }, ms);
      this.timers.add(timer);
    });
  }

  /** Calls `step(u)` for u from 0 to 1 over `ms` on animation frames; 0 ms (reduced motion) steps once to the end. */
  private tween(ms: number, step: (u: number) => void): Promise<void> {
    if (ms <= 0 || this.disposed) {
      step(1);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (): void => {
        const u = this.disposed ? 1 : Math.min(1, (performance.now() - start) / ms);
        step(u);
        if (u < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }
}

/** A square's centre on its block top, three units (the close-up camera looks here). */
function blockPoint(square: number): [number, number, number] {
  const [x, z] = squareCentre(square);
  return [x, blockTopY(square), z];
}

function lerp2(a: Vec2, b: Vec2, u: number): Vec2 {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
}

function easeInOut(u: number): number {
  return 0.5 - Math.cos(u * Math.PI) / 2;
}

function headingOf(from: Vec2, to: Vec2, previous: number): number {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  return dx === 0 && dy === 0 ? previous : Math.atan2(dx, dy);
}
