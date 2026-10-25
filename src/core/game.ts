import type { Dice } from './dice';
import type { GameEvent } from './events';
import {
  BIG_JUMP,
  FINAL_SQUARE,
  NEAR_END_SQUARE,
  type Board,
  type GameConfig,
  type GameState,
  type Jump,
} from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export interface MoveResult {
  path: number[];
  landing: number;
  overshoot: number;
  jump: Jump | null;
  final: number;
}

/** Pure move rule: step, bounce back past 144, then at most one ladder or snake. */
export function resolveMove(board: Board, from: number, roll: number): MoveResult {
  const path: number[] = [];
  let square = from;
  let direction = 1;
  for (let step = 0; step < roll; step++) {
    if (square === FINAL_SQUARE) direction = -1;
    square += direction;
    path.push(square);
  }
  const overshoot = Math.max(0, from + roll - FINAL_SQUARE);
  const jump = findJump(board, square);
  return { path, landing: square, overshoot, jump, final: jump ? jump.to : square };
}

export function findJump(board: Board, square: number): Jump | null {
  return board.ladders.find((j) => j.from === square) ?? board.snakes.find((j) => j.from === square) ?? null;
}

export class Game {
  private constructor(
    private readonly board: Board,
    private readonly dice: Dice,
    private readonly state: GameState,
  ) {}

  static create(config: GameConfig, board: Board, dice: Dice): Game {
    if (config.players.length < MIN_PLAYERS || config.players.length > MAX_PLAYERS) {
      throw new Error(`A game needs ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${config.players.length}`);
    }
    if (board.level !== config.level) throw new Error(`Board is ${board.level}, config is ${config.level}`);
    return new Game(board, dice, {
      level: config.level,
      playOn: config.playOn,
      players: config.players.map((p) => ({ ...p, position: 0, rank: null })),
      current: 0,
      sixesThisTurn: 0,
      turnStartPosition: 0,
      over: false,
    });
  }

  /** Restore a saved game; the board must match the saved level. */
  static restore(state: GameState, board: Board, dice: Dice): Game {
    if (board.level !== state.level) throw new Error(`Board is ${board.level}, save is ${state.level}`);
    return new Game(board, dice, structuredClone(state));
  }

  /** A deep copy, safe to serialise. */
  snapshot(): GameState {
    return structuredClone(this.state);
  }

  get currentPlayer(): number {
    return this.state.current;
  }

  get isOver(): boolean {
    return this.state.over;
  }

  /** True when the game is over but at least two players are still unranked, so play can go on. */
  get canContinue(): boolean {
    return this.state.over && this.unrankedCount() >= 2;
  }

  /** Event that opens the first turn (or the resumed turn). */
  begin(): GameEvent[] {
    const player = this.state.current;
    return this.turnStarted(player);
  }

  /** Roll for the current player and apply every consequence of that roll. */
  roll(): GameEvent[] {
    if (this.state.over) throw new Error('The game is over');
    const player = this.state.current;
    const value = this.dice.roll();
    const events: GameEvent[] = [{ type: 'Rolled', player, value }];

    if (value === 6) this.state.sixesThisTurn++;
    if (this.state.sixesThisTurn === 3) {
      const from = this.positionOf(player);
      this.setPosition(player, this.state.turnStartPosition);
      events.push({ type: 'TripleSixVoid', player, from, restoredTo: this.state.turnStartPosition });
      events.push(...this.endTurn());
      return events;
    }

    const from = this.positionOf(player);
    const move = resolveMove(this.board, from, value);
    events.push({ type: 'Moved', player, from, to: move.landing, path: move.path });
    if (move.overshoot > 0) events.push({ type: 'Bounced', player, overshoot: move.overshoot });
    if (move.jump) {
      const big = Math.abs(move.jump.to - move.jump.from) >= BIG_JUMP;
      const type = move.jump.to > move.jump.from ? 'Laddered' : 'Bitten';
      events.push({ type, player, jump: move.jump, big });
    }
    this.setPosition(player, move.final);

    const overtaken = this.overtakenBy(player, from, move.final);
    if (overtaken.length > 0) events.push({ type: 'Overtook', player, overtaken });
    const bitten = move.jump !== null && move.jump.to < move.jump.from;
    const snakeHead = this.board.snakes.find((j) => j.from === move.final + 1);
    if (!bitten && snakeHead) events.push({ type: 'NearMiss', player, snakeHead: snakeHead.from });

    if (move.final === FINAL_SQUARE) {
      events.push(...this.finish(player));
      return events;
    }
    if (value === 6) {
      events.push({ type: 'ExtraRoll', player });
      return events;
    }
    events.push(...this.endTurn());
    return events;
  }

  /** After a game ends with places still open ("Play On"), play the remaining players for the next ranks. */
  continuePlay(): GameEvent[] {
    if (!this.canContinue) {
      throw new Error('Cannot continue: the game is not over or fewer than 2 players are unranked');
    }
    this.state.playOn = true;
    this.state.over = false;
    return this.endTurn();
  }

  private unrankedCount(): number {
    return this.state.players.filter((p) => p.rank === null).length;
  }

  private finish(player: number): GameEvent[] {
    const rank = this.state.players.filter((p) => p.rank !== null).length + 1;
    this.playerAt(player).rank = rank;
    const events: GameEvent[] = [{ type: 'Won', player, rank }];
    const remaining = this.state.players.filter((p) => p.rank === null);
    if (!this.state.playOn || remaining.length <= 1) {
      this.state.over = true;
      events.push({ type: 'GameOver', ranking: this.ranking() });
      return events;
    }
    events.push(...this.endTurn());
    return events;
  }

  /** Finished players by rank, then the rest by board position (furthest first). */
  ranking(): number[] {
    const indexed = this.state.players.map((p, i) => ({ p, i }));
    const finished = indexed.filter((x) => x.p.rank !== null).sort((a, b) => a.p.rank! - b.p.rank!);
    const rest = indexed.filter((x) => x.p.rank === null).sort((a, b) => b.p.position - a.p.position);
    return [...finished, ...rest].map((x) => x.i);
  }

  private endTurn(): GameEvent[] {
    const count = this.state.players.length;
    let next = this.state.current;
    do {
      next = (next + 1) % count;
    } while (this.playerAt(next).rank !== null);
    this.state.current = next;
    this.state.sixesThisTurn = 0;
    this.state.turnStartPosition = this.positionOf(next);
    return this.turnStarted(next);
  }

  private turnStarted(player: number): GameEvent[] {
    const position = this.positionOf(player);
    const events: GameEvent[] = [{ type: 'TurnStarted', player, position }];
    if (position >= NEAR_END_SQUARE) events.push({ type: 'NearEnd', player, position });
    return events;
  }

  /** Unfinished players the mover jumped past: strictly between the start square and the final square. */
  private overtakenBy(player: number, from: number, final: number): number[] {
    const overtaken: number[] = [];
    this.state.players.forEach((p, i) => {
      if (i !== player && p.rank === null && p.position > from && p.position < final) overtaken.push(i);
    });
    return overtaken;
  }

  positionOf(player: number): number {
    return this.playerAt(player).position;
  }

  private setPosition(player: number, square: number): void {
    this.playerAt(player).position = square;
  }

  private playerAt(index: number) {
    const p = this.state.players[index];
    if (!p) throw new Error(`No player ${index}`);
    return p;
  }
}
