import { boardFor, LEVELS, validateLayout } from '../src/core/boards';
import { createSeededDice } from '../src/core/dice';
import type { GameEvent } from '../src/core/events';
import { Game } from '../src/core/game';
import type { Board, Level, PlayerConfig } from '../src/core/types';

// tsconfig has no Node types; declare the two bits of `process` this script uses.
declare const process: { env: Record<string, string | undefined>; exitCode?: number };

const BASE_SEED = 42;
const SOLO_GAMES = Number(process.env.SIM_GAMES ?? 50000);
const WINNER_GAMES = 20000;
const TARGETS: Record<Level, { mean: number; tolerance: number }> = {
  easy: { mean: 36, tolerance: 3 },
  medium: { mean: 45, tolerance: 3 },
  hard: { mean: 64, tolerance: 5 },
};

const PLAYERS: PlayerConfig[] = [
  { hero: 'rama', controller: 'bot', name: 'P0' },
  { hero: 'sita', controller: 'bot', name: 'P1' },
  { hero: 'lakshmana', controller: 'bot', name: 'P2' },
  { hero: 'hanuman', controller: 'bot', name: 'P3' },
];

interface SoloResult {
  turns: number;
  ladders: number;
  bites: number;
}

/** Real engine, player 0 only: control is handed straight back to player 0 whenever it passes on. */
function playSolo(board: Board, seed: number): SoloResult {
  const dice = createSeededDice(seed);
  let game = Game.create({ level: board.level, players: PLAYERS.slice(0, 2), playOn: false }, board, dice);
  const result: SoloResult = { turns: 1, ladders: 0, bites: 0 };
  for (;;) {
    let passedToPlayerOne = false;
    for (const event of game.roll()) {
      if (event.type === 'Laddered') result.ladders++;
      if (event.type === 'Bitten') result.bites++;
      if (event.type === 'Won') return result;
      if (event.type === 'TurnStarted' && event.player === 1) passedToPlayerOne = true;
    }
    if (passedToPlayerOne) {
      const state = game.snapshot();
      state.current = 0;
      state.turnStartPosition = state.players[0]?.position ?? 0;
      state.sixesThisTurn = 0;
      game = Game.restore(state, board, dice);
      result.turns++;
    }
  }
}

function playFourPlayerWinnerTurns(board: Board, seed: number): number {
  const game = Game.create({ level: board.level, players: PLAYERS, playOn: false }, board, createSeededDice(seed));
  const turns = PLAYERS.map(() => 0);
  const count = (events: GameEvent[]): number | null => {
    for (const event of events) {
      if (event.type === 'TurnStarted') turns[event.player]!++;
      if (event.type === 'Won') return turns[event.player] ?? 0;
    }
    return null;
  };
  count(game.begin());
  for (;;) {
    const won = count(game.roll());
    if (won !== null) return won;
  }
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

function main(): void {
  const failures: string[] = [];
  for (const problem of validateLayout()) failures.push(`layout: ${problem}`);

  console.log(`Solo games per level: ${SOLO_GAMES}, 4-player games per level: ${WINNER_GAMES}`);
  console.log('level   ladders snakes  mean   median p10  p90  4p-winner  ladders/game bites/game');
  for (const level of LEVELS) {
    const board = boardFor(level);
    const solo: SoloResult[] = [];
    for (let i = 0; i < SOLO_GAMES; i++) solo.push(playSolo(board, BASE_SEED + i));
    const turns = solo.map((r) => r.turns).sort((a, b) => a - b);
    const winners: number[] = [];
    for (let i = 0; i < WINNER_GAMES; i++) winners.push(playFourPlayerWinnerTurns(board, BASE_SEED + i));

    const soloMean = mean(turns);
    console.log(
      [
        level.padEnd(7),
        String(board.ladders.length).padStart(7),
        String(board.snakes.length).padStart(6),
        soloMean.toFixed(1).padStart(6),
        String(percentile(turns, 0.5)).padStart(6),
        String(percentile(turns, 0.1)).padStart(4),
        String(percentile(turns, 0.9)).padStart(4),
        mean(winners).toFixed(1).padStart(10),
        mean(solo.map((r) => r.ladders)).toFixed(2).padStart(13),
        mean(solo.map((r) => r.bites)).toFixed(2).padStart(10),
      ].join(' '),
    );

    const target = TARGETS[level];
    if (Math.abs(soloMean - target.mean) > target.tolerance) {
      failures.push(`${level}: mean solo turns ${soloMean.toFixed(1)} outside ${target.mean}±${target.tolerance}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.log(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('SIM OK');
}

main();
