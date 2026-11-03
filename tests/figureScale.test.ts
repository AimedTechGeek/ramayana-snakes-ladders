// Runtime scale of heroes and snakes (T45.2): constants, planted feet at the new stride, and the snake's mouth points.
import { describe, expect, it } from 'vitest';
import { CELL } from '../src/game/iso/world';
import { gaitFor } from '../src/game/iso/locomotion';
import { HERO_SCALE, SNAKE_SCALE } from '../src/app/board3d/figureScale';
import { scaledStride } from '../src/app/board3d/Hero';
import { phaseFromDistance } from '../src/app/board3d/heroClips';
import { SNAKE_META, mouthPoint, snakeAnchor } from '../src/app/board3d/snakeChoreo';

describe('figure scale constants', () => {
  it('Defaults_Should_ShrinkHeroesToAboutHalfAndKeepSnakesFullSize', () => {
    expect(HERO_SCALE).toBe(0.55);
    expect(SNAKE_SCALE).toBe(1); // owner decision 2026-11-04: snakes stay full size (R9 retired on the board)
  });
});

describe('hero stride at the new scale', () => {
  const walkStride = gaitFor(1, false).cycle / CELL; // the GLB's stride_m (heroGlb.test asserts the two agree)
  const runStride = gaitFor(3, false).cycle / CELL;

  it.each([
    ['walk', walkStride],
    ['run', runStride],
  ])('Stride_(%s)_Should_ShrinkWithTheHeroSoOneClipCycleIsOneRenderedStride', (_name, stride) => {
    expect(scaledStride(stride, HERO_SCALE)).toBeCloseTo(stride * HERO_SCALE, 9);
    expect(scaledStride(stride, 1)).toBe(stride);
  });

  it.each([
    ['walk', walkStride],
    ['run', runStride],
  ])('Feet_(%s)_Should_StayPlantedAtTheNewScale', (_name, stride) => {
    // A planted foot moves back relative to the body by exactly the distance the body moves forward. The clip moves a
    // foot by one GLB stride per cycle; on screen that is one GLB stride x the render scale. The phase must therefore
    // turn once per `scaledStride`: walking d units must advance the cycle by d / (stride x scale).
    const cycle = scaledStride(stride, HERO_SCALE);
    for (const walked of [0.05, 0.3, 0.77, 1, 2.5]) {
      const turns = walked / cycle;
      const footTravelOnScreen = turns * stride * HERO_SCALE; // cycles x rendered stride
      expect(footTravelOnScreen).toBeCloseTo(walked, 9);
      expect(phaseFromDistance(walked, cycle)).toBeCloseTo(turns - Math.floor(turns), 9);
    }
    // the unscaled stride would slide the feet: 1 / HERO_SCALE too fast
    const slide = (walked: number): number => (walked / stride) * stride * HERO_SCALE;
    expect(slide(1)).toBeCloseTo(HERO_SCALE, 9);
  });
});

describe('snake mouth points at the new scale', () => {
  const id = Object.keys(SNAKE_META)[0]!;
  const meta = SNAKE_META[id]!;

  it('MouthPoint_(Default)_Should_BeTheManifestOffsetTimesSnakeScaleFromTheCoil', () => {
    const anchor = snakeAnchor(37, id);
    for (const phase of ['idle', 'hold', 'strike'] as const) {
      const mouth = mouthPoint(37, id, phase);
      const offset = meta.mouth[phase];
      expect(mouth[0] - anchor[0]).toBeCloseTo(offset[0] * SNAKE_SCALE, 9);
      expect(mouth[1] - anchor[1]).toBeCloseTo(offset[1] * SNAKE_SCALE, 9);
      expect(mouth[2] - anchor[2]).toBeCloseTo(offset[2] * SNAKE_SCALE, 9);
    }
  });

  it('MouthPoint_(GrownSnake)_Should_ScaleOnTopOfSnakeScale', () => {
    const growth = 1.6;
    const anchor = snakeAnchor(37, id);
    const grown = mouthPoint(37, id, 'strike', SNAKE_SCALE * growth);
    const base = mouthPoint(37, id, 'strike');
    expect(grown[1] - anchor[1]).toBeCloseTo((base[1] - anchor[1]) * growth, 9);
  });
});
