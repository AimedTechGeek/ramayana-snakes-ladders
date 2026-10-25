import { describe, expect, it } from 'vitest';
import type { Dice } from '../src/core/dice';
import { Game, resolveMove } from '../src/core/game';
import type { Board, GameConfig, PlayerConfig } from '../src/core/types';

const board: Board = {
  level: 'easy',
  ladders: [
    { from: 4, to: 25, name: 'ladder 4' },
    { from: 16, to: 30, name: 'ladder 16' },
    { from: 141, to: 143, name: 'late ladder' },
  ],
  snakes: [
    { from: 17, to: 6, name: 'snake 17' },
    { from: 142, to: 100, name: 'late snake' },
  ],
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

function newGame(dice: Dice, overrides: Partial<GameConfig> = {}): Game {
  return Game.create({ level: 'easy', players: [rama, hanuman], playOn: false, ...overrides }, board, dice);
}

/** Put a player on a square by rewriting a snapshot; keeps tests independent of long roll scripts. */
function at(game: Game, positions: number[], dice: Dice): Game {
  const s = game.snapshot();
  positions.forEach((pos, i) => (s.players[i]!.position = pos));
  s.turnStartPosition = positions[s.current]!;
  return Game.restore(s, board, dice);
}

const types = (events: { type: string }[]) => events.map((e) => e.type);

describe('resolveMove', () => {
  it('Move_PastFinalSquare_Should_BounceBackByTheOvershoot', () => {
    const move = resolveMove(board, 139, 6); // 140..144, then back to 143
    expect(move.landing).toBe(143);
    expect(move.path).toEqual([140, 141, 142, 143, 144, 143]);
    expect(move.overshoot).toBe(1);
  });

  it('Move_ExactlyToFinalSquare_Should_NotBounce', () => {
    const move = resolveMove(board, 140, 4);
    expect(move).toMatchObject({ landing: 144, overshoot: 0, final: 144, jump: null });
  });
});

describe('Game turns', () => {
  it('Roll_OnLadderFoot_Should_ClimbAndEndTurn', () => {
    const game = newGame(scripted(4));
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Laddered', 'TurnStarted']);
    expect(game.positionOf(0)).toBe(25);
    expect(game.currentPlayer).toBe(1);
  });

  it('Roll_OnSnakeHead_Should_SlideDown', () => {
    const game = at(newGame(scripted()), [14, 0], scripted(3));
    const events = game.roll();
    expect(types(events)).toContain('Bitten');
    expect(game.positionOf(0)).toBe(6);
  });

  it('Roll_Six_Should_GrantExtraRollToSamePlayer', () => {
    const game = newGame(scripted(6, 2));
    expect(types(game.roll())).toEqual(['Rolled', 'Moved', 'ExtraRoll']);
    expect(game.currentPlayer).toBe(0);
    game.roll();
    expect(game.positionOf(0)).toBe(8);
    expect(game.currentPlayer).toBe(1);
  });

  it('Roll_ThirdSixInARow_Should_VoidWholeTurnAndRestoreStart', () => {
    const game = newGame(scripted(6, 6, 6));
    game.roll();
    game.roll(); // 6+6 = 12
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'TripleSixVoid', 'TurnStarted']);
    expect(game.positionOf(0)).toBe(0);
    expect(game.currentPlayer).toBe(1);
  });

  it('TripleSixVoid_AfterALadderInTheSameTurn_Should_RestoreSquareBeforeTheLadder', () => {
    const game = at(newGame(scripted()), [10, 0], scripted(6, 6, 6));
    expect(types(game.roll())).toContain('Laddered'); // 16 -> 30
    game.roll(); // 36
    game.roll();
    expect(game.positionOf(0)).toBe(10);
  });

  it('Sixes_Should_ResetForTheNextPlayer', () => {
    const game = newGame(scripted(6, 6, 1, 6, 6, 6));
    game.roll();
    game.roll();
    game.roll(); // player 0 ends after 6,6,1
    game.roll();
    game.roll();
    const events = game.roll(); // player 1's own third six
    expect(types(events)).toContain('TripleSixVoid');
  });

  it('Bounce_OntoSnakeHead_Should_ApplyTheSnake', () => {
    const game = at(newGame(scripted()), [140, 0], scripted(6)); // 144 -> back to 142 (snake)
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Bounced', 'Bitten', 'ExtraRoll']); // a 6 still earns its extra roll
    expect(game.positionOf(0)).toBe(100);
  });

  it('Bounce_OntoLadderFoot_Should_ApplyTheLadder', () => {
    const game = at(newGame(scripted()), [143, 0], scripted(4)); // 144, 143, 142, 141 -> ladder 141 -> 143
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Bounced', 'Laddered', 'TurnStarted']);
    expect(game.positionOf(0)).toBe(143);
  });

  it('TwoTokens_OnSameSquare_Should_BothStayThere', () => {
    const game = newGame(scripted(2, 2));
    game.roll();
    game.roll();
    expect(game.positionOf(0)).toBe(2);
    expect(game.positionOf(1)).toBe(2);
  });
});

