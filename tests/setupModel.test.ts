import { describe, expect, it } from 'vitest';
import {
  canStart,
  cycleHero,
  defaultSeats,
  setController,
  setName,
  toGameConfig,
} from '../src/game/setupModel';

describe('setupModel', () => {
  it('DefaultSeats_Should_BeHumanRamaBotHanumanThenTwoEmpty', () => {
    const seats = defaultSeats();
    expect(seats.map((s) => [s.controller, s.hero])).toEqual([
      ['human', 'rama'],
      ['bot', 'hanuman'],
      ['empty', 'lakshmana'],
      ['empty', 'sita'],
    ]);
  });

  it('CycleHero_ToUnheldHero_Should_ChangeOnlyThatSeat', () => {
    const seats = cycleHero(defaultSeats(), 0, 1); // rama -> sita (held by seat 4)
    expect(seats[0]?.hero).toBe('sita');
    const free = cycleHero(setController(defaultSeats(), 3, 'empty'), 3, -1); // sita -> rama (held)
    expect(new Set(free.map((s) => s.hero)).size).toBe(4);
  });

  it('CycleHero_OntoHeroHeldByAnotherSeat_Should_SwapHeroes', () => {
    const seats = cycleHero(defaultSeats(), 0, 1);
    expect(seats[0]?.hero).toBe('sita');
    expect(seats[3]?.hero).toBe('rama');
  });

  it('CycleHero_PastEnd_Should_WrapAround', () => {
    const seats = cycleHero(defaultSeats(), 1, 1); // hanuman is last
    expect(seats[1]?.hero).toBe('rama');
    expect(seats[0]?.hero).toBe('hanuman');
  });

  it('CycleHero_WithDefaultName_Should_FollowHeroLabel', () => {
    const seats = cycleHero(defaultSeats(), 0, 1);
    expect(seats[0]?.name).toBe('Sita');
    expect(seats[3]?.name).toBe('Rama');
  });

  it('CycleHero_WithCustomName_Should_KeepName', () => {
    const seats = cycleHero(setName(defaultSeats(), 0, 'Asha'), 0, 1);
    expect(seats[0]?.name).toBe('Asha');
  });

  it('CanStart_WithOneNonEmptySeat_Should_BeFalse', () => {
    expect(canStart(setController(defaultSeats(), 1, 'empty'))).toBe(false);
  });

  it('CanStart_WithTwoNonEmptySeats_Should_BeTrue', () => {
    expect(canStart(defaultSeats())).toBe(true);
  });

  it('ToGameConfig_Should_SkipEmptySeatsAndKeepOrder', () => {
    let seats = setController(defaultSeats(), 0, 'empty');
    seats = setController(seats, 2, 'bot');
    seats = setController(seats, 3, 'human');
    const config = toGameConfig(seats, 'hard');
    expect(config.level).toBe('hard');
    expect(config.playOn).toBe(false);
    expect(config.players.map((p) => [p.hero, p.controller])).toEqual([
      ['hanuman', 'bot'],
      ['lakshmana', 'bot'],
      ['sita', 'human'],
    ]);
  });

  it('ToGameConfig_BlankName_Should_FallBackToHeroLabel', () => {
    const config = toGameConfig(setName(defaultSeats(), 0, '   '), 'easy');
    expect(config.players[0]?.name).toBe('Rama');
  });

  it('ToGameConfig_PaddedName_Should_BeTrimmed', () => {
    const config = toGameConfig(setName(defaultSeats(), 0, '  Asha '), 'easy');
    expect(config.players[0]?.name).toBe('Asha');
  });
});
