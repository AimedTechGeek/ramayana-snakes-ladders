// The HudSink the controller writes to, as an external store React reads with useSyncExternalStore.

import type { StageId } from '../../game/stages';
import type { GameResult, HudSink, SeatInfo } from '../turn/ports';

export interface DiceFace {
  value: number;
  rolling: boolean;
  /** Bumped on every roll, so the view can restart the tumble animation. */
  roll: number;
}

export interface HudState {
  seats: readonly SeatInfo[];
  current: number;
  banner: string;
  hint: string;
  diceEnabled: boolean;
  dice: DiceFace;
  fast: boolean;
  muted: boolean;
  /** The chapter card on screen (T46.5), or null. */
  chapter: ChapterNotice | null;
  result: GameResult | null;
}

export interface ChapterNotice {
  stage: StageId;
  /** Bumped per card, so the view restarts its slide-in. */
  seq: number;
}

/** A chapter card stays this long (T46: ~2.5 s; Fast 1 s); queued cards follow after a short breath. */
export const CHAPTER_MS = 2500;
export const CHAPTER_FAST_MS = 1000;
const CHAPTER_GAP_MS = 250;

const ROLL_MS = 600;
/** The die's tumble clips: 1.0 s, Fast 0.14 s (T44 7, Fast since T44.14); a roll not settled by then + slack is let go. */
const DIE_MS = 1000;
const DIE_FAST_MS = 143;
const DIE_SLACK_MS = 600;

export type DieRoller = (value: number, fast: boolean, turn: number) => Promise<void>;

export class HudStore implements HudSink {
  private die: DieRoller | null = null;
  private state: HudState = {
    seats: [],
    current: -1,
    banner: '',
    hint: '',
    diceEnabled: false,
    dice: { value: 1, rolling: false, roll: 0 },
    fast: false,
    muted: false,
    chapter: null,
    result: null,
  };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private chapters: StageId[] = [];
  private chapterTimer: ReturnType<typeof setTimeout> | null = null;
  private chapterSeq = 0;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): HudState => this.state;

  private set(patch: Partial<HudState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.chapterTimer) clearTimeout(this.chapterTimer);
  }

  /** The Win screen was dismissed by Play On. */
  clearResult(): void {
    this.set({ result: null });
  }

  seats(seats: readonly SeatInfo[]): void {
    this.set({ seats });
  }

  turn(player: number, banner: string): void {
    this.set({ current: player, banner });
  }

  hint(text: string): void {
    this.set({ hint: text });
  }

  diceEnabled(enabled: boolean): void {
    this.set({ diceEnabled: enabled });
  }

  /**
   * The 3D die on the tray, once it is in the scene: `roll(value, fast, turn)` resolves when it has settled. Without
   * it (still loading) the pill's own short tumble stands in.
   */
  setDie(roll: DieRoller | null): void {
    this.die = roll;
  }

  rollDice(value: number, fast: boolean): Promise<void> {
    const roll = this.state.dice.roll + 1;
    this.set({ dice: { value, rolling: true, roll } });
    const settled = (): void => this.set({ dice: { value, rolling: false, roll } });
    const die = this.die;
    if (die) {
      // The die settles on animation frames; never let a stalled frame loop hold the game.
      const limit = (fast ? DIE_FAST_MS : DIE_MS) + DIE_SLACK_MS;
      return Promise.race([die(value, fast, roll).catch(() => undefined), this.wait(limit)]).then(settled);
    }
    return this.wait(fast ? ROLL_MS / 2 : ROLL_MS).then(settled);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(() => {
        this.timer = null;
        resolve();
      }, ms);
    });
  }

  settings(settings: { fast: boolean; muted: boolean }): void {
    this.set(settings);
  }

  /** Shows the stage's card for CHAPTER_MS (Fast: CHAPTER_FAST_MS), or queues it behind the card on screen. */
  chapter(stage: StageId): void {
    this.chapters.push(stage);
    if (!this.chapterTimer) this.nextChapter();
  }

  private nextChapter(): void {
    const stage = this.chapters.shift();
    if (stage === undefined) return;
    this.chapterSeq++;
    this.set({ chapter: { stage, seq: this.chapterSeq } });
    this.chapterTimer = setTimeout(
      () => {
        this.set({ chapter: null });
        this.chapterTimer = setTimeout(() => {
          this.chapterTimer = null;
          this.nextChapter();
        }, CHAPTER_GAP_MS);
      },
      this.state.fast ? CHAPTER_FAST_MS : CHAPTER_MS,
    );
  }

  gameOver(result: GameResult): void {
    this.set({ result });
  }
}
