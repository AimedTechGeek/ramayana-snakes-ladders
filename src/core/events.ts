import type { Jump } from './types';

/** Everything the presentation layer needs to animate, in the order it happened. */
export type GameEvent =
  | { type: 'TurnStarted'; player: number; position: number }
  | { type: 'Rolled'; player: number; value: number }
  | { type: 'TripleSixVoid'; player: number; from: number; restoredTo: number }
  | { type: 'Moved'; player: number; from: number; to: number; path: number[] }
  | { type: 'Bounced'; player: number; overshoot: number }
  | { type: 'Laddered'; player: number; jump: Jump; big: boolean }
  | { type: 'Bitten'; player: number; jump: Jump; big: boolean }
  | { type: 'ExtraRoll'; player: number }
  | { type: 'Won'; player: number; rank: number }
  | { type: 'GameOver'; ranking: number[] };

export type GameEventType = GameEvent['type'];
