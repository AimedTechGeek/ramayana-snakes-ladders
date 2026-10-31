import { describe, expect, it } from 'vitest';
import { boardFor, LEVELS } from '../src/core/boards';
import easyMeta from '../public/assets/iso/snakes-easy.meta.json';
import mediumMeta from '../public/assets/iso/snakes-medium.meta.json';
import hardMeta from '../public/assets/iso/snakes-hard.meta.json';
import {
  blendColor,
  headPoint,
  headSide,
  headTurn,
  MAX_TURN_DEG,
  snakeEntry,
  snakeTimeline,
  toLogical,
  type SnakeSheetEntry,
} from '../src/game/board/snakePlan';
import type { Level } from '../src/core/types';

const METAS: Record<Level, { snakes: Record<string, SnakeSheetEntry> }> = {
  easy: easyMeta as never,
  medium: mediumMeta as never,
  hard: hardMeta as never,
};

describe('snake bite timeline', () => {
  it('Bite_OnFirstRevealNormalSpeed_Should_FollowTheSpec54StepTimes', () => {
    const { steps, total } = snakeTimeline(false);
    expect(steps.rise).toEqual({ start: 0, end: 380 });
    expect(steps.hold).toEqual({ start: 380, end: 640 });
    expect(steps.strike).toEqual({ start: 640, end: 820 });
    expect(steps.swallow).toEqual({ start: 820, end: 1140 });
    expect(steps.pan).toEqual({ start: 1140, end: 1560 });
    expect(steps.reappear).toEqual({ start: 1560, end: 1820 });
    expect(total).toBe(1820);
  });

  it('Bite_AlreadyRevealed_Should_SkipTheRiseOnly', () => {
    const first = snakeTimeline(false, true);
    const later = snakeTimeline(false, false);
    expect(later.steps.rise).toEqual({ start: 0, end: 0 });
    expect(later.total).toBe(first.total - 380);
  });

  it('Bite_InFastMode_Should_TakeAboutHalfASecond', () => {
    const { total } = snakeTimeline(true);
    expect(total).toBe(480);
    expect(total).toBeGreaterThan(450);
    expect(total).toBeLessThan(550);
  });

  it.each([false, true])('Token_(fast %s)_Should_BeInTheSnakeFromSwallowToReappear', (fast) => {
    const { steps, tokenInSnake, tokenInvisible } = snakeTimeline(fast);
    expect(tokenInSnake).toEqual({ start: steps.swallow.start, end: steps.reappear.start });
    expect(tokenInvisible).toEqual({ start: steps.swallow.end, end: steps.reappear.start });
    expect(tokenInvisible.start).toBeGreaterThanOrEqual(tokenInSnake.start);
  });

  it('Pan_StartsAtTheEndOfTheSwallow_And_TheHeadRestoreRunsBesideIt', () => {
    const { steps } = snakeTimeline(false);
    expect(steps.pan.start).toBe(steps.swallow.end);
    expect(steps.restore).toEqual({ start: steps.swallow.end, end: steps.swallow.end + 220 });
    expect(steps.restore.end).toBeLessThanOrEqual(steps.reappear.start);
  });

  it.each([false, true])('Steps_(fast %s)_Should_RunInOrderWithoutOverlap', (fast) => {
    const { steps } = snakeTimeline(fast);
    const order = [steps.rise, steps.hold, steps.strike, steps.swallow, steps.pan, steps.reappear];
    order.forEach((span, i) => {
      expect(span.end).toBeGreaterThanOrEqual(span.start);
      if (i > 0) expect(span.start).toBe(order[i - 1]!.end);
    });
  });
});

describe('snake sheet lookups', () => {
  it.each(LEVELS)('Every_Snake_Of_%s_Should_HaveASheetEntryWithThreeNeckPoints', (level) => {
    for (const jump of boardFor(level).snakes) {
      const entry = snakeEntry(METAS[level], jump.id);
      expect(entry.head.neck).toHaveLength(3);
      expect(entry.head.closed).toBe(`${jump.id}.head.closed`);
    }
  });

  it('SnakeEntry_ForAnUnknownId_Should_Throw', () => {
    expect(() => snakeEntry(METAS.easy, 'nobody')).toThrow(/no snake/);
  });

  it('ToLogical_AtFactorFive_Should_DivideDevicePixels', () => {
    expect(toLogical([-31.18, -74.21], 5)).toEqual({ x: -31.18 / 5, y: -74.21 / 5 });
  });
});

describe('head placement', () => {
  const pivot = { x: 100, y: 100 };

  it('HeadSide_TokenRightOfThePivot_Should_FaceRight', () => {
    expect(headSide(pivot, { x: 108, y: 140 })).toBe(1);
  });

  it('HeadSide_TokenClearlyLeftOfThePivot_Should_Mirror', () => {
    expect(headSide(pivot, { x: 80, y: 140 })).toBe(-1);
  });

  it('HeadTurn_TokenFarOffAxis_Should_NeverTurnMoreThanTheTasteLimit', () => {
    const turn = headTurn(pivot, { x: 10, y: 0 }, 1, { x: 100, y: 400 });
    expect(Math.abs(turn)).toBeLessThanOrEqual(MAX_TURN_DEG);
  });

  it('HeadPoint_MirroredHead_Should_PutTheMouthOnTheLeft', () => {
    const mouth = headPoint(pivot, { x: 10, y: -1 }, -1, 0);
    expect(mouth.x).toBeCloseTo(90);
    expect(mouth.y).toBeCloseTo(99);
  });

  it('HeadPoint_RotatedNinetyDegrees_Should_PointTheMouthDown', () => {
    const mouth = headPoint(pivot, { x: 10, y: 0 }, 1, 90);
    expect(mouth.x).toBeCloseTo(100);
    expect(mouth.y).toBeCloseTo(110);
  });
});

describe('tint blend', () => {
  it('BlendColor_Halfway_Should_AverageEachChannel', () => {
    expect(blendColor(0x000000, 0xff8040, 0.5)).toBe(0x804020);
  });
});
