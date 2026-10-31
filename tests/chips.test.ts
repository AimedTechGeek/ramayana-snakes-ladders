import { describe, expect, it } from 'vitest';
import { ATLAS_GRID, chipCell, chipScale, chipUvOrigin } from '../src/app/board3d/chips';

describe('chip scale (spec 2.8)', () => {
  it('Close_Should_NeverShrinkBelowOne', () => expect(chipScale(3)).toBe(1));
  it('AtTenUnits_Should_BeOne', () => expect(chipScale(10)).toBe(1));
  it('AtFitDistance_Should_GrowWithDistance', () => expect(chipScale(19)).toBeCloseTo(1.9));
  it('Far_Should_CapAtTwoAndAHalf', () => expect(chipScale(60)).toBe(2.5));
});

describe('chip atlas layout', () => {
  it('Square1_Should_BeTheTopLeftCell', () => expect(chipCell(1)).toEqual({ column: 0, row: 0 }));
  it('Square144_Should_BeTheBottomRightCell', () =>
    expect(chipCell(144)).toEqual({ column: ATLAS_GRID - 1, row: ATLAS_GRID - 1 }));
  it('EverySquare_Should_HaveItsOwnCell', () => {
    const cells = new Set(Array.from({ length: 144 }, (_, i) => JSON.stringify(chipCell(i + 1))));
    expect(cells.size).toBe(144);
  });
  it('TheTopRow_Should_HaveTheHighestV', () => {
    expect(chipUvOrigin(1)[1]).toBeCloseTo(1 - 1 / ATLAS_GRID);
    expect(chipUvOrigin(144)[1]).toBeCloseTo(0);
  });
});
