// Turn sequencing, extracted from the Phaser BoardScene: plays engine events in order through a BoardView and a
// HudSink, lifts fog as tokens arrive, starts the heroes' reactions, autosaves, and rolls for bots.
// Renderer-free: no React, three or Phaser imports.

import { orderedDelay, pickSpeakers, reactionsFor, type Cue } from '../../characters/reactionMapper';
import { reactionFor, scaled, TIMING } from '../../characters/reactions';
import { boardFor, type StoryBoard } from '../../core/boards';
import { createRandomDice, type Dice } from '../../core/dice';
import type { GameEvent } from '../../core/events';
import { Game } from '../../core/game';
import type { GameConfig, GameState, Jump } from '../../core/types';
import { gaitFor } from '../../game/iso/locomotion';
import {
  applyEvent,
  newGameReveal,
  seedFromGameState,
  type RevealChange,
  type RevealState,
} from '../../game/reveal';
import { clearSave, saveGame } from '../../game/save';
import { speech, t } from '../../i18n/i18n';
import type { BoardView, Clock, HudSink, MotionOptions, SaveSink, SeatInfo, TurnAudio } from './ports';

export const BOT_DELAY_MS = 1000;
/** Fast is for watching bots: a 4-bot Hard game (about 180 rolls) fits a minute (T44.14; was 400). */
export const FAST_BOT_DELAY_MS = 60;
/** A reaction cut short by a newer one may never resolve; Won and GameOver wait at most this much past the longest. */
const REACTION_SLACK_MS = 100;

export type TurnStart = { config: GameConfig } | { state: GameState; reveal?: RevealState };

export interface TurnDeps {
  view: BoardView;
  hud: HudSink;
  audio: TurnAudio;
  dice?: Dice;
  clock?: Clock;
  save?: SaveSink;
  /** 0..1, for the bystander stagger and the reaction mapper. */
  random?: () => number;
  /** The player asked the system for reduced motion. */
  reducedMotion?: () => boolean;
}

export interface TurnSettings {
  fast: boolean;
  muted: boolean;
}

