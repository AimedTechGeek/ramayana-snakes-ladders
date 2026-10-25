import { beforeEach, describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import { registerLocale, setLocale, speech, t } from '../src/i18n/i18n';

const HEROES = ['rama', 'sita', 'lakshmana', 'hanuman'];
const ROLES = ['self', 'other'] as const;
const EVENTS = [
  'roll6',
  'ladder',
  'ladderBig',
  'snake',
  'snakeBig',
  'overtake',
  'overtaken',
  'nearMiss',
  'waiting',
  'tripleSix',
  'win',
  'lose',
];

describe('i18n', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('T_KnownKey_Should_ReturnEnglish', () => {
    expect(t('ui.play')).toBe('Play');
  });

  it('T_WithParams_Should_Interpolate', () => {
    expect(t('ui.seat', { n: 3 })).toBe('Seat 3');
  });

  it('T_MissingInHindi_Should_FallBackToEnglish', () => {
    registerLocale('hi', { 'ui.play': 'खेलें' });
    setLocale('hi');

    expect(t('ui.play')).toBe('खेलें');
    expect(t('ui.menu')).toBe('Menu');
  });

  it('T_UnknownKey_Should_ReturnKey', () => {
    expect(t('ui.doesNotExist')).toBe('ui.doesNotExist');
  });

  it('Speech_Should_ReturnOneOfTheLines', () => {
    const lines = en['rama.self.roll6'];
    expect(Array.isArray(lines)).toBe(true);
    const pool = lines as string[];
    expect(pool).toContain(speech('rama', 'self', 'roll6', () => 0));
    expect(pool).toContain(speech('rama', 'self', 'roll6', () => 0.999));
  });

  it('Speech_EveryHeroRoleEvent_Should_HaveLines', () => {
    for (const hero of HEROES) {
      for (const role of ROLES) {
        for (const event of EVENTS) {
          expect(
            speech(hero, role, event, () => 0),
            `${hero}.${role}.${event}`,
          ).not.toBeNull();
        }
      }
    }
  });
});
