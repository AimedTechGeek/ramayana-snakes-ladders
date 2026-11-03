// The ports the TurnController drives: a board view (the 3D diorama, or a fake in tests), a HUD sink (DOM) and the
// side effects it needs (audio, clock, save). Renderer-free: no React, three or Phaser types appear here.

import type { Reaction } from '../../characters/reactions';
import type { StoryBoard } from '../../core/boards';
import type { Controller, GameState, Hero, Jump } from '../../core/types';
import type { Gait } from '../../game/iso/locomotion';
import type { RevealChange, RevealState } from '../../game/reveal';
import type { StageId } from '../../game/stages';

/** How an animation should play: Fast halves or shortens it; reduced motion glides or places without flourish. */
export interface MotionOptions {
  fast: boolean;
  reducedMotion: boolean;
}

/**
 * Called by the view each time a moving token reaches a square's centre (and once on arrival at the last one).
 * The controller lifts that square's fog through `BoardView.reveal` if this event revealed it: reveal on arrival.
 */
export type Arrive = (square: number) => void;

/** A sound inside a view animation: a bridge's stones rising, a snake's hiss, strike, gulp and the token's pop. */
export type SoundCue = 'stone' | 'hiss' | 'strike' | 'gulp' | 'pop';
/** Called by the view on the beat a sound belongs to; the controller plays it (Fast and Mute applied there). */
export type Cue = (sound: SoundCue) => void;

/** Everything the view needs to draw the board as it is now: a new game, or a resumed one with its fog. */
export interface BoardSetup {
  board: StoryBoard;
  state: GameState;
  reveal: RevealState;
}

/**
 * The board presentation. Async methods resolve when their animation has finished; the controller awaits them in
 * engine event order. A view owns token placement (fan slots, waiting spots); the controller only speaks squares.
 * Square 0 means the token waits off the board (on its seat).
 */
export interface BoardView {
  /** Draws the board, the revealed squares and jumps, and every token at its square. Called once, first. */
  init(setup: BoardSetup): void;
  /** A new turn begins for `player` (highlight its token). The camera must not move by itself. */
  turnStarted(player: number): void;
  /** The token leaves its seat and lands on `square` (the first square of its first move). */
  enter(player: number, square: number, motion: MotionOptions, arrive: Arrive): Promise<void>;
  /** The token walks or runs through `squares` (locomotion `pathOf` / `sampleAt` timing with `gait`). */
  walk(
    player: number,
    squares: readonly number[],
    gait: Gait,
    motion: MotionOptions,
    arrive: Arrive,
  ): Promise<void>;
  /** The token crosses the bridge (ladder) `jump` from its foot to its top square. */
  cross(player: number, jump: Jump, motion: MotionOptions, arrive: Arrive): Promise<void>;
  /** The snake `jump` bites the token at its head and it reappears at the tail square (cues: hiss on the first rise, strike, gulp, pop). */
  bite(player: number, jump: Jump, motion: MotionOptions, arrive: Arrive, cue: Cue): Promise<void>;
  /** The token turned round at 144 (a puff at the last square). */
  bounce(player: number, motion: MotionOptions): void;
  /** Three sixes: the token slides back to `restoredTo` (0: back to its seat), a penalty with no celebration. */
  voidTriple(player: number, restoredTo: number, motion: MotionOptions): Promise<void>;
  /** Lifts fog from squares or raises jumps. A raised jump resolves when it stands; terrain may resolve at once. A bridge cues `stone` as it rises. */
  reveal(changes: readonly RevealChange[], motion: MotionOptions, cue: Cue): Promise<void>;
  /** A seat's hero reacts (emotion and gesture, already scaled for Fast). Resolves when the gesture ends. */
  react(seat: number, reaction: Reaction, fast: boolean): Promise<void>;
  /** A speech bubble for a seat. */
  speak(seat: number, line: string, intensity: number, fast: boolean): void;
  /** The game is over; `ranking` is player indexes in finishing order. */
  win(ranking: readonly number[]): void;
}

export interface SeatInfo {
  name: string;
  hero: Hero;
  controller: Controller;
  /** 0 = waiting at the start. */
  position: number;
  rank: number | null;
}

export interface GameResult {
  state: GameState;
  ranking: number[];
  /** Two or more players are still unranked, so Play On is offered. */
  canContinue: boolean;
}

/** The HUD overlay: seats, turn banner, hint line, the dice and the settings chips. */
export interface HudSink {
  /** Every seat's name, hero, controller, square and rank; sent at start and after every engine event. */
  seats(seats: readonly SeatInfo[]): void;
  /** Whose turn it is, with the banner text already translated. */
  turn(player: number, banner: string): void;
  /** The hint line under the banner; '' hides it. */
  hint(text: string): void;
  /** Whether the dice button accepts a roll. */
  diceEnabled(enabled: boolean): void;
  /** The die tumbles and shows `value`; resolves when it has settled. */
  rollDice(value: number, fast: boolean): Promise<void>;
  /** Fast and Mute chip state. */
  settings(settings: { fast: boolean; muted: boolean }): void;
  /** A hero entered `stage` for the first time this game: show its chapter card (T46.5; queued behind one showing). */
  chapter(stage: StageId): void;
  /** The game is over: show the Win screen. */
  gameOver(result: GameResult): void;
}

/** The sounds the controller plays; `src/game/audio.ts` `Audio` satisfies it. */
export interface TurnAudio {
  unlock(): void;
  setMuted(muted: boolean): void;
  dice(): void;
  reveal(fast?: boolean): void;
  ladder(short?: boolean): void;
  stone(fast?: boolean): void;
  hiss(fast?: boolean): void;
  snake(fast?: boolean): void;
  gulp(fast?: boolean): void;
  pop(fast?: boolean): void;
  bounce(): void;
  tripleSix(): void;
  win(): void;
  drone(on: boolean): void;
}

export interface Clock {
  now(): number;
  wait(ms: number): Promise<void>;
}

export interface SaveSink {
  /** `stages`: the stages whose chapter card has shown this game, so a resumed game does not repeat them. */
  save(state: GameState, reveal: RevealState, stages: readonly StageId[]): void;
  clear(): void;
}
