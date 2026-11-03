import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Hero } from '../src/core/types';
import { HERO_ORDER, HEROES } from '../src/game/heroes';
import { setLocale } from '../src/i18n/i18n';
import {
  canStart,
  cycleHero,
  defaultSeats,
  setController,
  setName,
  toGameConfig,
} from '../src/game/setupModel';

describe('Roster (T46)', () => {
  it('Roster_Should_OfferSixHeroesWithTheirSeatColours', () => {
    expect([...HERO_ORDER].sort()).toEqual(
      ['bharata', 'hanuman', 'lakshmana', 'rama', 'shatrughna', 'sita'] satisfies Hero[],
    );
    expect(Object.keys(HEROES).sort()).toEqual([...HERO_ORDER].sort());
    expect(HEROES.bharata.cssColor).toBe('#6E4BB5');
    expect(HEROES.bharata.color).toBe(0x6e4bb5);
    expect(HEROES.shatrughna.cssColor).toBe('#1F9E95');
    expect(HEROES.shatrughna.color).toBe(0x1f9e95);
    expect(new Set(HERO_ORDER.map((hero) => HEROES[hero].cssColor)).size).toBe(6);
  });

  it('CycleHero_(OneSeatAllTheWayRound)_Should_ReachEverySixHeroesAndKeepThemUnique', () => {
    let seats = defaultSeats();
    const seen = new Set<Hero>([seats[0]!.hero]);
    for (let step = 0; step < HERO_ORDER.length; step++) {
      seats = cycleHero(seats, 0, 1);
      seen.add(seats[0]!.hero);
      expect(new Set(seats.map((s) => s.hero)).size, `step ${step}`).toBe(seats.length);
    }
    expect(seen.size).toBe(6);
    expect(seats[0]?.hero).toBe('rama');
  });

  it('CycleHero_(EverySeatBothWays)_Should_NeverGiveTwoSeatsTheSameHero', () => {
    let seats = defaultSeats();
    for (let round = 0; round < 24; round++) {
      seats = cycleHero(seats, round % 4, round % 3 === 0 ? -1 : 1);
      expect(new Set(seats.map((s) => s.hero)).size, `round ${round}`).toBe(4);
    }
  });
});

describe('setupModel', () => {
  it('DefaultSeats_Should_BeTheFourBrothersWithRamaHuman', () => {
    const seats = defaultSeats();
    expect(seats.map((s) => [s.controller, s.hero])).toEqual([
      ['human', 'rama'],
      ['bot', 'lakshmana'],
      ['bot', 'bharata'],
      ['bot', 'shatrughna'],
    ]);
  });

  it('CycleHero_ToUnheldHero_Should_ChangeOnlyThatSeat', () => {
    const seats = cycleHero(defaultSeats(), 3, 1); // shatrughna -> hanuman (not seated)
    expect(seats.map((s) => s.hero)).toEqual(['rama', 'lakshmana', 'bharata', 'hanuman']);
  });

  it('CycleHero_OntoHeroHeldByAnotherSeat_Should_SwapHeroes', () => {
    const seats = cycleHero(defaultSeats(), 0, 1); // rama -> lakshmana (seat 2)
    expect(seats[0]?.hero).toBe('lakshmana');
    expect(seats[1]?.hero).toBe('rama');
  });

  it('CycleHero_PastEnd_Should_WrapAround', () => {
    const back = cycleHero(defaultSeats(), 0, -1); // rama is first -> sita, the last
    expect(back[0]?.hero).toBe('sita');
    const forward = cycleHero(back, 0, 1); // sita -> rama
    expect(forward[0]?.hero).toBe('rama');
  });

  it('CycleHero_WithDefaultName_Should_FollowHeroLabel', () => {
    const seats = cycleHero(defaultSeats(), 0, 1);
    expect(seats[0]?.name).toBe('Lakshmana');
    expect(seats[1]?.name).toBe('Rama');
  });

  it('CycleHero_WithCustomName_Should_KeepName', () => {
    const seats = cycleHero(setName(defaultSeats(), 0, 'Asha'), 0, 1);
    expect(seats[0]?.name).toBe('Asha');
  });

  it('CanStart_WithOneNonEmptySeat_Should_BeFalse', () => {
    let seats = setController(defaultSeats(), 1, 'empty');
    seats = setController(seats, 2, 'empty');
    seats = setController(seats, 3, 'empty');
    expect(canStart(seats)).toBe(false);
  });

  it('CanStart_WithTwoNonEmptySeats_Should_BeTrue', () => {
    let seats = setController(defaultSeats(), 2, 'empty');
    seats = setController(seats, 3, 'empty');
    expect(canStart(seats)).toBe(true);
    expect(canStart(defaultSeats())).toBe(true);
  });

  it('ToGameConfig_Should_SkipEmptySeatsAndKeepOrder', () => {
    let seats = setController(defaultSeats(), 0, 'empty');
    seats = setController(seats, 3, 'human');
    const config = toGameConfig(seats, 'hard');
    expect(config.level).toBe('hard');
    expect(config.playOn).toBe(false);
    expect(config.players.map((p) => [p.hero, p.controller])).toEqual([
      ['lakshmana', 'bot'],
      ['bharata', 'bot'],
      ['shatrughna', 'human'],
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

describe('Hero names follow the language', () => {
  it('DefaultSeats_InHindi_Should_UseHindiHeroNames', () => {
    setLocale('hi');
    try {
      expect(defaultSeats().map((s) => s.name)).toEqual(['राम', 'लक्ष्मण', 'भरत', 'शत्रुघ्न']);
    } finally {
      setLocale('en');
    }
  });

  it('CycleHero_DefaultNameInHindi_Should_FollowTheHero', () => {
    setLocale('hi');
    try {
      const seats = cycleHero(defaultSeats(), 3, 1); // Shatrughna -> Hanuman
      expect(seats[3]).toMatchObject({ hero: 'hanuman', name: 'हनुमान' });
    } finally {
      setLocale('en');
    }
  });
});

/** Defined by vite.config.ts from public/models/heroes. */
declare const __HERO_MODELS__: readonly string[];

describe('Hero models shipped (T46)', () => {
  it('HeroModels_Should_ListExactlyTheGlbsInPublicModelsHeroes', () => {
    const onDisk = readdirSync('public/models/heroes')
      .filter((file) => file.endsWith('.glb'))
      .map((file) => file.replace(/\.glb$/, ''))
      .sort();
    const listed: string[] = [...__HERO_MODELS__].sort();
    expect(listed).toEqual(onDisk);
    expect(listed).toContain('rama');
  });
});