const realClock: Clock = {
  now: () => performance.now(),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const localSave: SaveSink = {
  save: (state, reveal) => void saveGame(state, reveal),
  clear: () => void clearSave(),
};

function systemReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export class TurnController {
  private readonly engine: Game;
  private readonly board: StoryBoard;
  private readonly reveal: RevealState;
  private readonly view: BoardView;
  private readonly hud: HudSink;
  private readonly audio: TurnAudio;
  private readonly clock: Clock;
  private readonly saver: SaveSink;
  private readonly random: () => number;
  private readonly reducedMotion: () => boolean;
  private settings: TurnSettings;
  /** Squares the current event revealed whose fog waits for a token to arrive. */
  private pendingTerrain = new Set<number>();
  /** True when the last arrival lifted fog (the airy cue plays once per move). */
  private landedOnHidden = false;
  private busy = false;
  private paused = false;
  private disposed = false;
  private resumeWaiters: (() => void)[] = [];
  /** Clock time each seat's latest reaction starts; later events never start before it. */
  private seatStartAt: number[] = [];
  /** Last line shown per speech key, so a bubble does not repeat itself. */
  private lastLines = new Map<string, string>();
  private latest: GameEvent | null = null;
  /** The die of the last Fast roll, which the move does not wait for. */
  private dieSettled: Promise<void> = Promise.resolve();

  constructor(start: TurnStart, deps: TurnDeps, settings: TurnSettings) {
    const dice = deps.dice ?? createRandomDice();
    if ('config' in start) {
      this.board = boardFor(start.config.level);
      this.engine = Game.create(start.config, this.board, dice);
      this.reveal = newGameReveal();
    } else {
      this.board = boardFor(start.state.level);
      this.engine = Game.restore(start.state, this.board, dice);
      this.reveal = start.reveal ? structuredClone(start.reveal) : seedFromGameState(start.state);
    }
    this.view = deps.view;
    this.hud = deps.hud;
    this.audio = deps.audio;
    this.clock = deps.clock ?? realClock;
    this.saver = deps.save ?? localSave;
    this.random = deps.random ?? Math.random;
    this.reducedMotion = deps.reducedMotion ?? systemReducedMotion;
    this.settings = { ...settings };
  }

  /** Draws the board, saves, and plays the opening TurnStarted; a bot's first roll is then scheduled. */
  async start(): Promise<void> {
    const state = this.engine.snapshot();
    this.view.init({ board: this.board, state, reveal: structuredClone(this.reveal) });
    this.audio.setMuted(this.settings.muted);
    this.hud.settings({ ...this.settings });
    this.hud.seats(seatsOf(state));
    this.hud.diceEnabled(false);
    this.hud.hint('');
    this.audio.drone(true);
    this.saver.save(state, this.reveal);
    this.busy = true;
    await this.play(this.engine.begin());
    this.afterEvents();
  }

  get isBusy(): boolean {
    return this.busy;
  }

  get isOver(): boolean {
    return this.engine.isOver;
  }

  get fast(): boolean {
    return this.settings.fast;
  }

  get muted(): boolean {
    return this.settings.muted;
  }

  /** The last engine event played (tests and screenshots wait for a ladder or a snake). */
  get lastEvent(): GameEvent | null {
    return this.latest;
  }

  snapshot(): GameState {
    return this.engine.snapshot();
  }

  revealState(): RevealState {
    return structuredClone(this.reveal);
  }

  setFast(on: boolean): void {
    this.settings.fast = on;
    this.hud.settings({ ...this.settings });
  }

  setMuted(on: boolean): void {
    this.settings.muted = on;
    this.audio.setMuted(on);
    this.hud.settings({ ...this.settings });
  }

  /** While paused (Menu open, portrait prompt) no roll starts; an animation already running finishes. */
  setPaused(on: boolean): void {
    this.paused = on;
    if (on) return;
    const waiters = this.resumeWaiters;
    this.resumeWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  /** Stops for good: no further roll, bot turn or HUD update. Safe to call twice. */
  dispose(): void {
    this.disposed = true;
    this.audio.drone(false);
    this.setPaused(false);
  }

  /** Rolls for the human whose turn it is. A no-op on bot turns, while busy or paused, or after the game ends. */
  async requestRoll(): Promise<void> {
    this.audio.unlock();
    if (this.busy || this.paused || this.disposed || this.engine.isOver || this.isBotTurn()) return;
    await this.takeTurn();
  }

  /** Play On: the remaining players continue after the first winner. */
  async continuePlay(): Promise<void> {
    if (this.busy || this.disposed || !this.engine.canContinue) return;
    this.busy = true;
    this.audio.drone(true);
    this.hud.diceEnabled(false);
    this.hud.hint('');
    await this.play(this.engine.continuePlay());
    this.afterEvents();
  }

  private isBotTurn(): boolean {
    const state = this.engine.snapshot();
    return state.players[state.current]?.controller === 'bot';
  }

  private async takeTurn(): Promise<void> {
    this.busy = true;
    this.hud.diceEnabled(false);
    this.hud.hint('');
    await this.play(this.engine.roll());
    this.afterEvents();
  }

  /** Hands control back: the game ends, a bot schedules its own roll (staying busy), or a human gets the dice. */
  private afterEvents(): void {
    if (this.disposed) return;
    const state = this.engine.snapshot();
    if (this.engine.isOver) {
      this.saver.clear();
      this.busy = false;
      this.hud.diceEnabled(false);
      this.hud.gameOver({ state, ranking: this.engine.ranking(), canContinue: this.engine.canContinue });
      return;
    }
    this.saver.save(state, this.reveal);
    if (this.isBotTurn()) {
      this.hud.diceEnabled(false);
      this.hud.hint('');
      void this.botTurn();
      return;
    }
    this.busy = false;
    this.hud.diceEnabled(true);
    this.hud.hint(t('ui.rollHint'));
  }

  private async botTurn(): Promise<void> {
    await this.clock.wait(this.settings.fast ? FAST_BOT_DELAY_MS : BOT_DELAY_MS);
    await this.untilResumed();
    if (this.disposed) return;
    await this.takeTurn();
  }

  private async untilResumed(): Promise<void> {
    while (this.paused && !this.disposed)
      await new Promise<void>((resolve) => this.resumeWaiters.push(resolve));
  }

  private get motion(): MotionOptions {
    return { fast: this.settings.fast, reducedMotion: this.reducedMotion() };
  }

  private async play(events: readonly GameEvent[]): Promise<void> {
    for (const event of events) {
      if (this.disposed) return;
      this.latest = event;
      const changes = applyEvent(this.reveal, event);
      this.pendingTerrain = new Set(changes.flatMap((c) => (c.kind === 'terrain' ? [c.square] : [])));
      this.hud.seats(seatsOf(this.engine.snapshot()));
      const reactions = this.react(event);
      await this.animate(
        event,
        changes.filter((c) => c.kind === 'jump'),
      );
      if (this.disposed) return;
      this.flushReveals();
      if (event.type === 'Won' || event.type === 'GameOver') await reactions;
    }
  }

  private async animate(event: GameEvent, jumpChanges: readonly RevealChange[]): Promise<void> {
    switch (event.type) {
      case 'TurnStarted':
        this.hud.turn(event.player, t('ui.yourTurn', { name: this.playerName(event.player) }));
        this.view.turnStarted(event.player);
        return;
      case 'Rolled': {
        await this.dieSettled; // the previous Fast roll's die is down before this one tumbles
        this.audio.dice();
        const rolling = this.hud.rollDice(event.value, this.settings.fast);
        // Fast: the token sets off while the die is still landing (T44.14: a 4-bot Hard game in about a minute)
        if (this.settings.fast) this.dieSettled = rolling;
        else await rolling;
        return;
      }
      case 'Moved':
        await this.advance(event.player, event.from, event.path);
        return;
      case 'Laddered':
        await this.view.reveal(jumpChanges, this.motion);
        await this.view.cross(event.player, event.jump, this.motion, this.arrive);
        this.ensureArrived(event.jump.to);
        this.audio.ladder(true);
        return;
      case 'Bitten':
        await this.view.reveal(jumpChanges, this.motion);
        await this.biteAt(event.player, event.jump);
        return;
      case 'TripleSixVoid':
        this.audio.tripleSix();
        this.hud.hint(t('ui.tripleSix'));
        await this.view.voidTriple(event.player, event.restoredTo, this.motion);
        return;
      case 'Won':
        this.audio.win();
        this.hud.hint(t('ui.winner', { name: this.playerName(event.player) }));
        return;
      case 'Bounced':
        this.audio.bounce();
        this.view.bounce(event.player, this.motion);
        return;
      case 'GameOver':
        this.audio.drone(false);
        this.view.win(event.ranking);
        return;
      default:
        return;
    }
  }

  private async biteAt(player: number, jump: Jump): Promise<void> {
    await this.view.bite(player, jump, this.motion, this.arrive);
    this.ensureArrived(jump.to);
  }

  /** A move: a token on its seat enters onto the first square, then walks (2 squares or fewer) or runs the rest. */
  private async advance(player: number, from: number, path: readonly number[]): Promise<void> {
    const first = path[0];
    if (first === undefined) return;
    this.landedOnHidden = false;
    let rest = path;
    if (from === 0) {
      await this.view.enter(player, first, this.motion, this.arrive);
      this.ensureArrived(first);
      rest = path.slice(1);
    }
    const motion = this.motion;
    // Reduced motion glides at the run speed with no ramps (BoardScene: gaitFor(3, false)).
    const gait = motion.reducedMotion ? gaitFor(3, false) : gaitFor(path.length, motion.fast);
    if (rest.length > 0) {
      await this.view.walk(player, rest, gait, motion, this.arrive);
      this.ensureArrived(rest[rest.length - 1]!);
    }
    if (this.landedOnHidden) this.audio.reveal(motion.fast);
  }

  /** Lifts the fog of a square this event revealed, as the token arrives on it (once per square). */
  private readonly arrive = (square: number): void => {
    this.landedOnHidden = this.pendingTerrain.delete(square);
    if (this.landedOnHidden) void this.view.reveal([{ kind: 'terrain', square }], this.motion);
  };

  /** The square is reached for sure (a view that skipped calling `arrive`); does not reset the airy-cue flag. */
  private ensureArrived(square: number): void {
    if (this.pendingTerrain.has(square)) this.arrive(square);
  }

  /** Anything the event revealed that no token reached shows by the end of the event. */
  private flushReveals(): void {
    if (this.pendingTerrain.size === 0) return;
    const changes: RevealChange[] = [...this.pendingTerrain].map((square) => ({ kind: 'terrain', square }));
    this.pendingTerrain.clear();
    void this.view.reveal(changes, this.motion);
  }

  /**
   * Starts every seated hero's reaction to an event without blocking movement (T05 section 1). Resolves when the
   * last reaction has finished, or after the longest one plus its delay, whichever is first.
   */
  private react(event: GameEvent): Promise<void> {
    const players = this.engine.snapshot().players;
    const cues = reactionsFor(event, players, this.random);
    if (cues.length === 0) return Promise.resolve();
    const speakers = pickSpeakers(cues, this.random);
    const fast = this.settings.fast;
    const [minStagger, maxStagger] = TIMING.bystanderStaggerMs;
    const now = this.clock.now();
    let latestDelay = 0;
    const runs = cues.map((cue) => {
      const stagger =
        cue.role === 'self' ? 0 : Math.floor(minStagger + this.random() * (maxStagger - minStagger + 1));
      // Back-to-back events draw fresh staggers; keep each seat's reactions (and bubbles) in event order.
      const delay = orderedDelay(this.seatStartAt, cue.seat, stagger, now);
      latestDelay = Math.max(latestDelay, delay);
      const hero = players[cue.seat]?.hero;
      if (!hero) return Promise.resolve();
      const reaction = scaled(reactionFor(hero, cue.role, cue.event), fast);
      const speaks = speakers.includes(cue);
      const begin = (): Promise<void> => {
        if (this.disposed) return Promise.resolve();
        if (speaks) this.showLine(cue, hero, reaction.intensity, fast);
        return this.view.react(cue.seat, reaction, fast);
      };
      return delay === 0 ? begin() : this.clock.wait(delay).then(begin);
    });
    const longest = Math.max(
      0,
      ...cues.map((cue) => {
        const hero = players[cue.seat]?.hero;
        return hero ? scaled(reactionFor(hero, cue.role, cue.event), fast).durationMs : 0;
      }),
    );
    const timeout = this.clock.wait(longest + latestDelay + REACTION_SLACK_MS);
    return Promise.race([Promise.all(runs).then(() => undefined), timeout]);
  }

  private showLine(cue: Cue, hero: string, intensity: number, fast: boolean): void {
    const key = `${hero}.${cue.role}.${cue.event}`;
    let line = speech(hero, cue.role, cue.event, this.random);
    if (line !== null && line === this.lastLines.get(key))
      line = speech(hero, cue.role, cue.event, this.random);
    if (line === null) return;
    this.lastLines.set(key, line);
    this.view.speak(cue.seat, line, intensity, fast);
  }

  private playerName(player: number): string {
    return this.engine.snapshot().players[player]?.name ?? '';
  }
}

function seatsOf(state: GameState): SeatInfo[] {
  return state.players.map(({ name, hero, controller, position, rank }) => ({
    name,
    hero,
    controller,
    position,
    rank,
  }));
}