describe('Winning', () => {
  it('Landing_On144_Should_WinAndEndGameByDefault', () => {
    const game = at(newGame(scripted()), [140, 50], scripted(4));
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Won', 'GameOver']);
    expect(game.isOver).toBe(true);
    expect(events.at(-1)).toEqual({ type: 'GameOver', ranking: [0, 1] });
    expect(() => game.roll()).toThrow();
  });

  it('Winning_WithASix_Should_NotGrantAnExtraRoll', () => {
    const game = at(newGame(scripted()), [138, 50], scripted(6));
    expect(types(game.roll())).toEqual(['Rolled', 'Moved', 'Won', 'GameOver']);
  });

  it('PlayOn_Should_ContinueUntilOnePlayerIsLeft', () => {
    const three = [rama, hanuman, { ...rama, hero: 'sita' as const, name: 'Mira' }];
    const base = Game.create({ level: 'easy', players: three, playOn: true }, board, scripted());
    const game = at(base, [140, 10, 20], scripted(4, 1, 1));
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Won', 'TurnStarted']);
    expect(game.isOver).toBe(false);
    game.roll(); // player 1
    game.roll(); // player 2
    expect(game.currentPlayer).toBe(1); // finished player 0 is skipped
  });

  it('PlayOn_WithTwoPlayers_Should_EndWhenTheFirstFinishes', () => {
    const game = at(newGame(scripted(), { playOn: true }), [140, 10], scripted(4));
    expect(types(game.roll())).toContain('GameOver');
  });

  it('ContinuePlay_AfterFirstWinner_Should_StartNextUnrankedPlayersTurn', () => {
    const sita: PlayerConfig = { hero: 'sita', controller: 'bot', name: 'Sita' };
    const game = at(
      Game.create({ level: 'easy', players: [rama, hanuman, sita], playOn: false }, board, scripted()),
      [140, 10, 20],
      scripted(4),
    );
    game.roll();
    expect(game.isOver).toBe(true);
    expect(game.canContinue).toBe(true);
    expect(game.continuePlay()).toEqual([{ type: 'TurnStarted', player: 1, position: 10 }]);
    expect(game.isOver).toBe(false);
    expect(game.currentPlayer).toBe(1);
  });

  it('ContinuePlay_WithOneUnrankedPlayer_Should_Throw', () => {
    const game = at(newGame(scripted()), [140, 10], scripted(4));
    game.roll();
    expect(game.canContinue).toBe(false);
    expect(() => game.continuePlay()).toThrow();
  });
});

describe('Setup and saving', () => {
  it('Create_WithOnePlayer_Should_BeRejected', () => {
    expect(() => Game.create({ level: 'easy', players: [rama], playOn: false }, board, scripted())).toThrow();
  });

  it('Restore_FromSnapshot_Should_ContinueIdentically', () => {
    const game = newGame(scripted(3, 5));
    game.roll();
    const saved = JSON.parse(JSON.stringify(game.snapshot()));
    const restored = Game.restore(saved, board, scripted(5));
    restored.roll();
    expect(restored.positionOf(1)).toBe(5);
    expect(restored.positionOf(0)).toBe(3);
  });

  it('Snapshot_Should_NotExposeLiveState', () => {
    const game = newGame(scripted(3));
    const snap = game.snapshot();
    snap.players[0]!.position = 99;
    expect(game.positionOf(0)).toBe(0);
  });
});

