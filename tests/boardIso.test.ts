import { describe, expect, it } from 'vitest';
import * as node from '../scripts/art/iso-board.mjs';
import camera from '../src/game/iso/camera.json';
import {
  boardProjection,
  depthKey,
  squareScreen,
  squareWorld,
  toScreen,
  worldOffsetScreen,
} from '../src/game/iso/boardIso';
import { BOARD, gridOf, squareCenter } from '../src/game/layout';

const squares = Array.from({ length: 144 }, (_, i) => i + 1);
const { rect } = camera;
const inside = (p: { x: number; y: number }) =>
  p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;

describe('squareScreen', () => {
  it('Squares1And144_Should_BeInsideTheScreenRect', () => {
    expect(inside(squareScreen(1))).toBe(true);
    expect(inside(squareScreen(144))).toBe(true);
  });

  it('AllSquares_Should_BeInsideTheScreenRect', () => {
    expect(squares.every((n) => inside(squareScreen(n)))).toBe(true);
  });

  it('Square1_Should_BeNearerTheViewerThanSquare144', () => {
    expect(depthKey(squareWorld(1))).toBeGreaterThan(depthKey(squareWorld(144)));
  });

  it('AdjacentSquares_Should_BeOneCellApartInWorldUnits', () => {
    for (const n of squares.slice(0, -1)) {
      const [ax, ay] = squareWorld(n);
      const [bx, by] = squareWorld(n + 1);
      expect(Math.hypot(bx - ax, by - ay)).toBeCloseTo(camera.cell);
    }
  });

  it('WorldOffsetScreen_ZeroOffset_Should_EqualSquareScreen', () => {
    expect(worldOffsetScreen(30, 0, 0)).toEqual(squareScreen(30));
  });
});

describe('node and TypeScript projections', () => {
  it('BoardProjection_Should_MatchBetweenNodeAndTypeScript', () => {
    expect(node.boardProjection()).toEqual(boardProjection());
  });

  it('SquareScreen_AllSquares_Should_MatchBetweenNodeAndTypeScript', () => {
    for (const n of squares) {
      expect(node.squareScreen(n)).toEqual(squareScreen(n));
      expect(node.toScreen(node.squareWorld(n))).toEqual(toScreen(squareWorld(n)));
    }
  });
});

describe('gridOf', () => {
  it('SquareCenter_AllSquares_Should_FollowGridOf', () => {
    for (const n of squares) {
      const { row, column } = gridOf(n);
      expect(squareCenter(n)).toEqual({
        x: BOARD.x + column * BOARD.cell + BOARD.cell / 2,
        y: BOARD.y + BOARD.size - row * BOARD.cell - BOARD.cell / 2,
      });
    }
  });

  it('GridOf_Square13_Should_RunBackFromTheRightColumn', () => {
    expect(gridOf(13)).toEqual({ row: 1, column: 11 });
  });
});
