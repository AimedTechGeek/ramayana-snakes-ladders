import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TurnController,
  BOT_DELAY_MS,
  FAST_BOT_DELAY_MS,
  type TurnStart,
} from '../src/app/turn/TurnController';
import type {
  Arrive,
  BoardSetup,
  BoardView,
  Clock,
  Cue,
  GameResult,
  HudSink,
  MotionOptions,
  SaveSink,
  SeatInfo,
  TurnAudio,
} from '../src/app/turn/ports';
import type { Reaction } from '../src/characters/reactions';
import type { Dice } from '../src/core/dice';
import type { GameConfig, GameState, Jump, PlayerConfig } from '../src/core/types';
import { gaitFor, type Gait } from '../src/game/iso/locomotion';
import type { RevealChange, RevealState } from '../src/game/reveal';
import { setLocale } from '../src/i18n/i18n';

// The easy board (src/core/boards.ts): ladder 4 -> 25, snake 37 -> 19.

const human = (name: string): PlayerConfig => ({ hero: 'rama', controller: 'human', name });
const bot = (name: string, hero: PlayerConfig['hero'] = 'hanuman'): PlayerConfig => ({
  hero,
  controller: 'bot',
  name,
});

function scripted(...rolls: number[]): Dice {
  return {
    roll: () => {
      const value = rolls.shift();
      if (value === undefined) throw new Error('scripted dice ran out');
      return value;
    },
  };
}

function describeChange(change: RevealChange): string {
  return change.kind === 'terrain' ? `terrain ${change.square}` : `jump ${change.jumpId} ${change.jumpType}`;
}

/** A BoardView and HudSink that record every call into one log, in order. Moving tokens call `arrive` per square. */
class Recorder implements BoardView, HudSink {
  log: string[] = [];
  setup: BoardSetup | null = null;
  gaits: Gait[] = [];
  motions: MotionOptions[] = [];
  reactions: { seat: number; reaction: Reaction }[] = [];
  lines: { seat: number; line: string }[] = [];
  diceOn = false;
  hintText = '';
  result: GameResult | null = null;
  seatRows: readonly SeatInfo[] = [];
  settingsSeen: { fast: boolean; muted: boolean }[] = [];
  rollFast: boolean[] = [];

  init(setup: BoardSetup): void {
    this.setup = setup;
    this.log.push('view.init');
  }
  turnStarted(player: number): void {
    this.log.push(`view.turnStarted ${player}`);
  }
  async enter(player: number, square: number, motion: MotionOptions, arrive: Arrive): Promise<void> {
    this.log.push(`view.enter ${player} ${square}`);
    this.motions.push(motion);
    arrive(square);
  }
  async walk(
    player: number,
    squares: readonly number[],
    gait: Gait,
    motion: MotionOptions,
    arrive: Arrive,
  ): Promise<void> {
    this.log.push(`view.walk ${player} ${squares.join(',')}`);
    this.gaits.push(gait);
    this.motions.push(motion);
    for (const square of squares) {
      this.log.push(`arrive ${square}`);
      arrive(square);
    }
    this.log.push('view.walk done');
  }
  async cross(player: number, jump: Jump, _motion: MotionOptions, arrive: Arrive): Promise<void> {
    this.log.push(`view.cross ${player} ${jump.from}->${jump.to}`);
    arrive(jump.to);
  }
  async bite(player: number, jump: Jump, _motion: MotionOptions, arrive: Arrive, cue: Cue): Promise<void> {
    this.log.push(`view.bite ${player} ${jump.from}->${jump.to}`);
    cue('strike');
    cue('gulp');
    arrive(jump.to);
    cue('pop');
  }
  bounce(player: number): void {
    this.log.push(`view.bounce ${player}`);
  }
  async voidTriple(player: number, restoredTo: number): Promise<void> {
    this.log.push(`view.voidTriple ${player} ${restoredTo}`);
  }
  async reveal(changes: readonly RevealChange[], _motion: MotionOptions, cue: Cue): Promise<void> {
    this.log.push(`view.reveal ${changes.map(describeChange).join(', ')}`);
    // like the diorama: a bridge cues its stones as it rises (a snake's hiss belongs to its bite)
    if (changes.some((change) => change.kind === 'jump' && change.jumpType === 'ladder')) cue('stone');
  }
  async react(seat: number, reaction: Reaction): Promise<void> {
    this.reactions.push({ seat, reaction });
  }
  speak(seat: number, line: string): void {
    this.lines.push({ seat, line });
  }
  win(ranking: readonly number[]): void {
    this.log.push(`view.win ${ranking.join(',')}`);
  }

