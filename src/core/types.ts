export type Level = 'easy' | 'medium' | 'hard';
export type Hero = 'rama' | 'sita' | 'lakshmana' | 'hanuman';
export type Controller = 'human' | 'bot';

export const FINAL_SQUARE = 144;
/** Jumps this long play the big reactions; 25 makes the long ladders (incl. Hanuman's leap) and Ravana's snake big. */
export const BIG_JUMP = 25;
/** A player starting a turn on or beyond this square triggers NearEnd. */
export const NEAR_END_SQUARE = 132;

export interface Jump {
  from: number;
  to: number;
  name: string;
}

export interface Board {
  level: Level;
  ladders: readonly Jump[];
  snakes: readonly Jump[];
}

export interface PlayerConfig {
  hero: Hero;
  controller: Controller;
  name: string;
}

export interface PlayerState extends PlayerConfig {
  position: number;
  /** 1-based finishing place, set when the player reaches 144. */
  rank: number | null;
}

export interface GameConfig {
  level: Level;
  players: readonly PlayerConfig[];
  /** Keep playing for 2nd/3rd/4th place after the first winner. */
  playOn: boolean;
}

/** Plain JSON so it can be saved to localStorage and restored. */
export interface GameState {
  level: Level;
  playOn: boolean;
  players: PlayerState[];
  current: number;
  sixesThisTurn: number;
  turnStartPosition: number;
  over: boolean;
}
