import { describe, expect, it } from 'vitest';
import * as node from '../scripts/art/iso-board.mjs';
import * as nodeWorld from '../scripts/art/iso/world.mjs';
import camera from '../src/game/iso/camera.json';
import { boxCorners } from '../src/game/iso/isoKit';
import {
  boardProjection,
  depthKey,
  squareScreen,
  squareWorld,
  toScreen,
  worldOffsetScreen,
} from '../src/game/iso/boardIso';
import * as world from '../src/game/iso/world';
import { BOARD, gridOf, squareCenter } from '../src/game/layout';

const squares = Array.from({ length: 144 }, (_, i) => i + 1);
const { rect } = camera;
const inside = (p: { x: number; y: number }) =>
  p.x >= rect.x && p.x <= rect.x + rect.width && p.y >= rect.y && p.y <= rect.y + rect.height;
const SPEC_HALF_PIXEL = 0.5;
const nearSpec = (actual: { x: number; y: number }, x: number, y: number) =>
  Math.abs(actual.x - x) <= SPEC_HALF_PIXEL && Math.abs(actual.y - y) <= SPEC_HALF_PIXEL;

describe('squareScreen', () => {
  it('Squares1And144_Should_BeInsideTheScreenRect', () => {
    expect(inside(squareScreen(1))).toBe(true);
    expect(inside(squareScreen(144))).toBe(true);
  });

  it('AllSquares_Should_BeInsideTheScreenRect', () => {
    expect(squares.every((n) => inside(squareScreen(n)))).toBe(true);
  });

  it('Square1_Should_MatchSpecWithinHalfPixel', () => {
    expect(nearSpec(squareScreen(1), 65.1, 418.8)).toBe(true);
  });

  it('Square12_Should_MatchSpecWithinHalfPixel', () => {
    expect(nearSpec(squareScreen(12), 449.6, 625.0)).toBe(true);
  });

  it('Square133_Should_MatchSpecWithinHalfPixel', () => {
    expect(nearSpec(squareScreen(133), 718.9, 330.4)).toBe(true);
  });

  it('Square144_Should_MatchSpecWithinHalfPixel', () => {
    expect(nearSpec(squareScreen(144), 334.4, 124.2)).toBe(true);
  });

  it('Square1_Should_BeNearerTheViewerThanSquare144', () => {
    expect(depthKey(squareWorld(1))).toBeGreaterThan(depthKey(squareWorld(144)));
  });

  it('AdjacentSquares_Should_BeOneCellApartInWorldUnits', () => {
    for (const n of squares.slice(0, -1)) {
      const [ax, ay] = squareWorld(n);
      const [bx, by] = squareWorld(n + 1);
      expect(Math.hypot(bx - ax, by - ay)).toBeCloseTo(world.CELL);
    }
  });

  it('SquareWorld_AllSquares_Should_SitAtTopZ', () => {
    expect(squares.every((n) => squareWorld(n)[2] === world.TOP_Z)).toBe(true);
  });

  it('WorldOffsetScreen_ZeroOffset_Should_EqualSquareScreen', () => {
    expect(worldOffsetScreen(30, 0, 0)).toEqual(squareScreen(30));
  });
});

describe('boardProjection fit', () => {
  it('PlinthBox_Should_FitInsideTheScreenRectWithPad', () => {
    const corners = boxCorners(
      { x: -world.RIM, y: -world.RIM, w: world.SIZE + 2 * world.RIM, d: world.SIZE + 2 * world.RIM, r: 0 },
      -(world.BASE_H + world.FOOT_H),
      world.TOP_Z + world.HEADROOM,
    );
    const screens = corners.map(toScreen);
    const pad = camera.pad;
    expect(Math.min(...screens.map((s) => s.x))).toBeCloseTo(rect.x + pad, 0);
    expect(Math.max(...screens.map((s) => s.x))).toBeCloseTo(rect.x + rect.width - pad, 0);
    expect(Math.min(...screens.map((s) => s.y))).toBeGreaterThanOrEqual(rect.y + pad - 1e-9);
    expect(Math.max(...screens.map((s) => s.y))).toBeLessThanOrEqual(rect.y + rect.height - pad + 1e-9);
  });

  it('BoardProjection_Should_UseTheSpecCameraAngles', () => {
    expect(boardProjection().azimuth).toBe(55);
    expect(boardProjection().elevation).toBe(50);
  });
});

describe('FAN_WORLD', () => {
  it('FanOffsets_AllCounts_Should_KeepPedestalsInsideTheStandingField', () => {
    const pedestal = 7;
    for (const count of [1, 2, 3, 4] as const) {
      for (const [dx, dy] of world.FAN_WORLD[count]) {
        expect(Math.abs(dx) + pedestal).toBeLessThanOrEqual(16);
        expect(Math.abs(dy) + pedestal).toBeLessThanOrEqual(13);
      }
    }
  });

  it('FanOffsets_Count3_Should_HaveThreeDistinctSpots', () => {
    expect(new Set(world.FAN_WORLD[3].map((p) => JSON.stringify(p))).size).toBe(3);
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

  it('WorldConstants_Should_MatchBetweenNodeAndTypeScript', () => {
    const names = [
      'CELL',
      'SIZE',
      'RIM',
      'BASE_H',
      'FOOT_H',
      'FIELD_Z',
      'TOP_Z',
      'RIM_Z',
      'SILL_D',
      'FIELD_C_OFFSET',
      'FIG_H',
      'HEADROOM',
      'FAN_WORLD',
    ] as const;
    for (const name of names) {
      expect(nodeWorld[name]).toEqual(world[name]);
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
