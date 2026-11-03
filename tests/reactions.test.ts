// T05 sections 3 and 5 as data, for all six heroes (T46): every hero x role x event has a reaction, and the
// restrained heroes (Rama, Sita, Bharata) never use a comic tween or the scared face.
import { describe, expect, it } from 'vitest';
import table from '../src/characters/reactions.json';
import { reactionFor, type ReactionEvent, type Role, type TweenName } from '../src/characters/reactions';
import { HERO_ORDER } from '../src/game/heroes';

const ROLES: readonly Role[] = ['self', 'other'];
const EVENTS: readonly ReactionEvent[] = [
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
const EMOTIONS = ['idle', 'happy', 'excited', 'scared', 'sad'];
const TWEENS: readonly TweenName[] = [
  'none',
  'bounce',
  'leap',
  'somersault',
  'cower',
  'shake',
  'slump',
  'nod',
  'clap',
  'stomp',
  'fidget',
  'bless',
  'salute',
  'sigh',
];
const RESTRAINED = ['rama', 'sita', 'bharata'] as const;
const FORBIDDEN_FOR_RESTRAINED: readonly TweenName[] = ['somersault', 'slump', 'cower', 'stomp', 'fidget', 'shake'];

describe('Reaction table (T05, T46)', () => {
  it('Table_Should_HaveExactlyTheSixHeroesAndTiming', () => {
    expect(Object.keys(table).sort()).toEqual([...HERO_ORDER, 'timing'].sort());
  });

  it('Reaction_(EveryHeroRoleEvent)_Should_BeAValidEntry', () => {
    let checked = 0;
    for (const hero of HERO_ORDER) {
      for (const role of ROLES) {
        expect(Object.keys(table[hero][role]).sort(), `${hero}.${role}`).toEqual([...EVENTS].sort());
        for (const event of EVENTS) {
          const reaction = reactionFor(hero, role, event);
          const key = `${hero}.${role}.${event}`;
          expect(EMOTIONS, key).toContain(reaction.emotion);
          expect(TWEENS, key).toContain(reaction.tween);
          expect(reaction.intensity, key).toBeGreaterThanOrEqual(0);
          expect(reaction.intensity, key).toBeLessThanOrEqual(1);
          expect(Number.isInteger(reaction.durationMs) && reaction.durationMs > 0, key).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBe(6 * 2 * 12);
  });

  it('Reaction_(RestrainedHeroes)_Should_NeverUseAComicTweenOrTheScaredFace', () => {
    for (const hero of RESTRAINED) {
      for (const role of ROLES) {
        for (const event of EVENTS) {
          const reaction = reactionFor(hero, role, event);
          const key = `${hero}.${role}.${event}`;
          expect(FORBIDDEN_FOR_RESTRAINED, key).not.toContain(reaction.tween);
          expect(reaction.emotion, key).not.toBe('scared');
          expect(reaction.intensity, key).toBeLessThanOrEqual(0.9);
        }
      }
    }
  });
});
