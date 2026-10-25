import { describe, expect, it } from 'vitest';
import { pickSpeakers, reactionsFor, type Cue } from '../src/characters/reactionMapper';
import type { GameEvent } from '../src/core/events';

const PLAYERS = [
  { hero: 'rama', rank: null },
  { hero: 'sita', rank: null },
  { hero: 'lakshmana', rank: null },
  { hero: 'hanuman', rank: 1 },
] as const;
const JUMP = { from: 4, to: 40, name: 'x' };

function cuesOf(event: GameEvent): Cue[] {
  return reactionsFor(event, PLAYERS);
}

describe('reactionsFor', () => {
  it('ExtraRoll_(Mover_Seat_1)_Should_GiveMoverSelfRoll6AndOthersOtherRoll6', () => {
    const cues = cuesOf({ type: 'ExtraRoll', player: 1 });
    expect(cues).toHaveLength(4);
    expect(cues.find((c) => c.seat === 1)).toEqual({ seat: 1, role: 'self', event: 'roll6' });
    expect(cues.filter((c) => c.seat !== 1).every((c) => c.role === 'other' && c.event === 'roll6')).toBe(
      true,
    );
  });

  it.each([
    [false, 'ladder'],
    [true, 'ladderBig'],
  ])('Laddered_(Big_%s)_Should_Play_%s', (big, name) => {
    const cue = cuesOf({ type: 'Laddered', player: 0, jump: JUMP, big })[0];
    expect(cue).toEqual({ seat: 0, role: 'self', event: name });
  });

  it.each([
    [false, 'snake'],
    [true, 'snakeBig'],
  ])('Bitten_(Big_%s)_Should_Play_%s', (big, name) => {
    const cues = cuesOf({ type: 'Bitten', player: 2, jump: JUMP, big });
    expect(cues.find((c) => c.seat === 2)).toEqual({ seat: 2, role: 'self', event: name });
    expect(cues.find((c) => c.seat === 0)).toEqual({ seat: 0, role: 'other', event: name });
  });

  it('Overtook_(Mover_Passes_Seat_1)_Should_GiveMoverOvertakeAndSeat1Overtaken', () => {
    const cues = cuesOf({ type: 'Overtook', player: 0, overtaken: [1] });
    expect(cues.find((c) => c.seat === 0)).toEqual({ seat: 0, role: 'self', event: 'overtake' });
    expect(cues.find((c) => c.seat === 1)).toEqual({ seat: 1, role: 'self', event: 'overtaken' });
    expect(cues.find((c) => c.seat === 2)).toEqual({ seat: 2, role: 'other', event: 'overtake' });
    expect(cues.find((c) => c.seat === 3)).toEqual({ seat: 3, role: 'other', event: 'overtake' });
  });

  it('NearMiss_(Any_Mover)_Should_PlayNearMissForEverySeat', () => {
    expect(cuesOf({ type: 'NearMiss', player: 0, snakeHead: 9 }).map((c) => c.event)).toEqual(
      Array(4).fill('nearMiss'),
    );
  });

  it('NearEnd_(Mover_Close_To_Finish)_Should_PlayWaiting', () => {
    const cues = cuesOf({ type: 'NearEnd', player: 3, position: 135 });
    expect(cues[0]).toEqual({ seat: 3, role: 'self', event: 'waiting' });
  });

  it('TripleSixVoid_(Mover_Seat_2)_Should_PlayTripleSix', () => {
    const cues = cuesOf({ type: 'TripleSixVoid', player: 2, from: 5, restoredTo: 1 });
    expect(cues.find((c) => c.seat === 2)).toEqual({ seat: 2, role: 'self', event: 'tripleSix' });
  });

  it('Won_(Winner_Seat_3)_Should_GiveWinnerSelfWinAndOthersOtherWin', () => {
    const cues = cuesOf({ type: 'Won', player: 3, rank: 1 });
    expect(cues.find((c) => c.seat === 3)).toEqual({ seat: 3, role: 'self', event: 'win' });
    expect(cues.filter((c) => c.role === 'other' && c.event === 'win')).toHaveLength(3);
  });

  it('GameOver_(Winner_Seat_2)_Should_GiveEveryoneElseSelfLoseAndWinnerNothing', () => {
    const cues = cuesOf({ type: 'GameOver', ranking: [2, 0, 1, 3] });
    expect(cues.map((c) => c.seat).sort()).toEqual([0, 1, 3]);
    expect(cues.every((c) => c.role === 'self' && c.event === 'lose')).toBe(true);
  });

  it.each<GameEvent>([
    { type: 'TurnStarted', player: 0, position: 0 },
    { type: 'Rolled', player: 0, value: 3 },
    { type: 'Moved', player: 0, from: 0, to: 3, path: [1, 2, 3] },
    { type: 'Bounced', player: 0, overshoot: 2 },
  ])('Event_(%o)_Should_ProduceNoCues', (event) => {
    expect(cuesOf(event)).toEqual([]);
  });
});

describe('pickSpeakers', () => {
  const first = () => 0;
  const last = () => 0.999;

  it('Speakers_(Laddered_With_Bystanders)_Should_BeMoverPlusExactlyOneBystander', () => {
    const cues = cuesOf({ type: 'Laddered', player: 1, jump: JUMP, big: false });
    for (const random of [first, last]) {
      const speakers = pickSpeakers(cues, random);
      expect(speakers).toHaveLength(2);
      expect(speakers[0]?.seat).toBe(1);
      expect(speakers[1]?.role).toBe('other');
    }
  });

  it('Speakers_(Random_Picks_Last)_Should_ChooseTheLastBystander', () => {
    const cues = cuesOf({ type: 'ExtraRoll', player: 0 });
    expect(pickSpeakers(cues, last)[1]?.seat).toBe(3);
    expect(pickSpeakers(cues, first)[1]?.seat).toBe(1);
  });

  it('Speakers_(No_Bystanders)_Should_BeMoverOnly', () => {
    const cues = reactionsFor({ type: 'ExtraRoll', player: 0 }, [PLAYERS[0]]);
    expect(pickSpeakers(cues, first)).toEqual([{ seat: 0, role: 'self', event: 'roll6' }]);
  });

  it('Speakers_(Overtook)_Should_LetOnlyTheMoverSpeakAmongSelves', () => {
    const cues = cuesOf({ type: 'Overtook', player: 0, overtaken: [1, 2] });
    const speakers = pickSpeakers(cues, first);
    expect(speakers.filter((c) => c.role === 'self').map((c) => c.seat)).toEqual([0]);
    expect(speakers.filter((c) => c.role === 'other')).toHaveLength(1);
  });

  it('Speakers_(GameOver)_Should_PickExactlyOneLoser', () => {
    const cues = cuesOf({ type: 'GameOver', ranking: [3, 0, 1, 2] });
    expect(pickSpeakers(cues, last)).toEqual([{ seat: 2, role: 'self', event: 'lose' }]);
    expect(pickSpeakers(cues, first)).toEqual([{ seat: 0, role: 'self', event: 'lose' }]);
  });

  it('Speakers_(No_Cues)_Should_BeEmpty', () => {
    expect(pickSpeakers([], first)).toEqual([]);
  });
});
