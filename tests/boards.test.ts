import { describe, expect, it } from 'vitest';
import { LEVELS, STORY_JUMPS, boardFor, validateLayout, type StoryJump } from '../src/core/boards';
import type { Level } from '../src/core/types';

function withChange(id: string, change: Partial<StoryJump>): StoryJump[] {
  return STORY_JUMPS.map((j) => (j.id === id ? { ...j, ...change } : j));
}

function snakeIds(level: Level): string[] {
  return boardFor(level).snakes.map((s) => s.id);
}

function ladderIds(level: Level): string[] {
  return boardFor(level).ladders.map((s) => s.id);
}

describe('boards', () => {
  it('ValidateLayout_ShippedBoards_Should_ReportNoViolations', () => {
    expect(validateLayout()).toEqual([]);
  });

  it('BoardFor_Easy_Should_Have9Ladders6Snakes', () => {
    const b = boardFor('easy');
    expect([b.ladders.length, b.snakes.length]).toEqual([9, 6]);
  });

  it('BoardFor_Medium_Should_Have7Ladders9Snakes', () => {
    const b = boardFor('medium');
    expect([b.ladders.length, b.snakes.length]).toEqual([7, 9]);
  });

  it('BoardFor_Hard_Should_Have6Ladders13Snakes', () => {
    const b = boardFor('hard');
    expect([b.ladders.length, b.snakes.length]).toEqual([6, 13]);
  });

  it('BoardFor_Hard_Should_IncludeRavanaMegaSnake', () => {
    const ravana = boardFor('hard').snakes.find((s) => s.id === 'ravana');
    expect([ravana?.from, ravana?.to]).toEqual([138, 78]);
  });

  it('BoardFor_AnyLevel_Should_SortJumpsByFromSquare', () => {
    for (const level of LEVELS) {
      const b = boardFor(level);
      for (const list of [b.ladders, b.snakes]) {
        const froms = list.map((j) => j.from);
        expect(froms).toEqual([...froms].sort((x, y) => x - y));
      }
    }
  });

  it('Snakes_OnEasierBoard_Should_AllAppearOnHarderBoards', () => {
    expect(snakeIds('hard')).toEqual(expect.arrayContaining(snakeIds('medium')));
    expect(snakeIds('medium')).toEqual(expect.arrayContaining(snakeIds('easy')));
  });

  it('Ladders_OnHarderBoard_Should_AllAppearOnEasierBoards', () => {
    expect(ladderIds('easy')).toEqual(expect.arrayContaining(ladderIds('medium')));
    expect(ladderIds('medium')).toEqual(expect.arrayContaining(ladderIds('hard')));
  });

  it('ValidateLayout_TwoJumpsOnSameStartSquare_Should_ReportViolation', () => {
    const bad = withChange('tataka', { from: 4 });
    expect(validateLayout(bad).some((v) => v.includes('same square'))).toBe(true);
  });

  it('ValidateLayout_JumpEndingOnFinalSquare_Should_ReportViolation', () => {
    const bad = withChange('vishwamitra', { to: 144 });
    expect(validateLayout(bad).some((v) => v.includes('touches square'))).toBe(true);
  });

  it('ValidateLayout_SnakeMissingFromHarderLevel_Should_ReportNestingViolation', () => {
    const bad = withChange('manthara', { levels: ['easy', 'medium'] });
    expect(validateLayout(bad).some((v) => v.includes('missing from hard'))).toBe(true);
  });
});
