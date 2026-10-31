// The BoardView of the 3D diorama: a plain model the R3F components read every frame (token spots, fog, raised
// jumps, puffs) plus a small requestAnimationFrame tween runner that plays each animation and resolves when done.
// No React here; components subscribe for discrete changes and read token transforms in useFrame.

import type { Arrive, BoardSetup, BoardView, MotionOptions } from '../turn/ports';
import type { Emotion, Reaction } from '../../characters/reactions';
import { TIMING } from '../../characters/reactions';
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
import { CELL } from '../../game/iso/world';
import { bridgeCurve } from './jumpCurves';
import { toThree, waitingSpot } from './coords';

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
}

export interface Puff {
  at: Vec2;
  start: number;
  ms: number;
}

export interface SeatMood {
  emotion: Emotion;
  until: number;
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
}

interface StepSound {
  step(): void;
}

const ENTER_MS = 360;
const SLIDE_MS = 500;
const RISE_MS = 450;
const BITE_MS = 400;
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
  current = -1;
  moods: (SeatMood | null)[] = [];
  bubbles: (Bubble | null)[] = [];
  puffs: Puff[] = [];
  ranking: readonly number[] | null = null;
  camera: CameraApi | null = null;
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
    await this.tween(this.ms(ENTER_MS, motion), (u) => {
      token.spot = lerp2(from, to, u);
      token.lift = ENTER_ARC * 4 * u * (1 - u);
      token.heading = headingOf(from, to, token.heading);
    });
    token.lift = 0;
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
    const curve = bridgeCurve(jump);
    token.square = jump.to;
    const end = this.spotOf(player);
    const speed = motion.fast ? TIMING.fastRunUnitsPerS : TIMING.runUnitsPerS;
    const duration = motion.reducedMotion ? 0 : ((curve.getLength() * CELL) / speed) * 1000;
    await this.tween(duration, (u) => {
      const point = curve.getPoint(u);
      const ahead = curve.getPoint(Math.min(1, u + 0.01));
      token.override = [point.x, point.y, point.z];
      token.heading = Math.atan2(ahead.x - point.x, ahead.z - point.z) || token.heading;
    });
    token.override = null;
    token.spot = end;
    arrive(jump.to);
    await this.refan(player, motion);
  }

  async bite(player: number, jump: Jump, motion: MotionOptions, arrive: Arrive): Promise<void> {
    const token = this.token(player);
    const half = this.ms(BITE_MS, motion) / 2;
    await this.tween(half, (u) => (token.scale = 1 - u));
    arrive(jump.to);
    token.square = jump.to;
    token.spot = this.spotOf(player);
    await this.tween(half, (u) => (token.scale = u));
    token.scale = 1;
    await this.refan(player, motion);
  }

  bounce(_player: number, motion: MotionOptions): void {
    this.puff(144, motion);
  }

  async voidTriple(player: number, restoredTo: number, motion: MotionOptions): Promise<void> {
    const token = this.token(player);
    const from = token.spot;
    token.square = restoredTo;
    const to = this.spotOf(player);
    await this.tween(this.ms(SLIDE_MS, motion), (u) => (token.spot = lerp2(from, to, easeInOut(u))));
    await this.refan(player, motion);
  }

  async reveal(changes: readonly RevealChange[], motion: MotionOptions): Promise<void> {
    const rising: number[] = [];
    for (const change of changes) {
      if (change.kind === 'terrain') this.revealedTerrain.add(change.square);
      else if (!this.jumpRise.has(change.jumpId)) {
        this.jumpRise.set(change.jumpId, 0);
        rising.push(change.jumpId);
      }
    }
    this.changed();
    if (rising.length === 0) return;
    await this.tween(this.ms(RISE_MS, motion), (u) =>
      rising.forEach((id) => this.jumpRise.set(id, easeInOut(u))),
    );
  }

  react(seat: number, reaction: Reaction): Promise<void> {
    this.moods[seat] = { emotion: reaction.emotion, until: performance.now() + reaction.durationMs };
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
    await this.tween(this.ms(REFAN_MS, motion), (u) =>
      moves.forEach(({ token, from, to }) => (token.spot = lerp2(from, to, u))),
    );
  }

  private puff(square: number, motion: MotionOptions): void {
    this.puffs.push({ at: fieldCentre(square), start: performance.now(), ms: this.ms(PUFF_MS, motion) });
    this.changed();
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
