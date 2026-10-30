import { describe, expect, it } from 'vitest';
import { squareScreen } from '../src/game/iso/boardIso';
import { fieldCentre } from '../src/game/iso/jumps';
import {
  HOP_HEIGHT,
  hopPoint,
  restingSpot,
  SHADOW_DEPTH,
  TOKEN_DEPTH_BASE,
  worldPose,
} from '../src/game/iso/tokenPose';
import { FAN_WORLD, TOP_Z } from '../src/game/iso/world';

const squares = Array.from({ length: 144 }, (_, i) => i + 1);

describe('restingSpot', () => {
  it('SingleToken_Should_StandOnTheFieldCentreOfItsTile', () => {
    for (const square of squares) {
      expect(restingSpot(square, 0, 1)).toEqual([...fieldCentre(square)]);
    }
  });

  it('SingleToken_Should_LandWithinHalfATileOfTheTileCentreOnScreen', () => {
    for (const square of squares) {
      const [x, y] = restingSpot(square, 0, 1);
      const feet = worldPose(x, y).feet;
      const tile = squareScreen(square);
      expect(Math.hypot(feet.x - tile.x, feet.y - tile.y), `square ${square}`).toBeLessThan(10);
    }
  });

  it('TokensSharingASquare_Should_FanToTheWorldOffsetsOfTheirSlots', () => {
    for (const count of [1, 2, 3, 4] as const) {
      const [cx, cy] = fieldCentre(40);
      FAN_WORLD[count].forEach(([dx, dy], slot) => {
        expect(restingSpot(40, slot, count)).toEqual([cx + dx, cy + dy]);
      });
    }
  });

  it('FourTokensOnOneSquare_Should_RestAtFourDistinctDepths', () => {
    const depths = [0, 1, 2, 3].map((slot) => {
      const [x, y] = restingSpot(70, slot, 4);
      return worldPose(x, y).depth;
    });
    expect(new Set(depths).size).toBe(4);
  });

  it('TokenNearerTheViewerOnTheSameSquare_Should_DrawInFront', () => {
    const [bx, by] = restingSpot(70, 0, 4);
    const [fx, fy] = restingSpot(70, 2, 4);
    // Slot 2 sits further toward the viewer (larger world y) than slot 0.
    expect(fy).toBeGreaterThan(by);
    expect(worldPose(fx, fy).depth).toBeGreaterThan(worldPose(bx, by).depth);
  });
});

describe('worldPose', () => {
  it('EveryToken_Should_DrawAboveTheBoardAndItsShadow', () => {
    for (const square of squares) {
      const [x, y] = restingSpot(square, 0, 1);
      const { depth } = worldPose(x, y);
      expect(depth).toBeGreaterThan(TOKEN_DEPTH_BASE);
      expect(depth).toBeGreaterThan(SHADOW_DEPTH);
    }
  });

  it('TokenFurtherUpTheBoard_Should_DrawBehindATokenNearerTheViewer', () => {
    const [nx, ny] = restingSpot(12, 0, 1); // near corner
    const [fx, fy] = restingSpot(144, 0, 1); // far corner
    expect(worldPose(fx, fy).depth).toBeLessThan(worldPose(nx, ny).depth);
  });

  it('AirborneToken_Should_KeepItsShadowOnTheTileAndRiseOnScreen', () => {
    const [x, y] = restingSpot(5, 0, 1);
    const flat = worldPose(x, y);
    const air = worldPose(x, y, TOP_Z + HOP_HEIGHT);
    expect(air.ground).toEqual(flat.ground);
    expect(air.feet.y).toBeLessThan(flat.feet.y);
    expect(air.lift).toBeCloseTo(1, 9);
    expect(flat.lift).toBe(0);
  });
});

describe('hopPoint', () => {
  const from = restingSpot(5, 0, 1);
  const to = restingSpot(6, 0, 1);

  it('Hop_Should_StartOnTheFromSpotAndLandOnTheToSpotAtTileHeight', () => {
    expect(hopPoint(from, to, 0)).toEqual([from[0], from[1], TOP_Z]);
    const [x, y, z] = hopPoint(from, to, 1);
    expect(x).toBeCloseTo(to[0], 9);
    expect(y).toBeCloseTo(to[1], 9);
    expect(z).toBeCloseTo(TOP_Z, 9);
  });

  it('Hop_Should_RiseFourteenUnitsAtItsApex', () => {
    expect(hopPoint(from, to, 0.5)[2]).toBeCloseTo(TOP_Z + HOP_HEIGHT, 9);
  });

  it('Hop_Should_NeverGoBelowTheTile', () => {
    for (let u = 0; u <= 1; u += 0.05) expect(hopPoint(from, to, u)[2]).toBeGreaterThanOrEqual(TOP_Z - 1e-9);
  });
});