  seats(seats: readonly SeatInfo[]): void {
    this.seatRows = seats;
  }
  turn(player: number, banner: string): void {
    this.log.push(`hud.turn ${player} ${banner}`);
  }
  hint(text: string): void {
    this.hintText = text;
  }
  diceEnabled(enabled: boolean): void {
    this.diceOn = enabled;
  }
  /** A test can hold the die in the air: rollDice resolves when this does. */
  dieHold: (() => Promise<void>) | null = null;
  async rollDice(value: number, fast: boolean): Promise<void> {
    this.log.push(`hud.rollDice ${value}`);
    this.rollFast.push(fast);
    if (this.dieHold) await this.dieHold();
    this.log.push(`hud.dieSettled ${value}`);
  }
  settings(settings: { fast: boolean; muted: boolean }): void {
    this.settingsSeen.push(settings);
  }
  gameOver(result: GameResult): void {
    this.result = result;
    this.log.push(`hud.gameOver ${result.ranking.join(',')}`);
  }
}

class FakeAudio implements TurnAudio {
  calls: string[] = [];
  unlock(): void {}
  setMuted(muted: boolean): void {
    this.calls.push(`setMuted ${muted}`);
  }
  dice(): void {
    this.calls.push('dice');
  }
  reveal(): void {
    this.calls.push('reveal');
  }
  ladder(): void {
    this.calls.push('ladder');
  }
  stone(fast = false): void {
    this.calls.push(`stone${fast ? ' fast' : ''}`);
  }
  hiss(fast = false): void {
    this.calls.push(`hiss${fast ? ' fast' : ''}`);
  }
  snake(fast = false): void {
    this.calls.push(`snake${fast ? ' fast' : ''}`);
  }
  gulp(fast = false): void {
    this.calls.push(`gulp${fast ? ' fast' : ''}`);
  }
  pop(fast = false): void {
    this.calls.push(`pop${fast ? ' fast' : ''}`);
  }
  bounce(): void {
    this.calls.push('bounce');
  }
  tripleSix(): void {
    this.calls.push('tripleSix');
  }
  win(): void {
    this.calls.push('win');
  }
  drone(on: boolean): void {
    this.calls.push(`drone ${on}`);
  }
}

/** Every wait resolves at once; the requested durations are recorded. */
class InstantClock implements Clock {
  waits: number[] = [];
  now(): number {
    return 0;
  }
  wait(ms: number): Promise<void> {
    this.waits.push(ms);
    return Promise.resolve();
  }
}

class MemorySave implements SaveSink {
  saves: { state: GameState; reveal: RevealState }[] = [];
  cleared = 0;
  save(state: GameState, reveal: RevealState): void {
    this.saves.push({ state: structuredClone(state), reveal: structuredClone(reveal) });
  }
  clear(): void {
    this.cleared++;
  }
}

interface Rig {
  controller: TurnController;
  view: Recorder;
  audio: FakeAudio;
  clock: InstantClock;
  saves: MemorySave;
}

function rig(
  start: TurnStart,
  rolls: number[],
  options: { fast?: boolean; muted?: boolean; reducedMotion?: boolean } = {},
): Rig {
  const view = new Recorder();
  const audio = new FakeAudio();
  const clock = new InstantClock();
  const saves = new MemorySave();
  const controller = new TurnController(
    start,
    {
      view,
      hud: view,
      audio,
      clock,
      save: saves,
      dice: scripted(...rolls),
      random: () => 0.5,
      reducedMotion: () => options.reducedMotion ?? false,
    },
    { fast: options.fast ?? false, muted: options.muted ?? false },
  );
  return { controller, view, audio, clock, saves };
}

