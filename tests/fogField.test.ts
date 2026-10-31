import { describe, expect, it } from 'vitest';
import { FogField, REVEAL_MS, REVEAL_MS_FAST, easeOutQuad } from '../src/app/board3d/fogField';

/** A field that has seen square 1 revealed, then `extra` revealed at t = 1000. */
function revealedAt1000(extra: number, duration: number): FogField {
  const fog = new FogField();
  fog.update(new Set([1]), 0, duration);
  fog.update(new Set([1, extra]), 1000, duration);
  return fog;
}

describe('fog field (spec 3)', () => {
  it('AFreshBoard_Should_HideEverySquareExceptTheRevealedOnes', () => {
    const fog = new FogField();
    fog.update(new Set([1, 144]), 0, REVEAL_MS);
    expect(fog.values[1]).toBe(0);
    expect(fog.values[144]).toBe(0);
    expect(fog.values[2]).toBe(1);
  });
  it('ResumingFromASave_Should_ApplyTheStateAtFrameZeroWithoutAnimation', () => {
    const fog = new FogField();
    fog.snap(new Set([5, 6, 7]));
    expect(fog.values[6]).toBe(0);
    expect(fog.update(new Set([5, 6, 7]), 1000, REVEAL_MS)).toBe(false);
  });
  it('ANewlyRevealedSquare_Should_BeClearAfterFourHundredTwentyMs', () => {
    const fog = revealedAt1000(9, REVEAL_MS);
    fog.update(new Set([1, 9]), 1000 + REVEAL_MS, REVEAL_MS);
    expect(fog.values[9]).toBe(0);
  });
  it('ANewlyRevealedSquare_Should_EaseOutNotJumpLinearly', () => {
    const fog = revealedAt1000(9, REVEAL_MS);
    fog.update(new Set([1, 9]), 1000 + REVEAL_MS / 2, REVEAL_MS);
    // Quad.easeOut at half time covers 75 % of the way, so 25 % of the fog is left
    expect(fog.values[9]).toBeCloseTo(0.25, 5);
  });
  it('FastMode_Should_ClearTheFogInOneHundredTwentyMs', () => {
    const fog = revealedAt1000(9, REVEAL_MS_FAST);
    fog.update(new Set([1, 9]), 1000 + REVEAL_MS_FAST, REVEAL_MS_FAST);
    expect(fog.values[9]).toBe(0);
  });
  it('ReducedMotion_Should_ClearTheFogInTheSameFrame', () => {
    expect(revealedAt1000(9, 0).values[9]).toBe(0);
  });
  it('EaseOutQuad_Should_RunFromZeroToOneWithoutOvershoot', () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(1)).toBe(1);
    expect(easeOutQuad(2)).toBe(1);
    expect(easeOutQuad(0.5)).toBeCloseTo(0.75);
  });
});
