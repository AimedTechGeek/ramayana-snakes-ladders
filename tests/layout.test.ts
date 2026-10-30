import { describe, expect, it } from 'vitest';
import { BOARD, rowOf, squareCenter } from '../src/game/layout';

const half = BOARD.cell / 2;
const bottom = BOARD.y + BOARD.size - half;
const left = BOARD.x + half;
const right = BOARD.x + BOARD.size - half;

describe('squareCenter', () => {
  it('Square1_Should_BeBottomLeft', () => {
    expect(squareCenter(1)).toEqual({ x: left, y: bottom });
  });

  it('Square12_Should_BeBottomRight', () => {
    expect(squareCenter(12)).toEqual({ x: right, y: bottom });
  });

  it('Square13_Should_SitDirectlyAbove12_Boustrophedon', () => {
    expect(squareCenter(13)).toEqual({ x: right, y: bottom - BOARD.cell });
  });

  it('Square144_Should_BeTopLeft', () => {
    expect(squareCenter(144)).toEqual({ x: left, y: BOARD.y + half });
  });

  it('EverySquare_Should_HaveAUniqueCell', () => {
    const cells = new Set(Array.from({ length: 144 }, (_, i) => JSON.stringify(squareCenter(i + 1))));
    expect(cells.size).toBe(144);
  });
});

describe('rowOf', () => {
  it('RowOf_Should_MapTwelveSquaresPerRow', () => {
    expect([rowOf(1), rowOf(12), rowOf(13), rowOf(144)]).toEqual([0, 0, 1, 11]);
  });
});
