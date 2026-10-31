import { describe, expect, it } from 'vitest';
import type { Dice } from '../src/core/dice';
import { Game } from '../src/core/game';
import type { Board, GameState, PlayerConfig } from '../src/core/types';
import {
  applyEvent,
  applyEvents,
  createRevealState,
  isJumpRevealed,
  isRevealState,
  isTerrainRevealed,
  seedFromGameState,
} from '../src/game/reveal';

const board: Board = {
  level: 'easy',
  ladders: [
    { from: 4, to: 25, name: 'ladder 4' },
    { from: 16, to: 30, name: 'ladder 16' },
  ],
  snakes: [{ from: 17, to: 6, name: 'snake 17' }],
};

const rama: PlayerConfig = { hero: 'rama', controller: 'human', name: 'Asha' };
const hanuman: PlayerConfig = { hero: 'hanuman', controller: 'bot', name: 'Bot' };

function scripted(...rolls: number[]): Dice {
  return {
    roll: () => {
      const next = rolls.shift();
      if (next === undefined) throw new Error('Dice script exhausted');
      return next;
    },
  };
}

/** A two-player game with player 0 placed on `position`, rolling the scripted dice. */
function gameAt(position: number, ...rolls: number[]): Game {
  const dice = scripted(...rolls);
  const game = Game.create({ level: 'easy', players: [rama, hanuman], playOn: false }, board, dice);
  const s = game.snapshot();
  s.players[0]!.position = position;
  s.turnStartPosition = position;
  return Game.restore(s, board, dice);
}

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);

describe('applyEvents', () => {
  it('applyEvents_TokenHopsOverSnakeHead_Should_RevealTerrainButNotSnake', () => {
    const game = gameAt(15, 3); // 16 (ladder foot) and 17 (snake head) are passed, landing on 18
    const reveal = createRevealState();
    applyEvents(reveal, game.roll());
    expect(sorted(reveal.terrain)).toEqual([16, 17, 18]);
    expect(isJumpRevealed(reveal, 17)).toBe(false);
    expect(isJumpRevealed(reveal, 16)).toBe(false);
  });

  it('applyEvents_LandingOnLadderFoot_Should_RevealLadderAndTopTerrain', () => {
    const game = gameAt(0, 4);
    const reveal = createRevealState();
    const changes = applyEvents(reveal, game.roll());
    expect(isJumpRevealed(reveal, 4)).toBe(true);
    expect(isTerrainRevealed(reveal, 25)).toBe(true);
    expect(isTerrainRevealed(reveal, 10)).toBe(false);
    expect(changes.at(-2)).toEqual({ kind: 'jump', jumpId: 4, jumpType: 'ladder' });
    expect(changes.at(-1)).toEqual({ kind: 'terrain', square: 25 });
  });

  it('applyEvents_SnakeBite_Should_RevealSnakeAndTailTerrainOnly', () => {
    const game = gameAt(14, 3); // 15, 16, 17 then bitten to 6
    const reveal = createRevealState();
    applyEvents(reveal, game.roll());
    expect(isJumpRevealed(reveal, 17)).toBe(true);
    expect(sorted(reveal.terrain)).toEqual([6, 15, 16, 17]);
    for (let square = 7; square <= 14; square++) expect(isTerrainRevealed(reveal, square)).toBe(false);
  });

  it('applyEvents_BounceBack_Should_RevealEveryPassedSquareIncludingBounceSquares', () => {
    const game = gameAt(139, 6); // 140..144 then back to 143
    const reveal = createRevealState();
    applyEvents(reveal, game.roll());
    expect(sorted(reveal.terrain)).toEqual([140, 141, 142, 143, 144]);
  });

  it('applyEvents_TripleSixVoid_Should_RevealNothingNew', () => {
    const game = gameAt(20, 6, 6, 6);
    const reveal = createRevealState();
    applyEvents(reveal, game.roll());
    applyEvents(reveal, game.roll());
    const before = structuredClone(reveal);
    const voided = game.roll();
    expect(voided.some((e) => e.type === 'TripleSixVoid')).toBe(true);
    expect(applyEvents(reveal, voided)).toEqual([]);
    expect(reveal).toEqual(before);
  });

  it('applyEvents_SameEventsAgain_Should_ReturnNoChangesAndKeepEarlierReveals', () => {
    const game = gameAt(0, 4);
    const reveal = createRevealState();
    const events = game.roll();
    applyEvents(reveal, events);
    const before = structuredClone(reveal);
    expect(applyEvents(reveal, events)).toEqual([]);
    expect(reveal).toEqual(before);
  });

  it('applyEvents_OtherPlayerLaterTurn_Should_KeepRevealingForEveryone', () => {
    const dice = scripted(2, 3);
    const game = Game.create({ level: 'easy', players: [rama, hanuman], playOn: false }, board, dice);
    const reveal = createRevealState();
    applyEvents(reveal, game.roll());
    applyEvents(reveal, game.roll());
    expect(sorted(reveal.terrain)).toEqual([1, 2, 3]);
  });

  it('applyEvent_NonMovementEvent_Should_RevealNothing', () => {
    const reveal = createRevealState();
    expect(applyEvent(reveal, { type: 'Rolled', player: 0, value: 3 })).toEqual([]);
  });
});

describe('createRevealState', () => {
  it('createRevealState_Default_Should_HideEverything', () => {
    const reveal = createRevealState();
    expect(reveal).toEqual({ terrain: [], jumps: [] });
    expect(isTerrainRevealed(reveal, 1)).toBe(false);
  });

  it('createRevealState_WithInitialSquares_Should_RevealOnlyOnBoardSquares', () => {
    const reveal = createRevealState([1, 144, 0]);
    expect(sorted(reveal.terrain)).toEqual([1, 144]);
  });
});

describe('seedFromGameState', () => {
  it('seedFromGameState_PlayersOnBoard_Should_RevealOnlyTheirCurrentSquares', () => {
    const state: GameState = {
      level: 'easy',
      playOn: false,
      players: [
        { ...rama, position: 42, rank: null },
        { ...hanuman, position: 0, rank: null },
      ],
      current: 0,
      sixesThisTurn: 0,
      turnStartPosition: 42,
      over: false,
    };
    expect(seedFromGameState(state)).toEqual({ terrain: [42], jumps: [] });
  });
});

describe('isRevealState', () => {
  it('isRevealState_BadShapes_Should_BeRejected', () => {
    expect(isRevealState({ terrain: [1], jumps: [] })).toBe(true);
    expect(isRevealState(null)).toBe(false);
    expect(isRevealState({ terrain: [1] })).toBe(false);
    expect(isRevealState({ terrain: ['1'], jumps: [] })).toBe(false);
    expect(isRevealState({ terrain: [145], jumps: [] })).toBe(false);
    expect(isRevealState({ terrain: [3, 3], jumps: [] })).toBe(false);
  });
});