describe('Derived events', () => {
  const nearMissBoard: Board = {
    level: 'easy',
    ladders: [{ from: 40, to: 48, name: 'ladder 40' }],
    snakes: [
      { from: 50, to: 48, name: 'snake 50' },
      { from: 49, to: 1, name: 'snake 49' },
    ],
  };

  function onBoard(b: Board, positions: number[], dice: Dice): Game {
    const s = Game.create(
      { level: 'easy', players: [rama, hanuman], playOn: false },
      b,
      scripted(),
    ).snapshot();
    positions.forEach((pos, i) => (s.players[i]!.position = pos));
    s.turnStartPosition = positions[0]!;
    return Game.restore(s, b, dice);
  }

  it('Overtook_AfterAPlainMove_Should_ListThePlayersPassed', () => {
    const game = at(newGame(scripted()), [3, 5], scripted(4)); // 3 -> 7 passes the token on 5
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Overtook', 'TurnStarted']);
    expect(events.find((e) => e.type === 'Overtook')).toEqual({
      type: 'Overtook',
      player: 0,
      overtaken: [1],
    });
  });

  it('Overtook_WhenPassingViaALadder_Should_ListThePlayersPassed', () => {
    const game = at(newGame(scripted()), [2, 10], scripted(2)); // 2 -> 4 -> ladder to 25
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Laddered', 'Overtook', 'TurnStarted']);
    expect(events.find((e) => e.type === 'Overtook')).toMatchObject({ overtaken: [1] });
  });

  it('Overtook_WhenStartingLevelWithAnotherPlayer_Should_NotBeEmitted', () => {
    const game = at(newGame(scripted()), [5, 5], scripted(3));
    expect(types(game.roll())).not.toContain('Overtook');
  });

  it('Overtook_WhenPassingAFinishedPlayer_Should_NotBeEmitted', () => {
    const three = [rama, hanuman, { ...rama, hero: 'sita' as const, name: 'Mira' }];
    const s = Game.create({ level: 'easy', players: three, playOn: true }, board, scripted()).snapshot();
    s.players[1]!.position = 5;
    s.players[1]!.rank = 1;
    s.players[2]!.position = 20;
    s.players[0]!.position = 3;
    s.turnStartPosition = 3;
    const game = Game.restore(s, board, scripted(4)); // 3 -> 7 passes finished player on 5
    expect(types(game.roll())).not.toContain('Overtook');
  });

  it('Overtook_WhenASnakeDropsTheMoverBelowOthers_Should_NotBeEmitted', () => {
    const game = at(newGame(scripted()), [14, 10], scripted(3)); // 17 -> snake to 6, below the token on 10
    expect(types(game.roll())).not.toContain('Overtook');
  });

  it('NearMiss_OnTheSquareBelowASnakeHead_Should_NameTheHead', () => {
    const game = onBoard(nearMissBoard, [45, 0], scripted(4)); // 49 is a head; 48 is not reachable here
    const events = onBoard(nearMissBoard, [44, 0], scripted(4)).roll(); // lands on 48, one below head 49
    expect(events.find((e) => e.type === 'NearMiss')).toEqual({ type: 'NearMiss', player: 0, snakeHead: 49 });
    expect(game.roll().some((e) => e.type === 'NearMiss')).toBe(false); // 45 -> 49 is bitten, final 1
  });

  it('NearMiss_AfterALadderEndsBelowASnakeHead_Should_BeEmitted', () => {
    const game = onBoard(nearMissBoard, [36, 0], scripted(4)); // 40 -> ladder to 48, one below head 49
    expect(types(game.roll())).toEqual(['Rolled', 'Moved', 'Laddered', 'NearMiss', 'TurnStarted']);
  });

  it('NearMiss_WhenBittenToASquareBelowAnotherHead_Should_NotBeEmitted', () => {
    const game = onBoard(nearMissBoard, [46, 0], scripted(4)); // 50 -> snake to 48, one below head 49
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'Bitten', 'TurnStarted']);
    expect(game.positionOf(0)).toBe(48);
  });

  it('NearEnd_WhenTheNextPlayerStartsOn132_Should_FollowTurnStarted', () => {
    const game = at(newGame(scripted()), [10, 132], scripted(1));
    const events = game.roll();
    expect(types(events)).toEqual(['Rolled', 'Moved', 'TurnStarted', 'NearEnd']);
    expect(events.at(-1)).toEqual({ type: 'NearEnd', player: 1, position: 132 });
  });

  it('NearEnd_WhenTheNextPlayerStartsOn131_Should_NotBeEmitted', () => {
    const game = at(newGame(scripted()), [10, 131], scripted(1));
    expect(types(game.roll())).not.toContain('NearEnd');
  });

  it('NearEnd_OnBegin_Should_FollowTurnStartedWhenResumingNearTheEnd', () => {
    const game = at(newGame(scripted()), [140, 0], scripted());
    expect(types(game.begin())).toEqual(['TurnStarted', 'NearEnd']);
  });

  it('Roll_WithEveryDerivedEvent_Should_EmitThemInTheDocumentedOrder', () => {
    const endBoard: Board = {
      level: 'easy',
      ladders: [{ from: 137, to: 140, name: 'ladder 137' }],
      snakes: [{ from: 141, to: 100, name: 'snake 141' }],
    };
    const game = onBoard(endBoard, [133, 138], scripted(4)); // 137 -> ladder 140, passes 138
    expect(types(game.roll())).toEqual([
      'Rolled',
      'Moved',
      'Laddered',
      'Overtook',
      'NearMiss',
      'TurnStarted',
      'NearEnd',
    ]);
  });
});