function newGame(players: PlayerConfig[], playOn = false): TurnStart {
  const config: GameConfig = { level: 'easy', playOn, players };
  return { config };
}

/** A saved mid-game state on the easy board with players at the given squares; `current` moves next. */
function midGame(players: PlayerConfig[], positions: number[], current = 0): GameState {
  return {
    level: 'easy',
    playOn: false,
    players: players.map((p, i) => ({ ...p, position: positions[i] ?? 0, rank: null })),
    current,
    sixesThisTurn: 0,
    turnStartPosition: positions[current] ?? 0,
    over: false,
  };
}

function indexOf(log: string[], entry: string): number {
  const index = log.indexOf(entry);
  if (index < 0) throw new Error(`"${entry}" not in log:\n${log.join('\n')}`);
  return index;
}

describe('TurnController', () => {
  beforeEach(() => setLocale('en'));

  it('Start_NewGame_Should_InitTheViewThenAnnounceTheFirstTurnAndHandTheDiceToTheHuman', async () => {
    const { controller, view, saves } = rig(newGame([human('Asha'), bot('Bot')]), []);
    await controller.start();

    expect(view.log.slice(0, 3)).toEqual(['view.init', "hud.turn 0 Asha's turn", 'view.turnStarted 0']);
    expect(view.setup?.reveal.terrain.sort((a, b) => a - b)).toEqual([1, 144]);
    expect(view.diceOn).toBe(true);
    expect(view.hintText).toBe('Tap the dice or press Space');
    expect(controller.isBusy).toBe(false);
    expect(saves.saves.length).toBeGreaterThan(0);
  });

  it('HumanRoll_OntoALadderFoot_Should_PlayDiceEnterWalkRaiseTheBridgeThenCross_InEventOrder', async () => {
    const { controller, view, audio } = rig(newGame([human('Asha'), human('Ravi')]), [4]);
    await controller.start();
    await controller.requestRoll();

    const log = view.log;
    const order = [
      'hud.rollDice 4',
      'view.enter 0 1',
      'view.walk 0 2,3,4',
      'view.reveal jump 4 ladder',
      'view.cross 0 4->25',
      'view.reveal terrain 25',
      "hud.turn 1 Ravi's turn",
    ].map((entry) => indexOf(log, entry));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(audio.calls).toContain('ladder');
    expect(controller.snapshot().players[0]?.position).toBe(25);
  });

  it('Walk_Should_LiftEachSquaresFogWhenTheTokenArrives_NotBefore', async () => {
    const { controller, view } = rig(newGame([human('Asha'), human('Ravi')]), [3]);
    await controller.start();
    await controller.requestRoll();

    const log = view.log;
    // Square 1 (the gate) is known from the start, so entering on it reveals nothing.
    expect(log).not.toContain('view.reveal terrain 1');
    expect(indexOf(log, 'view.reveal terrain 2')).toBe(indexOf(log, 'arrive 2') + 1);
    expect(indexOf(log, 'view.reveal terrain 3')).toBe(indexOf(log, 'arrive 3') + 1);
    expect(indexOf(log, 'view.reveal terrain 3')).toBeLessThan(indexOf(log, 'view.walk done'));
  });

  it('Move_EndingOnAHiddenSquare_Should_PlayTheRevealCueOnce', async () => {
    const { controller, audio } = rig(newGame([human('Asha'), human('Ravi')]), [3]);
    await controller.start();
    await controller.requestRoll();

    expect(audio.calls.filter((call) => call === 'reveal')).toHaveLength(1);
  });

  it('Move_EndingOnARevealedSquare_Should_NotPlayTheRevealCue', async () => {
    const state = midGame([human('Asha'), human('Ravi')], [10, 0]);
    const reveal: RevealState = { terrain: [1, 10, 11, 12, 144], jumps: [] };
    const { controller, audio } = rig({ state, reveal }, [2]);
    await controller.start();
    await controller.requestRoll();

    expect(audio.calls).not.toContain('reveal');
  });

  it('LandingOnASnakeHead_Should_ShowTheSnakeBeforeTheBiteAndRevealTheTailOnArrival', async () => {
    const state = midGame([human('Asha'), human('Ravi')], [33, 0]);
    const { controller, view } = rig({ state, reveal: { terrain: [1, 33, 144], jumps: [] } }, [4]);
    await controller.start();
    await controller.requestRoll();

    const log = view.log;
    expect(indexOf(log, 'view.reveal jump 37 snake')).toBeLessThan(indexOf(log, 'view.bite 0 37->19'));
    expect(indexOf(log, 'view.reveal terrain 19')).toBeGreaterThan(indexOf(log, 'view.bite 0 37->19'));
    expect(controller.snapshot().players[0]?.position).toBe(19);
  });

  it('BotTurn_Should_RollByItselfAfterAboutOneSecond', async () => {
    const { controller, view, clock } = rig(newGame([bot('Bot'), human('Asha')]), [2]);
    await controller.start();

    await vi.waitFor(() => expect(view.log).toContain('hud.rollDice 2'));
    expect(clock.waits).toContain(BOT_DELAY_MS);
    await vi.waitFor(() => expect(view.diceOn).toBe(true));
    expect(controller.snapshot().current).toBe(1);
  });

  it('BotTurn_InFastMode_Should_RollAfterTheShorterDelay', async () => {
    const { controller, view, clock } = rig(newGame([bot('Bot'), human('Asha')]), [2], { fast: true });
    await controller.start();

    await vi.waitFor(() => expect(view.log).toContain('hud.rollDice 2'));
    expect(clock.waits).toContain(FAST_BOT_DELAY_MS);
    expect(clock.waits).not.toContain(BOT_DELAY_MS);
  });

  it('RequestRoll_OnABotsTurn_Should_DoNothing', async () => {
    const { controller, view } = rig(newGame([bot('Bot'), human('Asha')]), [2]);
    controller.setPaused(true); // hold the bot's own roll
    await controller.start();
    await controller.requestRoll();

    expect(view.log).not.toContain('hud.rollDice 2');
  });

  it('Pause_Should_HoldTheBotsRollUntilResumed', async () => {
    const { controller, view } = rig(newGame([bot('Bot'), human('Asha')]), [2]);
    controller.setPaused(true);
    await controller.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(view.log).not.toContain('hud.rollDice 2');

    controller.setPaused(false);
    await vi.waitFor(() => expect(view.log).toContain('hud.rollDice 2'));
  });

  it('Dispose_Should_StopBotsFromRollingAgain', async () => {
    const { controller, view } = rig(newGame([bot('A'), bot('B', 'sita')]), [2, 3, 4, 5]);
    controller.setPaused(true);
    await controller.start();
    controller.dispose();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(view.log.filter((entry) => entry.startsWith('hud.rollDice'))).toHaveLength(0);
  });

  it('Fast_Should_ReachTheHudAndTheAnimations', async () => {
    const { controller, view } = rig(newGame([human('Asha'), human('Ravi')]), [5]);
    await controller.start();
    controller.setFast(true);
    await controller.requestRoll();

    expect(view.settingsSeen.at(-1)).toEqual({ fast: true, muted: false });
    expect(view.rollFast).toEqual([true]);
    expect(view.gaits[0]).toEqual(gaitFor(5, true));
    expect(view.motions.every((motion) => motion.fast)).toBe(true);
  });

  it('Roll_(NormalSpeed)_Should_MoveOnlyAfterTheDieHasSettled', async () => {
    const { controller, view } = rig(newGame([human('Asha'), human('Ravi')]), [5]);
    await controller.start();
    await controller.requestRoll();

    expect(indexOf(view.log, 'hud.dieSettled 5')).toBeLessThan(indexOf(view.log, 'view.enter 0 1'));
  });

  it('Roll_(Fast)_Should_SetOffWhileTheDieLandsButNeverTumbleTwoDiceAtOnce', async () => {
    // T44.14: a 4-bot Hard game in Fast fits about a minute because the move overlaps the die
    const { controller, view } = rig(newGame([human('Asha'), human('Ravi')]), [5, 3], { fast: true });
    let land: () => void = () => {};
    view.dieHold = () => new Promise<void>((resolve) => (land = resolve));
    await controller.start();
    await controller.requestRoll();
    expect(indexOf(view.log, 'view.enter 0 1')).toBeGreaterThan(-1);
    expect(view.log).not.toContain('hud.dieSettled 5');

    const second = controller.requestRoll(); // Ravi: his die waits for Asha's to land
    await Promise.resolve();
    expect(view.log).not.toContain('hud.rollDice 3');
    land();
    await vi.waitFor(() => expect(view.log).toContain('hud.rollDice 3'));
    expect(indexOf(view.log, 'hud.dieSettled 5')).toBeLessThan(indexOf(view.log, 'hud.rollDice 3'));
    land();
    await second;
  });

  it('ReducedMotion_Should_GlideAtRunSpeedWithTheReducedFlag', async () => {
    const { controller, view } = rig(newGame([human('Asha'), human('Ravi')]), [2], { reducedMotion: true });
    await controller.start();
    await controller.requestRoll();

    expect(view.gaits[0]).toEqual(gaitFor(3, false));
    expect(view.motions.every((motion) => motion.reducedMotion)).toBe(true);
  });

  it('LandingOnALadderFoot_Should_PlayTheStonesOfTheRisingBridge', async () => {
    const { controller, audio } = rig(newGame([human('Asha'), human('Ravi')]), [4]);
    await controller.start();
    await controller.requestRoll();

    expect(audio.calls).toContain('stone');
    expect(audio.calls.indexOf('stone')).toBeLessThan(audio.calls.indexOf('ladder'));
  });

  it('Bitten_Should_PlayStrikeGulpAndPopOnTheViewsCuesWithTheFastFlag', async () => {
    const state = midGame([human('Asha'), human('Ravi')], [33, 0]);
    const { controller, audio } = rig({ state, reveal: { terrain: [1, 33, 144], jumps: [] } }, [4], { fast: true });
    await controller.start();
    await controller.requestRoll(); // 33 + 4 = 37: manthara's head

    const snakeCalls = audio.calls.filter((c) => /^(hiss|snake|gulp|pop)/.test(c));
    expect(snakeCalls).toEqual(['snake fast', 'gulp fast', 'pop fast']);
  });

  it('Mute_Should_SilenceTheAudioAndShowOnTheHud', async () => {
    const { controller, view, audio } = rig(newGame([human('Asha'), human('Ravi')]), []);
    await controller.start();
    controller.setMuted(true);

    expect(audio.calls).toContain('setMuted true');
    expect(view.settingsSeen.at(-1)).toEqual({ fast: false, muted: true });
  });

  it('EveryFinishedTurn_Should_AutosaveTheGameAndItsFog', async () => {
    const { controller, saves } = rig(newGame([human('Asha'), human('Ravi')]), [3]);
    await controller.start();
    const before = saves.saves.length;
    await controller.requestRoll();

    expect(saves.saves.length).toBe(before + 1);
    const last = saves.saves.at(-1)!;
    expect(last.state.players[0]?.position).toBe(3);
    expect(last.reveal.terrain).toEqual(expect.arrayContaining([1, 2, 3, 144]));
  });

  it('Resume_FromASave_Should_DrawTheSavedFogAndContinueWithTheSavedPlayer', async () => {
    const state = midGame([human('Asha'), human('Ravi')], [25, 12], 1);
    const reveal: RevealState = { terrain: [1, 4, 12, 25, 144], jumps: [4] };
    const { controller, view } = rig({ state, reveal }, []);
    await controller.start();

    expect(view.setup?.reveal).toEqual(reveal);
    expect(view.setup?.state.players.map((p) => p.position)).toEqual([25, 12]);
    expect(view.log).toContain("hud.turn 1 Ravi's turn");
    expect(controller.isBusy).toBe(false);
  });

  it('LadderEvent_Should_StartEverySeatsReactionMoverFirst_AndTheMoverSpeaks', async () => {
    const { controller, view } = rig(newGame([human('Asha'), human('Ravi'), bot('Bot', 'sita')]), [4]);
    controller.setPaused(true);
    await controller.start();
    controller.setPaused(false);
    await controller.requestRoll();

    const ladderReactions = view.reactions.slice(0, 3);
    expect(ladderReactions.map((r) => r.seat)).toEqual([0, 1, 2]);
    expect(view.lines.some((line) => line.seat === 0)).toBe(true);
  });

  it('ReachingTheThrone_Should_ClearTheSaveAndShowTheWinWithTheRanking', async () => {
    const state = midGame([human('Asha'), human('Ravi'), human('Mira')], [140, 50, 30]);
    const { controller, view, saves, audio } = rig(
      { state, reveal: { terrain: [1, 140, 144], jumps: [] } },
      [4],
    );
    await controller.start();
    await controller.requestRoll();

    expect(view.result?.ranking).toEqual([0, 1, 2]);
    expect(view.result?.canContinue).toBe(true);
    expect(saves.cleared).toBe(1);
    expect(audio.calls).toEqual(expect.arrayContaining(['win', 'drone false']));
    expect(indexOf(view.log, 'view.win 0,1,2')).toBeLessThan(indexOf(view.log, 'hud.gameOver 0,1,2'));
    expect(view.diceOn).toBe(false);
  });

  it('PlayOn_AfterTheFirstWinner_Should_ContinueWithTheNextUnrankedPlayer', async () => {
    const state = midGame([human('Asha'), human('Ravi'), human('Mira')], [140, 50, 30]);
    const { controller, view } = rig({ state, reveal: { terrain: [1, 140, 144], jumps: [] } }, [4]);
    await controller.start();
    await controller.requestRoll();
    await controller.continuePlay();

    expect(controller.isOver).toBe(false);
    expect(view.log.at(-1)).toBe('view.turnStarted 1');
    expect(view.diceOn).toBe(true);
  });

  it('ThreeSixes_Should_SlideTheTokenBackToWhereTheTurnBegan', async () => {
    const { controller, view, audio } = rig(newGame([human('Asha'), human('Ravi')]), [6, 6, 6]);
    await controller.start();
    await controller.requestRoll();
    await controller.requestRoll();
    await controller.requestRoll();

    expect(view.log).toContain('view.voidTriple 0 0');
    expect(audio.calls).toContain('tripleSix');
    expect(controller.snapshot().players[0]?.position).toBe(0);
  });

  it('OvershootingTheThrone_Should_BounceTheToken', async () => {
    const state = midGame([human('Asha'), human('Ravi')], [142, 0]);
    const { controller, view, audio } = rig({ state, reveal: { terrain: [1, 142, 144], jumps: [] } }, [4]);
    await controller.start();
    await controller.requestRoll();

    expect(view.log).toContain('view.walk 0 143,144,143,142');
    expect(view.log).toContain('view.bounce 0');
    expect(audio.calls).toContain('bounce');
  });

  it('FourBots_Should_PlayAWholeGameToTheWinScreenByThemselves', async () => {
    const players = [bot('A', 'rama'), bot('B', 'sita'), bot('C', 'lakshmana'), bot('D', 'hanuman')];
    const rolls = Array.from({ length: 2000 }, (_, i) => ((i * 7 + 3) % 6) + 1);
    const { controller, view } = rig(newGame(players), rolls, { fast: true });
    await controller.start();

    await vi.waitFor(() => expect(view.result).not.toBeNull(), { timeout: 5000 });
    expect(view.result?.state.over).toBe(true);
    expect(view.result?.state.players.some((p) => p.rank === 1)).toBe(true);
  });
});
