// The HudSink the controller writes to, as an external store React reads with useSyncExternalStore.

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
  result: GameResult | null;
}

const ROLL_MS = 600;

export class HudStore implements HudSink {
  private state: HudState = {
    seats: [],
    current: -1,
    banner: '',
    hint: '',
    diceEnabled: false,
    dice: { value: 1, rolling: false, roll: 0 },
    fast: false,
    muted: false,
    result: null,
  };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

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

  rollDice(value: number, fast: boolean): Promise<void> {
    const roll = this.state.dice.roll + 1;
    this.set({ dice: { value, rolling: true, roll } });
    return new Promise((resolve) => {
      this.timer = setTimeout(
        () => {
          this.timer = null;
          this.set({ dice: { value, rolling: false, roll } });
          resolve();
        },
        fast ? ROLL_MS / 2 : ROLL_MS,
      );
    });
  }

  settings(settings: { fast: boolean; muted: boolean }): void {
    this.set(settings);
  }

  gameOver(result: GameResult): void {
    this.set({ result });
  }
}
